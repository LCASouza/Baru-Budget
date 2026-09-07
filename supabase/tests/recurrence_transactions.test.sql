begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', '{"display_name": "Alice"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.accounts (id, owner_user_id, name, type)
values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Bank', 'BANK');
insert into public.fixed_expenses (id, owner_user_id, description, category_id, account_id, default_amount, due_day)
values ('ffffffff-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Aluguel',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Moradia'),
        'aaaaaaaa-0000-4000-8000-000000000001', 1850.00, 10);
insert into public.recurring_incomes (id, owner_user_id, description, category_id, account_id, default_amount, receipt_day)
values ('11111111-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Salário',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'INCOME' and name = 'Salário'),
        'aaaaaaaa-0000-4000-8000-000000000001', 5400.00, 5);

select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id, fixed_expense_id)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Sem competência', 10, '2026-09-10',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Moradia'),
             'aaaaaaaa-0000-4000-8000-000000000001', 'ffffffff-0000-4000-8000-000000000001') $$,
  '23514', null, 'a template link without a competence month is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id, fixed_expense_id, recurrence_month)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Meio do mês', 10, '2026-09-10',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Moradia'),
             'aaaaaaaa-0000-4000-8000-000000000001', 'ffffffff-0000-4000-8000-000000000001', '2026-09-15') $$,
  '23514', null, 'a competence month that is not the first day is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id, fixed_expense_id, recurring_income_id, recurrence_month)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Dois modelos', 10, '2026-09-10',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Moradia'),
             'aaaaaaaa-0000-4000-8000-000000000001', 'ffffffff-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', '2026-09-01') $$,
  '23514', null, 'linking two templates at once is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id, fixed_expense_id, recurrence_month)
     values ('11111111-1111-1111-1111-111111111111', 'INCOME', 'Receita com gasto fixo', 10, '2026-09-10',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'INCOME' and name = 'Salário'),
             'aaaaaaaa-0000-4000-8000-000000000001', 'ffffffff-0000-4000-8000-000000000001', '2026-09-01') $$,
  '23514', null, 'a fixed expense cannot back an income'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id, recurring_income_id, recurrence_month)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Despesa com receita recorrente', 10, '2026-09-10',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Moradia'),
             'aaaaaaaa-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', '2026-09-01') $$,
  '23514', null, 'a recurring income cannot back an expense'
);

-- One instance per template and month
select lives_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id, fixed_expense_id, recurrence_month)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Aluguel', 1850, '2026-09-10',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Moradia'),
             'aaaaaaaa-0000-4000-8000-000000000001', 'ffffffff-0000-4000-8000-000000000001', '2026-09-01') $$,
  'the first instance of the month is accepted'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id, fixed_expense_id, recurrence_month)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Aluguel de novo', 1850, '2026-09-10',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Moradia'),
             'aaaaaaaa-0000-4000-8000-000000000001', 'ffffffff-0000-4000-8000-000000000001', '2026-09-01') $$,
  '23505', null, 'a second instance of the same month is rejected'
);
select lives_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id, fixed_expense_id, recurrence_month)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Aluguel', 1850, '2026-10-10',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Moradia'),
             'aaaaaaaa-0000-4000-8000-000000000001', 'ffffffff-0000-4000-8000-000000000001', '2026-10-01') $$,
  'another month is accepted'
);
select lives_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Avulsa', 10, '2026-09-11',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Moradia'),
             'aaaaaaaa-0000-4000-8000-000000000001') $$,
  'ordinary transactions are unaffected'
);

select * from finish();
rollback;
