begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', '{"display_name": "Bob"}');

-- Bob's records, referenced later by Alice to prove cross-owner references fail
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
insert into public.accounts (id, owner_user_id, name, type)
values ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'Bob bank', 'BANK');
insert into public.categories (id, owner_user_id, kind, name)
values ('bbbbbbbb-0000-4000-8000-0000000000c1', '22222222-2222-2222-2222-222222222222', 'EXPENSE', 'Bob expense');

-- Owner (Alice)
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.accounts (id, owner_user_id, name, type, opening_balance)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Bank', 'BANK', 1000),
  ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'Meal voucher', 'BENEFIT', 0);

select is((select count(*)::int from public.transactions), 0, 'new user starts without transactions');

select lives_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id)
     values ('11111111-1111-1111-1111-111111111111', 'INCOME', 'Salary', 1500, '2026-09-05',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'INCOME' and name = 'Salário'),
             'aaaaaaaa-0000-4000-8000-000000000001') $$,
  'owner can insert an income'
);
select is((select status from public.transactions where description = 'Salary'), 'PAID'::public.transaction_status, 'status defaults to PAID');
select is((select created_by from public.transactions where description = 'Salary'), '11111111-1111-1111-1111-111111111111'::uuid, 'created_by is filled with the authenticated user');
select is((select updated_by from public.transactions where description = 'Salary'), '11111111-1111-1111-1111-111111111111'::uuid, 'updated_by is filled with the authenticated user');
select is((select amount from public.transactions where description = 'Salary'), 1500.00::numeric, 'amount is stored with two decimals');

select lives_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, due_date, status, category_id, account_id)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Groceries', 200.50, '2026-09-06', '2026-09-10', 'PENDING',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Alimentação'),
             'aaaaaaaa-0000-4000-8000-000000000001') $$,
  'owner can insert a pending expense with a due date'
);
select lives_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, account_id, destination_account_id)
     values ('11111111-1111-1111-1111-111111111111', 'TRANSFER', 'To voucher', 300, '2026-09-07',
             'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002') $$,
  'owner can insert a transfer between own accounts'
);
select lives_ok(
  $$ update public.transactions set description = 'Monthly salary', status = 'PAID' where description = 'Salary' $$,
  'owner can update a transaction'
);
select is((select updated_by from public.transactions where description = 'Monthly salary'), '11111111-1111-1111-1111-111111111111'::uuid, 'updated_by is filled on update');
select is((select count(*)::int from public.transactions), 3, 'owner sees the own transactions');

-- Constraints
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Zero', 0, '2026-09-06',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             'aaaaaaaa-0000-4000-8000-000000000001') $$,
  '23514', null, 'zero amount is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Negative', -10, '2026-09-06',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             'aaaaaaaa-0000-4000-8000-000000000001') $$,
  '23514', null, 'negative amount is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', '', 10, '2026-09-06',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             'aaaaaaaa-0000-4000-8000-000000000001') $$,
  '23514', null, 'empty description is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id)
     values ('11111111-1111-1111-1111-111111111111', 'SETTLEMENT', 'Settle', 10, '2026-09-06',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             'aaaaaaaa-0000-4000-8000-000000000001') $$,
  '23514', null, 'SETTLEMENT is not accepted yet'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, account_id)
     values ('11111111-1111-1111-1111-111111111111', 'TRANSFER', 'No destination', 10, '2026-09-06', 'aaaaaaaa-0000-4000-8000-000000000001') $$,
  '23514', null, 'transfer without destination account is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, account_id, destination_account_id)
     values ('11111111-1111-1111-1111-111111111111', 'TRANSFER', 'Same account', 10, '2026-09-06',
             'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001') $$,
  '23514', null, 'transfer to the same account is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id, destination_account_id)
     values ('11111111-1111-1111-1111-111111111111', 'TRANSFER', 'With category', 10, '2026-09-06',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002') $$,
  '23514', null, 'transfer with a category is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, account_id)
     values ('11111111-1111-1111-1111-111111111111', 'INCOME', 'No category', 10, '2026-09-06', 'aaaaaaaa-0000-4000-8000-000000000001') $$,
  '23514', null, 'income without category is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id)
     values ('11111111-1111-1111-1111-111111111111', 'INCOME', 'Wrong kind', 10, '2026-09-06',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             'aaaaaaaa-0000-4000-8000-000000000001') $$,
  '23514', null, 'income with an expense category is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Foreign category', 10, '2026-09-06',
             'bbbbbbbb-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-000000000001') $$,
  '23503', null, 'category of another user is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Foreign account', 10, '2026-09-06',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             'bbbbbbbb-0000-4000-8000-000000000001') $$,
  '23503', null, 'account of another user is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, account_id, destination_account_id)
     values ('11111111-1111-1111-1111-111111111111', 'TRANSFER', 'Foreign destination', 10, '2026-09-06',
             'aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001') $$,
  '23503', null, 'transfer to an account of another user is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id)
     values ('22222222-2222-2222-2222-222222222222', 'EXPENSE', 'Intruder', 10, '2026-09-06',
             'bbbbbbbb-0000-4000-8000-0000000000c1', 'bbbbbbbb-0000-4000-8000-000000000001') $$,
  null, null, 'owner cannot insert a transaction for another user (rejected by the reference trigger or the policy)'
);
select throws_ok(
  $$ update public.transactions set owner_user_id = '22222222-2222-2222-2222-222222222222' where description = 'Groceries' $$,
  null, null, 'ownership transfer is rejected (by the reference trigger or the policy)'
);
select throws_ok(
  $$ update public.transactions set account_id = 'bbbbbbbb-0000-4000-8000-000000000001' where description = 'Groceries' $$,
  '23503', null, 'update to an account of another user is rejected'
);

-- Referenced accounts and categories cannot be deleted, only deactivated
select throws_ok(
  $$ delete from public.accounts where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '23503', null, 'account in use cannot be deleted'
);
select throws_ok(
  $$ delete from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and name = 'Alimentação' $$,
  '23503', null, 'category in use cannot be deleted'
);
select lives_ok(
  $$ update public.accounts set active = false where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'account in use can be deactivated'
);
select lives_ok(
  $$ delete from public.transactions where description = 'To voucher' $$,
  'owner can delete a transaction'
);
select is((select count(*)::int from public.transactions), 2, 'deleted transaction is gone');

-- Another user (Bob)
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.transactions), 0, 'unrelated user sees no transactions of another owner');
select lives_ok(
  $$ update public.transactions set amount = 1 where owner_user_id = '11111111-1111-1111-1111-111111111111' $$,
  'update on another owner transactions affects no rows'
);
select lives_ok(
  $$ delete from public.transactions where owner_user_id = '11111111-1111-1111-1111-111111111111' $$,
  'delete on another owner transactions affects no rows'
);

reset role;
select is((select count(*)::int from public.transactions where owner_user_id = '11111111-1111-1111-1111-111111111111'), 2, 'another user did not delete the owner transactions');
select is((select amount from public.transactions where description = 'Monthly salary'), 1500.00::numeric, 'another user did not modify the owner transactions');

-- Anonymous
set local role anon;
select is((select count(*)::int from public.transactions), 0, 'anon sees no transactions');
reset role;

select * from finish();
rollback;
