-- The schedule as a function by parts: an observed statement reanchors it, and
-- the charges compose the amount that leaves the account.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', '{"display_name": "Alice"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.accounts (id, owner_user_id, name, type, opening_balance)
values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Bank', 'BANK', 0);

-- The real Caixa contract: 224.000,00 with 44.800,00 down, 420 instalments at
-- 6,6971% a year, first instalment on 2024-07-10.
insert into public.financings (id, owner_user_id, description, account_id, category_id, asset_value, down_payment, interest_rate, interest_period, system, installment_count, acquisition_date, first_due_date)
values ('11111111-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'Casa',
        'aaaaaaaa-0000-4000-8000-000000000001',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Moradia'),
        224000, 44800, 6.6971, 'YEARLY', 'PRICE', 420, '2024-06-10', '2024-07-10');

select is(
  array_length(public.financing_schedule_amounts('11111111-0000-4000-8000-000000000002'), 1),
  420,
  'without a statement the schedule is the contract, whole'
);
select ok(
  abs((public.financing_schedule_amounts('11111111-0000-4000-8000-000000000002'))[1] - 1082.63) < 0.01,
  'and the projected instalment is the one the contract alone can produce'
);

-- The lender reported September 2026: instalment 27 of the schedule.
select is(
  public.instalment_number_for('2024-07-10', '2026-09-01'),
  27,
  'the competence of September 2026 is instalment 27'
);

insert into public.debt_statements (financing_id, competence, outstanding_balance, installment_amount, insurance_amount, fee_amount, remaining_count)
values ('11111111-0000-4000-8000-000000000002', '2026-09-01', 183670.08, 1125.09, 31.59, 25.00, 394);

select ok(
  abs((public.financing_schedule_amounts('11111111-0000-4000-8000-000000000002'))[26] - 1082.63) < 0.01,
  'the instalments before the statement keep the contract projection'
);
select ok(
  abs((public.financing_schedule_amounts('11111111-0000-4000-8000-000000000002'))[27] - 1125.09) < 5.00,
  'from the statement on, the projection restarts from the observed balance and lands within R$ 5,00 of the instalment charged'
);
select is(
  array_length(public.financing_schedule_amounts('11111111-0000-4000-8000-000000000002'), 1),
  420,
  'the reported remaining count keeps the schedule at four hundred and twenty'
);

-- Charges: the statement of the month wins over the contracted value.
select is(
  public.financing_charges_for('11111111-0000-4000-8000-000000000002', 27),
  56.59::numeric,
  'the charges of the observed month come from the statement'
);
select is(
  public.financing_charges_for('11111111-0000-4000-8000-000000000002', 28),
  0::numeric,
  'a month with no statement falls back to the contracted charges, zero here'
);
update public.financings set insurance_amount = 30, fee_amount = 25
 where id = '11111111-0000-4000-8000-000000000002';
select is(
  public.financing_charges_for('11111111-0000-4000-8000-000000000002', 28),
  55::numeric,
  'and picks up the contracted charges once they exist'
);
select is(
  public.financing_charges_for('11111111-0000-4000-8000-000000000002', 27),
  56.59::numeric,
  'while the observed month keeps what the lender actually charged'
);

-- The generated transaction carries instalment plus charges.
select is(public.generate_financing_schedule('11111111-0000-4000-8000-000000000002', false), 420, 'the schedule is generated');
select ok(
  abs((select amount from public.transactions
        where financing_id = '11111111-0000-4000-8000-000000000002' and financing_installment_number = 27) - 1181.68) < 5.00,
  'the instalment of the observed month lands within R$ 5,00 of the R$ 1.181,68 charged'
);
select is(
  (select amount from public.transactions
    where financing_id = '11111111-0000-4000-8000-000000000002' and financing_installment_number = 28)
  - (public.financing_schedule_amounts('11111111-0000-4000-8000-000000000002'))[28],
  55::numeric,
  'a month with no statement carries the contracted charges'
);

-- A statement that shortens the debt shortens the schedule.
insert into public.debt_statements (financing_id, competence, outstanding_balance, installment_amount, remaining_count)
values ('11111111-0000-4000-8000-000000000002', '2026-10-01', 180000, 1500, 200);
select is(
  array_length(public.financing_schedule_amounts('11111111-0000-4000-8000-000000000002'), 1),
  227,
  'the schedule now ends at instalment 28 plus the 199 the lender still expects'
);

-- Loans reanchor the same way.
insert into public.loans (id, owner_user_id, description, account_id, category_id, principal, interest_rate, interest_model, installment_count, start_date, first_due_date)
values ('11111111-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Empréstimo',
        'aaaaaaaa-0000-4000-8000-000000000001',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
        6127.30, 1.95, 'PRICE', 12, '2026-06-02', '2026-07-07');
select ok(
  abs((public.loan_schedule_amounts('11111111-0000-4000-8000-000000000001'))[1] - 577.62) < 0.01,
  'the loan projects the contract instalment'
);
insert into public.debt_statements (loan_id, competence, outstanding_balance, installment_amount, remaining_count)
values ('11111111-0000-4000-8000-000000000001', '2026-10-01', 4725.91, 578.34, 9);
select ok(
  abs((public.loan_schedule_amounts('11111111-0000-4000-8000-000000000001'))[4] - 578.34) < 1.00,
  'and from the observed month it follows the balance the lender reported'
);
select is(
  array_length(public.loan_schedule_amounts('11111111-0000-4000-8000-000000000001'), 1),
  12,
  'the loan schedule keeps its twelve instalments'
);

select * from finish();
rollback;
