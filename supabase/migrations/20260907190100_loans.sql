-- Loans taken. The interest model is explicit per loan and its formula never
-- changes silently. The outstanding balance is always derived, never stored.

create type public.loan_interest_model as enum ('SIMPLE', 'PRICE');
create type public.interest_period as enum ('MONTHLY', 'YEARLY');

create table public.loans (
  id                uuid primary key default gen_random_uuid(),
  owner_user_id     uuid not null references public.profiles (id) on delete cascade,
  description       text not null,
  lender            text,
  account_id        uuid not null references public.accounts (id) on delete restrict,
  category_id       uuid not null references public.categories (id) on delete restrict,
  disbursement_category_id uuid references public.categories (id) on delete restrict,
  household_id      uuid references public.households (id) on delete set null,
  principal         numeric(14, 2) not null,
  interest_rate     numeric(9, 6) not null,
  interest_period   public.interest_period not null default 'MONTHLY',
  interest_model    public.loan_interest_model not null,
  installment_count integer not null,
  start_date        date not null,
  first_due_date    date not null,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid not null default auth.uid() references public.profiles (id),
  updated_by        uuid not null default auth.uid() references public.profiles (id),
  constraint loans_description_length check (char_length(description) between 1 and 120),
  constraint loans_lender_length check (lender is null or char_length(lender) between 1 and 80),
  constraint loans_notes_length check (notes is null or char_length(notes) <= 1000),
  constraint loans_principal_positive check (principal > 0),
  constraint loans_rate_range check (interest_rate >= 0 and interest_rate < 100),
  constraint loans_installments_range check (installment_count between 1 and 480)
);

comment on table public.loans is 'Loan taken by a user. The rate is a percentage per interest_period and the model decides the formula.';
comment on column public.loans.interest_rate is 'Percentage per period: 1.5 means 1.5%.';

create index loans_owner_idx on public.loans (owner_user_id);

