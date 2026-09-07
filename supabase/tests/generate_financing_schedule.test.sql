begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', '{"display_name": "Bob"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.accounts (id, owner_user_id, name, type, opening_balance)
values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Bank', 'BANK', 0);
insert into public.financings (id, owner_user_id, description, account_id, category_id, down_payment_category_id, asset_value, down_payment, interest_rate, system, installment_count, acquisition_date, first_due_date)
values ('11111111-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Carro',
        'aaaaaaaa-0000-4000-8000-000000000001',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Moradia'),
        60000, 15000, 1, 'SAC', 48, '2026-09-05', '2026-10-31');

select is(public.generate_financing_schedule('11111111-0000-4000-8000-000000000001'), 49, 'the down payment and forty-eight instalments are created');
select is(
  (select count(*)::int from public.transactions where financing_id = '11111111-0000-4000-8000-000000000001' and financing_installment_number is not null),
  48,
  'one expense per instalment'
);
select results_eq(
  $$ select amount, date, status::text from public.transactions
      where financing_id = '11111111-0000-4000-8000-000000000001' and financing_installment_number is null $$,
  $$ values (15000.00::numeric, '2026-09-05'::date, 'PAID') $$,
  'the down payment is an expense of the acquisition date'
);
select is(
  (select category_id from public.transactions where financing_id = '11111111-0000-4000-8000-000000000001' and financing_installment_number is null),
  (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Moradia'),
  'the down payment uses its own expense category'
);
select results_eq(
  $$ select amount, date, status::text from public.transactions
      where financing_id = '11111111-0000-4000-8000-000000000001' and financing_installment_number = 1 $$,
  $$ values (1387.50::numeric, '2026-10-31'::date, 'PENDING') $$,
  'the first instalment matches the SAC formula and the first due date'
);
select is(
  (select date from public.transactions where financing_id = '11111111-0000-4000-8000-000000000001' and financing_installment_number = 2),
  '2026-11-30'::date,
  'day 31 is clamped to the last day of November'
);
select is(
  (select date from public.transactions where financing_id = '11111111-0000-4000-8000-000000000001' and financing_installment_number = 4),
  '2027-01-31'::date,
  'the schedule crosses the year'
);
select ok(
  (select amount from public.transactions where financing_id = '11111111-0000-4000-8000-000000000001' and financing_installment_number = 48)
    < (select amount from public.transactions where financing_id = '11111111-0000-4000-8000-000000000001' and financing_installment_number = 1),
  'the SAC instalments fall over time'
);

-- No duplication: the asset value is never a transaction
select is(
  (select sum(amount) from public.transactions where financing_id = '11111111-0000-4000-8000-000000000001'),
  71025.12::numeric,
  'what was recorded is the down payment plus the instalments, that is the asset plus interest'
);
select is(
  (select count(*)::int from public.transactions where amount = 60000),
  0,
  'no transaction carries the asset value'
);
select is(
  (select count(*)::int from public.transactions where financing_id = '11111111-0000-4000-8000-000000000001' and kind <> 'EXPENSE'),
  0,
  'a financing produces no income: the bank pays the seller directly'
);
select is(
  (select total from public.monthly_transaction_totals
    where month = '2026-09-01' and kind = 'EXPENSE' and owner_user_id = '11111111-1111-1111-1111-111111111111'),
  15000.00::numeric,
  'the acquisition month records the down payment, not the asset value'
);
select is(
  (select count(*)::int from public.monthly_transaction_totals where kind = 'INCOME'),
  0,
  'the financing never becomes income of a month'
);
select is(
  (select current_balance from public.account_balances where account_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  -15000::numeric,
  'only the down payment has left the account so far'
);

-- Idempotency
select is(public.generate_financing_schedule('11111111-0000-4000-8000-000000000001'), 0, 'generating again creates nothing');
select is(
  (select count(*)::int from public.transactions where financing_id = '11111111-0000-4000-8000-000000000001'),
  49,
  'no duplicates were created'
);
select lives_ok(
  $$ delete from public.transactions where financing_id = '11111111-0000-4000-8000-000000000001' and financing_installment_number = 5 $$,
  'owner deletes one instalment'
);
select is(public.generate_financing_schedule('11111111-0000-4000-8000-000000000001'), 1, 'the deleted instalment is created again');
select lives_ok(
  $$ update public.transactions set status = 'CANCELLED' where financing_id = '11111111-0000-4000-8000-000000000001' and financing_installment_number = 6 $$,
  'owner cancels one instalment'
);
select is(public.generate_financing_schedule('11111111-0000-4000-8000-000000000001'), 0, 'a cancelled instalment is not recreated');
select lives_ok(
  $$ delete from public.transactions where financing_id = '11111111-0000-4000-8000-000000000001' and financing_installment_number is null $$,
  'owner deletes the down payment'
);
select is(public.generate_financing_schedule('11111111-0000-4000-8000-000000000001'), 1, 'the deleted down payment is created again');

-- Shape rejections
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, account_id, financing_id)
     values ('11111111-1111-1111-1111-111111111111', 'INCOME', 'Financiamento como receita', 10, '2026-09-05',
             'aaaaaaaa-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001') $$,
  '23514', null, 'a financing transaction cannot be an income'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, account_id, destination_account_id, financing_installment_number)
     values ('11111111-1111-1111-1111-111111111111', 'TRANSFER', 'Sem financiamento', 10, '2026-09-05',
             'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 3) $$,
  '23514', null, 'an instalment number without a financing and without an expense is rejected'
);
insert into public.loans (id, owner_user_id, description, account_id, category_id, principal, interest_rate, interest_model, installment_count, start_date, first_due_date)
values ('11111111-0000-4000-8000-0000000000f1', '11111111-1111-1111-1111-111111111111', 'Empréstimo',
        'aaaaaaaa-0000-4000-8000-000000000001',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
        1000, 1, 'PRICE', 12, '2026-09-05', '2026-10-10');
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id, loan_id, loan_installment_number, financing_id, financing_installment_number)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Duas dívidas', 10, '2026-09-05',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             'aaaaaaaa-0000-4000-8000-000000000001', '11111111-0000-4000-8000-0000000000f1', 1,
             '11111111-0000-4000-8000-000000000001', 1) $$,
  '23514', null, 'a transaction cannot belong to a loan and to a financing at the same time'
);

