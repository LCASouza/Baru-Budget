-- Money received from a loan increases cash but is not earned income, so it
-- leaves the monthly income totals.

create or replace view public.monthly_transaction_totals
with (security_invoker = true) as
select
  owner_user_id,
  household_id,
  (date_trunc('month', date))::date as month,
  kind,
  sum(amount) as total,
  count(*)::integer as transaction_count
from public.transactions
where status <> 'CANCELLED'
  and kind in ('INCOME', 'EXPENSE')
  and not (kind = 'INCOME' and loan_id is not null)
group by owner_user_id, household_id, date_trunc('month', date), kind;

comment on view public.monthly_transaction_totals is 'Monthly totals per owner, household and kind. Cancelled transactions, transfers and loan disbursements are excluded; pending ones are included.';