-- Monthly rate of a loan. The yearly conversion is proportional for simple
-- interest and effective for Price: two different conventions, both declared.
create or replace function public.loan_monthly_rate(
  p_rate numeric,
  p_period public.interest_period,
  p_model public.loan_interest_model
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_period = 'MONTHLY' then p_rate / 100
    when p_model = 'SIMPLE' then (p_rate / 100) / 12
    else (power((1 + p_rate / 100)::double precision, 1.0 / 12) - 1)::numeric
  end;
$$;

-- Instalments in whole cents. The rounding difference lands on the last one, so
-- the early instalments match what the lender charges and the schedule ends at zero.
create or replace function public.loan_installment_amounts(
  p_principal numeric,
  p_monthly_rate numeric,
  p_count integer,
  p_model public.loan_interest_model
)
returns numeric[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  amounts        numeric[];
  total_cents    bigint;
  base_cents     bigint;
  principal_cents bigint;
  base_amort     bigint;
  amortization   numeric;
  interest       numeric;
  balance        numeric;
  payment        numeric;
  position       integer;
begin
  if p_count is null or p_count < 1 then
    raise exception 'a loan needs at least one instalment' using errcode = 'check_violation';
  end if;
  if p_principal is null or p_principal <= 0 then
    raise exception 'a loan needs a positive principal' using errcode = 'check_violation';
  end if;

  if p_model = 'SIMPLE' then
    total_cents := round(p_principal * (1 + p_monthly_rate * p_count) * 100);
    base_cents := total_cents / p_count;
    amounts := array_fill(base_cents::numeric / 100, array[p_count]);
    amounts[p_count] := (total_cents - base_cents * (p_count - 1))::numeric / 100;
    return amounts;
  end if;

  if p_monthly_rate = 0 then
    principal_cents := round(p_principal * 100);
    base_amort := principal_cents / p_count;
    amounts := array_fill(base_amort::numeric / 100, array[p_count]);
    amounts[p_count] := (principal_cents - base_amort * (p_count - 1))::numeric / 100;
    return amounts;
  end if;

  payment := round(
    (p_principal::double precision * p_monthly_rate::double precision
      / (1 - power((1 + p_monthly_rate)::double precision, -p_count::double precision)))::numeric,
    2
  );

  balance := p_principal;
  amounts := array_fill(0::numeric, array[p_count]);
  for position in 1..p_count loop
    interest := round(balance * p_monthly_rate, 2);
    if position < p_count then
      amortization := payment - interest;
      amounts[position] := payment;
    else
      amortization := balance;
      amounts[position] := round(balance + interest, 2);
    end if;
    balance := balance - amortization;
  end loop;

  return amounts;
end;
$$;

revoke execute on function public.loan_monthly_rate(numeric, public.interest_period, public.loan_interest_model) from public, anon;
revoke execute on function public.loan_installment_amounts(numeric, numeric, integer, public.loan_interest_model) from public, anon;
grant execute on function public.loan_monthly_rate(numeric, public.interest_period, public.loan_interest_model) to authenticated;
grant execute on function public.loan_installment_amounts(numeric, numeric, integer, public.loan_interest_model) to authenticated;

create or replace function public.validate_loan_references()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.assert_owned_category(new.owner_user_id, new.category_id, 'EXPENSE');
  if new.disbursement_category_id is not null then
    perform public.assert_owned_category(new.owner_user_id, new.disbursement_category_id, 'INCOME');
  end if;
  perform public.assert_owned_account(new.owner_user_id, new.account_id);
  perform public.assert_household_member(new.owner_user_id, new.household_id);
  return new;
end;
$$;

alter table public.loans enable row level security;

create policy loans_select_visible
  on public.loans for select to authenticated
  using (public.can_view(owner_user_id));
create policy loans_insert_manage
  on public.loans for insert to authenticated
  with check (public.can_manage(owner_user_id));
create policy loans_update_manage
  on public.loans for update to authenticated
  using (public.can_manage(owner_user_id))
  with check (public.can_manage(owner_user_id));
create policy loans_delete_manage
  on public.loans for delete to authenticated
  using (public.can_manage(owner_user_id));

create trigger loans_set_audit_on_insert
  before insert on public.loans
  for each row execute function public.set_audit_on_insert();
create trigger loans_set_audit_on_update
  before update on public.loans
  for each row execute function public.set_audit_on_update();
create trigger loans_validate_references
  before insert or update on public.loans
  for each row execute function public.validate_loan_references();

-- The money received is an income tied to the loan; the instalments are expenses.
alter table public.transactions
  add column loan_id uuid references public.loans (id) on delete set null,
  add column loan_installment_number integer;

comment on column public.transactions.loan_id is 'Loan this transaction belongs to: the disbursement (INCOME) or one instalment (EXPENSE).';

-- A linked transaction is either the disbursement (income, no number) or one
-- instalment (expense, numbered). Deleting the loan clears the link and the
-- transactions stay as history, keeping their number.
alter table public.transactions add constraint transactions_loan_shape check (
  case
    when loan_id is not null then
      (kind = 'INCOME' and loan_installment_number is null)
      or (kind = 'EXPENSE' and loan_installment_number is not null and loan_installment_number >= 1)
    else
      loan_installment_number is null
      or (kind = 'EXPENSE' and loan_installment_number >= 1)
  end
);

create unique index transactions_loan_disbursement_key
  on public.transactions (loan_id)
  where loan_id is not null and kind = 'INCOME';

create unique index transactions_loan_installment_key
  on public.transactions (loan_id, loan_installment_number)
  where loan_installment_number is not null;

-- Creates the disbursement and the instalments that are still missing, and
-- returns how many were created. Invoker rights: row level security decides.
create or replace function public.generate_loan_schedule(
  p_loan_id uuid,
  p_with_disbursement boolean default true
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  loan        public.loans;
  amounts     numeric[];
  monthly     numeric;
  created     integer := 0;
  competence  date;
  position    integer;
begin
  select * into loan from public.loans where id = p_loan_id;
  if not found then
    raise exception 'loan % not found', p_loan_id using errcode = 'foreign_key_violation';
  end if;

  monthly := public.loan_monthly_rate(loan.interest_rate, loan.interest_period, loan.interest_model);
  amounts := public.loan_installment_amounts(loan.principal, monthly, loan.installment_count, loan.interest_model);

  -- The disbursement only exists when the loan says which income category to use.
  if p_with_disbursement and loan.disbursement_category_id is not null then
    insert into public.transactions (
      owner_user_id, kind, description, amount, date, status,
      category_id, account_id, household_id, loan_id
    )
    values (
      loan.owner_user_id, 'INCOME', loan.description, loan.principal, loan.start_date, 'PAID',
      loan.disbursement_category_id, loan.account_id, loan.household_id, loan.id
    )
    on conflict do nothing;
    if found then
      created := created + 1;
    end if;
  end if;

  for position in 1..loan.installment_count loop
    competence := public.shift_month_day(loan.first_due_date, position - 1);

    insert into public.transactions (
      owner_user_id, kind, description, amount, date, due_date, status,
      category_id, account_id, household_id, loan_id, loan_installment_number
    )
    values (
      loan.owner_user_id, 'EXPENSE', loan.description, amounts[position],
      competence, competence, 'PENDING',
      loan.category_id, loan.account_id, loan.household_id, loan.id, position
    )
    on conflict do nothing;
    if found then
      created := created + 1;
    end if;
  end loop;

  return created;
end;
$$;

revoke execute on function public.generate_loan_schedule(uuid, boolean) from public, anon;
revoke execute on function public.validate_loan_references() from public, anon, authenticated;
grant execute on function public.generate_loan_schedule(uuid, boolean) to authenticated;
