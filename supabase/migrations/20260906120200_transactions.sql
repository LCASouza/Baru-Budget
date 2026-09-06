-- Financial transactions: incomes, expenses and transfers between own accounts.
-- The amount is always positive; the direction comes from kind. OVERDUE is not
-- stored: it is derived from PENDING and the due date at read time.

create type public.transaction_status as enum ('PENDING', 'PAID', 'CANCELLED');

create table public.transactions (
  id                     uuid primary key default gen_random_uuid(),
  owner_user_id          uuid not null references public.profiles (id) on delete cascade,
  kind                   public.transaction_kind not null,
  description            text not null,
  amount                 numeric(14, 2) not null,
  date                   date not null,
  due_date               date,
  status                 public.transaction_status not null default 'PAID',
  category_id            uuid references public.categories (id) on delete restrict,
  account_id             uuid not null references public.accounts (id) on delete restrict,
  destination_account_id uuid references public.accounts (id) on delete restrict,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid not null default auth.uid() references public.profiles (id),
  updated_by             uuid not null default auth.uid() references public.profiles (id),
  constraint transactions_description_length check (char_length(description) between 1 and 120),
  constraint transactions_amount_positive check (amount > 0),
  constraint transactions_notes_length check (notes is null or char_length(notes) <= 1000),
  -- SETTLEMENT is part of the vocabulary but only becomes usable with settlements.
  constraint transactions_kind_supported check (kind in ('INCOME', 'EXPENSE', 'TRANSFER')),
  -- Transfers move money between two different own accounts and have no category;
  -- incomes and expenses always have a category and no destination account.
  constraint transactions_shape check (
    (kind = 'TRANSFER'
      and category_id is null
      and destination_account_id is not null
      and destination_account_id <> account_id)
    or
    (kind <> 'TRANSFER'
      and category_id is not null
      and destination_account_id is null)
  )
);

comment on table public.transactions is 'Incomes, expenses and transfers owned by a user. Amount is positive; direction comes from kind.';
comment on column public.transactions.date is 'Financial date of the transaction (competence).';
comment on column public.transactions.due_date is 'Optional due date; a PENDING transaction past coalesce(due_date, date) is overdue.';
comment on column public.transactions.account_id is 'Account credited by INCOME and debited by EXPENSE and TRANSFER.';
comment on column public.transactions.destination_account_id is 'Account credited by a TRANSFER; null for other kinds.';

create index transactions_owner_date_idx on public.transactions (owner_user_id, date desc);
create index transactions_category_idx on public.transactions (category_id);
create index transactions_account_idx on public.transactions (account_id);
create index transactions_destination_account_idx on public.transactions (destination_account_id)
  where destination_account_id is not null;

alter table public.transactions enable row level security;

create policy transactions_select_own
  on public.transactions
  for select
  to authenticated
  using ((select auth.uid()) = owner_user_id);

create policy transactions_insert_own
  on public.transactions
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_user_id);

create policy transactions_update_own
  on public.transactions
  for update
  to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

create policy transactions_delete_own
  on public.transactions
  for delete
  to authenticated
  using ((select auth.uid()) = owner_user_id);

create trigger transactions_set_audit_on_insert
  before insert on public.transactions
  for each row execute function public.set_audit_on_insert();

create trigger transactions_set_audit_on_update
  before update on public.transactions
  for each row execute function public.set_audit_on_update();

-- Foreign keys are checked outside row level security, so a category or account
-- of another user could be referenced by id. This trigger requires every
-- referenced row to belong to the transaction owner and the category kind to
-- match the transaction kind. It runs with the caller privileges: rows hidden
-- by RLS count as missing and the statement fails closed.
create or replace function public.validate_transaction_references()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  referenced_category_kind public.category_kind;
begin
  if new.category_id is not null then
    select c.kind
      into referenced_category_kind
      from public.categories c
     where c.id = new.category_id
       and c.owner_user_id = new.owner_user_id;

    if not found then
      raise exception 'category % does not belong to the transaction owner', new.category_id
        using errcode = 'foreign_key_violation';
    end if;

    if referenced_category_kind::text <> new.kind::text then
      raise exception 'category kind % does not match transaction kind %', referenced_category_kind, new.kind
        using errcode = 'check_violation';
    end if;
  end if;

  if not exists (
    select 1 from public.accounts a
     where a.id = new.account_id
       and a.owner_user_id = new.owner_user_id
  ) then
    raise exception 'account % does not belong to the transaction owner', new.account_id
      using errcode = 'foreign_key_violation';
  end if;

  if new.destination_account_id is not null and not exists (
    select 1 from public.accounts a
     where a.id = new.destination_account_id
       and a.owner_user_id = new.owner_user_id
  ) then
    raise exception 'destination account % does not belong to the transaction owner', new.destination_account_id
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

create trigger transactions_validate_references
  before insert or update on public.transactions
  for each row execute function public.validate_transaction_references();
