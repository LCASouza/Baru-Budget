begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', '{"display_name": "Bob"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
insert into public.accounts (id, owner_user_id, name, type, opening_balance)
values ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'Bob bank', 'BANK', 10);

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.accounts (id, owner_user_id, name, type, opening_balance)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Bank', 'BANK', 1000),
  ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'Meal voucher', 'BENEFIT', 50),
  ('aaaaaaaa-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', 'Cash', 'CASH', 0);

insert into public.transactions (owner_user_id, kind, description, amount, date, status, category_id, account_id, destination_account_id)
values
  ('11111111-1111-1111-1111-111111111111', 'INCOME', 'Salary', 500, '2026-09-05', 'PAID',
   (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'INCOME' and name = 'Salário'),
   'aaaaaaaa-0000-4000-8000-000000000001', null),
  ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Paid expense', 120.25, '2026-09-06', 'PAID',
   (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
   'aaaaaaaa-0000-4000-8000-000000000001', null),
  ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Pending expense', 999, '2026-09-06', 'PENDING',
   (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
   'aaaaaaaa-0000-4000-8000-000000000001', null),
  ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Cancelled expense', 50, '2026-09-06', 'CANCELLED',
   (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
   'aaaaaaaa-0000-4000-8000-000000000001', null),
  ('11111111-1111-1111-1111-111111111111', 'TRANSFER', 'Paid transfer', 200, '2026-09-07', 'PAID', null,
   'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002'),
  ('11111111-1111-1111-1111-111111111111', 'TRANSFER', 'Pending transfer', 30, '2026-09-08', 'PENDING', null,
   'aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001'),
  ('11111111-1111-1111-1111-111111111111', 'INCOME', 'Voucher credit', 700, '2026-09-05', 'PAID',
   (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'INCOME' and name = 'Benefício'),
   'aaaaaaaa-0000-4000-8000-000000000002', null);

select is((select count(*)::int from public.account_balances), 3, 'owner sees one balance row per own account');
select is(
  (select current_balance from public.account_balances where account_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1179.75::numeric,
  'bank balance = opening + paid income - paid expense - paid transfer out'
);
select is(
  (select current_balance from public.account_balances where account_id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  950.00::numeric,
  'benefit balance = opening + paid transfer in + paid income'
);
select is(
  (select current_balance from public.account_balances where account_id = 'aaaaaaaa-0000-4000-8000-000000000003'),
  0::numeric,
  'account without movements keeps the opening balance'
);
select is(
  (select opening_balance from public.account_balances where account_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1000::numeric,
  'view exposes the opening balance'
);

-- Another user (Bob)
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.account_balances), 1, 'unrelated user sees only the own balances');
select is(
  (select current_balance from public.account_balances where account_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  10::numeric,
  'unrelated user balance is unaffected by other owners'
);

-- Anonymous
set local role anon;
select is((select count(*)::int from public.account_balances), 0, 'anon sees no balances');
reset role;

select * from finish();
rollback;
