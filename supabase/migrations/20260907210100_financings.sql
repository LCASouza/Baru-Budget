-- Financings of assets. The asset value is never a transaction: only the down
-- payment and the instalments are, which is what keeps an acquisition from
-- being counted twice. The financed amount is generated from the other two.

create type public.financing_system as enum ('PRICE', 'SAC');

create table public.financings (
  id                uuid primary key default gen_random_uuid(),
  owner_user_id     uuid not null references public.profiles (id) on delete cascade,
  description       text not null,
  institution       text,
  account_id        uuid not null references public.accounts (id) on delete restrict,
  category_id       uuid not null references public.categories (id) on delete restrict,
  down_payment_category_id uuid references public.categories (id) on delete restrict,
  household_id      uuid references public.households (id) on delete set null,
  asset_value       numeric(14, 2) not null,
  down_payment      numeric(14, 2) not null default 0,
  financed_amount   numeric(14, 2) not null generated always as (asset_value - down_payment) stored,
  interest_rate     numeric(9, 6) not null,
  interest_period   public.interest_period not null default 'MONTHLY',
  system            public.financing_system not null,
  installment_count integer not null,
  acquisition_date  date not null,
  first_due_date    date not null,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid not null default auth.uid() references public.profiles (id),
  updated_by        uuid not null default auth.uid() references public.profiles (id),
  constraint financings_description_length check (char_length(description) between 1 and 120),
  constraint financings_institution_length check (institution is null or char_length(institution) between 1 and 80),
  constraint financings_notes_length check (notes is null or char_length(notes) <= 1000),
  constraint financings_asset_value_positive check (asset_value > 0),
  constraint financings_down_payment_range check (down_payment >= 0 and down_payment < asset_value),
  constraint financings_rate_range check (interest_rate >= 0 and interest_rate < 100),
  constraint financings_installments_range check (installment_count between 1 and 480)
);

comment on table public.financings is 'Financing of an asset. The asset value is context, not a transaction: only the down payment and the instalments are recorded.';
comment on column public.financings.financed_amount is 'Generated: asset_value - down_payment. Never written by hand, so it cannot diverge.';
comment on column public.financings.interest_rate is 'Percentage per interest_period: 1.5 means 1.5%.';
comment on column public.financings.category_id is 'Expense category of the instalments.';
comment on column public.financings.down_payment_category_id is 'Expense category of the down payment; when null the instalment category is used.';

create index financings_owner_idx on public.financings (owner_user_id);

-- Monthly rate of a financing. Both systems capitalize over the outstanding
-- balance, so a yearly rate always converts to its effective monthly equivalent.
create or replace function public.financing_monthly_rate(
  p_rate numeric,
  p_period public.interest_period
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_period = 'MONTHLY' then p_rate / 100
    else (power((1 + p_rate / 100)::double precision, 1.0 / 12) - 1)::numeric
  end;
$$;

-- Instalments in whole cents. Price is the same formula the loans already use,
-- reused instead of written twice. SAC amortizes a constant share of the
-- principal, so the instalment falls month after month.
create or replace function public.financing_installment_amounts(
  p_financed numeric,
  p_monthly_rate numeric,
  p_count integer,
  p_system public.financing_system
)
returns numeric[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  amounts         numeric[];
  amortizations   numeric[];
  principal_cents bigint;
  base_cents      bigint;
  balance         numeric;
  interest        numeric;
  position        integer;
begin
  if p_count is null or p_count < 1 then
    raise exception 'a financing needs at least one instalment' using errcode = 'check_violation';
  end if;
  if p_financed is null or p_financed <= 0 then
    raise exception 'a financing needs a positive financed amount' using errcode = 'check_violation';
  end if;

  if p_system = 'PRICE' then
    return public.loan_installment_amounts(p_financed, p_monthly_rate, p_count, 'PRICE');
  end if;

  principal_cents := round(p_financed * 100);
  base_cents := principal_cents / p_count;
  amortizations := array_fill(base_cents::numeric / 100, array[p_count]);
  amortizations[p_count] := (principal_cents - base_cents * (p_count - 1))::numeric / 100;

  amounts := array_fill(0::numeric, array[p_count]);
  balance := p_financed;
  for position in 1..p_count loop
    interest := round(balance * p_monthly_rate, 2);
    amounts[position] := amortizations[position] + interest;
    balance := balance - amortizations[position];
  end loop;

  return amounts;
end;
$$;

revoke execute on function public.financing_monthly_rate(numeric, public.interest_period) from public, anon;
revoke execute on function public.financing_installment_amounts(numeric, numeric, integer, public.financing_system) from public, anon;
grant execute on function public.financing_monthly_rate(numeric, public.interest_period) to authenticated;
grant execute on function public.financing_installment_amounts(numeric, numeric, integer, public.financing_system) to authenticated;

-- Both the instalments and the down payment leave the account, so both
-- categories are expense categories.
create or replace function public.validate_financing_references()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_owned_category(new.owner_user_id, new.category_id, 'EXPENSE');
  if new.down_payment_category_id is not null then
    perform public.assert_owned_category(new.owner_user_id, new.down_payment_category_id, 'EXPENSE');
  end if;
  perform public.assert_owned_account(new.owner_user_id, new.account_id);
  perform public.assert_household_member(new.owner_user_id, new.household_id);
  return new;
end;
$$;

revoke execute on function public.validate_financing_references() from public, anon, authenticated;

alter table public.financings enable row level security;

create policy financings_select_visible
  on public.financings for select to authenticated
  using (public.can_view(owner_user_id));
create policy financings_insert_manage
  on public.financings for insert to authenticated
  with check (public.can_manage(owner_user_id));
create policy financings_update_manage
  on public.financings for update to authenticated
  using (public.can_manage(owner_user_id))
  with check (public.can_manage(owner_user_id));
create policy financings_delete_manage
  on public.financings for delete to authenticated
  using (public.can_manage(owner_user_id));

create trigger financings_set_audit_on_insert
  before insert on public.financings
  for each row execute function public.set_audit_on_insert();
create trigger financings_set_audit_on_update
  before update on public.financings
  for each row execute function public.set_audit_on_update();
create trigger financings_validate_references
  before insert or update on public.financings
  for each row execute function public.validate_financing_references();
