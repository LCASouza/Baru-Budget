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
  $$ insert into public.financings (id, owner_user_id, description, institution, account_id, category_id, asset_value, down_payment, interest_rate, system, installment_count, acquisition_date, first_due_date)
     values ('11111111-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Carro', 'Banco',
             'aaaaaaaa-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             60000, 15000, 1, 'SAC', 48, '2026-09-05', '2026-10-10') $$,
  'owner creates a financing'
);
select is(
  (select financed_amount from public.financings where id = '11111111-0000-4000-8000-000000000001'),
  45000.00::numeric,
  'the financed amount is the asset value minus the down payment'
);
select is((select interest_period from public.financings where id = '11111111-0000-4000-8000-000000000001'), 'MONTHLY'::public.interest_period, 'the rate period defaults to monthly');
select is((select created_by from public.financings where id = '11111111-0000-4000-8000-000000000001'), '11111111-1111-1111-1111-111111111111'::uuid, 'created_by is filled');

select lives_ok(
  $$ update public.financings set down_payment = 20000 where id = '11111111-0000-4000-8000-000000000001' $$,
  'owner changes the down payment'
);
select is(
  (select financed_amount from public.financings where id = '11111111-0000-4000-8000-000000000001'),
  40000.00::numeric,
  'the financed amount follows the down payment'
);
select throws_ok(
  $$ update public.financings set financed_amount = 1 where id = '11111111-0000-4000-8000-000000000001' $$,
  '428C9', null, 'the financed amount cannot be written by hand'
);
select lives_ok(
  $$ update public.financings set down_payment = 15000 where id = '11111111-0000-4000-8000-000000000001' $$,
  'the down payment goes back'
);

