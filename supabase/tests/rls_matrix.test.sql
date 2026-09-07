-- The permission matrix of MASTER_PROMPT section 61, applied to every table in
-- `public` by a loop instead of table by table. Coverage used to grow one
-- version at a time and was uneven; here a table that gains no policy fails the
-- moment it is created.

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', '{"display_name": "Bob"}'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol@example.com', '{"display_name": "Carol"}');

-- Every table carries row level security, at least one policy, and no policy
-- open to anon or public. A new table without a policy fails right here.
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'matrix: every table has row level security enabled'
);

select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')
        and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) $$,
  'matrix: every table has at least one policy'
);

-- Every table that belongs to an owner has the four commands covered, so a
-- table with only a select policy cannot slip through.
select is_empty(
  $$
    select c.relname || ' misses ' || cmd
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) as commands(cmd)
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and exists (
        select 1 from information_schema.columns col
         where col.table_schema = 'public' and col.table_name = c.relname
           and col.column_name = 'owner_user_id'
      )
      and not exists (
        select 1 from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname
           and (p.cmd = commands.cmd or p.cmd = 'ALL')
      )
  $$,
  'matrix: every owned table covers select, insert, update and delete'
);

select is_empty(
  $$ select policyname from pg_policies where schemaname = 'public' and 'anon' = any(roles) $$,
  'matrix: no policy is granted to anon'
);

select is_empty(
  $$ select policyname from pg_policies where schemaname = 'public' and 'public' = any(roles) $$,
  'matrix: no policy is granted to public'
);

-- Alice owns data; Bob receives a grant; Carol stays unrelated.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.accounts (id, owner_user_id, name, type, opening_balance)
values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Alice bank', 'BANK', 1000);
insert into public.transactions (id, owner_user_id, kind, description, amount, date, category_id, account_id)
values ('aaaaaaaa-0000-4000-8000-0000000000e1', '11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Alice expense', 100, '2026-09-05',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
        'aaaaaaaa-0000-4000-8000-000000000001');
insert into public.credit_cards (id, owner_user_id, name, closing_day, due_day)
values ('aaaaaaaa-0000-4000-8000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'Alice card', 10, 20);
insert into public.loans (id, owner_user_id, description, account_id, category_id, principal, interest_rate, interest_model, installment_count, start_date, first_due_date)
values ('aaaaaaaa-0000-4000-8000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'Alice loan', 'aaaaaaaa-0000-4000-8000-000000000001',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
        1000, 1, 'PRICE', 12, '2026-09-05', '2026-10-10');
insert into public.financings (id, owner_user_id, description, account_id, category_id, asset_value, down_payment, interest_rate, system, installment_count, acquisition_date, first_due_date)
values ('aaaaaaaa-0000-4000-8000-0000000000b1', '11111111-1111-1111-1111-111111111111', 'Alice financing', 'aaaaaaaa-0000-4000-8000-000000000001',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
        1000, 200, 1, 'SAC', 12, '2026-09-05', '2026-10-10');
insert into public.fixed_expenses (id, owner_user_id, description, category_id, account_id, default_amount, due_day, frequency)
values ('aaaaaaaa-0000-4000-8000-0000000000d1', '11111111-1111-1111-1111-111111111111', 'Alice fixed',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
        'aaaaaaaa-0000-4000-8000-000000000001', 100, 10, 'MONTHLY');
insert into public.recurring_incomes (id, owner_user_id, description, category_id, account_id, default_amount, receipt_day, frequency)
values ('aaaaaaaa-0000-4000-8000-0000000000e2', '11111111-1111-1111-1111-111111111111', 'Alice income',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'INCOME' and name = 'Outros'),
        'aaaaaaaa-0000-4000-8000-000000000001', 100, 10, 'MONTHLY');

-- Owner: reads and writes everything of their own.
select is((select count(*)::int from public.accounts), 1, 'owner: reads own accounts');
select is((select count(*)::int from public.loans), 1, 'owner: reads own loans');
select is((select count(*)::int from public.financings), 1, 'owner: reads own financings');
select lives_ok($$ update public.accounts set name = 'Renamed' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$, 'owner: updates own account');
select lives_ok($$ update public.accounts set name = 'Alice bank' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$, 'owner: restores own account');

