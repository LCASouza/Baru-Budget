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
insert into public.loans (id, owner_user_id, description, account_id, category_id, disbursement_category_id, principal, interest_rate, interest_model, installment_count, start_date, first_due_date)
values ('11111111-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Empréstimo',
        'aaaaaaaa-0000-4000-8000-000000000001',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'INCOME' and name = 'Outros'),
        10000, 1.5, 'PRICE', 12, '2026-09-05', '2026-10-31');

select is(public.generate_loan_schedule('11111111-0000-4000-8000-000000000001'), 13, 'the disbursement and twelve instalments are created');
select is(
  (select count(*)::int from public.transactions where loan_id = '11111111-0000-4000-8000-000000000001' and kind = 'EXPENSE'),
  12,
  'one expense per instalment'
);
select results_eq(
  $$ select amount, date, status::text from public.transactions
      where loan_id = '11111111-0000-4000-8000-000000000001' and loan_installment_number = 1 $$,
  $$ values (916.80::numeric, '2026-10-31'::date, 'PENDING') $$,
  'the first instalment matches the Price formula and the first due date'
);
select is(
  (select date from public.transactions where loan_id = '11111111-0000-4000-8000-000000000001' and loan_installment_number = 2),
  '2026-11-30'::date,
  'day 31 is clamped to the last day of November'
);
select is(
  (select date from public.transactions where loan_id = '11111111-0000-4000-8000-000000000001' and loan_installment_number = 4),
  '2027-01-31'::date,
  'the schedule crosses the year'
);
select is(
  (select category_id from public.transactions where loan_id = '11111111-0000-4000-8000-000000000001' and kind = 'INCOME'),
  (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'INCOME' and name = 'Outros'),
  'the disbursement uses the income category of the loan'
);

-- Cash goes up, income does not
select is(
  (select current_balance from public.account_balances where account_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  10000::numeric,
  'the disbursement increases the account balance'
);
select is(
  (select count(*)::int from public.monthly_transaction_totals where kind = 'INCOME'),
  0,
  'the disbursement is not income of the month'
);
select is(
  (select count(*)::int from public.monthly_transaction_totals where kind = 'EXPENSE'),
  12,
  'the instalments are expenses of their months'
);

-- Idempotency
select is(public.generate_loan_schedule('11111111-0000-4000-8000-000000000001'), 0, 'generating again creates nothing');
select is(
  (select count(*)::int from public.transactions where loan_id = '11111111-0000-4000-8000-000000000001'),
  13,
  'no duplicates were created'
);
select lives_ok(
  $$ delete from public.transactions where loan_id = '11111111-0000-4000-8000-000000000001' and loan_installment_number = 5 $$,
  'owner deletes one instalment'
);
select is(public.generate_loan_schedule('11111111-0000-4000-8000-000000000001'), 1, 'the deleted instalment is created again');
select lives_ok(
  $$ update public.transactions set status = 'CANCELLED' where loan_id = '11111111-0000-4000-8000-000000000001' and loan_installment_number = 6 $$,
  'owner cancels one instalment'
);
select is(public.generate_loan_schedule('11111111-0000-4000-8000-000000000001'), 0, 'a cancelled instalment is not recreated');

-- Shape rejections
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, account_id, loan_id, loan_installment_number)
     values ('11111111-1111-1111-1111-111111111111', 'INCOME', 'Liberação numerada', 10, '2026-09-05',
             'aaaaaaaa-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 1) $$,
  '23514', null, 'a disbursement cannot carry an instalment number'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id, loan_id)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Parcela sem número', 10, '2026-09-05',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             'aaaaaaaa-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001') $$,
  '23514', null, 'a loan expense needs an instalment number'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, account_id, loan_installment_number)
     values ('11111111-1111-1111-1111-111111111111', 'INCOME', 'Sem empréstimo', 10, '2026-09-05',
             'aaaaaaaa-0000-4000-8000-000000000001', 3) $$,
  '23514', null, 'an instalment number without a loan is rejected'
);

-- Without the disbursement
insert into public.loans (id, owner_user_id, description, account_id, category_id, principal, interest_rate, interest_model, installment_count, start_date, first_due_date)
values ('11111111-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'Sem liberação',
        'aaaaaaaa-0000-4000-8000-000000000001',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
        1200, 0, 'SIMPLE', 12, '2026-09-05', '2026-10-10');
select is(public.generate_loan_schedule('11111111-0000-4000-8000-000000000002', false), 12, 'only the instalments are created');
select is(
  (select count(*)::int from public.transactions where loan_id = '11111111-0000-4000-8000-000000000002'),
  12,
  'a loan without an income category never gets a disbursement'
);
select is(
  (select count(*)::int from public.transactions where loan_id = '11111111-0000-4000-8000-000000000002' and kind = 'INCOME'),
  0,
  'no disbursement was created'
);

-- Deleting the loan keeps the transactions
select lives_ok($$ delete from public.loans where id = '11111111-0000-4000-8000-000000000002' $$, 'owner deletes a loan');
select is((select count(*)::int from public.transactions where description = 'Sem liberação'), 12, 'the instalments survive');
select is((select count(*)::int from public.transactions where description = 'Sem liberação' and loan_id is not null), 0, 'the link is cleared');

-- Sharing
insert into public.financial_access_grants (id, owner_user_id, granted_user_id, permission)
values ('99999999-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'VIEW');
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.generate_loan_schedule('11111111-0000-4000-8000-000000000001') $$,
  '42501', null, 'VIEW cannot generate the schedule'
);
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
update public.financial_access_grants set permission = 'MANAGE' where id = '99999999-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select lives_ok(
  $$ delete from public.transactions where loan_id = '11111111-0000-4000-8000-000000000001' and loan_installment_number = 7 $$,
  'MANAGE deletes an instalment of the owner'
);
select is(public.generate_loan_schedule('11111111-0000-4000-8000-000000000001'), 1, 'MANAGE generates for the owner');

set local role anon;
select throws_ok(
  $$ select public.generate_loan_schedule('11111111-0000-4000-8000-000000000001') $$,
  '42501', null, 'anon cannot execute generate_loan_schedule'
);
reset role;

select * from finish();
rollback;
