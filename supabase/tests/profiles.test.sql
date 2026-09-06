begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', '{}');

-- Trigger behavior
select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Alice',
  'profile is created with display_name from user metadata'
);
select is(
  (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'bob',
  'profile falls back to the email prefix when metadata has no display_name'
);
select is(
  (select count(*)::int from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111'),
  16,
  'new profile receives the 16 default categories'
);
select is(
  (select count(*)::int from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'INCOME'),
  7,
  'default categories include 7 income categories'
);

update public.profiles set updated_at = '2000-01-01', display_name = 'Alice B.' where id = '11111111-1111-1111-1111-111111111111';
select ok(
  (select updated_at > '2000-01-01'::timestamptz from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'updated_at is refreshed by trigger on update'
);

-- Owner access
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  'owner sees only the own profile'
);
select lives_ok(
  $$ update public.profiles set display_name = 'Alice Updated' where id = '11111111-1111-1111-1111-111111111111' $$,
  'owner can update the own profile'
);
select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Alice Updated',
  'owner update is persisted'
);
select throws_ok(
  $$ insert into public.profiles (id, display_name) values ('33333333-3333-3333-3333-333333333333', 'Intruder') $$,
  '42501',
  null,
  'client cannot insert profiles directly'
);
select lives_ok(
  $$ update public.profiles set display_name = 'Hacked' where id = '22222222-2222-2222-2222-222222222222' $$,
  'update on another profile affects no rows'
);
select lives_ok(
  $$ delete from public.profiles where id = '11111111-1111-1111-1111-111111111111' $$,
  'delete statement is accepted but denied by the absence of a policy'
);

reset role;
select is(
  (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'bob',
  'another user profile was not modified'
);
select is(
  (select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  1,
  'profile was not deleted by the client'
);

-- Anonymous access
set local role anon;
select is((select count(*)::int from public.profiles), 0, 'anon sees no profiles');
reset role;

select * from finish();
rollback;