-- Without the down payment
insert into public.financings (id, owner_user_id, description, account_id, category_id, asset_value, down_payment, interest_rate, system, installment_count, acquisition_date, first_due_date)
values ('11111111-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'Sem entrada',
        'aaaaaaaa-0000-4000-8000-000000000001',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
        1200, 0, 0, 'PRICE', 12, '2026-09-05', '2026-10-10');
select is(public.generate_financing_schedule('11111111-0000-4000-8000-000000000002'), 12, 'a financing without a down payment creates only the instalments');
select is(
  (select count(*)::int from public.transactions where financing_id = '11111111-0000-4000-8000-000000000002' and financing_installment_number is null),
  0,
  'a zero down payment never becomes a transaction'
);

insert into public.financings (id, owner_user_id, description, account_id, category_id, asset_value, down_payment, interest_rate, system, installment_count, acquisition_date, first_due_date)
values ('11111111-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', 'Entrada à parte',
        'aaaaaaaa-0000-4000-8000-000000000001',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
        2400, 400, 0, 'PRICE', 10, '2026-09-05', '2026-10-10');
select is(public.generate_financing_schedule('11111111-0000-4000-8000-000000000003', false), 10, 'the down payment can be skipped when it was recorded by hand');
select is(
  (select count(*)::int from public.transactions where financing_id = '11111111-0000-4000-8000-000000000003' and financing_installment_number is null),
  0,
  'no down payment was created'
);

-- Deleting the financing keeps the transactions
select lives_ok($$ delete from public.financings where id = '11111111-0000-4000-8000-000000000002' $$, 'owner deletes a financing');
select is((select count(*)::int from public.transactions where description = 'Sem entrada'), 12, 'the instalments survive');
select is((select count(*)::int from public.transactions where description = 'Sem entrada' and financing_id is not null), 0, 'the link is cleared');
select is((select count(*)::int from public.transactions where description = 'Sem entrada' and financing_installment_number = 1), 1, 'the orphan instalment keeps its number');

-- Sharing
insert into public.financial_access_grants (id, owner_user_id, granted_user_id, permission)
values ('99999999-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'VIEW');
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.generate_financing_schedule('11111111-0000-4000-8000-000000000003') $$,
  '42501', null, 'VIEW cannot generate the schedule'
);
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
update public.financial_access_grants set permission = 'MANAGE' where id = '99999999-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select lives_ok(
  $$ delete from public.transactions where financing_id = '11111111-0000-4000-8000-000000000003' and financing_installment_number = 7 $$,
  'MANAGE deletes an instalment of the owner'
);
select is(public.generate_financing_schedule('11111111-0000-4000-8000-000000000003'), 2, 'MANAGE generates the missing instalment and the down payment');

set local role anon;
select throws_ok(
  $$ select public.generate_financing_schedule('11111111-0000-4000-8000-000000000003') $$,
  '42501', null, 'anon cannot execute generate_financing_schedule'
);
reset role;

select * from finish();
rollback;
