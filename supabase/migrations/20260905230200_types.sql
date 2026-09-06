-- Closed financial vocabularies. Context of an expense (card, fixed expense, loan,
-- financing) is never a kind; it is represented by references on transactions.

create type public.category_kind as enum ('INCOME', 'EXPENSE');

create type public.account_type as enum ('BANK', 'CASH', 'BENEFIT', 'OTHER');

create type public.transaction_kind as enum ('INCOME', 'EXPENSE', 'TRANSFER', 'SETTLEMENT');
