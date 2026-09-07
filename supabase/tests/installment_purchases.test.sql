begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', '{"display_name": "Bob"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.accounts (id, owner_user_id, name, type, opening_balance)
values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Bank', 'BANK', 0);

-- Four monthly instalments starting two months ago: two already past, two ahead.
select public.create_installment_purchase(
  '11111111-1111-1111-1111-111111111111', 'Geladeira', 1000.00, 4,
  (date_trunc('month', current_date) - interval '2 month' + interval '9 day')::date,
  (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
  null, 'aaaaaaaa-0000-4000-8000-000000000001', null, null
);

select is((select count(*)::int from public.installment_purchases), 1, 'one row per installment purchase');
select is((select description from public.installment_purchases), 'Geladeira', 'the description comes from the instalments');
select is((select installment_count from public.installment_purchases), 4, 'the instalment count is reported');
select is((select recorded_count from public.installment_purchases), 4, 'every instalment is recorded');
select is((select total_amount from public.installment_purchases), 1000.00::numeric, 'the total is the sum of the instalments');
select is((select account_id from public.installment_purchases), 'aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'the origin account is reported');
select is((select credit_card_id from public.installment_purchases), null, 'there is no card on an account purchase');
select is((select remaining_count from public.installment_purchases), 2, 'two instalments are still ahead');
select is((select remaining_amount from public.installment_purchases), 500.00::numeric, 'the remaining amount covers the future instalments');
select is(
  (select first_competence from public.installment_purchases),
  (date_trunc('month', current_date) - interval '2 month' + interval '9 day')::date,
  'the first competence is the first instalment'
);

-- A cancelled instalment leaves the purchase
select lives_ok(
  $$ update public.transactions set status = 'CANCELLED' where description = 'Geladeira' and installment_number = 4 $$,
  'owner cancels the last instalment'
);
select is((select recorded_count from public.installment_purchases), 3, 'the cancelled instalment is not counted');
select is((select total_amount from public.installment_purchases), 750.00::numeric, 'the total drops with the cancelled instalment');
select is((select remaining_count from public.installment_purchases), 1, 'only one instalment is still ahead');

-- Visibility
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.installment_purchases), 0, 'unrelated user sees no installment purchases');

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.financial_access_grants (owner_user_id, granted_user_id, permission)
values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'VIEW');
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.installment_purchases), 1, 'VIEW grantee sees the owner installment purchases');

set local role anon;
select is((select count(*)::int from public.installment_purchases), 0, 'anon sees no installment purchases');
reset role;

select * from finish();
rollback;
