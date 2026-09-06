begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', '{"display_name": "Bob"}');

-- Owner (Alice)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select is((select count(*)::int from public.accounts), 0, 'new user starts without accounts');
select lives_ok(
  $$ insert into public.accounts (owner_user_id, name, type, institution, opening_balance) values ('11111111-1111-1111-1111-111111111111', 'Conta corrente', 'BANK', 'Banco X', 1500.50) $$,
  'owner can insert a bank account'
);
select lives_ok(
  $$ insert into public.accounts (owner_user_id, name, type) values ('11111111-1111-1111-1111-111111111111', 'Vale alimentação', 'BENEFIT') $$,
  'owner can insert a benefit account'
);
select is(
  (select opening_balance from public.accounts where name = 'Conta corrente'),
  1500.50::numeric,
  'opening_balance is stored with two decimals'
);
select is(
  (select opening_balance from public.accounts where name = 'Vale alimentação'),
  0::numeric,
  'opening_balance defaults to 0'
);
select is(
  (select created_by from public.accounts where name = 'Conta corrente'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'created_by is filled with the authenticated user'
);
select lives_ok(
  $$ update public.accounts set name = 'Conta principal' where name = 'Conta corrente' $$,
  'owner can update an account'
);
select is(
  (select updated_by from public.accounts where name = 'Conta principal'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'updated_by is filled on update'
);
select lives_ok(
  $$ delete from public.accounts where name = 'Vale alimentação' $$,
  'owner can delete an account'
);

-- Constraints
select throws_ok(
  $$ insert into public.accounts (owner_user_id, name, type) values ('11111111-1111-1111-1111-111111111111', 'conta PRINCIPAL', 'CASH') $$,
  '23505',
  null,
  'account names are unique per owner, case-insensitively'
);
select throws_ok(
  $$ insert into public.accounts (owner_user_id, name, type) values ('11111111-1111-1111-1111-111111111111', '', 'CASH') $$,
  '23514',
  null,
  'empty account name is rejected'
);
select throws_ok(
  $$ insert into public.accounts (owner_user_id, name, type, color) values ('11111111-1111-1111-1111-111111111111', 'Carteira', 'CASH', 'red') $$,
  '23514',
  null,
  'invalid color format is rejected'
);
select throws_ok(
  $$ insert into public.accounts (owner_user_id, name, type) values ('11111111-1111-1111-1111-111111111111', 'Cripto', 'WALLET') $$,
  '22P02',
  null,
  'unknown account type is rejected'
);
select throws_ok(
  $$ insert into public.accounts (owner_user_id, name, type) values ('22222222-2222-2222-2222-222222222222', 'Intrusa', 'CASH') $$,
  '42501',
  null,
  'owner cannot insert an account for another user'
);

-- Another user (Bob)
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.accounts), 0, 'unrelated user sees no accounts of another owner');
select lives_ok(
  $$ update public.accounts set opening_balance = 999999 where owner_user_id = '11111111-1111-1111-1111-111111111111' $$,
  'update on another owner accounts affects no rows'
);
select lives_ok(
  $$ delete from public.accounts where owner_user_id = '11111111-1111-1111-1111-111111111111' $$,
  'delete on another owner accounts affects no rows'
);

reset role;
select is(
  (select opening_balance from public.accounts where name = 'Conta principal'),
  1500.50::numeric,
  'another user did not modify the owner account'
);
select is((select count(*)::int from public.accounts where owner_user_id = '11111111-1111-1111-1111-111111111111'), 1, 'another user did not delete the owner account');

-- Anonymous
set local role anon;
select is((select count(*)::int from public.accounts), 0, 'anon sees no accounts');
reset role;

select * from finish();
rollback;
