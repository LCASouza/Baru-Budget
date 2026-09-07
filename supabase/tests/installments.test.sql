begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', '{"display_name": "Bob"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
insert into public.credit_cards (id, owner_user_id, name, closing_day, due_day)
values ('cccccccc-0000-4000-8000-0000000000b0', '22222222-2222-2222-2222-222222222222', 'Bob card', 10, 20);

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.credit_cards (id, owner_user_id, name, closing_day, due_day)
values ('cccccccc-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cartão', 20, 5);
insert into public.accounts (id, owner_user_id, name, type, opening_balance)
values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Bank', 'BANK', 5000);

-- Card: 900 in 3 instalments, purchased before the closing day
select lives_ok(
  $$ select public.create_installment_purchase(
       '11111111-1111-1111-1111-111111111111', 'Notebook', 900.00, 3, '2026-09-10',
       (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
       'cccccccc-0000-4000-8000-000000000001', null, null, null) $$,
  'owner creates an installment purchase on a card'
);
select is((select count(*)::int from public.transactions where description = 'Notebook'), 3, 'three instalments are created');
select results_eq(
  $$ select installment_number, amount, invoice_due_date, date, status::text
       from public.transactions where description = 'Notebook' order by installment_number $$,
  $$ values (1, 300.00::numeric, '2026-10-05'::date, '2026-09-10'::date, 'PAID'),
            (2, 300.00::numeric, '2026-11-05'::date, '2026-10-10'::date, 'PAID'),
            (3, 300.00::numeric, '2026-12-05'::date, '2026-11-10'::date, 'PAID') $$,
  'each instalment lands on the next invoice and on the next month'
);
select is(
  (select count(distinct installment_group_id)::int from public.transactions where description = 'Notebook'),
  1,
  'the instalments share one group'
);
select is(
  (select count(*)::int from public.transactions where description = 'Notebook' and account_id is not null),
  0,
  'card instalments have no account'
);
select is(
  (select count(*)::int from public.credit_card_invoices where credit_card_id = 'cccccccc-0000-4000-8000-000000000001'),
  3,
  'the purchase produces one invoice per instalment'
);
select is(
  (select total from public.credit_card_invoices where invoice_due_date = '2026-11-05'),
  300.00::numeric,
  'each invoice receives a single instalment'
);

-- Card: purchase after the closing day starts on the next invoice
select lives_ok(
  $$ select public.create_installment_purchase(
       '11111111-1111-1111-1111-111111111111', 'Fone', 300.00, 3, '2026-09-21',
       (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
       'cccccccc-0000-4000-8000-000000000001', null, null, null) $$,
  'a purchase after the closing day is accepted'
);
select is(
  (select min(invoice_due_date) from public.transactions where description = 'Fone'),
  '2026-11-05'::date,
  'it starts on the invoice after the closing'
);

-- Account: payment booklet
select lives_ok(
  $$ select public.create_installment_purchase(
       '11111111-1111-1111-1111-111111111111', 'Geladeira', 1000.00, 4, '2026-01-31',
       (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
       null, 'aaaaaaaa-0000-4000-8000-000000000001', null, null) $$,
  'owner creates an installment purchase on an account'
);
select results_eq(
  $$ select installment_number, amount, date, due_date, status::text, invoice_due_date
       from public.transactions where description = 'Geladeira' order by installment_number $$,
  $$ values (1, 250.00::numeric, '2026-01-31'::date, '2026-01-31'::date, 'PENDING', null::date),
            (2, 250.00::numeric, '2026-02-28'::date, '2026-02-28'::date, 'PENDING', null::date),
            (3, 250.00::numeric, '2026-03-31'::date, '2026-03-31'::date, 'PENDING', null::date),
            (4, 250.00::numeric, '2026-04-30'::date, '2026-04-30'::date, 'PENDING', null::date) $$,
  'account instalments are monthly, pending and clamped to the last day of the month'
);
select is(
  (select current_balance from public.account_balances where account_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  5000::numeric,
  'pending instalments do not move the account balance'
);

-- Rejections
select throws_ok(
  $$ select public.create_installment_purchase('11111111-1111-1111-1111-111111111111', 'Sem origem', 100, 2, '2026-09-10',
       (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
       null, null, null, null) $$,
  '23514', null, 'an installment purchase without an origin is rejected'
);
select throws_ok(
  $$ select public.create_installment_purchase('11111111-1111-1111-1111-111111111111', 'Duas origens', 100, 2, '2026-09-10',
       (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
       'cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', null, null) $$,
  '23514', null, 'an installment purchase with two origins is rejected'
);
select throws_ok(
  $$ select public.create_installment_purchase('11111111-1111-1111-1111-111111111111', 'Uma parcela', 100, 1, '2026-09-10',
       (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
       'cccccccc-0000-4000-8000-000000000001', null, null, null) $$,
  '23514', null, 'a single instalment is rejected'
);
select throws_ok(
  $$ select public.create_installment_purchase('11111111-1111-1111-1111-111111111111', 'Cartão alheio', 100, 2, '2026-09-10',
       (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
       'cccccccc-0000-4000-8000-0000000000b0', null, null, null) $$,
  '23503', null, 'a card of another user is rejected'
);

-- Shape constraint on the columns themselves
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id, installment_number, installment_count)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Sem grupo', 10, '2026-09-10',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
             'aaaaaaaa-0000-4000-8000-000000000001', 1, 3) $$,
  '23514', null, 'instalment numbering without a group is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id, installment_group_id, installment_number, installment_count)
     values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Fora da faixa', 10, '2026-09-10',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
             'aaaaaaaa-0000-4000-8000-000000000001', gen_random_uuid(), 5, 3) $$,
  '23514', null, 'an instalment number above the count is rejected'
);
select throws_ok(
  $$ insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, account_id, installment_group_id, installment_number, installment_count)
     values ('11111111-1111-1111-1111-111111111111', 'INCOME', 'Receita parcelada', 10, '2026-09-10',
             (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'INCOME' and name = 'Salário'),
             'aaaaaaaa-0000-4000-8000-000000000001', gen_random_uuid(), 1, 3) $$,
  '23514', null, 'an income cannot be split into instalments'
);

-- Sharing: VIEW cannot create, MANAGE can
insert into public.financial_access_grants (id, owner_user_id, granted_user_id, permission)
values ('99999999-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'VIEW');

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.create_installment_purchase('11111111-1111-1111-1111-111111111111', 'Pelo VIEW', 100, 2, '2026-09-10',
       (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
       'cccccccc-0000-4000-8000-000000000001', null, null, null) $$,
  '42501', null, 'VIEW cannot create an installment purchase for the owner'
);

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
update public.financial_access_grants set permission = 'MANAGE' where id = '99999999-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select lives_ok(
  $$ select public.create_installment_purchase('11111111-1111-1111-1111-111111111111', 'Pelo MANAGE', 100, 2, '2026-09-10',
       (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
       'cccccccc-0000-4000-8000-000000000001', null, null, null) $$,
  'MANAGE creates an installment purchase for the owner'
);
select is(
  (select count(distinct owner_user_id)::int from public.transactions where description = 'Pelo MANAGE'),
  1,
  'the instalments belong to the owner'
);
select is(
  (select created_by from public.transactions where description = 'Pelo MANAGE' limit 1),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'created_by records who registered them'
);

-- Deleting the group removes every instalment
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok(
  $$ delete from public.transactions where installment_group_id =
       (select installment_group_id from public.transactions where description = 'Notebook' limit 1) $$,
  'owner deletes the whole installment purchase'
);
select is((select count(*)::int from public.transactions where description = 'Notebook'), 0, 'every instalment is gone');

set local role anon;
select throws_ok(
  $$ select public.create_installment_purchase('11111111-1111-1111-1111-111111111111', 'Anon', 100, 2, '2026-09-10', null, null, null, null, null) $$,
  '42501', null, 'anon cannot execute create_installment_purchase'
);
reset role;

select * from finish();
rollback;
