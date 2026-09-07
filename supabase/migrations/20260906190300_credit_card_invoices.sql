-- Invoices are derived: a group of card transactions sharing an invoice due date.
-- Purchases add to the total, payments add to the paid amount, and cancelled
-- transactions never count.

create view public.credit_card_invoices
with (security_invoker = true) as
select
  t.credit_card_id,
  t.invoice_due_date,
  sum(case when t.kind = 'EXPENSE' then t.amount else 0 end) as total,
  sum(case when t.kind = 'TRANSFER' then t.amount else 0 end) as paid,
  (count(*) filter (where t.kind = 'EXPENSE'))::integer       as purchase_count
from public.transactions t
where t.credit_card_id is not null
  and t.status = 'PAID'
group by t.credit_card_id, t.invoice_due_date;

comment on view public.credit_card_invoices is 'Derived invoice totals per card and due date. Never stored.';
