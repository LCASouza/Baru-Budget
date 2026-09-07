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
insert into public.categories (id, owner_user_id, kind, name)
values ('bbbbbbbb-0000-4000-8000-0000000000c1', '22222222-2222-2222-2222-222222222222', 'EXPENSE', 'Bob expense');

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.accounts (id, owner_user_id, name, type)
values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Bank', 'BANK');
insert into public.credit_cards (id, owner_user_id, name, closing_day, due_day)
values ('cccccccc-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cartão', 20, 5);

select lives_ok(
  $$ insert into public.fixed_expenses (id, owner_user_id, description, category_id, account_id, default_amount, due_day)
     values ('ffffffff-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Aluguel',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Moradia'),
             'aaaaaaaa-0000-4000-8000-000000000001', 1850.00, 10) $$,
  'owner creates a fixed expense on an account'
);
select is((select frequency from public.fixed_expenses where description = 'Aluguel'), 'MONTHLY'::public.recurrence_frequency, 'frequency defaults to monthly');
select is((select active from public.fixed_expenses where description = 'Aluguel'), true, 'template starts active');
select is((select created_by from public.fixed_expenses where description = 'Aluguel'), '11111111-1111-1111-1111-111111111111'::uuid, 'created_by is filled');

select lives_ok(
  $$ insert into public.fixed_expenses (owner_user_id, description, category_id, credit_card_id, default_amount, due_day)
     values ('11111111-1111-1111-1111-111111111111', 'Streaming',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Assinaturas'),
             'cccccccc-0000-4000-8000-000000000001', 49.90, 8) $$,
  'owner creates a fixed expense on a card'
);
select lives_ok(
  $$ insert into public.recurring_incomes (owner_user_id, description, category_id, account_id, default_amount, receipt_day)
     values ('11111111-1111-1111-1111-111111111111', 'Salário',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'INCOME' and name = 'Salário'),
             'aaaaaaaa-0000-4000-8000-000000000001', 5400.00, 5) $$,
  'owner creates a recurring income'
);
select lives_ok(
  $$ insert into public.fixed_expenses (owner_user_id, description, category_id, account_id, default_amount, due_day, frequency, anchor_month)
     values ('11111111-1111-1111-1111-111111111111', 'IPVA',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Transporte'),
             'aaaaaaaa-0000-4000-8000-000000000001', 900.00, 15, 'YEARLY', 1) $$,
  'owner creates a yearly fixed expense'
);

