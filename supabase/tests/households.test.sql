begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', '{"display_name": "Bob"}'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol@example.com', '{"display_name": "Carol"}');

-- Alice creates a household
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.households (id, name) values ('dddddddd-0000-4000-8000-000000000001', 'Casa') $$,
  'user creates a household'
);
select is((select role from public.household_members where household_id = 'dddddddd-0000-4000-8000-000000000001' and user_id = '11111111-1111-1111-1111-111111111111'), 'ADMIN'::public.household_role, 'creator becomes ADMIN');
select is((select created_by from public.households where id = 'dddddddd-0000-4000-8000-000000000001'), '11111111-1111-1111-1111-111111111111'::uuid, 'created_by is the creator');
select lives_ok(
  $$ insert into public.households (id, name, created_by) values ('dddddddd-0000-4000-8000-00000000000f', 'Forged', '22222222-2222-2222-2222-222222222222') $$,
  'insert with a foreign created_by is accepted'
);
select is((select created_by from public.households where id = 'dddddddd-0000-4000-8000-00000000000f'), '11111111-1111-1111-1111-111111111111'::uuid, 'forged creator is replaced by the authenticated user');
select is((select user_id from public.household_members where household_id = 'dddddddd-0000-4000-8000-00000000000f' and role = 'ADMIN'), '11111111-1111-1111-1111-111111111111'::uuid, 'the authenticated user becomes the ADMIN of the household');
select lives_ok($$ delete from public.households where id = 'dddddddd-0000-4000-8000-00000000000f' $$, 'creator deletes the extra household');
select lives_ok(
  $$ insert into public.household_members (household_id, user_id) values ('dddddddd-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222') $$,
  'ADMIN adds a member'
);
select is((select role from public.household_members where household_id = 'dddddddd-0000-4000-8000-000000000001' and user_id = '22222222-2222-2222-2222-222222222222'), 'MEMBER'::public.household_role, 'new member defaults to MEMBER');
select lives_ok($$ update public.households set name = 'Casa Nova' where id = 'dddddddd-0000-4000-8000-000000000001' $$, 'ADMIN renames the household');
select is((select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'), 'Bob', 'ADMIN sees the member profile');

-- Last administrator protection
select throws_ok(
  $$ update public.household_members set role = 'MEMBER' where household_id = 'dddddddd-0000-4000-8000-000000000001' and user_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'last ADMIN cannot be demoted'
);
select throws_ok(
  $$ update public.household_members set status = 'INACTIVE' where household_id = 'dddddddd-0000-4000-8000-000000000001' and user_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'last ADMIN cannot be deactivated'
);
select throws_ok(
  $$ delete from public.household_members where household_id = 'dddddddd-0000-4000-8000-000000000001' and user_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'last ADMIN cannot be deleted'
);
select throws_ok(
  $$ select public.leave_household('dddddddd-0000-4000-8000-000000000001') $$,
  '23514', null, 'last ADMIN cannot leave'
);

-- Bob as MEMBER
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.households), 1, 'member sees the household');
select is((select count(*)::int from public.household_members where household_id = 'dddddddd-0000-4000-8000-000000000001'), 2, 'member sees the members');
select is((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'Alice', 'member sees the admin profile');
select throws_ok(
  $$ insert into public.household_members (household_id, user_id) values ('dddddddd-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333') $$,
  '42501', null, 'MEMBER cannot add members'
);
select lives_ok($$ update public.household_members set role = 'ADMIN' where household_id = 'dddddddd-0000-4000-8000-000000000001' and user_id = '22222222-2222-2222-2222-222222222222' $$, 'MEMBER update on own role affects no rows');
select lives_ok($$ update public.households set name = 'Hacked' where id = 'dddddddd-0000-4000-8000-000000000001' $$, 'MEMBER rename affects no rows');
select lives_ok($$ delete from public.households where id = 'dddddddd-0000-4000-8000-000000000001' $$, 'MEMBER delete affects no rows');

reset role;
select is((select role from public.household_members where household_id = 'dddddddd-0000-4000-8000-000000000001' and user_id = '22222222-2222-2222-2222-222222222222'), 'MEMBER'::public.household_role, 'MEMBER role unchanged');
select is((select name from public.households where id = 'dddddddd-0000-4000-8000-000000000001'), 'Casa Nova', 'household name unchanged by member');

-- Carol (not a member)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.households), 0, 'non-member sees no household');
select is((select count(*)::int from public.household_members), 0, 'non-member sees no members');
select is((select count(*)::int from public.profiles where id <> '33333333-3333-3333-3333-333333333333'), 0, 'non-member sees no other profiles');

-- Promotion, demotion, removal and leaving
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok($$ update public.household_members set role = 'ADMIN' where household_id = 'dddddddd-0000-4000-8000-000000000001' and user_id = '22222222-2222-2222-2222-222222222222' $$, 'ADMIN promotes a member');
select lives_ok($$ update public.household_members set role = 'MEMBER' where household_id = 'dddddddd-0000-4000-8000-000000000001' and user_id = '11111111-1111-1111-1111-111111111111' $$, 'ADMIN demotes themselves once another ADMIN exists');

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.household_members (household_id, user_id) values ('dddddddd-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333') $$,
  'new ADMIN adds a member'
);

select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.households), 1, 'added member sees the household');
select lives_ok($$ select public.leave_household('dddddddd-0000-4000-8000-000000000001') $$, 'member leaves the household');
select is((select count(*)::int from public.households), 0, 'inactive member no longer sees the household');
select throws_ok($$ select public.leave_household('dddddddd-0000-4000-8000-000000000001') $$, 'P0002', null, 'leaving twice fails');

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select status from public.household_members where household_id = 'dddddddd-0000-4000-8000-000000000001' and user_id = '33333333-3333-3333-3333-333333333333'), 'INACTIVE'::public.household_member_status, 'leaving marks the membership INACTIVE');
select lives_ok(
  $$ insert into public.household_members (household_id, user_id, role) values ('dddddddd-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333', 'MEMBER')
     on conflict (household_id, user_id) do update set status = 'ACTIVE', role = excluded.role, joined_at = now() $$,
  'ADMIN re-adds an inactive member'
);
select lives_ok($$ update public.household_members set status = 'INACTIVE' where household_id = 'dddddddd-0000-4000-8000-000000000001' and user_id = '11111111-1111-1111-1111-111111111111' $$, 'ADMIN removes a member');

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is((select count(*)::int from public.households where id = 'dddddddd-0000-4000-8000-000000000001'), 0, 'removed member no longer sees the household');

-- Deleting the household cascades without tripping the last-admin guard
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select lives_ok($$ delete from public.households where id = 'dddddddd-0000-4000-8000-000000000001' $$, 'ADMIN deletes the household');
reset role;
select is((select count(*)::int from public.household_members where household_id = 'dddddddd-0000-4000-8000-000000000001'), 0, 'members are removed with the household');

-- Anonymous
set local role anon;
select is((select count(*)::int from public.households), 0, 'anon sees no households');
select throws_ok($$ select public.leave_household('dddddddd-0000-4000-8000-000000000001') $$, '42501', null, 'anon cannot execute leave_household');
reset role;

select * from finish();
rollback;