select lives_ok(
  $$ insert into public.financings (owner_user_id, description, account_id, category_id, asset_value, down_payment, interest_rate, system, installment_count, acquisition_date, first_due_date)
     values ('11111111-1111-1111-1111-111111111111', 'Sem entrada', 'aaaaaaaa-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             1200, 0, 0, 'PRICE', 12, '2026-09-05', '2026-10-10') $$,
  'a financing without a down payment and without interest is accepted'
);

-- Constraints
select throws_ok(
  $$ insert into public.financings (owner_user_id, description, account_id, category_id, asset_value, down_payment, interest_rate, system, installment_count, acquisition_date, first_due_date)
     values ('11111111-1111-1111-1111-111111111111', 'Bem zerado', 'aaaaaaaa-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             0, 0, 1, 'SAC', 12, '2026-09-05', '2026-10-10') $$,
  '23514', null, 'an asset value of zero is rejected'
);
select throws_ok(
  $$ insert into public.financings (owner_user_id, description, account_id, category_id, asset_value, down_payment, interest_rate, system, installment_count, acquisition_date, first_due_date)
     values ('11111111-1111-1111-1111-111111111111', 'Entrada total', 'aaaaaaaa-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             1000, 1000, 1, 'SAC', 12, '2026-09-05', '2026-10-10') $$,
  '23514', null, 'a down payment covering the whole asset is rejected: there is nothing to finance'
);
select throws_ok(
  $$ insert into public.financings (owner_user_id, description, account_id, category_id, asset_value, down_payment, interest_rate, system, installment_count, acquisition_date, first_due_date)
     values ('11111111-1111-1111-1111-111111111111', 'Entrada negativa', 'aaaaaaaa-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             1000, -1, 1, 'SAC', 12, '2026-09-05', '2026-10-10') $$,
  '23514', null, 'a negative down payment is rejected'
);
select throws_ok(
  $$ insert into public.financings (owner_user_id, description, account_id, category_id, asset_value, down_payment, interest_rate, system, installment_count, acquisition_date, first_due_date)
     values ('11111111-1111-1111-1111-111111111111', 'Taxa alta', 'aaaaaaaa-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             1000, 0, 100, 'SAC', 12, '2026-09-05', '2026-10-10') $$,
  '23514', null, 'a rate of 100% or more is rejected'
);
select throws_ok(
  $$ insert into public.financings (owner_user_id, description, account_id, category_id, asset_value, down_payment, interest_rate, system, installment_count, acquisition_date, first_due_date)
     values ('11111111-1111-1111-1111-111111111111', 'Sem parcelas', 'aaaaaaaa-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             1000, 0, 1, 'SAC', 0, '2026-09-05', '2026-10-10') $$,
  '23514', null, 'zero instalments are rejected'
);
select throws_ok(
  $$ insert into public.financings (owner_user_id, description, account_id, category_id, asset_value, down_payment, interest_rate, system, installment_count, acquisition_date, first_due_date)
     values ('11111111-1111-1111-1111-111111111111', 'Prazo absurdo', 'aaaaaaaa-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             1000, 0, 1, 'SAC', 481, '2026-09-05', '2026-10-10') $$,
  '23514', null, 'more than forty years of instalments is rejected'
);

-- References
select throws_ok(
  $$ insert into public.financings (owner_user_id, description, account_id, category_id, asset_value, down_payment, interest_rate, system, installment_count, acquisition_date, first_due_date)
     values ('11111111-1111-1111-1111-111111111111', 'Categoria de receita', 'aaaaaaaa-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'INCOME' and name = 'Salário'),
             1000, 0, 1, 'SAC', 12, '2026-09-05', '2026-10-10') $$,
  '23514', null, 'an income category is rejected for the instalments'
);
select throws_ok(
  $$ insert into public.financings (owner_user_id, description, account_id, category_id, asset_value, down_payment, interest_rate, system, installment_count, acquisition_date, first_due_date)
     values ('11111111-1111-1111-1111-111111111111', 'Conta alheia', 'bbbbbbbb-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             1000, 0, 1, 'SAC', 12, '2026-09-05', '2026-10-10') $$,
  '23503', null, 'an account of another user is rejected'
);
select throws_ok(
  $$ update public.financings set down_payment_category_id =
       (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'INCOME' and name = 'Salário')
      where id = '11111111-0000-4000-8000-000000000001' $$,
  '23514', null, 'an income category is rejected for the down payment'
);
select lives_ok(
  $$ update public.financings set down_payment_category_id =
       (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Moradia')
      where id = '11111111-0000-4000-8000-000000000001' $$,
  'the down payment can use an expense category of its own'
);
select lives_ok($$ update public.financings set institution = 'Outro banco' where id = '11111111-0000-4000-8000-000000000001' $$, 'owner edits the financing');

-- Sharing
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.financings), 0, 'unrelated user sees no financing');
select throws_ok(
  $$ insert into public.financings (owner_user_id, description, account_id, category_id, asset_value, down_payment, interest_rate, system, installment_count, acquisition_date, first_due_date)
     values ('11111111-1111-1111-1111-111111111111', 'Intruso', 'aaaaaaaa-0000-4000-8000-000000000001',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             1000, 0, 1, 'SAC', 12, '2026-09-05', '2026-10-10') $$,
  null, null, 'unrelated user cannot create a financing for the owner'
);
-- The reference trigger runs before the policy check, so the write stops on the
-- category the intruder cannot even see. Either way nothing is written.
select is((select count(*)::int from public.financings where description = 'Intruso'), 0, 'nothing was written for the owner');

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.financial_access_grants (id, owner_user_id, granted_user_id, permission)
values ('99999999-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'VIEW');

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.financings), 2, 'VIEW grantee sees the owner financings');
select lives_ok($$ update public.financings set asset_value = 1 where id = '11111111-0000-4000-8000-000000000001' $$, 'VIEW update affects no rows');
select lives_ok($$ delete from public.financings where id = '11111111-0000-4000-8000-000000000001' $$, 'VIEW delete affects no rows');

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is((select asset_value from public.financings where id = '11111111-0000-4000-8000-000000000001'), 60000::numeric, 'the financing was not changed by VIEW');
select lives_ok($$ update public.financial_access_grants set permission = 'MANAGE' where id = '99999999-0000-4000-8000-000000000001' $$, 'owner upgrades the grant to MANAGE');

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select lives_ok($$ update public.financings set institution = 'Pelo gestor' where id = '11111111-0000-4000-8000-000000000001' $$, 'MANAGE edits the owner financing');
select is((select updated_by from public.financings where id = '11111111-0000-4000-8000-000000000001'), '22222222-2222-2222-2222-222222222222'::uuid, 'updated_by records the manager');

set local role anon;
select is((select count(*)::int from public.financings), 0, 'anon sees no financing');
reset role;

select * from finish();
rollback;
