begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', '{"display_name": "Bob"}'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol@example.com', '{"display_name": "Carol"}');

-- Carol owns a household Alice does not belong to
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
insert into public.households (id, name) values ('dddddddd-0000-4000-8000-000000000002', 'Carol house');

-- Alice: household with Bob, personal and household transactions
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.households (id, name) values ('dddddddd-0000-4000-8000-000000000001', 'Casa');
insert into public.household_members (household_id, user_id) values ('dddddddd-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222');
insert into public.accounts (id, owner_user_id, name, type, opening_balance)
values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Alice bank', 'BANK', 500);

select lives_ok(
  $$ insert into public.transactions (id, owner_user_id, kind, description, amount, date, category_id, account_id)
     values ('aaaaaaaa-0000-4000-8000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Alice personal', 40, '2026-09-05',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Lazer'),
             'aaaaaaaa-0000-4000-8000-000000000001') $$,
  'owner records a personal transaction'
);
select lives_ok(
  $$ insert into public.transactions (id, owner_user_id, kind, description, amount, date, category_id, account_id, household_id)
     values ('aaaaaaaa-0000-4000-8000-0000000000b1', '11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Groceries for home', 200, '2026-09-06',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Alimentação'),
             'aaaaaaaa-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000001') $$,
  'member tags a transaction with the household using an own account'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id, household_id)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Not my house', 10, '2026-09-06',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             'aaaaaaaa-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000002') $$,
  '23503', null, 'transaction cannot be tagged with a household the owner does not belong to'
);

-- Bob (member, no grant)
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.transactions where owner_user_id = '11111111-1111-1111-1111-111111111111'), 1, 'member sees only the household transaction of another member');
select is((select description from public.transactions where owner_user_id = '11111111-1111-1111-1111-111111111111'), 'Groceries for home', 'the visible transaction is the household one');
select is((select count(*)::int from public.accounts where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'member sees no accounts of another member');
select is((select count(*)::int from public.account_balances where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'member sees no balances of another member');
select is((select count(*)::int from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111'), 1, 'member sees only the category used by the household transaction');
select is((select name from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111'), 'Alimentação', 'the visible category is the one in use');
select lives_ok($$ update public.transactions set amount = 1 where id = 'aaaaaaaa-0000-4000-8000-0000000000b1' $$, 'member update on another member transaction affects no rows');
select lives_ok($$ delete from public.transactions where id = 'aaaaaaaa-0000-4000-8000-0000000000b1' $$, 'member delete on another member transaction affects no rows');
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id, household_id)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'For Alice', 10, '2026-09-06',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Alimentação'),
             'aaaaaaaa-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000001') $$,
  null, null, 'member cannot record a household transaction on behalf of another member'
);

insert into public.accounts (id, owner_user_id, name, type) values ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'Bob bank', 'BANK');
select lives_ok(
  $$ insert into public.transactions (id, owner_user_id, kind, description, amount, date, category_id, account_id, household_id)
     values ('bbbbbbbb-0000-4000-8000-0000000000c1', '22222222-2222-2222-2222-222222222222', 'EXPENSE', 'Bob for home', 50, '2026-09-07',
             (select id from public.categories where owner_user_id = '22222222-2222-2222-2222-222222222222' and kind = 'EXPENSE' and name = 'Moradia'),
             'bbbbbbbb-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000001') $$,
  'member records an own household transaction'
);
select is((select count(*)::int from public.transactions where household_id = 'dddddddd-0000-4000-8000-000000000001'), 2, 'member sees both household transactions');

reset role;
select is((select amount from public.transactions where id = 'aaaaaaaa-0000-4000-8000-0000000000b1'), 200::numeric, 'household transaction unchanged by another member');

-- Alice sees the household transaction from Bob and its category name
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is((select count(*)::int from public.transactions where household_id = 'dddddddd-0000-4000-8000-000000000001'), 2, 'admin sees both household transactions');
select is((select name from public.categories where owner_user_id = '22222222-2222-2222-2222-222222222222'), 'Moradia', 'admin sees the category used by the member transaction');
select is((select count(*)::int from public.accounts where owner_user_id = '22222222-2222-2222-2222-222222222222'), 0, 'admin sees no accounts of the member');

-- Deactivated member loses household visibility
select lives_ok($$ update public.household_members set status = 'INACTIVE' where household_id = 'dddddddd-0000-4000-8000-000000000001' and user_id = '22222222-2222-2222-2222-222222222222' $$, 'admin deactivates the member');
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.transactions where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'inactive member no longer sees household transactions of others');
select is((select count(*)::int from public.transactions where id = 'bbbbbbbb-0000-4000-8000-0000000000c1'), 1, 'inactive member still sees the own transaction');

-- Deleting the household keeps the transactions as personal
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok($$ delete from public.households where id = 'dddddddd-0000-4000-8000-000000000001' $$, 'admin deletes the household');
reset role;
select is((select household_id from public.transactions where id = 'aaaaaaaa-0000-4000-8000-0000000000b1'), null, 'household transaction becomes personal after the household is deleted');
select is((select count(*)::int from public.transactions where id in ('aaaaaaaa-0000-4000-8000-0000000000b1', 'bbbbbbbb-0000-4000-8000-0000000000c1')), 2, 'transactions survive the household deletion');

select * from finish();
rollback;
