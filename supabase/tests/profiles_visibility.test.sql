begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'Alice@Example.com', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', '{"display_name": "Bob"}'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol@example.com', '{"display_name": "Carol"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is((select count(*)::int from public.profiles), 1, 'user starts seeing only the own profile');

-- Lookup by e-mail
select results_eq(
  $$ select id, display_name from public.lookup_user_by_email(' bob@EXAMPLE.com ') $$,
  $$ values ('22222222-2222-2222-2222-222222222222'::uuid, 'Bob') $$,
  'lookup finds an exact e-mail ignoring case and surrounding spaces'
);
select is_empty($$ select * from public.lookup_user_by_email('nobody@example.com') $$, 'lookup returns nothing for an unknown e-mail');
select is_empty($$ select * from public.lookup_user_by_email('bob') $$, 'lookup does not match partial e-mails');

-- Visibility through a grant
insert into public.financial_access_grants (id, owner_user_id, granted_user_id, permission)
values ('99999999-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'VIEW');
select is((select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'), 'Bob', 'owner sees the grantee profile');
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'Alice', 'grantee sees the owner profile');
select is((select count(*)::int from public.profiles where id = '33333333-3333-3333-3333-333333333333'), 0, 'grantee does not see unrelated profiles');
select lives_ok($$ update public.profiles set display_name = 'X' where id = '11111111-1111-1111-1111-111111111111' $$, 'grantee update on the owner profile affects no rows');

-- Visibility through a household
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
insert into public.households (id, name) values ('dddddddd-0000-4000-8000-000000000001', 'Casa');
insert into public.household_members (household_id, user_id) values ('dddddddd-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222');
select is((select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'), 'Bob', 'household admin sees the member profile');
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select display_name from public.profiles where id = '33333333-3333-3333-3333-333333333333'), 'Carol', 'member sees the co-member profile');
select is((select count(*)::int from public.profiles), 3, 'member sees self, grant counterpart and co-member');

-- Revoked grant and inactive membership hide profiles again
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
update public.financial_access_grants set revoked_at = now() where id = '99999999-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
update public.household_members set status = 'INACTIVE' where household_id = 'dddddddd-0000-4000-8000-000000000001' and user_id = '22222222-2222-2222-2222-222222222222';
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.profiles), 1, 'after revocation and removal only the own profile remains visible');

reset role;
select is((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'Alice', 'owner profile unchanged');

-- Anonymous
set local role anon;
select is((select count(*)::int from public.profiles), 0, 'anon sees no profiles');
select throws_ok($$ select * from public.lookup_user_by_email('bob@example.com') $$, '42501', null, 'anon cannot execute lookup_user_by_email');
reset role;

select * from finish();
rollback;
