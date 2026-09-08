-- Realigning a schedule after the debt was edited (BUG-006). Generating only
-- inserts what is missing, so an edited loan or financing keeps instalments
-- carrying the old numbers until they are realigned on purpose.
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

insert into public.loans (id, owner_user_id, description, account_id, category_id, principal, interest_rate, interest_model, installment_count, start_date, first_due_date)
values ('11111111-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Empréstimo',
        'aaaaaaaa-0000-4000-8000-000000000001',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
        10000, 1.5, 'PRICE', 12, '2026-09-05', '2026-10-31');

select is(public.generate_loan_schedule('11111111-0000-4000-8000-000000000001', false), 12, 'twelve instalments are created');

-- Instalment 1 is paid and instalment 2 is cancelled: both are facts, not projections.
update public.transactions set status = 'PAID'
 where loan_id = '11111111-0000-4000-8000-000000000001' and loan_installment_number = 1;
update public.transactions set status = 'CANCELLED'
 where loan_id = '11111111-0000-4000-8000-000000000001' and loan_installment_number = 2;

-- Editing the loan is exactly what leaves the instalments behind.
update public.loans set principal = 12000 where id = '11111111-0000-4000-8000-000000000001';

select is(
  public.generate_loan_schedule('11111111-0000-4000-8000-000000000001', false),
  0,
  'generating after an edit creates nothing, because no instalment is missing'
);
select is(
  (select amount from public.transactions where loan_id = '11111111-0000-4000-8000-000000000001' and loan_installment_number = 3),
  916.80::numeric,
  'and it leaves the pending instalment on the old amount, which is the defect'
);

select is(
  public.realign_loan_schedule('11111111-0000-4000-8000-000000000001'),
  10,
  'realigning updates the ten pending instalments and leaves the paid and the cancelled alone'
);
select is(
  (select amount from public.transactions where loan_id = '11111111-0000-4000-8000-000000000001' and loan_installment_number = 3),
  1100.16::numeric,
  'the pending instalment now follows the new principal'
);
select is(
  (select amount from public.transactions where loan_id = '11111111-0000-4000-8000-000000000001' and loan_installment_number = 1),
  916.80::numeric,
  'the paid instalment keeps the amount that actually left the account'
);
select is(
  (select amount from public.transactions where loan_id = '11111111-0000-4000-8000-000000000001' and loan_installment_number = 2),
  916.80::numeric,
  'the cancelled instalment is not revived'
);
select is(
  public.realign_loan_schedule('11111111-0000-4000-8000-000000000001'),
  0,
  'realigning again changes nothing'
);

-- Moving the first due date moves every pending competence with it.
update public.loans set first_due_date = '2026-11-15' where id = '11111111-0000-4000-8000-000000000001';
select is(public.realign_loan_schedule('11111111-0000-4000-8000-000000000001'), 10, 'a new first due date moves the pending instalments');
select is(
  (select date from public.transactions where loan_id = '11111111-0000-4000-8000-000000000001' and loan_installment_number = 3),
  '2027-01-15'::date,
  'the pending competence follows the new first due date'
);
select is(
  (select date from public.transactions where loan_id = '11111111-0000-4000-8000-000000000001' and loan_installment_number = 1),
  '2026-10-31'::date,
  'the paid instalment keeps its own date'
);

-- Financings behave the same way.
insert into public.financings (id, owner_user_id, description, account_id, category_id, asset_value, down_payment, interest_rate, system, installment_count, acquisition_date, first_due_date)
values ('11111111-0000-4000-8000-000000000009', '11111111-1111-1111-1111-111111111111', 'Carro',
        'aaaaaaaa-0000-4000-8000-000000000001',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
        60000, 15000, 1, 'SAC', 48, '2026-09-05', '2026-10-31');
select is(public.generate_financing_schedule('11111111-0000-4000-8000-000000000009', false), 48, 'forty-eight instalments are created');
update public.transactions set status = 'PAID'
 where financing_id = '11111111-0000-4000-8000-000000000009' and financing_installment_number = 1;
update public.financings set asset_value = 70000 where id = '11111111-0000-4000-8000-000000000009';
select is(
  public.realign_financing_schedule('11111111-0000-4000-8000-000000000009'),
  47,
  'realigning a financing updates every pending instalment'
);
select isnt(
  (select amount from public.transactions where financing_id = '11111111-0000-4000-8000-000000000009' and financing_installment_number = 2),
  (select amount from public.transactions where financing_id = '11111111-0000-4000-8000-000000000009' and financing_installment_number = 1),
  'the paid instalment did not follow the new financed amount'
);

-- Permissions mirror the generate functions.
insert into public.financial_access_grants (id, owner_user_id, granted_user_id, permission)
values ('99999999-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'VIEW');
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is(
  public.realign_loan_schedule('11111111-0000-4000-8000-000000000001'),
  0,
  'VIEW changes nothing, because row level security hides the rows from the update'
);

set local role anon;
select throws_ok(
  $$ select public.realign_loan_schedule('11111111-0000-4000-8000-000000000001') $$,
  '42501', null, 'anon cannot execute realign_loan_schedule'
);
select throws_ok(
  $$ select public.realign_financing_schedule('11111111-0000-4000-8000-000000000009') $$,
  '42501', null, 'anon cannot execute realign_financing_schedule'
);
reset role;

select * from finish();
rollback;
