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

select is((select count(*)::int from public.categories), 16, 'owner sees only the own categories');

select lives_ok(
  $$ insert into public.categories (owner_user_id, kind, name, color) values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Pets', '#1F7A5C') $$,
  'owner can insert a category'
);
select is(
  (select created_by from public.categories where name = 'Pets'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'created_by is filled with the authenticated user'
);
select is(
  (select updated_by from public.categories where name = 'Pets'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'updated_by is filled with the authenticated user'
);
select lives_ok(
  $$ insert into public.categories (owner_user_id, kind, name, created_by) values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Spoofed', '22222222-2222-2222-2222-222222222222') $$,
  'insert with a foreign created_by is accepted'
);
select is(
  (select created_by from public.categories where name = 'Spoofed'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'created_by supplied by the client is overridden by the authenticated user'
);

select lives_ok(
  $$ update public.categories set name = 'Animais', created_by = '22222222-2222-2222-2222-222222222222' where name = 'Pets' $$,
  'owner can update a category'
);
select is(
  (select created_by from public.categories where name = 'Animais'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'created_by is immutable on update'
);
select lives_ok(
  $$ delete from public.categories where name = 'Spoofed' $$,
  'owner can delete a category'
);
select is((select count(*)::int from public.categories where name = 'Spoofed'), 0, 'deleted category is gone');

-- Constraints
select throws_ok(
  $$ insert into public.categories (owner_user_id, kind, name) values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'moradia') $$,
  '23505',
  null,
  'category names are unique per owner and kind, case-insensitively'
);
select throws_ok(
  $$ insert into public.categories (owner_user_id, kind, name) values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', '') $$,
  '23514',
  null,
  'empty category name is rejected'
);
select throws_ok(
  $$ insert into public.categories (owner_user_id, kind, name, color) values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Viagem', 'green') $$,
  '23514',
  null,
  'invalid color format is rejected'
);
select throws_ok(
  $$ insert into public.categories (owner_user_id, kind, name) values ('22222222-2222-2222-2222-222222222222', 'EXPENSE', 'Intrusa') $$,
  '42501',
  null,
  'owner cannot insert a category for another user'
);
select throws_ok(
  $$ update public.categories set owner_user_id = '22222222-2222-2222-2222-222222222222' where name = 'Animais' $$,
  '42501',
  null,
  'owner cannot transfer a category to another user'
);

-- Another user (Bob)
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is(
  (select count(*)::int from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'unrelated user sees no categories of another owner'
);
select lives_ok(
  $$ update public.categories set name = 'Hacked' where owner_user_id = '11111111-1111-1111-1111-111111111111' $$,
  'update on another owner categories affects no rows'
);
select lives_ok(
  $$ delete from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' $$,
  'delete on another owner categories affects no rows'
);

reset role;
select is(
  (select count(*)::int from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111'),
  17,
  'another user did not modify or delete the owner categories'
);
select is((select count(*)::int from public.categories where name = 'Hacked'), 0, 'no category was renamed by another user');

-- Anonymous
set local role anon;
select is((select count(*)::int from public.categories), 0, 'anon sees no categories');
select throws_ok(
  $$ insert into public.categories (owner_user_id, kind, name) values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Anon') $$,
  '42501',
  null,
  'anon cannot insert categories'
);
reset role;

select * from finish();
rollback;
