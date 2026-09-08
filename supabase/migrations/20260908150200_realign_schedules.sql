-- Editing a loan or a financing changes everything derived from the record, but
-- the instalments already generated keep the values they were created with:
-- `generate_*_schedule` only inserts what is missing. The screen then shows an
-- outstanding balance from the new record next to a total to pay from the old
-- transactions, with nothing saying they disagree.
--
-- Realigning is a separate operation on purpose. Folding it into the generate
-- functions would silently overwrite an instalment the user corrected by hand to
-- the amount actually charged, which is the very thing a ledger must not lose.
--
-- Only PENDING instalments move. A PAID one records money that already left the
-- account and a CANCELLED one records a decision; neither is a projection.

create or replace function public.realign_loan_schedule(p_loan_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  loan       public.loans;
  amounts    numeric[];
  monthly    numeric;
  changed    integer := 0;
  competence date;
  position   integer;
  touched    integer;
begin
  select * into loan from public.loans where id = p_loan_id;
  if not found then
    raise exception 'loan % not found', p_loan_id using errcode = 'foreign_key_violation';
  end if;

  monthly := public.loan_monthly_rate(loan.interest_rate, loan.interest_period, loan.interest_model);
  amounts := public.loan_installment_amounts(loan.principal, monthly, loan.installment_count, loan.interest_model);

  for position in 1..loan.installment_count loop
    competence := public.shift_month_day(loan.first_due_date, position - 1);

    update public.transactions t
       set amount = amounts[position],
           date = competence,
           due_date = competence
     where t.loan_id = loan.id
       and t.loan_installment_number = position
       and t.status = 'PENDING'
       and (t.amount <> amounts[position] or t.date <> competence or t.due_date is distinct from competence);

    get diagnostics touched = row_count;
    changed := changed + touched;
  end loop;

  return changed;
end;
$$;

comment on function public.realign_loan_schedule(uuid) is
  'Brings the pending instalments of a loan back in line with its current schedule and returns how many changed. Paid and cancelled instalments are never touched.';

create or replace function public.realign_financing_schedule(p_financing_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  financing  public.financings;
  amounts    numeric[];
  monthly    numeric;
  changed    integer := 0;
  competence date;
  position   integer;
  touched    integer;
begin
  select * into financing from public.financings where id = p_financing_id;
  if not found then
    raise exception 'financing % not found', p_financing_id using errcode = 'foreign_key_violation';
  end if;

  monthly := public.financing_monthly_rate(financing.interest_rate, financing.interest_period);
  amounts := public.financing_installment_amounts(
    financing.financed_amount, monthly, financing.installment_count, financing.system
  );

  for position in 1..financing.installment_count loop
    competence := public.shift_month_day(financing.first_due_date, position - 1);

    update public.transactions t
       set amount = amounts[position],
           date = competence,
           due_date = competence
     where t.financing_id = financing.id
       and t.financing_installment_number = position
       and t.status = 'PENDING'
       and (t.amount <> amounts[position] or t.date <> competence or t.due_date is distinct from competence);

    get diagnostics touched = row_count;
    changed := changed + touched;
  end loop;

  return changed;
end;
$$;

comment on function public.realign_financing_schedule(uuid) is
  'Brings the pending instalments of a financing back in line with its current schedule and returns how many changed. Paid and cancelled instalments are never touched.';

revoke execute on function public.realign_loan_schedule(uuid) from public, anon;
revoke execute on function public.realign_financing_schedule(uuid) from public, anon;
grant execute on function public.realign_loan_schedule(uuid) to authenticated;
grant execute on function public.realign_financing_schedule(uuid) to authenticated;
