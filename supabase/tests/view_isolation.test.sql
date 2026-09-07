-- Every view runs with security_invoker, which a transversal guard already
-- checks. What that guard cannot prove is that the view actually isolates: two
-- users with the same shape of data must never see each other's rows. This file
-- proves it view by view, and fails when a view is added without a case here.

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- A view added without a case in this file fails immediately.
select set_eq(
  $$
    select c.relname::text
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
  $$,
  $$ values ('account_balances'), ('credit_card_invoices'), ('installment_purchases'),
            ('monthly_transaction_totals'), ('people_balances') $$,
  'every view in public is covered by this file'
);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', '{"display_name": "Bob"}'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol@example.com', '{"display_name": "Carol"}');

set local role authenticated;

-- Alice: an account with money, a card purchase in instalments and a split expense.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.accounts (id, owner_user_id, name, type, opening_balance)
values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Alice bank', 'BANK', 1000);
insert into public.credit_cards (id, owner_user_id, name, closing_day, due_day)
values ('aaaaaaaa-0000-4000-8000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'Alice card', 10, 20);
select public.create_installment_purchase(
  p_owner_user_id => '11111111-1111-1111-1111-111111111111',
  p_description => 'Alice compra',
  p_total_amount => 300,
  p_date => '2026-09-05',
  p_installment_count => 3,
  p_category_id => (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
  p_credit_card_id => 'aaaaaaaa-0000-4000-8000-0000000000c1'
);
insert into public.transactions (id, owner_user_id, kind, description, amount, date, category_id, account_id)
values ('aaaaaaaa-0000-4000-8000-0000000000e1', '11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Alice jantar', 200, '2026-09-05',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
        'aaaaaaaa-0000-4000-8000-000000000001');
select public.set_transaction_allocations(
  'aaaaaaaa-0000-4000-8000-0000000000e1',
  array['11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333']::uuid[],
  array[100, 100]::numeric[]
);

-- Bob: the same shape, so a leak would be visible instead of accidental.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
insert into public.accounts (id, owner_user_id, name, type, opening_balance)
values ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'Bob bank', 'BANK', 5000);
insert into public.credit_cards (id, owner_user_id, name, closing_day, due_day)
values ('bbbbbbbb-0000-4000-8000-0000000000c1', '22222222-2222-2222-2222-222222222222', 'Bob card', 10, 20);
select public.create_installment_purchase(
  p_owner_user_id => '22222222-2222-2222-2222-222222222222',
  p_description => 'Bob compra',
  p_total_amount => 600,
  p_date => '2026-09-05',
  p_installment_count => 3,
  p_category_id => (select id from public.categories where owner_user_id = '22222222-2222-2222-2222-222222222222' and kind = 'EXPENSE' and name = 'Outros'),
  p_credit_card_id => 'bbbbbbbb-0000-4000-8000-0000000000c1'
);
insert into public.transactions (id, owner_user_id, kind, description, amount, date, category_id, account_id)
values ('bbbbbbbb-0000-4000-8000-0000000000e1', '22222222-2222-2222-2222-222222222222', 'EXPENSE', 'Bob jantar', 400, '2026-09-05',
        (select id from public.categories where owner_user_id = '22222222-2222-2222-2222-222222222222' and kind = 'EXPENSE' and name = 'Outros'),
        'bbbbbbbb-0000-4000-8000-000000000001');
select public.set_transaction_allocations(
  'bbbbbbbb-0000-4000-8000-0000000000e1',
  array['22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333']::uuid[],
  array[200, 200]::numeric[]
);

-- Alice sees her own rows and nothing of Bob.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select is((select count(*)::int from public.account_balances), 1, 'account_balances: Alice sees one account');
select is(
  (select owner_user_id from public.account_balances),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'account_balances: and it is hers'
);
select is((select current_balance from public.account_balances), 800::numeric, 'account_balances: her own numbers');

select is((select count(*)::int from public.credit_card_invoices), 3, 'credit_card_invoices: Alice sees her three invoices');
select is_empty(
  $$ select credit_card_id from public.credit_card_invoices
      where credit_card_id = 'bbbbbbbb-0000-4000-8000-0000000000c1' $$,
  'credit_card_invoices: no invoice of another owner'
);

select is((select count(*)::int from public.installment_purchases), 1, 'installment_purchases: Alice sees her purchase');
select is(
  (select total_amount from public.installment_purchases),
  300::numeric,
  'installment_purchases: her own total, not the 600 of the other owner'
);

select is(
  (select count(*)::int from public.monthly_transaction_totals
    where owner_user_id <> '11111111-1111-1111-1111-111111111111'),
  0,
  'monthly_transaction_totals: nothing of another owner'
);
select ok(
  (select count(*)::int from public.monthly_transaction_totals) > 0,
  'monthly_transaction_totals: her own month is there'
);

select is((select count(*)::int from public.people_balances), 1, 'people_balances: Alice has one counterparty');
select results_eq(
  $$ select counterparty_user_id, balance from public.people_balances $$,
  $$ values ('33333333-3333-3333-3333-333333333333'::uuid, 100::numeric) $$,
  'people_balances: only what Carol owes Alice, never the pair of another owner'
);

-- Bob sees his own, which proves the isolation is symmetric and not an accident
-- of ordering.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select current_balance from public.account_balances), 4600::numeric, 'account_balances: Bob sees his own balance');
select is((select total_amount from public.installment_purchases), 600::numeric, 'installment_purchases: Bob sees his own purchase');
select results_eq(
  $$ select counterparty_user_id, balance from public.people_balances $$,
  $$ values ('33333333-3333-3333-3333-333333333333'::uuid, 200::numeric) $$,
  'people_balances: Bob sees his own pair'
);

-- Carol is on the other side of both splits and sees exactly that, from her side.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.account_balances), 0, 'account_balances: Carol owns no account');
select is((select count(*)::int from public.people_balances), 2, 'people_balances: Carol owes two people');
select is(
  (select sum(balance)::numeric from public.people_balances),
  -300::numeric,
  'people_balances: her side of both splits is negative'
);

-- Anonymous sees nothing in any view.
set local role anon;
select is((select count(*)::int from public.account_balances), 0, 'anon: no balances');
select is((select count(*)::int from public.credit_card_invoices), 0, 'anon: no invoices');
select is((select count(*)::int from public.installment_purchases), 0, 'anon: no installment purchases');
select is((select count(*)::int from public.monthly_transaction_totals), 0, 'anon: no monthly totals');
select is((select count(*)::int from public.people_balances), 0, 'anon: no people balances');
reset role;

select * from finish();
rollback;
