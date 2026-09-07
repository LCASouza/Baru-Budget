begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', '{"display_name": "Bob"}'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol@example.com', '{"display_name": "Carol"}');

-- Alice (owner) creates her data
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.accounts (id, owner_user_id, name, type, opening_balance)
values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Alice bank', 'BANK', 1000);
insert into public.transactions (id, owner_user_id, kind, description, amount, date, category_id, account_id)
values ('aaaaaaaa-0000-4000-8000-0000000000e1', '11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Alice expense', 100, '2026-09-05',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
        'aaaaaaaa-0000-4000-8000-000000000001');

-- Grant constraints
select throws_ok(
  $$ insert into public.financial_access_grants (owner_user_id, granted_user_id, permission) values ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'VIEW') $$,
  '23514', null, 'owner cannot grant access to themselves'
);
select throws_ok(
  $$ insert into public.financial_access_grants (owner_user_id, granted_user_id, permission) values ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'VIEW') $$,
  '42501', null, 'user cannot create a grant on behalf of another owner'
);
select lives_ok(
  $$ insert into public.financial_access_grants (id, owner_user_id, granted_user_id, permission) values ('99999999-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'VIEW') $$,
  'owner grants VIEW to another user'
);
select throws_ok(
  $$ insert into public.financial_access_grants (owner_user_id, granted_user_id, permission) values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'MANAGE') $$,
  '23505', null, 'only one active grant per pair'
);

