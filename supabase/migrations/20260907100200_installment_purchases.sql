-- Consolidated view of installment purchases. Competence is the invoice due date
-- on a card and the transaction date on an account, the same criterion used to
-- order instalments and to measure the future commitment.

create view public.installment_purchases
with (security_invoker = true) as
select
  t.installment_group_id                    as id,
  t.owner_user_id,
  t.credit_card_id,
  t.account_id,
  t.category_id,
  min(t.description)                        as description,
  max(t.installment_count)                  as installment_count,
  count(*)::integer                         as recorded_count,
  sum(t.amount)                             as total_amount,
  min(coalesce(t.invoice_due_date, t.date)) as first_competence,
  max(coalesce(t.invoice_due_date, t.date)) as last_competence,
  (count(*) filter (where coalesce(t.invoice_due_date, t.date) > current_date))::integer as remaining_count,
  coalesce(sum(t.amount) filter (where coalesce(t.invoice_due_date, t.date) > current_date), 0) as remaining_amount
from public.transactions t
where t.installment_group_id is not null
  and t.status <> 'CANCELLED'
group by t.installment_group_id, t.owner_user_id, t.credit_card_id, t.account_id, t.category_id;

comment on view public.installment_purchases is 'One row per installment purchase, with the remaining instalments and amount relative to today.';