-- Unrelated user: reads nothing of the owner, on every table of the matrix.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.accounts where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'unrelated: no accounts');
select is((select count(*)::int from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'unrelated: no categories');
select is((select count(*)::int from public.credit_cards where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'unrelated: no cards');
select is((select count(*)::int from public.transactions where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'unrelated: no transactions');
select is((select count(*)::int from public.loans where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'unrelated: no loans');
select is((select count(*)::int from public.financings where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'unrelated: no financings');
select is((select count(*)::int from public.fixed_expenses where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'unrelated: no fixed expenses');
select is((select count(*)::int from public.recurring_incomes where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'unrelated: no recurring incomes');

-- VIEW: reads everything, writes nothing.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.financial_access_grants (id, owner_user_id, granted_user_id, permission)
values ('99999999-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'VIEW');

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.accounts where owner_user_id = '11111111-1111-1111-1111-111111111111'), 1, 'VIEW: reads accounts');
select is((select count(*)::int from public.credit_cards where owner_user_id = '11111111-1111-1111-1111-111111111111'), 1, 'VIEW: reads cards');
select is((select count(*)::int from public.loans where owner_user_id = '11111111-1111-1111-1111-111111111111'), 1, 'VIEW: reads loans');
select is((select count(*)::int from public.financings where owner_user_id = '11111111-1111-1111-1111-111111111111'), 1, 'VIEW: reads financings');
select is((select count(*)::int from public.fixed_expenses where owner_user_id = '11111111-1111-1111-1111-111111111111'), 1, 'VIEW: reads fixed expenses');
select is((select count(*)::int from public.recurring_incomes where owner_user_id = '11111111-1111-1111-1111-111111111111'), 1, 'VIEW: reads recurring incomes');

select lives_ok($$ update public.loans set description = 'Hacked' where id = 'aaaaaaaa-0000-4000-8000-0000000000a1' $$, 'VIEW: update on a loan affects no rows');
select lives_ok($$ update public.financings set description = 'Hacked' where id = 'aaaaaaaa-0000-4000-8000-0000000000b1' $$, 'VIEW: update on a financing affects no rows');
select lives_ok($$ delete from public.credit_cards where id = 'aaaaaaaa-0000-4000-8000-0000000000c1' $$, 'VIEW: delete on a card affects no rows');
select lives_ok($$ delete from public.fixed_expenses where id = 'aaaaaaaa-0000-4000-8000-0000000000d1' $$, 'VIEW: delete on a fixed expense affects no rows');

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is((select description from public.loans where id = 'aaaaaaaa-0000-4000-8000-0000000000a1'), 'Alice loan', 'VIEW: the loan was not changed');
select is((select description from public.financings where id = 'aaaaaaaa-0000-4000-8000-0000000000b1'), 'Alice financing', 'VIEW: the financing was not changed');
select is((select count(*)::int from public.credit_cards where id = 'aaaaaaaa-0000-4000-8000-0000000000c1'), 1, 'VIEW: the card was not deleted');
select is((select count(*)::int from public.fixed_expenses where id = 'aaaaaaaa-0000-4000-8000-0000000000d1'), 1, 'VIEW: the fixed expense was not deleted');

-- MANAGE: reads and writes the owner data, but never the grants.
select lives_ok($$ update public.financial_access_grants set permission = 'MANAGE' where id = '99999999-0000-4000-8000-000000000001' $$, 'owner upgrades the grant');
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select lives_ok($$ update public.loans set lender = 'Pelo gestor' where id = 'aaaaaaaa-0000-4000-8000-0000000000a1' $$, 'MANAGE: updates a loan of the owner');
select lives_ok($$ update public.financings set institution = 'Pelo gestor' where id = 'aaaaaaaa-0000-4000-8000-0000000000b1' $$, 'MANAGE: updates a financing of the owner');
select is((select updated_by from public.loans where id = 'aaaaaaaa-0000-4000-8000-0000000000a1'), '22222222-2222-2222-2222-222222222222'::uuid, 'MANAGE: updated_by records the manager');
select throws_ok(
  $$ insert into public.financial_access_grants (owner_user_id, granted_user_id, permission)
     values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'VIEW') $$,
  '42501', null, 'MANAGE: cannot share the owner finances with a third user'
);

-- Transitivity: Carol manages Bob and still sees nothing of Alice.
insert into public.accounts (owner_user_id, name, type) values ('22222222-2222-2222-2222-222222222222', 'Bob bank', 'BANK');
insert into public.financial_access_grants (owner_user_id, granted_user_id, permission)
values ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'MANAGE');

select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.accounts where owner_user_id = '22222222-2222-2222-2222-222222222222'), 1, 'transitivity: Carol sees Bob accounts');
select is((select count(*)::int from public.loans where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'transitivity: Carol sees no Alice loan through Bob');
select is((select count(*)::int from public.financings where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'transitivity: Carol sees no Alice financing through Bob');
select is((select count(*)::int from public.transactions where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'transitivity: Carol sees no Alice transaction through Bob');

-- Anonymous reads nothing anywhere.
set local role anon;
select is((select count(*)::int from public.accounts), 0, 'anon: no accounts');
select is((select count(*)::int from public.transactions), 0, 'anon: no transactions');
select is((select count(*)::int from public.loans), 0, 'anon: no loans');
select is((select count(*)::int from public.financings), 0, 'anon: no financings');
select is((select count(*)::int from public.credit_cards), 0, 'anon: no cards');
select is((select count(*)::int from public.fixed_expenses), 0, 'anon: no fixed expenses');
select is((select count(*)::int from public.recurring_incomes), 0, 'anon: no recurring incomes');
select is((select count(*)::int from public.transaction_allocations), 0, 'anon: no allocations');
select is((select count(*)::int from public.households), 0, 'anon: no households');
select is((select count(*)::int from public.profiles), 0, 'anon: no profiles');
reset role;

select * from finish();
rollback;
