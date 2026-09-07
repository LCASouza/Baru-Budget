begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', '{"display_name": "Bob"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
insert into public.accounts (id, owner_user_id, name, type)
values ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'Bob bank', 'BANK');

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.accounts (id, owner_user_id, name, type, opening_balance)
values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Bank', 'BANK', 0);

select lives_ok(
  $$ insert into public.loans (id, owner_user_id, description, lender, account_id, category_id, principal, interest_rate, interest_model, installment_count, start_date, first_due_date)
     values ('11111111-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Empréstimo', 'Banco',
             'aaaaaaaa-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             10000, 1.5, 'PRICE', 12, '2026-09-05', '2026-10-10') $$,
  'owner creates a loan'
);
select is((select interest_period from public.loans where id = '11111111-0000-4000-8000-000000000001'), 'MONTHLY'::public.interest_period, 'the rate period defaults to monthly');
select is((select created_by from public.loans where id = '11111111-0000-4000-8000-000000000001'), '11111111-1111-1111-1111-111111111111'::uuid, 'created_by is filled');
select lives_ok(
  $$ insert into public.loans (owner_user_id, description, account_id, category_id, principal, interest_rate, interest_model, installment_count, start_date, first_due_date)
     values ('11111111-1111-1111-1111-111111111111', 'Sem juros', 'aaaaaaaa-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             1200, 0, 'SIMPLE', 12, '2026-09-05', '2026-10-10') $$,
  'a loan without interest is accepted'
);

-- Constraints
select throws_ok(
  $$ insert into public.loans (owner_user_id, description, account_id, category_id, principal, interest_rate, interest_model, installment_count, start_date, first_due_date)
     values ('11111111-1111-1111-1111-111111111111', 'Zero', 'aaaaaaaa-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             0, 1, 'PRICE', 12, '2026-09-05', '2026-10-10') $$,
  '23514', null, 'a zero principal is rejected'
);
select throws_ok(
  $$ insert into public.loans (owner_user_id, description, account_id, category_id, principal, interest_rate, interest_model, installment_count, start_date, first_due_date)
     values ('11111111-1111-1111-1111-111111111111', 'Taxa alta', 'aaaaaaaa-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             1000, 100, 'PRICE', 12, '2026-09-05', '2026-10-10') $$,
  '23514', null, 'a rate of 100% or more is rejected'
);
select throws_ok(
  $$ insert into public.loans (owner_user_id, description, account_id, category_id, principal, interest_rate, interest_model, installment_count, start_date, first_due_date)
     values ('11111111-1111-1111-1111-111111111111', 'Sem parcelas', 'aaaaaaaa-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             1000, 1, 'PRICE', 0, '2026-09-05', '2026-10-10') $$,
  '23514', null, 'zero instalments are rejected'
);
select throws_ok(
  $$ insert into public.loans (owner_user_id, description, account_id, category_id, principal, interest_rate, interest_model, installment_count, start_date, first_due_date)
     values ('11111111-1111-1111-1111-111111111111', 'Categoria de receita', 'aaaaaaaa-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'INCOME' and name = 'Salário'),
             1000, 1, 'PRICE', 12, '2026-09-05', '2026-10-10') $$,
  '23514', null, 'an income category is rejected'
);
select throws_ok(
  $$ insert into public.loans (owner_user_id, description, account_id, category_id, principal, interest_rate, interest_model, installment_count, start_date, first_due_date)
     values ('11111111-1111-1111-1111-111111111111', 'Conta alheia', 'bbbbbbbb-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             1000, 1, 'PRICE', 12, '2026-09-05', '2026-10-10') $$,
  '23503', null, 'an account of another user is rejected'
);

select throws_ok(
  $$ update public.loans set disbursement_category_id =
       (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros')
      where id = '11111111-0000-4000-8000-000000000001' $$,
  '23514', null, 'an expense category is rejected for the disbursement'
);
select lives_ok(
  $$ update public.loans set disbursement_category_id =
       (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'INCOME' and name = 'Outros')
      where id = '11111111-0000-4000-8000-000000000001' $$,
  'an income category is accepted for the disbursement'
);
select lives_ok($$ update public.loans set lender = 'Outro banco' where id = '11111111-0000-4000-8000-000000000001' $$, 'owner edits the loan');

-- Sharing
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.loans), 0, 'unrelated user sees no loan');
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.financial_access_grants (id, owner_user_id, granted_user_id, permission)
values ('99999999-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'VIEW');
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.loans), 2, 'VIEW grantee sees the owner loans');
select lives_ok($$ update public.loans set principal = 1 where id = '11111111-0000-4000-8000-000000000001' $$, 'VIEW update affects no rows');
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is((select principal from public.loans where id = '11111111-0000-4000-8000-000000000001'), 10000::numeric, 'the loan was not changed by VIEW');

set local role anon;
select is((select count(*)::int from public.loans), 0, 'anon sees no loan');
reset role;

select * from finish();
rollback;
