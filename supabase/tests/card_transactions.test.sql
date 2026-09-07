begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', '{"display_name": "Bob"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
insert into public.credit_cards (id, owner_user_id, name, closing_day, due_day)
values ('cccccccc-0000-4000-8000-0000000000b0', '22222222-2222-2222-2222-222222222222', 'Bob card', 10, 20);

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.credit_cards (id, owner_user_id, name, closing_day, due_day)
values ('cccccccc-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cartão', 20, 5);
insert into public.accounts (id, owner_user_id, name, type, opening_balance)
values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Bank', 'BANK', 1000);

-- Purchases get their invoice from the card rules
select lives_ok(
  $$ insert into public.transactions (id, owner_user_id, kind, description, amount, date, category_id, credit_card_id)
     values ('eeeeeeee-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Antes do fechamento', 100, '2026-09-10',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
             'cccccccc-0000-4000-8000-000000000001') $$,
  'owner records a card purchase'
);
select is(
  (select invoice_due_date from public.transactions where id = 'eeeeeeee-0000-4000-8000-000000000001'),
  '2026-10-05'::date,
  'the invoice due date is filled by the card rules'
);
select is(
  (select account_id from public.transactions where id = 'eeeeeeee-0000-4000-8000-000000000001'),
  null,
  'a card purchase has no account'
);
select lives_ok(
  $$ insert into public.transactions (id, owner_user_id, kind, description, amount, date, category_id, credit_card_id)
     values ('eeeeeeee-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Depois do fechamento', 50, '2026-09-21',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
             'cccccccc-0000-4000-8000-000000000001') $$,
  'a purchase after the closing day is accepted'
);
select is(
  (select invoice_due_date from public.transactions where id = 'eeeeeeee-0000-4000-8000-000000000002'),
  '2026-11-05'::date,
  'a purchase after the closing day falls into the next invoice'
);

-- Shape constraints
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, credit_card_id, account_id)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Conta e cartão', 10, '2026-09-10',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
             'cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001') $$,
  '23514', null, 'a transaction cannot have an account and a card at the same time'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, credit_card_id)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Sem categoria', 10, '2026-09-10', 'cccccccc-0000-4000-8000-000000000001') $$,
  '23514', null, 'a card purchase without a category is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, credit_card_id)
     values ('11111111-1111-1111-1111-111111111111', 'INCOME', 'Estorno', 10, '2026-09-10',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'INCOME' and name = 'Reembolso'),
             'cccccccc-0000-4000-8000-000000000001') $$,
  '23514', null, 'an income on a card is not accepted yet'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, credit_card_id)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Cartão alheio', 10, '2026-09-10',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
             'cccccccc-0000-4000-8000-0000000000b0') $$,
  '23503', null, 'a card of another user is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, account_id)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Sem origem', 10, '2026-09-10', null) $$,
  '23514', null, 'a transaction without account and without card is rejected'
);

-- Invoice payment
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, credit_card_id, invoice_due_date)
     values ('11111111-1111-1111-1111-111111111111', 'TRANSFER', 'Pagamento sem conta', 100, '2026-10-05', 'cccccccc-0000-4000-8000-000000000001', '2026-10-05') $$,
  '23514', null, 'an invoice payment without a source account is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, account_id, credit_card_id)
     values ('11111111-1111-1111-1111-111111111111', 'TRANSFER', 'Pagamento sem fatura', 100, '2026-10-05', 'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001') $$,
  '23514', null, 'an invoice payment without an invoice due date is rejected'
);
select lives_ok(
  $$ insert into public.transactions (id, owner_user_id, kind, description, amount, date, account_id, credit_card_id, invoice_due_date)
     values ('eeeeeeee-0000-4000-8000-00000000000f', '11111111-1111-1111-1111-111111111111', 'TRANSFER', 'Pagamento da fatura', 100, '2026-10-05',
             'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', '2026-10-05') $$,
  'owner pays an invoice from an account'
);

-- No double counting: the purchase is an expense that never moves money; the
-- payment moves money and is not an expense.
select is(
  (select current_balance from public.account_balances where account_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  900::numeric,
  'only the invoice payment debits the account'
);
select is(
  (select sum(total) from public.monthly_transaction_totals where kind = 'EXPENSE' and month = '2026-09-01'),
  150::numeric,
  'card purchases count as expenses of the purchase month'
);
select is(
  (select count(*)::int from public.monthly_transaction_totals where month = '2026-10-01'),
  0,
  'the invoice payment is not an expense'
);

-- Editing the card does not move invoices already recorded
select lives_ok($$ update public.credit_cards set closing_day = 1, due_day = 15 where id = 'cccccccc-0000-4000-8000-000000000001' $$, 'owner changes the card closing day');
select is(
  (select invoice_due_date from public.transactions where id = 'eeeeeeee-0000-4000-8000-000000000001'),
  '2026-10-05'::date,
  'the invoice of an existing purchase does not change'
);
select lives_ok(
  $$ insert into public.transactions (id, owner_user_id, kind, description, amount, date, category_id, credit_card_id)
     values ('eeeeeeee-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Nova regra', 10, '2026-09-10',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
             'cccccccc-0000-4000-8000-000000000001') $$,
  'a new purchase uses the new card rules'
);
select is(
  (select invoice_due_date from public.transactions where id = 'eeeeeeee-0000-4000-8000-000000000003'),
  '2026-10-15'::date,
  'the new purchase follows the updated closing and due days'
);

-- An explicit invoice is kept
select lives_ok(
  $$ insert into public.transactions (id, owner_user_id, kind, description, amount, date, category_id, credit_card_id, invoice_due_date)
     values ('eeeeeeee-0000-4000-8000-000000000004', '11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Fatura escolhida', 10, '2026-09-10',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
             'cccccccc-0000-4000-8000-000000000001', '2026-12-05') $$,
  'an explicit invoice due date is accepted'
);
select is(
  (select invoice_due_date from public.transactions where id = 'eeeeeeee-0000-4000-8000-000000000004'),
  '2026-12-05'::date,
  'the explicit invoice due date is kept'
);

select * from finish();
rollback;
