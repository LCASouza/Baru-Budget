-- Net balance with each person, from the point of view of whoever queries it.
-- Positive means they owe the caller; negative means the caller owes them.
-- Nothing is stored: the balance is always derived.

create view public.people_balances
with (security_invoker = true) as
with entries as (
  -- The responsible person owes the payer their share.
  select t.owner_user_id as creditor, a.user_id as debtor, a.amount
    from public.transaction_allocations a
    join public.transactions t on t.id = a.transaction_id
   where t.kind = 'EXPENSE'
     and t.status <> 'CANCELLED'
     and a.user_id <> t.owner_user_id
  union all
  -- Whoever hands over the money gains credit against whoever receives it.
  select
    case when t.settlement_direction = 'PAY' then t.owner_user_id else t.counterparty_user_id end,
    case when t.settlement_direction = 'PAY' then t.counterparty_user_id else t.owner_user_id end,
    t.amount
    from public.transactions t
   where t.kind = 'SETTLEMENT'
     and t.status <> 'CANCELLED'
)
select
  case when e.creditor = auth.uid() then e.debtor else e.creditor end as counterparty_user_id,
  sum(case when e.creditor = auth.uid() then e.amount else -e.amount end) as balance
from entries e
where auth.uid() in (e.creditor, e.debtor)
group by 1;

comment on view public.people_balances is 'Net balance per person for the current user. Positive is receivable, negative is payable.';
