begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', '{"display_name": "Bob"}'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol@example.com', '{"display_name": "Carol"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.accounts (id, owner_user_id, name, type, opening_balance)
values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Bank', 'BANK', 1000);
insert into public.credit_cards (id, owner_user_id, name, closing_day, due_day)
values ('cccccccc-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cartão', 20, 5);

select lives_ok(
  $$ insert into public.transactions (id, owner_user_id, kind, description, amount, date, account_id, counterparty_user_id, settlement_direction)
     values ('55555555-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'SETTLEMENT', 'Pix para Bob', 200, '2026-09-12',
             'aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'PAY') $$,
  'owner records a settlement they paid'
);
select is(
  (select current_balance from public.account_balances where account_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  800::numeric,
  'paying a settlement debits the account'
);
select lives_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, account_id, counterparty_user_id, settlement_direction)
     values ('11111111-1111-1111-1111-111111111111', 'SETTLEMENT', 'Pix de Bob', 50, '2026-09-13',
             'aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'RECEIVE') $$,
  'owner records a settlement they received'
);
select is(
  (select current_balance from public.account_balances where account_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  850::numeric,
  'receiving a settlement credits the account'
);
select is(
  (select count(*)::int from public.monthly_transaction_totals where month = '2026-09-01'),
  0,
  'a settlement is neither income nor expense'
);

-- Shape
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, counterparty_user_id, settlement_direction)
     values ('11111111-1111-1111-1111-111111111111', 'SETTLEMENT', 'Sem conta', 10, '2026-09-12', '22222222-2222-2222-2222-222222222222', 'PAY') $$,
  '23514', null, 'a settlement without an account is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, account_id, settlement_direction)
     values ('11111111-1111-1111-1111-111111111111', 'SETTLEMENT', 'Sem contraparte', 10, '2026-09-12', 'aaaaaaaa-0000-4000-8000-000000000001', 'PAY') $$,
  '23514', null, 'a settlement without a counterparty is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, account_id, counterparty_user_id)
     values ('11111111-1111-1111-1111-111111111111', 'SETTLEMENT', 'Sem direção', 10, '2026-09-12', 'aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222') $$,
  '23514', null, 'a settlement without a direction is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, account_id, counterparty_user_id, settlement_direction)
     values ('11111111-1111-1111-1111-111111111111', 'SETTLEMENT', 'Comigo mesmo', 10, '2026-09-12',
             'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'PAY') $$,
  '23514', null, 'a settlement with oneself is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, account_id, category_id, counterparty_user_id, settlement_direction)
     values ('11111111-1111-1111-1111-111111111111', 'SETTLEMENT', 'Com categoria', 10, '2026-09-12',
             'aaaaaaaa-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             '22222222-2222-2222-2222-222222222222', 'PAY') $$,
  '23514', null, 'a settlement with a category is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, credit_card_id, counterparty_user_id, settlement_direction, invoice_due_date)
     values ('11111111-1111-1111-1111-111111111111', 'SETTLEMENT', 'Com cartão', 10, '2026-09-12',
             'cccccccc-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'PAY', '2026-10-05') $$,
  '23514', null, 'a settlement on a card is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, account_id, category_id, counterparty_user_id)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Despesa com contraparte', 10, '2026-09-12',
             'aaaaaaaa-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             '22222222-2222-2222-2222-222222222222') $$,
  '23514', null, 'only a settlement carries a counterparty'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, account_id, counterparty_user_id, settlement_direction, installment_group_id, installment_number, installment_count)
     values ('11111111-1111-1111-1111-111111111111', 'SETTLEMENT', 'Parcelado', 10, '2026-09-12',
             'aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'PAY', gen_random_uuid(), 1, 2) $$,
  '23514', null, 'a settlement cannot be split into instalments'
);
select throws_ok(
  $$ insert into public.transaction_allocations (transaction_id, user_id, amount)
     values ('55555555-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333', 200) $$,
  '23514', null, 'a settlement cannot be split between people'
);

-- The counterparty sees the settlement
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.transactions where kind = 'SETTLEMENT'), 2, 'the counterparty sees the settlements that involve them');
select is((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'Alice', 'and the name of the other side');
select is((select count(*)::int from public.accounts where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'but not the account');
select lives_ok($$ update public.transactions set amount = 1 where id = '55555555-0000-4000-8000-000000000001' $$, 'their update affects no rows');

select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.transactions where kind = 'SETTLEMENT'), 0, 'an unrelated user sees no settlement');

set local role anon;
select is((select count(*)::int from public.transactions where kind = 'SETTLEMENT'), 0, 'anon sees no settlement');
reset role;

select * from finish();
rollback;
