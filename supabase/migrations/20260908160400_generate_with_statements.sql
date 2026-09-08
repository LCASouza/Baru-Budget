-- Generating and realigning now read the schedule through the composers, so an
-- observed statement reaches the transactions instead of living beside them.
--
-- The amount written is what leaves the account: instalment plus insurance plus
-- fee. The split stays available through the schedule and the statement, so the
-- ledger is right without hiding how much of the payment is interest.
--
-- The length comes from the composed schedule, not from `installment_count`: a
-- statement reporting a different number of remaining instalments changes how
-- many there are, and the contract column keeps recording what was signed.

create or replace function public.generate_financing_schedule(
  p_financing_id uuid,
  p_with_down_payment boolean default true
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  financing  public.financings;
  amounts    numeric[];
  created    integer := 0;
  competence date;
  position   integer;
begin
  select * into financing from public.financings where id = p_financing_id;
  if not found then
    raise exception 'financing % not found', p_financing_id using errcode = 'foreign_key_violation';
  end if;

  amounts := public.financing_schedule_amounts(p_financing_id);

  -- The down payment is the only expense of the acquisition. The asset value
  -- and the financed amount never become transactions.
  if p_with_down_payment and financing.down_payment > 0 then
    insert into public.transactions (
      owner_user_id, kind, description, amount, date, status,
      category_id, account_id, household_id, financing_id
    )
    values (
      financing.owner_user_id, 'EXPENSE', financing.description, financing.down_payment,
      financing.acquisition_date, 'PAID',
      coalesce(financing.down_payment_category_id, financing.category_id),
      financing.account_id, financing.household_id, financing.id
    )
    on conflict do nothing;
    if found then
      created := created + 1;
    end if;
  end if;

  for position in 1..coalesce(array_length(amounts, 1), 0) loop
    competence := public.shift_month_day(financing.first_due_date, position - 1);

    insert into public.transactions (
      owner_user_id, kind, description, amount, date, due_date, status,
      category_id, account_id, household_id, financing_id, financing_installment_number
    )
    values (
      financing.owner_user_id, 'EXPENSE', financing.description,
      amounts[position] + public.financing_charges_for(p_financing_id, position),
      competence, competence, 'PENDING',
      financing.category_id, financing.account_id, financing.household_id,
      financing.id, position
    )
    on conflict do nothing;
    if found then
      created := created + 1;
    end if;
  end loop;

  return created;
end;
$$;

create or replace function public.realign_financing_schedule(p_financing_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  financing  public.financings;
  amounts    numeric[];
  changed    integer := 0;
  competence date;
  expected   numeric;
  position   integer;
  touched    integer;
begin
  select * into financing from public.financings where id = p_financing_id;
  if not found then
    raise exception 'financing % not found', p_financing_id using errcode = 'foreign_key_violation';
  end if;

  amounts := public.financing_schedule_amounts(p_financing_id);

  for position in 1..coalesce(array_length(amounts, 1), 0) loop
    competence := public.shift_month_day(financing.first_due_date, position - 1);
    expected := amounts[position] + public.financing_charges_for(p_financing_id, position);

    update public.transactions t
       set amount = expected,
           date = competence,
           due_date = competence
     where t.financing_id = financing.id
       and t.financing_installment_number = position
       and t.status = 'PENDING'
       and (t.amount <> expected or t.date <> competence or t.due_date is distinct from competence);

    get diagnostics touched = row_count;
    changed := changed + touched;
  end loop;

  return changed;
end;
$$;

create or replace function public.generate_loan_schedule(
  p_loan_id uuid,
  p_with_disbursement boolean default true
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  loan       public.loans;
  amounts    numeric[];
  created    integer := 0;
  competence date;
  position   integer;
begin
  select * into loan from public.loans where id = p_loan_id;
  if not found then
    raise exception 'loan % not found', p_loan_id using errcode = 'foreign_key_violation';
  end if;

  amounts := public.loan_schedule_amounts(p_loan_id);

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

  for position in 1..coalesce(array_length(amounts, 1), 0) loop
    competence := public.shift_month_day(loan.first_due_date, position - 1);

    insert into public.transactions (
      owner_user_id, kind, description, amount, date, due_date, status,
      category_id, account_id, household_id, loan_id, loan_installment_number
    )
    values (
      loan.owner_user_id, 'EXPENSE', loan.description,
      amounts[position] + public.loan_charges_for(p_loan_id, position),
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

create or replace function public.realign_loan_schedule(p_loan_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  loan       public.loans;
  amounts    numeric[];
  changed    integer := 0;
  competence date;
  expected   numeric;
  position   integer;
  touched    integer;
begin
  select * into loan from public.loans where id = p_loan_id;
  if not found then
    raise exception 'loan % not found', p_loan_id using errcode = 'foreign_key_violation';
  end if;

  amounts := public.loan_schedule_amounts(p_loan_id);

  for position in 1..coalesce(array_length(amounts, 1), 0) loop
    competence := public.shift_month_day(loan.first_due_date, position - 1);
    expected := amounts[position] + public.loan_charges_for(p_loan_id, position);

    update public.transactions t
       set amount = expected,
           date = competence,
           due_date = competence
     where t.loan_id = loan.id
       and t.loan_installment_number = position
       and t.status = 'PENDING'
       and (t.amount <> expected or t.date <> competence or t.due_date is distinct from competence);

    get diagnostics touched = row_count;
    changed := changed + touched;
  end loop;

  return changed;
end;
$$;