-- Constraints
select throws_ok(
  $$ insert into public.fixed_expenses (owner_user_id, description, category_id, account_id, credit_card_id, default_amount, due_day)
     values ('11111111-1111-1111-1111-111111111111', 'Duas origens',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', 10, 5) $$,
  '23514', null, 'a fixed expense with an account and a card is rejected'
);
select throws_ok(
  $$ insert into public.fixed_expenses (owner_user_id, description, category_id, default_amount, due_day)
     values ('11111111-1111-1111-1111-111111111111', 'Sem origem',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'), 10, 5) $$,
  '23514', null, 'a fixed expense without an origin is rejected'
);
select throws_ok(
  $$ insert into public.fixed_expenses (owner_user_id, description, category_id, account_id, default_amount, due_day)
     values ('11111111-1111-1111-1111-111111111111', 'Dia inválido',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             'aaaaaaaa-0000-4000-8000-000000000001', 10, 32) $$,
  '23514', null, 'a due day above 31 is rejected'
);
select throws_ok(
  $$ insert into public.fixed_expenses (owner_user_id, description, category_id, account_id, default_amount, due_day)
     values ('11111111-1111-1111-1111-111111111111', 'Valor zero',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             'aaaaaaaa-0000-4000-8000-000000000001', 0, 5) $$,
  '23514', null, 'a non positive amount is rejected'
);
select throws_ok(
  $$ insert into public.fixed_expenses (owner_user_id, description, category_id, account_id, default_amount, due_day, frequency)
     values ('11111111-1111-1111-1111-111111111111', 'Anual sem mês',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             'aaaaaaaa-0000-4000-8000-000000000001', 10, 5, 'YEARLY') $$,
  '23514', null, 'a yearly template without an anchor month is rejected'
);
select throws_ok(
  $$ insert into public.fixed_expenses (owner_user_id, description, category_id, account_id, default_amount, due_day)
     values ('11111111-1111-1111-1111-111111111111', 'Categoria de receita',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'INCOME' and name = 'Salário'),
             'aaaaaaaa-0000-4000-8000-000000000001', 10, 5) $$,
  '23514', null, 'an income category on a fixed expense is rejected'
);
select throws_ok(
  $$ insert into public.recurring_incomes (owner_user_id, description, category_id, account_id, default_amount, receipt_day)
     values ('11111111-1111-1111-1111-111111111111', 'Categoria de despesa',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             'aaaaaaaa-0000-4000-8000-000000000001', 10, 5) $$,
  '23514', null, 'an expense category on a recurring income is rejected'
);
select throws_ok(
  $$ insert into public.fixed_expenses (owner_user_id, description, category_id, account_id, default_amount, due_day)
     values ('11111111-1111-1111-1111-111111111111', 'Categoria alheia', 'bbbbbbbb-0000-4000-8000-0000000000c1',
             'aaaaaaaa-0000-4000-8000-000000000001', 10, 5) $$,
  '23503', null, 'a category of another user is rejected'
);
select throws_ok(
  $$ insert into public.fixed_expenses (owner_user_id, description, category_id, account_id, default_amount, due_day)
     values ('11111111-1111-1111-1111-111111111111', 'Conta alheia',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             'bbbbbbbb-0000-4000-8000-000000000001', 10, 5) $$,
  '23503', null, 'an account of another user is rejected'
);

-- Editing and deactivating
select lives_ok($$ update public.fixed_expenses set default_amount = 1900 where description = 'Aluguel' $$, 'owner edits the template');
select lives_ok($$ update public.fixed_expenses set active = false where description = 'IPVA' $$, 'owner deactivates a template');
select lives_ok($$ delete from public.fixed_expenses where description = 'IPVA' $$, 'owner deletes a template');

-- Sharing
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.fixed_expenses where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'unrelated user sees no templates');
select is((select count(*)::int from public.recurring_incomes where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'unrelated user sees no recurring incomes');

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.financial_access_grants (id, owner_user_id, granted_user_id, permission)
values ('99999999-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'VIEW');

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.fixed_expenses), 2, 'VIEW grantee sees the owner templates');
select throws_ok(
  $$ insert into public.fixed_expenses (owner_user_id, description, category_id, account_id, default_amount, due_day)
     values ('11111111-1111-1111-1111-111111111111', 'Pelo VIEW',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             'aaaaaaaa-0000-4000-8000-000000000001', 10, 5) $$,
  '42501', null, 'VIEW cannot create a template for the owner'
);
select lives_ok($$ update public.fixed_expenses set default_amount = 1 where id = 'ffffffff-0000-4000-8000-000000000001' $$, 'VIEW update affects no rows');

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is((select default_amount from public.fixed_expenses where id = 'ffffffff-0000-4000-8000-000000000001'), 1900::numeric, 'the template was not changed by VIEW');
update public.financial_access_grants set permission = 'MANAGE' where id = '99999999-0000-4000-8000-000000000001';

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.fixed_expenses (owner_user_id, description, category_id, account_id, default_amount, due_day)
     values ('11111111-1111-1111-1111-111111111111', 'Pelo MANAGE',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
             'aaaaaaaa-0000-4000-8000-000000000001', 10, 5) $$,
  'MANAGE creates a template for the owner'
);

set local role anon;
select is((select count(*)::int from public.fixed_expenses), 0, 'anon sees no templates');
select is((select count(*)::int from public.recurring_incomes), 0, 'anon sees no recurring incomes');
reset role;

select * from finish();
rollback;
