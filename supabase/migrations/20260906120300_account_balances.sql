-- Current balance per account: opening balance plus PAID movements. PENDING
-- transactions have not moved money yet and CANCELLED ones never do. The view
-- runs with the caller privileges so the RLS of accounts and transactions applies.

create view public.account_balances
with (security_invoker = true) as
select
  a.id as account_id,
  a.owner_user_id,
  a.opening_balance,
  a.opening_balance + coalesce(m.movement, 0) as current_balance
from public.accounts a
left join (
  select account_id, sum(delta) as movement
  from (
    select account_id,
           case when kind = 'INCOME' then amount else -amount end as delta
      from public.transactions
     where status = 'PAID'
    union all
    select destination_account_id, amount
      from public.transactions
     where status = 'PAID' and kind = 'TRANSFER'
  ) as movements
  group by account_id
) as m on m.account_id = a.id;

comment on view public.account_balances is 'Derived current balance per account (opening_balance + PAID movements). Never stored.';
