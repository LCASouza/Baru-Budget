-- Recurring templates. Fixed expenses and recurring incomes are kept apart on
-- purpose: they describe different things and never mix.

create type public.recurrence_frequency as enum ('MONTHLY', 'YEARLY');

-- Ownership checks shared by the template validation triggers.

create or replace function public.assert_owned_category(owner uuid, category uuid, expected public.category_kind)
returns void
language plpgsql
set search_path = ''
as $$
declare
  found_kind public.category_kind;
begin
  select c.kind into found_kind
    from public.categories c
   where c.id = category and c.owner_user_id = owner;
  if not found then
    raise exception 'category % does not belong to the owner', category
      using errcode = 'foreign_key_violation';
  end if;
  if found_kind <> expected then
    raise exception 'category kind % does not match %', found_kind, expected
      using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function public.assert_owned_account(owner uuid, account uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if account is not null and not exists (
    select 1 from public.accounts a where a.id = account and a.owner_user_id = owner
  ) then
    raise exception 'account % does not belong to the owner', account
      using errcode = 'foreign_key_violation';
  end if;
end;
$$;

create or replace function public.assert_owned_card(owner uuid, card uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if card is not null and not exists (
    select 1 from public.credit_cards c where c.id = card and c.owner_user_id = owner
  ) then
    raise exception 'credit card % does not belong to the owner', card
      using errcode = 'foreign_key_violation';
  end if;
end;
$$;

create or replace function public.assert_household_member(owner uuid, household uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if household is not null and not public.is_active_member(household, owner) then
    raise exception 'owner is not an active member of household %', household
      using errcode = 'foreign_key_violation';
  end if;
end;
$$;

create table public.fixed_expenses (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid not null references public.profiles (id) on delete cascade,
  description    text not null,
  category_id    uuid not null references public.categories (id) on delete restrict,
  account_id     uuid references public.accounts (id) on delete restrict,
  credit_card_id uuid references public.credit_cards (id) on delete restrict,
  household_id   uuid references public.households (id) on delete set null,
  default_amount numeric(14, 2) not null,
  due_day        integer not null,
  frequency      public.recurrence_frequency not null default 'MONTHLY',
  anchor_month   integer,
  active         boolean not null default true,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid not null default auth.uid() references public.profiles (id),
  updated_by     uuid not null default auth.uid() references public.profiles (id),
  constraint fixed_expenses_description_length check (char_length(description) between 1 and 120),
  constraint fixed_expenses_amount_positive check (default_amount > 0),
  constraint fixed_expenses_due_day_range check (due_day between 1 and 31),
  constraint fixed_expenses_notes_length check (notes is null or char_length(notes) <= 1000),
  constraint fixed_expenses_anchor_month check (
    (frequency = 'YEARLY' and anchor_month is not null and anchor_month between 1 and 12)
    or (frequency = 'MONTHLY' and anchor_month is null)
  ),
  constraint fixed_expenses_single_origin check ((account_id is null) <> (credit_card_id is null))
);

comment on table public.fixed_expenses is 'Recurring expense template. Each generated month is an ordinary transaction that can be edited without changing the template.';

create table public.recurring_incomes (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid not null references public.profiles (id) on delete cascade,
  description    text not null,
  category_id    uuid not null references public.categories (id) on delete restrict,
  account_id     uuid not null references public.accounts (id) on delete restrict,
  household_id   uuid references public.households (id) on delete set null,
  default_amount numeric(14, 2) not null,
  receipt_day    integer not null,
  frequency      public.recurrence_frequency not null default 'MONTHLY',
  anchor_month   integer,
  active         boolean not null default true,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid not null default auth.uid() references public.profiles (id),
  updated_by     uuid not null default auth.uid() references public.profiles (id),
  constraint recurring_incomes_description_length check (char_length(description) between 1 and 120),
  constraint recurring_incomes_amount_positive check (default_amount > 0),
  constraint recurring_incomes_receipt_day_range check (receipt_day between 1 and 31),
  constraint recurring_incomes_notes_length check (notes is null or char_length(notes) <= 1000),
  constraint recurring_incomes_anchor_month check (
    (frequency = 'YEARLY' and anchor_month is not null and anchor_month between 1 and 12)
    or (frequency = 'MONTHLY' and anchor_month is null)
  )
);

comment on table public.recurring_incomes is 'Recurring income template. Never mixed with fixed expenses.';

create index fixed_expenses_owner_active_idx on public.fixed_expenses (owner_user_id) where active;
create index recurring_incomes_owner_active_idx on public.recurring_incomes (owner_user_id) where active;

create or replace function public.validate_fixed_expense_references()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_owned_category(new.owner_user_id, new.category_id, 'EXPENSE');
  perform public.assert_owned_account(new.owner_user_id, new.account_id);
  perform public.assert_owned_card(new.owner_user_id, new.credit_card_id);
  perform public.assert_household_member(new.owner_user_id, new.household_id);
  return new;
end;
$$;

create or replace function public.validate_recurring_income_references()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_owned_category(new.owner_user_id, new.category_id, 'INCOME');
  perform public.assert_owned_account(new.owner_user_id, new.account_id);
  perform public.assert_household_member(new.owner_user_id, new.household_id);
  return new;
end;
$$;

alter table public.fixed_expenses enable row level security;
alter table public.recurring_incomes enable row level security;

create policy fixed_expenses_select_visible
  on public.fixed_expenses for select to authenticated
  using (public.can_view(owner_user_id));
create policy fixed_expenses_insert_manage
  on public.fixed_expenses for insert to authenticated
  with check (public.can_manage(owner_user_id));
create policy fixed_expenses_update_manage
  on public.fixed_expenses for update to authenticated
  using (public.can_manage(owner_user_id))
  with check (public.can_manage(owner_user_id));
create policy fixed_expenses_delete_manage
  on public.fixed_expenses for delete to authenticated
  using (public.can_manage(owner_user_id));

create policy recurring_incomes_select_visible
  on public.recurring_incomes for select to authenticated
  using (public.can_view(owner_user_id));
create policy recurring_incomes_insert_manage
  on public.recurring_incomes for insert to authenticated
  with check (public.can_manage(owner_user_id));
create policy recurring_incomes_update_manage
  on public.recurring_incomes for update to authenticated
  using (public.can_manage(owner_user_id))
  with check (public.can_manage(owner_user_id));
create policy recurring_incomes_delete_manage
  on public.recurring_incomes for delete to authenticated
  using (public.can_manage(owner_user_id));

create trigger fixed_expenses_set_audit_on_insert
  before insert on public.fixed_expenses
  for each row execute function public.set_audit_on_insert();
create trigger fixed_expenses_set_audit_on_update
  before update on public.fixed_expenses
  for each row execute function public.set_audit_on_update();
create trigger fixed_expenses_validate_references
  before insert or update on public.fixed_expenses
  for each row execute function public.validate_fixed_expense_references();

create trigger recurring_incomes_set_audit_on_insert
  before insert on public.recurring_incomes
  for each row execute function public.set_audit_on_insert();
create trigger recurring_incomes_set_audit_on_update
  before update on public.recurring_incomes
  for each row execute function public.set_audit_on_update();
create trigger recurring_incomes_validate_references
  before insert or update on public.recurring_incomes
  for each row execute function public.validate_recurring_income_references();

revoke execute on function public.assert_owned_category(uuid, uuid, public.category_kind) from public, anon;
revoke execute on function public.assert_owned_account(uuid, uuid) from public, anon;
revoke execute on function public.assert_owned_card(uuid, uuid) from public, anon;
revoke execute on function public.assert_household_member(uuid, uuid) from public, anon;
