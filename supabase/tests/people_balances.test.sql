begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The example of MASTER_PROMPT section 24: Pai owes 420, Esposa owes 150 and
-- Lucas owes 80 to Mãe.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lucas@example.com', '{"display_name": "Lucas"}'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pai@example.com', '{"display_name": "Pai"}'),
  ('30000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'esposa@example.com', '{"display_name": "Esposa"}'),
  ('40000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mae@example.com', '{"display_name": "Mae"}'),
  ('50000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outro@example.com', '{"display_name": "Outro"}');

set local role authenticated;

-- Lucas pays two expenses and allocates part of them
select set_config('request.jwt.claims', '{"sub": "10000000-0000-4000-8000-000000000001", "role": "authenticated"}', true);
insert into public.accounts (id, owner_user_id, name, type, opening_balance)
values ('aaaaaaaa-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Bank', 'BANK', 2000);
insert into public.transactions (id, owner_user_id, kind, description, amount, date, category_id, account_id)
values
  ('eeeeeeee-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'EXPENSE', 'Mercado', 600, '2026-09-10',
   (select id from public.categories where owner_user_id = '10000000-0000-4000-8000-000000000001' and kind = 'EXPENSE' and name = 'Alimentação'),
   'aaaaaaaa-0000-4000-8000-000000000001'),
  ('eeeeeeee-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'EXPENSE', 'Viagem', 300, '2026-09-11',
   (select id from public.categories where owner_user_id = '10000000-0000-4000-8000-000000000001' and kind = 'EXPENSE' and name = 'Lazer'),
   'aaaaaaaa-0000-4000-8000-000000000001');

select public.set_transaction_allocations('eeeeeeee-0000-4000-8000-000000000001',
  array['10000000-0000-4000-8000-000000000001'::uuid, '20000000-0000-4000-8000-000000000002'::uuid],
  array[180.00, 420.00]);
select public.set_transaction_allocations('eeeeeeee-0000-4000-8000-000000000002',
  array['10000000-0000-4000-8000-000000000001'::uuid, '30000000-0000-4000-8000-000000000003'::uuid],
  array[150.00, 150.00]);

-- Mãe pays something and allocates part to Lucas
select set_config('request.jwt.claims', '{"sub": "40000000-0000-4000-8000-000000000004", "role": "authenticated"}', true);
insert into public.accounts (id, owner_user_id, name, type)
values ('aaaaaaaa-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000004', 'Mae bank', 'BANK');
insert into public.transactions (id, owner_user_id, kind, description, amount, date, category_id, account_id)
values ('eeeeeeee-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000004', 'EXPENSE', 'Presente', 100, '2026-09-12',
        (select id from public.categories where owner_user_id = '40000000-0000-4000-8000-000000000004' and kind = 'EXPENSE' and name = 'Compras'),
        'aaaaaaaa-0000-4000-8000-000000000004');
select public.set_transaction_allocations('eeeeeeee-0000-4000-8000-000000000004',
  array['40000000-0000-4000-8000-000000000004'::uuid, '10000000-0000-4000-8000-000000000001'::uuid],
  array[20.00, 80.00]);

-- Lucas sees the three balances of the example
select set_config('request.jwt.claims', '{"sub": "10000000-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select results_eq(
  $$ select counterparty_user_id, balance from public.people_balances order by balance desc $$,
  $$ values ('20000000-0000-4000-8000-000000000002'::uuid, 420.00::numeric),
            ('30000000-0000-4000-8000-000000000003'::uuid, 150.00::numeric),
            ('40000000-0000-4000-8000-000000000004'::uuid, -80.00::numeric) $$,
  'the balances match the example of the specification'
);
select is(
  (select sum(balance) from public.people_balances where balance > 0),
  570.00::numeric,
  'receivables add up to 570'
);
select is(
  (select -sum(balance) from public.people_balances where balance < 0),
  80.00::numeric,
  'payables add up to 80'
);
select is((select sum(balance) from public.people_balances), 490.00::numeric, 'the net balance is 490');

-- The other side sees the same value with the opposite sign
select set_config('request.jwt.claims', '{"sub": "20000000-0000-4000-8000-000000000002", "role": "authenticated"}', true);
select results_eq(
  $$ select counterparty_user_id, balance from public.people_balances $$,
  $$ values ('10000000-0000-4000-8000-000000000001'::uuid, -420.00::numeric) $$,
  'the father sees that he owes 420'
);

-- A settlement reduces the debt in the right direction
select set_config('request.jwt.claims', '{"sub": "10000000-0000-4000-8000-000000000001", "role": "authenticated"}', true);
insert into public.transactions (owner_user_id, kind, description, amount, date, account_id, counterparty_user_id, settlement_direction)
values ('10000000-0000-4000-8000-000000000001', 'SETTLEMENT', 'Pix do Pai', 420, '2026-09-15',
        'aaaaaaaa-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'RECEIVE');
select is(
  (select balance from public.people_balances where counterparty_user_id = '20000000-0000-4000-8000-000000000002'),
  0.00::numeric,
  'receiving the settlement clears what the father owed'
);
insert into public.transactions (owner_user_id, kind, description, amount, date, account_id, counterparty_user_id, settlement_direction)
values ('10000000-0000-4000-8000-000000000001', 'SETTLEMENT', 'Pix para a Mãe', 80, '2026-09-16',
        'aaaaaaaa-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004', 'PAY');
select is(
  (select balance from public.people_balances where counterparty_user_id = '40000000-0000-4000-8000-000000000004'),
  0.00::numeric,
  'paying the settlement clears what was owed to the mother'
);
select is(
  (select amount from public.transactions where id = 'eeeeeeee-0000-4000-8000-000000000001'),
  600.00::numeric,
  'the settlement did not change the expense that created the debt'
);

-- Cancelled entries leave the balance
select lives_ok($$ update public.transactions set status = 'CANCELLED' where id = 'eeeeeeee-0000-4000-8000-000000000002' $$, 'owner cancels an expense');
select is(
  (select count(*)::int from public.people_balances where counterparty_user_id = '30000000-0000-4000-8000-000000000003'),
  0,
  'a cancelled expense leaves the balance'
);

-- An allocation to the payer never becomes a debt
select is(
  (select count(*)::int from public.people_balances where counterparty_user_id = '10000000-0000-4000-8000-000000000001'),
  0,
  'nobody owes themselves'
);

-- An unrelated user sees nothing
select set_config('request.jwt.claims', '{"sub": "50000000-0000-4000-8000-000000000005", "role": "authenticated"}', true);
select is((select count(*)::int from public.people_balances), 0, 'an unrelated user has no balance');

set local role anon;
select is((select count(*)::int from public.people_balances), 0, 'anon sees no balance');
reset role;

select * from finish();
rollback;
