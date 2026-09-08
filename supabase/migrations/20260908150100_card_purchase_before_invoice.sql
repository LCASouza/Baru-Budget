-- A card purchase always precedes the invoice that charges it: the competence
-- rule derives the invoice from the purchase date, so a purchase dated after
-- its own invoice describes something that cannot happen. Nothing refused it
-- until now, and an import carrying shifted instalment dates went straight in.
--
-- Equality is allowed. When the due day is only just past the closing day and
-- both clamp to the last day of a short month, the purchase and its invoice
-- land on the same date.
--
-- The rule covers purchases only. An invoice payment is a transfer whose date
-- is when the money moved, which may be before, on or after the due date.

alter table public.transactions add constraint transactions_card_purchase_before_invoice check (
  kind <> 'EXPENSE'
  or credit_card_id is null
  or invoice_due_date is null
  or date <= invoice_due_date
);

comment on constraint transactions_card_purchase_before_invoice on public.transactions is
  'A card purchase cannot be dated after the invoice that charges it. Invoice payments are transfers and are not covered.';
