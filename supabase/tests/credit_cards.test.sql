begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', '{"display_name": "Bob"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select is((select count(*)::int from public.credit_cards), 0, 'new user starts without cards');
select lives_ok(
  $$ insert into public.credit_cards (id, owner_user_id, name, institution, limit_amount, closing_day, due_day)
     values ('cccccccc-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cartão', 'Banco', 5000, 20, 5) $$,
  'owner creates a card'
);
select is((select created_by from public.credit_cards where name = 'Cartão'), '11111111-1111-1111-1111-111111111111'::uuid, 'created_by is filled');
select is((select active from public.credit_cards where name = 'Cartão'), true, 'card starts active');
select lives_ok(
  $$ insert into public.credit_cards (owner_user_id, name, closing_day, due_day) values ('11111111-1111-1111-1111-111111111111', 'Sem limite', 1, 10) $$,
  'limit is optional'
);
select lives_ok($$ update public.credit_cards set name = 'Cartão principal' where name = 'Cartão' $$, 'owner renames a card');
select lives_ok($$ update public.credit_cards set active = false where name = 'Sem limite' $$, 'owner deactivates a card');
select lives_ok($$ delete from public.credit_cards where name = 'Sem limite' $$, 'owner deletes an unused card');

-- Constraints
select throws_ok(
  $$ insert into public.credit_cards (owner_user_id, name, closing_day, due_day) values ('11111111-1111-1111-1111-111111111111', 'cartão PRINCIPAL', 5, 15) $$,
  '23505', null, 'card names are unique per owner, case-insensitively'
);
select throws_ok(
  $$ insert into public.credit_cards (owner_user_id, name, closing_day, due_day) values ('11111111-1111-1111-1111-111111111111', 'Zero', 0, 10) $$,
  '23514', null, 'closing day below 1 is rejected'
);
select throws_ok(
  $$ insert into public.credit_cards (owner_user_id, name, closing_day, due_day) values ('11111111-1111-1111-1111-111111111111', 'Alto', 15, 32) $$,
  '23514', null, 'due day above 31 is rejected'
);
select throws_ok(
  $$ insert into public.credit_cards (owner_user_id, name, closing_day, due_day, limit_amount) values ('11111111-1111-1111-1111-111111111111', 'Negativo', 15, 20, -1) $$,
  '23514', null, 'negative limit is rejected'
);
select throws_ok(
  $$ insert into public.credit_cards (owner_user_id, name, closing_day, due_day) values ('22222222-2222-2222-2222-222222222222', 'Intruso', 10, 20) $$,
  '42501', null, 'owner cannot create a card for another user'
);

-- Sharing
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.credit_cards), 0, 'unrelated user sees no cards');
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.financial_access_grants (id, owner_user_id, granted_user_id, permission)
values ('99999999-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'VIEW');

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.credit_cards), 1, 'VIEW grantee sees the owner cards');
select throws_ok(
  $$ insert into public.credit_cards (owner_user_id, name, closing_day, due_day) values ('11111111-1111-1111-1111-111111111111', 'Pelo VIEW', 10, 20) $$,
  '42501', null, 'VIEW cannot create a card for the owner'
);
select lives_ok($$ update public.credit_cards set name = 'Hacked' where id = 'cccccccc-0000-4000-8000-000000000001' $$, 'VIEW update affects no rows');

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
update public.financial_access_grants set permission = 'MANAGE' where id = '99999999-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.credit_cards (owner_user_id, name, closing_day, due_day) values ('11111111-1111-1111-1111-111111111111', 'Pelo MANAGE', 10, 20) $$,
  'MANAGE creates a card for the owner'
);
select is((select owner_user_id from public.credit_cards where name = 'Pelo MANAGE'), '11111111-1111-1111-1111-111111111111'::uuid, 'the owner remains the owner');

-- A card in use cannot be deleted
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.transactions (owner_user_id, kind, description, amount, date, category_id, credit_card_id)
values ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Compra', 100, '2026-09-10',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
        'cccccccc-0000-4000-8000-000000000001');
select throws_ok(
  $$ delete from public.credit_cards where id = 'cccccccc-0000-4000-8000-000000000001' $$,
  '23503', null, 'card with transactions cannot be deleted'
);
select lives_ok(
  $$ update public.credit_cards set active = false where id = 'cccccccc-0000-4000-8000-000000000001' $$,
  'card with transactions can be deactivated'
);

set local role anon;
select is((select count(*)::int from public.credit_cards), 0, 'anon sees no cards');
reset role;

select * from finish();
rollback;
