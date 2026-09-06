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

insert into public.households (id, name) values ('dddddddd-0000-4000-8000-000000000001', 'Casa');
insert into public.household_members (household_id, user_id) values ('dddddddd-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222');
insert into public.accounts (id, owner_user_id, name, type, opening_balance)
values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Alice bank', 'BANK', 0);

insert into public.transactions (owner_user_id, kind, description, amount, date, status, category_id, account_id, destination_account_id, household_id)
values
  ('11111111-1111-1111-1111-111111111111', 'INCOME', 'Salary Sep', 5000, '2026-09-05', 'PAID',
   (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'INCOME' and name = 'Salário'),
   'aaaaaaaa-0000-4000-8000-000000000001', null, null),
  ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Paid Sep', 300.50, '2026-09-06', 'PAID',
   (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
   'aaaaaaaa-0000-4000-8000-000000000001', null, null),
  ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Pending Sep', 100, '2026-09-07', 'PENDING',
   (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
   'aaaaaaaa-0000-4000-8000-000000000001', null, null),
  ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Cancelled Sep', 999, '2026-09-08', 'CANCELLED',
   (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
   'aaaaaaaa-0000-4000-8000-000000000001', null, null),
  ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Household Sep', 200, '2026-09-09', 'PAID',
   (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Alimentação'),
   'aaaaaaaa-0000-4000-8000-000000000001', null, 'dddddddd-0000-4000-8000-000000000001'),
  ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Paid Aug', 400, '2026-08-10', 'PAID',
   (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
   'aaaaaaaa-0000-4000-8000-000000000001', null, null);

insert into public.accounts (id, owner_user_id, name, type)
values ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'Alice cash', 'CASH');
insert into public.transactions (owner_user_id, kind, description, amount, date, status, account_id, destination_account_id)
values ('11111111-1111-1111-1111-111111111111', 'TRANSFER', 'Transfer Sep', 700, '2026-09-10', 'PAID',
        'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002');

-- Owner totals
select is(
  (select total from public.monthly_transaction_totals where owner_user_id = '11111111-1111-1111-1111-111111111111' and month = '2026-09-01' and kind = 'INCOME'),
  5000::numeric,
  'income of the month is summed'
);
select is(
  (select sum(total) from public.monthly_transaction_totals where owner_user_id = '11111111-1111-1111-1111-111111111111' and month = '2026-09-01' and kind = 'EXPENSE'),
  600.50::numeric,
  'expenses of the month include pending and household ones, excluding cancelled'
);
select is(
  (select sum(transaction_count)::int from public.monthly_transaction_totals where month = '2026-09-01' and kind = 'EXPENSE'),
  3,
  'expense count of the month excludes the cancelled transaction'
);
select is_empty(
  $$ select 1 from public.monthly_transaction_totals where kind not in ('INCOME', 'EXPENSE') $$,
  'transfers never appear in the totals'
);
select is(
  (select total from public.monthly_transaction_totals where month = '2026-08-01' and kind = 'EXPENSE'),
  400::numeric,
  'previous month is a separate row'
);
select is(
  (select count(*)::int from public.monthly_transaction_totals where month = '2026-09-01' and kind = 'EXPENSE' and household_id is not null),
  1,
  'household expenses are reported on their own row'
);

-- Household member sees only the household rows
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is(
  (select count(*)::int from public.monthly_transaction_totals where owner_user_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'household member sees only the household totals of another member'
);
select is(
  (select total from public.monthly_transaction_totals where household_id = 'dddddddd-0000-4000-8000-000000000001'),
  200::numeric,
  'household total matches the tagged transaction'
);

-- Unrelated user sees nothing, grantee sees everything of the owner
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.monthly_transaction_totals), 0, 'unrelated user sees no totals');

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.financial_access_grants (owner_user_id, granted_user_id, permission)
values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'VIEW');

select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is(
  (select sum(total) from public.monthly_transaction_totals where owner_user_id = '11111111-1111-1111-1111-111111111111' and month = '2026-09-01' and kind = 'EXPENSE'),
  600.50::numeric,
  'VIEW grantee sees the owner totals'
);

-- Anonymous
set local role anon;
select is((select count(*)::int from public.monthly_transaction_totals), 0, 'anon sees no totals');
reset role;

select * from finish();
rollback;
