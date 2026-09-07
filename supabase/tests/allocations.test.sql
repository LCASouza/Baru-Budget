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
values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Bank', 'BANK', 1000);
insert into public.transactions (id, owner_user_id, kind, description, amount, date, category_id, account_id)
values ('eeeeeeee-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Mercado', 600, '2026-09-10',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Alimentação'),
        'aaaaaaaa-0000-4000-8000-000000000001');
insert into public.transactions (id, owner_user_id, kind, description, amount, date, category_id, account_id)
values ('eeeeeeee-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'INCOME', 'Salário', 100, '2026-09-05',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'INCOME' and name = 'Salário'),
        'aaaaaaaa-0000-4000-8000-000000000001');

-- The split has to add up to the amount
select is(
  public.set_transaction_allocations('eeeeeeee-0000-4000-8000-000000000001',
    array['11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid],
    array[300.00, 300.00]),
  2,
  'a split that adds up is accepted'
);
select is((select count(*)::int from public.transaction_allocations), 2, 'one row per responsible person');
select throws_ok(
  $$ select public.set_transaction_allocations('eeeeeeee-0000-4000-8000-000000000001',
       array['11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid],
       array[300.00, 200.00]) $$,
  '23514', null, 'a split that does not add up is refused'
);
select throws_ok(
  $$ select public.set_transaction_allocations('eeeeeeee-0000-4000-8000-000000000001',
       array['11111111-1111-1111-1111-111111111111'::uuid], array[100.00, 200.00]) $$,
  '23514', null, 'a person without an amount is refused'
);
select is(
  public.set_transaction_allocations('eeeeeeee-0000-4000-8000-000000000001',
    array['11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid],
    array[400.00, 200.00]),
  2,
  'the split can be replaced by another one that adds up'
);
select is((select amount from public.transaction_allocations where user_id = '11111111-1111-1111-1111-111111111111'), 400.00::numeric, 'the replacement is applied');
select is(public.set_transaction_allocations('eeeeeeee-0000-4000-8000-000000000001', array[]::uuid[], array[]::numeric[]), 0, 'an empty split removes the allocations');
select is((select count(*)::int from public.transaction_allocations), 0, 'no allocation is left');

-- The invariant is checked at commit even when rows are written directly
select public.set_transaction_allocations('eeeeeeee-0000-4000-8000-000000000001',
  array['11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid],
  array[300.00, 300.00]);
-- The invariant is deferred to the end of the transaction, so the tests force it
-- with `set constraints all immediate`.
select throws_ok(
  $$ do $inner$
     begin
       delete from public.transaction_allocations where user_id = '22222222-2222-2222-2222-222222222222';
       set constraints all immediate;
     end
     $inner$ $$,
  '23514', null, 'deleting one side alone breaks the sum'
);
select throws_ok(
  $$ do $inner$
     begin
       update public.transactions set amount = 700 where id = 'eeeeeeee-0000-4000-8000-000000000001';
       set constraints all immediate;
     end
     $inner$ $$,
  '23514', null, 'changing the amount without adjusting the split fails'
);
select lives_ok(
  $$ do $inner$
     begin
       update public.transactions set amount = 700 where id = 'eeeeeeee-0000-4000-8000-000000000001';
       perform public.set_transaction_allocations('eeeeeeee-0000-4000-8000-000000000001',
         array['11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid],
         array[350.00, 350.00]);
       set constraints all immediate;
       set constraints all deferred;
     end
     $inner$ $$,
  'changing both in the same transaction is accepted'
);

-- Rejections
select throws_ok(
  $$ insert into public.transaction_allocations (transaction_id, user_id, amount)
     values ('eeeeeeee-0000-4000-8000-000000000002', '22222222-2222-2222-2222-222222222222', 100) $$,
  '23514', null, 'only an expense can be split'
);
select throws_ok(
  $$ insert into public.transaction_allocations (transaction_id, user_id, amount)
     values ('eeeeeeee-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 10) $$,
  '23505', null, 'the same person cannot appear twice'
);
select throws_ok(
  $$ insert into public.transaction_allocations (transaction_id, user_id, amount)
     values ('eeeeeeee-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333', 0) $$,
  '23514', null, 'a zero share is rejected'
);

-- The responsible person sees the expense and their own share, nothing else
insert into public.transactions (id, owner_user_id, kind, description, amount, date, category_id, account_id)
values ('eeeeeeee-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Só minha', 40, '2026-09-11',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Lazer'),
        'aaaaaaaa-0000-4000-8000-000000000001');

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.transactions where owner_user_id = '11111111-1111-1111-1111-111111111111'), 1, 'the responsible person sees only the shared expense');
select is((select description from public.transactions where owner_user_id = '11111111-1111-1111-1111-111111111111'), 'Mercado', 'and it is the right one');
select is((select count(*)::int from public.transaction_allocations), 2, 'the responsible person sees the split of that expense');
select is((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'Alice', 'and the name of who paid');
select is((select count(*)::int from public.accounts where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'but no account');
select is((select count(*)::int from public.account_balances where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'and no balance');
select throws_ok(
  $$ select public.set_transaction_allocations('eeeeeeee-0000-4000-8000-000000000001',
       array['22222222-2222-2222-2222-222222222222'::uuid], array[700.00]) $$,
  '42501', null, 'the responsible person cannot rewrite the split'
);
select lives_ok($$ update public.transaction_allocations set amount = 1 where user_id = '22222222-2222-2222-2222-222222222222' $$, 'their update affects no rows');

-- An unrelated user sees nothing
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.transaction_allocations), 0, 'an unrelated user sees no allocation');
select is((select count(*)::int from public.transactions where owner_user_id = '11111111-1111-1111-1111-111111111111'), 0, 'and no transaction');

-- MANAGE can rewrite the split
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.financial_access_grants (owner_user_id, granted_user_id, permission)
values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'MANAGE');
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is(
  public.set_transaction_allocations('eeeeeeee-0000-4000-8000-000000000001',
    array['11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid],
    array[500.00, 200.00]),
  2,
  'MANAGE rewrites the split of the owner'
);

-- Deleting the expense removes the split
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok($$ delete from public.transactions where id = 'eeeeeeee-0000-4000-8000-000000000001' $$, 'owner deletes the expense');
select is((select count(*)::int from public.transaction_allocations), 0, 'the split is gone with it');

set local role anon;
select is((select count(*)::int from public.transaction_allocations), 0, 'anon sees no allocation');
reset role;

select * from finish();
rollback;
