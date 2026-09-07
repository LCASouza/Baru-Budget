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
values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Bank', 'BANK', 1000);
insert into public.credit_cards (id, owner_user_id, name, closing_day, due_day)
values ('cccccccc-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cartão', 20, 5);

insert into public.fixed_expenses (id, owner_user_id, description, category_id, account_id, default_amount, due_day)
values ('ffffffff-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Aluguel',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Moradia'),
        'aaaaaaaa-0000-4000-8000-000000000001', 1850.00, 10);
insert into public.fixed_expenses (id, owner_user_id, description, category_id, credit_card_id, default_amount, due_day)
values ('ffffffff-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'Streaming',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Assinaturas'),
        'cccccccc-0000-4000-8000-000000000001', 49.90, 8);
insert into public.fixed_expenses (id, owner_user_id, description, category_id, account_id, default_amount, due_day, active)
values ('ffffffff-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', 'Academia',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Saúde'),
        'aaaaaaaa-0000-4000-8000-000000000001', 120.00, 5, false);
insert into public.fixed_expenses (id, owner_user_id, description, category_id, account_id, default_amount, due_day, frequency, anchor_month)
values ('ffffffff-0000-4000-8000-000000000004', '11111111-1111-1111-1111-111111111111', 'IPVA',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Transporte'),
        'aaaaaaaa-0000-4000-8000-000000000001', 900.00, 31, 'YEARLY', 2);
insert into public.recurring_incomes (id, owner_user_id, description, category_id, account_id, default_amount, receipt_day)
values ('11111111-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Salário',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'INCOME' and name = 'Salário'),
        'aaaaaaaa-0000-4000-8000-000000000001', 5400.00, 5);

-- September: monthly templates only
select is(public.generate_recurrences('11111111-1111-1111-1111-111111111111', '2026-09-01'), 3, 'three monthly instances are created');
select is((select count(*)::int from public.transactions where recurrence_month = '2026-09-01'), 3, 'the instances belong to the month');
select is((select count(*)::int from public.transactions where fixed_expense_id = 'ffffffff-0000-4000-8000-000000000003'), 0, 'an inactive template generates nothing');
select is((select count(*)::int from public.transactions where fixed_expense_id = 'ffffffff-0000-4000-8000-000000000004'), 0, 'a yearly template does not generate outside its anchor month');

select results_eq(
  $$ select description, amount, date, due_date, status::text, invoice_due_date
       from public.transactions where fixed_expense_id = 'ffffffff-0000-4000-8000-000000000001' $$,
  $$ values ('Aluguel', 1850.00::numeric, '2026-09-10'::date, '2026-09-10'::date, 'PENDING', null::date) $$,
  'an account fixed expense is pending on its due day'
);
select results_eq(
  $$ select description, amount, date, due_date, status::text, invoice_due_date, account_id
       from public.transactions where fixed_expense_id = 'ffffffff-0000-4000-8000-000000000002' $$,
  $$ values ('Streaming', 49.90::numeric, '2026-09-08'::date, null::date, 'PAID', '2026-10-05'::date, null::uuid) $$,
  'a card fixed expense is effective and lands on the right invoice'
);
select results_eq(
  $$ select description, amount, date, status::text, kind::text
       from public.transactions where recurring_income_id = '11111111-0000-4000-8000-000000000001' $$,
  $$ values ('Salário', 5400.00::numeric, '2026-09-05'::date, 'PENDING', 'INCOME') $$,
  'a recurring income is pending on its receipt day'
);

-- Idempotency
select is(public.generate_recurrences('11111111-1111-1111-1111-111111111111', '2026-09-01'), 0, 'generating the same month again creates nothing');
select is((select count(*)::int from public.transactions where recurrence_month = '2026-09-01'), 3, 'no duplicates were created');
select is(public.generate_recurrences('11111111-1111-1111-1111-111111111111', '2026-09-30'), 0, 'any day of the month refers to the same competence');

-- A deleted instance is recreated; a cancelled one is not
select lives_ok($$ delete from public.transactions where fixed_expense_id = 'ffffffff-0000-4000-8000-000000000001' $$, 'owner deletes an instance');
select is(public.generate_recurrences('11111111-1111-1111-1111-111111111111', '2026-09-01'), 1, 'the deleted instance is created again');
select lives_ok($$ update public.transactions set status = 'CANCELLED' where fixed_expense_id = 'ffffffff-0000-4000-8000-000000000001' $$, 'owner cancels an instance');
select is(public.generate_recurrences('11111111-1111-1111-1111-111111111111', '2026-09-01'), 0, 'a cancelled instance is not recreated');

-- Editing the instance does not touch the template
select lives_ok(
  $$ update public.transactions set amount = 1975.40, status = 'PAID'
      where fixed_expense_id = 'ffffffff-0000-4000-8000-000000000001' $$,
  'owner adjusts the amount of one month'
);
select is((select default_amount from public.fixed_expenses where id = 'ffffffff-0000-4000-8000-000000000001'), 1850.00::numeric, 'the template keeps its suggested amount');

-- February: the yearly template generates with the day clamped
select is(public.generate_recurrences('11111111-1111-1111-1111-111111111111', '2027-02-01'), 4, 'the yearly template joins the monthly ones');
select is(
  (select date from public.transactions where fixed_expense_id = 'ffffffff-0000-4000-8000-000000000004'),
  '2027-02-28'::date,
  'day 31 is clamped to the last day of February'
);

-- Deleting the template keeps the transactions
select lives_ok($$ delete from public.fixed_expenses where id = 'ffffffff-0000-4000-8000-000000000002' $$, 'owner deletes a template');
select is((select count(*)::int from public.transactions where description = 'Streaming'), 2, 'the generated transactions survive');
select is((select count(*)::int from public.transactions where description = 'Streaming' and fixed_expense_id is not null), 0, 'the link is cleared');

-- Sharing
insert into public.financial_access_grants (id, owner_user_id, granted_user_id, permission)
values ('99999999-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'VIEW');
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.generate_recurrences('11111111-1111-1111-1111-111111111111', '2026-10-01') $$,
  '42501', null, 'VIEW cannot generate for the owner'
);

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
update public.financial_access_grants set permission = 'MANAGE' where id = '99999999-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
-- Only the rent and the salary are left: the card template was deleted and the
-- gym one is inactive.
select is(public.generate_recurrences('11111111-1111-1111-1111-111111111111', '2026-10-01'), 2, 'MANAGE generates for the owner');
select is(
  (select distinct created_by from public.transactions where recurrence_month = '2026-10-01'),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'created_by records who generated them'
);
select is(
  (select distinct owner_user_id from public.transactions where recurrence_month = '2026-10-01'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'the instances belong to the owner'
);

set local role anon;
select throws_ok(
  $$ select public.generate_recurrences('11111111-1111-1111-1111-111111111111', '2026-11-01') $$,
  '42501', null, 'anon cannot execute generate_recurrences'
);
reset role;

select * from finish();
rollback;