-- Bob with VIEW
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.accounts where owner_user_id = '11111111-1111-1111-1111-111111111111'), 1, 'VIEW: sees the owner accounts');
select is((select count(*)::int from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111'), 16, 'VIEW: sees the owner categories');
select is((select count(*)::int from public.transactions where owner_user_id = '11111111-1111-1111-1111-111111111111'), 1, 'VIEW: sees the owner transactions');
select is((select current_balance from public.account_balances where account_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 900::numeric, 'VIEW: sees the owner balances');
select is((select count(*)::int from public.financial_access_grants), 1, 'VIEW: sees the grant received');
select is((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'Alice', 'VIEW: sees the owner profile');
select throws_ok(
  $$ insert into public.accounts (owner_user_id, name, type) values ('11111111-1111-1111-1111-111111111111', 'Intruder', 'CASH') $$,
  '42501', null, 'VIEW: cannot create an account for the owner'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Intruder', 5, '2026-09-05',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             'aaaaaaaa-0000-4000-8000-000000000001') $$,
  '42501', null, 'VIEW: cannot create a transaction for the owner'
);
-- Every table the Excel format writes is closed to VIEW, so importing a
-- workbook can never widen what a reader is allowed to do.
select throws_ok(
  $$ insert into public.credit_cards (owner_user_id, name, closing_day, due_day)
     values ('11111111-1111-1111-1111-111111111111', 'Intruso', 10, 20) $$,
  '42501', null, 'VIEW: cannot create a credit card for the owner'
);
select throws_ok(
  $$ insert into public.categories (owner_user_id, kind, name)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Intrusa') $$,
  '42501', null, 'VIEW: cannot create a category for the owner'
);
select throws_ok(
  $$ insert into public.loans (owner_user_id, description, account_id, category_id, principal, interest_rate, interest_model, installment_count, start_date, first_due_date)
     values ('11111111-1111-1111-1111-111111111111', 'Intruso', 'aaaaaaaa-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             1000, 1, 'PRICE', 12, '2026-09-05', '2026-10-10') $$,
  null, null, 'VIEW: cannot create a loan for the owner'
);
select throws_ok(
  $$ insert into public.financings (owner_user_id, description, account_id, category_id, asset_value, down_payment, interest_rate, system, installment_count, acquisition_date, first_due_date)
     values ('11111111-1111-1111-1111-111111111111', 'Intruso', 'aaaaaaaa-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             1000, 0, 1, 'SAC', 12, '2026-09-05', '2026-10-10') $$,
  null, null, 'VIEW: cannot create a financing for the owner'
);
select throws_ok(
  $$ insert into public.fixed_expenses (owner_user_id, description, category_id, account_id, default_amount, due_day, frequency)
     values ('11111111-1111-1111-1111-111111111111', 'Intruso',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             'aaaaaaaa-0000-4000-8000-000000000001', 100, 10, 'MONTHLY') $$,
  null, null, 'VIEW: cannot create a fixed expense for the owner'
);
select throws_ok(
  $$ insert into public.recurring_incomes (owner_user_id, description, category_id, account_id, default_amount, receipt_day, frequency)
     values ('11111111-1111-1111-1111-111111111111', 'Intruso',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'INCOME' and name = 'Outros'),
             'aaaaaaaa-0000-4000-8000-000000000001', 100, 10, 'MONTHLY') $$,
  null, null, 'VIEW: cannot create a recurring income for the owner'
);
select is(
  (select count(*)::int from public.credit_cards where owner_user_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'VIEW: nothing was written for the owner'
);

select lives_ok($$ update public.transactions set amount = 1 where id = 'aaaaaaaa-0000-4000-8000-0000000000e1' $$, 'VIEW: update on owner transaction affects no rows');
select lives_ok($$ delete from public.transactions where id = 'aaaaaaaa-0000-4000-8000-0000000000e1' $$, 'VIEW: delete on owner transaction affects no rows');
select lives_ok($$ update public.financial_access_grants set permission = 'MANAGE' where id = '99999999-0000-4000-8000-000000000001' $$, 'VIEW: update on the grant affects no rows');
select lives_ok($$ delete from public.financial_access_grants where id = '99999999-0000-4000-8000-000000000001' $$, 'VIEW: delete on the grant affects no rows');

reset role;
select is((select amount from public.transactions where id = 'aaaaaaaa-0000-4000-8000-0000000000e1'), 100::numeric, 'VIEW: owner transaction unchanged');
select is((select permission from public.financial_access_grants where id = '99999999-0000-4000-8000-000000000001'), 'VIEW'::public.access_permission, 'VIEW: grant unchanged');

-- Alice upgrades Bob to MANAGE
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok($$ update public.financial_access_grants set permission = 'MANAGE' where id = '99999999-0000-4000-8000-000000000001' $$, 'owner changes the permission to MANAGE');

-- Bob with MANAGE
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select lives_ok($$ update public.transactions set amount = 120 where id = 'aaaaaaaa-0000-4000-8000-0000000000e1' $$, 'MANAGE: updates the owner transaction');
select is((select amount from public.transactions where id = 'aaaaaaaa-0000-4000-8000-0000000000e1'), 120::numeric, 'MANAGE: update persisted');
select is((select updated_by from public.transactions where id = 'aaaaaaaa-0000-4000-8000-0000000000e1'), '22222222-2222-2222-2222-222222222222'::uuid, 'MANAGE: updated_by records the manager');
select lives_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'By manager', 5, '2026-09-05',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             'aaaaaaaa-0000-4000-8000-000000000001') $$,
  'MANAGE: creates a transaction for the owner'
);
select is((select created_by from public.transactions where description = 'By manager'), '22222222-2222-2222-2222-222222222222'::uuid, 'MANAGE: created_by records the manager while owner stays the owner');
select is((select owner_user_id from public.transactions where description = 'By manager'), '11111111-1111-1111-1111-111111111111'::uuid, 'MANAGE: owner_user_id is the owner');
select lives_ok($$ insert into public.accounts (owner_user_id, name, type) values ('11111111-1111-1111-1111-111111111111', 'Owner cash', 'CASH') $$, 'MANAGE: creates an account for the owner');
select lives_ok($$ insert into public.categories (owner_user_id, kind, name) values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Pets') $$, 'MANAGE: creates a category for the owner');
select lives_ok($$ delete from public.transactions where description = 'By manager' $$, 'MANAGE: deletes an owner transaction');
select throws_ok(
  $$ insert into public.financial_access_grants (owner_user_id, granted_user_id, permission) values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'VIEW') $$,
  '42501', null, 'MANAGE: cannot share the owner finances with a third user'
);
select lives_ok($$ update public.financial_access_grants set granted_user_id = '33333333-3333-3333-3333-333333333333' where id = '99999999-0000-4000-8000-000000000001' $$, 'MANAGE: update on the grant affects no rows');
select lives_ok($$ update public.profiles set display_name = 'Hacked' where id = '11111111-1111-1111-1111-111111111111' $$, 'MANAGE: update on the owner profile affects no rows');
select throws_ok(
  $$ update public.transactions set owner_user_id = '22222222-2222-2222-2222-222222222222' where id = 'aaaaaaaa-0000-4000-8000-0000000000e1' $$,
  null, null, 'MANAGE: cannot take ownership of an owner transaction'
);

reset role;
select is((select granted_user_id from public.financial_access_grants where id = '99999999-0000-4000-8000-000000000001'), '22222222-2222-2222-2222-222222222222'::uuid, 'MANAGE: grant unchanged');
select is((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'Alice', 'MANAGE: owner profile unchanged');

-- Carol (unrelated)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.accounts where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'unrelated user sees no owner accounts');
select is((select count(*)::int from public.transactions where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'unrelated user sees no owner transactions');
select is((select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 0, 'unrelated user does not see the owner profile');
select is((select count(*)::int from public.financial_access_grants), 0, 'unrelated user sees no grants');

-- Transitivity: Bob (who manages Alice) shares his own finances with Carol
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
insert into public.accounts (owner_user_id, name, type) values ('22222222-2222-2222-2222-222222222222', 'Bob bank', 'BANK');
insert into public.financial_access_grants (owner_user_id, granted_user_id, permission) values ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'MANAGE');

select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.accounts where owner_user_id = '22222222-2222-2222-2222-222222222222'), 1, 'transitivity: Carol sees Bob accounts');
select is((select count(*)::int from public.accounts where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'transitivity: Carol does not see Alice accounts through Bob');
select is((select count(*)::int from public.transactions where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'transitivity: Carol does not see Alice transactions through Bob');
select throws_ok(
  $$ insert into public.accounts (owner_user_id, name, type) values ('11111111-1111-1111-1111-111111111111', 'Via Bob', 'CASH') $$,
  '42501', null, 'transitivity: Carol cannot write Alice data through Bob'
);

-- Revocation
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok($$ update public.financial_access_grants set revoked_at = now() where id = '99999999-0000-4000-8000-000000000001' $$, 'owner revokes the grant');
select lives_ok(
  $$ insert into public.financial_access_grants (owner_user_id, granted_user_id, permission) values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'VIEW') $$,
  'a new grant can be created after revocation'
);
select lives_ok($$ update public.financial_access_grants set revoked_at = now() where owner_user_id = '11111111-1111-1111-1111-111111111111' and revoked_at is null $$, 'owner revokes again');

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.accounts where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'revoked: no access to owner accounts');
select is((select count(*)::int from public.transactions where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'revoked: no access to owner transactions');
select is((select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 0, 'revoked: owner profile no longer visible');
select throws_ok(
  $$ insert into public.accounts (owner_user_id, name, type) values ('11111111-1111-1111-1111-111111111111', 'After revoke', 'CASH') $$,
  '42501', null, 'revoked: cannot write owner data'
);

-- Anonymous
set local role anon;
select is((select count(*)::int from public.financial_access_grants), 0, 'anon sees no grants');
select throws_ok($$ select public.can_view('11111111-1111-1111-1111-111111111111') $$, '42501', null, 'anon cannot execute can_view');
reset role;

select * from finish();
rollback;
