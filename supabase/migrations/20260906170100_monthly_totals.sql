-- Monthly income and expense totals used by the dashboard evolution chart.
-- Runs with the caller privileges, so row level security is applied to each
-- transaction before aggregation: a grantee sums the owner transactions and a
-- household member sums only the transactions tagged with the household.

create view public.monthly_transaction_totals
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
group by owner_user_id, household_id, date_trunc('month', date), kind;

comment on view public.monthly_transaction_totals is 'Monthly totals per owner, household and kind. Cancelled transactions and transfers are excluded; pending ones are included (competence view).';
