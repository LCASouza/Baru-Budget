-- Observed statements of an indexed debt: shape, uniqueness and access.
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
values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Bank', 'BANK', 0);
insert into public.loans (id, owner_user_id, description, account_id, category_id, principal, interest_rate, interest_model, installment_count, start_date, first_due_date)
values ('11111111-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Empréstimo',
        'aaaaaaaa-0000-4000-8000-000000000001',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
        6127.30, 1.95, 'PRICE', 12, '2026-06-02', '2026-07-07');
insert into public.financings (id, owner_user_id, description, account_id, category_id, asset_value, down_payment, interest_rate, interest_period, system, installment_count, acquisition_date, first_due_date)
values ('11111111-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'Casa',
        'aaaaaaaa-0000-4000-8000-000000000001',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Moradia'),
        224000, 44800, 6.6971, 'YEARLY', 'PRICE', 420, '2024-06-10', '2024-07-10');

-- Shape
select lives_ok(
  $$ insert into public.debt_statements (id, financing_id, competence, outstanding_balance, installment_amount, insurance_amount, fee_amount, remaining_count)
     values ('dddddddd-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000002', '2026-09-01', 183670.08, 1125.09, 31.59, 25.00, 394) $$,
  'a financing statement is recorded'
);
select lives_ok(
  $$ insert into public.debt_statements (financing_id, competence, outstanding_balance, installment_amount, remaining_count)
     values ('11111111-0000-4000-8000-000000000002', '2026-10-01', 183100.00, 1126.00, 393) $$,
  'insurance and fee default to zero when the lender reports none'
);
select lives_ok(
  $$ insert into public.debt_statements (loan_id, competence, outstanding_balance, installment_amount, remaining_count)
     values ('11111111-0000-4000-8000-000000000001', '2026-09-01', 4725.91, 578.34, 9) $$,
  'a loan statement is recorded in the same table'
);

select throws_ok(
  $$ insert into public.debt_statements (loan_id, financing_id, competence, outstanding_balance, installment_amount, remaining_count)
     values ('11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000002', '2026-11-01', 100, 10, 1) $$,
  '23514', null, 'a statement of two debts at once is refused'
);
-- With no debt there is no owner, so row level security refuses the row before
-- the shape constraint is reached. The constraint itself is proved by the case
-- above, where a resolvable owner lets the insert reach it.
select throws_ok(
  $$ insert into public.debt_statements (competence, outstanding_balance, installment_amount, remaining_count)
     values ('2026-11-01', 100, 10, 1) $$,
  '42501', null, 'a statement of no debt is refused by row level security'
);
select throws_ok(
  $$ insert into public.debt_statements (loan_id, competence, outstanding_balance, installment_amount, remaining_count)
     values ('11111111-0000-4000-8000-000000000001', '2026-11-15', 100, 10, 1) $$,
  '23514', null, 'a competence that is not the first of the month is refused'
);
select throws_ok(
  $$ insert into public.debt_statements (loan_id, competence, outstanding_balance, installment_amount, remaining_count)
     values ('11111111-0000-4000-8000-000000000001', '2026-11-01', -1, 10, 1) $$,
  '23514', null, 'a negative balance is refused'
);
select throws_ok(
  $$ insert into public.debt_statements (loan_id, competence, outstanding_balance, installment_amount, remaining_count)
     values ('11111111-0000-4000-8000-000000000001', '2026-11-01', 100, 0, 1) $$,
  '23514', null, 'an instalment of zero is refused'
);
select throws_ok(
  $$ insert into public.debt_statements (loan_id, competence, outstanding_balance, installment_amount, insurance_amount, remaining_count)
     values ('11111111-0000-4000-8000-000000000001', '2026-11-01', 100, 10, -1, 1) $$,
  '23514', null, 'a negative insurance is refused'
);

-- One statement per competence, per debt
select throws_ok(
  $$ insert into public.debt_statements (financing_id, competence, outstanding_balance, installment_amount, remaining_count)
     values ('11111111-0000-4000-8000-000000000002', '2026-09-01', 1, 1, 1) $$,
  '23505', null, 'a second statement for the same month of the same debt is refused'
);
select lives_ok(
  $$ insert into public.debt_statements (loan_id, competence, outstanding_balance, installment_amount, remaining_count)
     values ('11111111-0000-4000-8000-000000000001', '2026-10-01', 4200.00, 578.34, 8) $$,
  'the same month of another debt is accepted'
);

-- Audit is stamped, never supplied
select is(
  (select created_by from public.debt_statements where id = 'dddddddd-0000-4000-8000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'the author is stamped from the session'
);

-- Deleting the debt takes its statements with it: they describe that contract
-- and nothing else.
select lives_ok(
  $$ insert into public.loans (id, owner_user_id, description, account_id, category_id, principal, interest_rate, interest_model, installment_count, start_date, first_due_date)
     values ('11111111-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', 'Outro',
             'aaaaaaaa-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             1000, 1, 'PRICE', 2, '2026-01-01', '2026-02-01') $$,
  'a second loan exists'
);
insert into public.debt_statements (loan_id, competence, outstanding_balance, installment_amount, remaining_count)
values ('11111111-0000-4000-8000-000000000003', '2026-02-01', 500, 505, 1);
delete from public.loans where id = '11111111-0000-4000-8000-000000000003';
select is(
  (select count(*)::int from public.debt_statements where loan_id = '11111111-0000-4000-8000-000000000003'),
  0,
  'deleting the debt deletes its statements'
);

-- Access
insert into public.financial_access_grants (id, owner_user_id, granted_user_id, permission)
values ('99999999-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'VIEW');

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is(
  (select count(*)::int from public.debt_statements where financing_id = '11111111-0000-4000-8000-000000000002'),
  2,
  'VIEW reads the statements of the owner'
);
select throws_ok(
  $$ insert into public.debt_statements (financing_id, competence, outstanding_balance, installment_amount, remaining_count)
     values ('11111111-0000-4000-8000-000000000002', '2026-12-01', 1, 1, 1) $$,
  '42501', null, 'VIEW cannot record a statement'
);

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
update public.financial_access_grants set permission = 'MANAGE' where id = '99999999-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.debt_statements (financing_id, competence, outstanding_balance, installment_amount, remaining_count)
     values ('11111111-0000-4000-8000-000000000002', '2026-12-01', 182000, 1127, 391) $$,
  'MANAGE records a statement for the owner'
);

select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is(
  (select count(*)::int from public.debt_statements),
  0,
  'a third party with no grant sees nothing'
);

set local role anon;
select is((select count(*)::int from public.debt_statements), 0, 'anon sees nothing');
reset role;

select * from finish();
rollback;
