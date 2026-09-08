-- The schedule stops being one projection over the whole contract and becomes a
-- function by parts. Each observed statement reanchors it: from that instalment
-- on, the projection restarts from the balance the lender reported and runs for
-- the number of instalments the lender still expects.
--
-- The pure math is untouched. `loan_installment_amounts` and
-- `financing_installment_amounts` keep doing what they always did, and the
-- composers below decide what to feed them and where each result belongs.

-- Instalment number a competence falls on: instalment 1 sits on the first due
-- date, and each one after it a month later.
create or replace function public.instalment_number_for(p_first_due date, p_competence date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (
    (extract(year from p_competence) - extract(year from p_first_due)) * 12
    + (extract(month from p_competence) - extract(month from p_first_due))
  )::integer + 1;
$$;

comment on function public.instalment_number_for(date, date) is 'Position in the schedule of the instalment competent for a month.';

create or replace function public.financing_schedule_amounts(p_financing_id uuid)
returns numeric[]
language plpgsql
stable
set search_path = ''
as $$
declare
  financing public.financings;
  monthly   numeric;
  amounts   numeric[];
  segment   numeric[];
  anchor    record;
  next_at   integer;
  taken     integer;
  position  integer;
begin
  select * into financing from public.financings where id = p_financing_id;
  if not found then
    raise exception 'financing % not found', p_financing_id using errcode = 'foreign_key_violation';
  end if;

  monthly := public.financing_monthly_rate(financing.interest_rate, financing.interest_period);
  amounts := array[]::numeric[];

  -- The contract is the first anchor; every statement that lands inside the
  -- schedule is another one. A statement before instalment one, or one whose
  -- competence predates the first due date, describes no instalment and is left out.
  for anchor in
    with anchors as (
      select 1 as number, financing.financed_amount as balance, financing.installment_count as count
      union all
      select public.instalment_number_for(financing.first_due_date, s.competence),
             s.outstanding_balance,
             s.remaining_count
        from public.debt_statements s
       where s.financing_id = financing.id
         and public.instalment_number_for(financing.first_due_date, s.competence) > 1
         and s.remaining_count > 0
    )
    select number, balance, count,
           lead(number) over (order by number) as next_number
      from anchors
     order by number
  loop
    next_at := coalesce(anchor.next_number, anchor.number + anchor.count);
    taken := least(next_at - anchor.number, anchor.count);
    if taken <= 0 then
      continue;
    end if;
    segment := public.financing_installment_amounts(
      anchor.balance, monthly, anchor.count, financing.system
    );
    for position in 1..taken loop
      amounts := array_append(amounts, segment[position]);
    end loop;
  end loop;

  return amounts;
end;
$$;

comment on function public.financing_schedule_amounts(uuid) is 'Instalment amounts of a financing, reanchored on every observed statement. Charges are not included.';

create or replace function public.loan_schedule_amounts(p_loan_id uuid)
returns numeric[]
language plpgsql
stable
set search_path = ''
as $$
declare
  loan     public.loans;
  monthly  numeric;
  amounts  numeric[];
  segment  numeric[];
  anchor   record;
  next_at  integer;
  taken    integer;
  position integer;
begin
  select * into loan from public.loans where id = p_loan_id;
  if not found then
    raise exception 'loan % not found', p_loan_id using errcode = 'foreign_key_violation';
  end if;

  monthly := public.loan_monthly_rate(loan.interest_rate, loan.interest_period, loan.interest_model);
  amounts := array[]::numeric[];

  for anchor in
    with anchors as (
      select 1 as number, loan.principal as balance, loan.installment_count as count
      union all
      select public.instalment_number_for(loan.first_due_date, s.competence),
             s.outstanding_balance,
             s.remaining_count
        from public.debt_statements s
       where s.loan_id = loan.id
         and public.instalment_number_for(loan.first_due_date, s.competence) > 1
         and s.remaining_count > 0
    )
    select number, balance, count,
           lead(number) over (order by number) as next_number
      from anchors
     order by number
  loop
    next_at := coalesce(anchor.next_number, anchor.number + anchor.count);
    taken := least(next_at - anchor.number, anchor.count);
    if taken <= 0 then
      continue;
    end if;
    segment := public.loan_installment_amounts(
      anchor.balance, monthly, anchor.count, loan.interest_model
    );
    for position in 1..taken loop
      amounts := array_append(amounts, segment[position]);
    end loop;
  end loop;

  return amounts;
end;
$$;

comment on function public.loan_schedule_amounts(uuid) is 'Instalment amounts of a loan, reanchored on every observed statement. Charges are not included.';

-- Charges of a competence: what the statement of that month reported, and the
-- contracted value when no statement covers it.
create or replace function public.financing_charges_for(p_financing_id uuid, p_number integer)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select s.insurance_amount + s.fee_amount
       from public.debt_statements s
       join public.financings f on f.id = s.financing_id
      where s.financing_id = p_financing_id
        and public.instalment_number_for(f.first_due_date, s.competence) = p_number),
    (select f.insurance_amount + f.fee_amount from public.financings f where f.id = p_financing_id),
    0
  );
$$;

create or replace function public.loan_charges_for(p_loan_id uuid, p_number integer)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select s.insurance_amount + s.fee_amount
       from public.debt_statements s
       join public.loans l on l.id = s.loan_id
      where s.loan_id = p_loan_id
        and public.instalment_number_for(l.first_due_date, s.competence) = p_number),
    (select l.insurance_amount + l.fee_amount from public.loans l where l.id = p_loan_id),
    0
  );
$$;

revoke execute on function public.instalment_number_for(date, date) from public, anon;
revoke execute on function public.financing_schedule_amounts(uuid) from public, anon;
revoke execute on function public.loan_schedule_amounts(uuid) from public, anon;
revoke execute on function public.financing_charges_for(uuid, integer) from public, anon;
revoke execute on function public.loan_charges_for(uuid, integer) from public, anon;
grant execute on function public.instalment_number_for(date, date) to authenticated;
grant execute on function public.financing_schedule_amounts(uuid) to authenticated;
grant execute on function public.loan_schedule_amounts(uuid) to authenticated;
grant execute on function public.financing_charges_for(uuid, integer) to authenticated;
grant execute on function public.loan_charges_for(uuid, integer) to authenticated;
