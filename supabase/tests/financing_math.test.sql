begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Both systems capitalize, so a yearly rate always converts effectively.
select is(public.financing_monthly_rate(1.5, 'MONTHLY'), 0.015::numeric, 'a monthly rate is used as given');
select ok(
  abs(public.financing_monthly_rate(12, 'YEARLY') - 0.009488792934583046) < 0.000000001,
  'a yearly rate converts to the equivalent effective monthly rate'
);
select ok(
  abs(power((1 + public.financing_monthly_rate(12, 'YEARLY'))::double precision, 12) - 1.12) < 0.000001,
  'twelve equivalent monthly rates rebuild the yearly rate'
);

-- Price is not written twice: the financing reuses the loan implementation.
select is(
  public.financing_installment_amounts(10000, 0.015, 12, 'PRICE'),
  public.loan_installment_amounts(10000, 0.015, 12, 'PRICE'),
  'the Price financing reuses the Price loan formula'
);
select is(
  (public.financing_installment_amounts(10000, 0.015, 12, 'PRICE'))[1],
  916.80::numeric,
  'the Price instalment of 10000 in 12x at 1.5% is 916.80'
);

-- SAC: 45000 in 48 instalments at 1% a month, amortizing 937.50 every month
select is(
  (public.financing_installment_amounts(45000, 0.01, 48, 'SAC'))[1],
  1387.50::numeric,
  'the first SAC instalment is the amortization plus interest on the whole balance'
);
select is(
  (public.financing_installment_amounts(45000, 0.01, 48, 'SAC'))[24],
  1171.88::numeric,
  'the middle SAC instalment charges interest on the balance left'
);
select is(
  (public.financing_installment_amounts(45000, 0.01, 48, 'SAC'))[48],
  946.88::numeric,
  'the last SAC instalment charges interest on one amortization only'
);
select is(
  (select count(*)::int from (
     select amount, lag(amount) over (order by position) as previous
       from unnest(public.financing_installment_amounts(45000, 0.01, 48, 'SAC')) with ordinality as t(amount, position)
   ) steps where previous is not null and amount >= previous),
  0,
  'every SAC instalment is smaller than the one before'
);
-- Closed form for the SAC interest: i * F * (n + 1) / 2, up to the cents rounded per month
select ok(
  abs(
    (select sum(amount) from unnest(public.financing_installment_amounts(45000, 0.01, 48, 'SAC')) as amount)
      - (45000 + 0.01 * 45000 * (48 + 1) / 2)
  ) < 0.5,
  'the SAC instalments add up to the financed amount plus the closed form interest'
);
select is(
  array_length(public.financing_installment_amounts(45000, 0.01, 48, 'SAC'), 1),
  48,
  'one amount per instalment'
);

-- Zero rate degenerates to the principal split in both systems
select is(
  public.financing_installment_amounts(1200, 0, 12, 'SAC'),
  array_fill(100.00::numeric, array[12]),
  'a SAC financing without interest splits the financed amount'
);
select is(
  public.financing_installment_amounts(1200, 0, 12, 'PRICE'),
  array_fill(100.00::numeric, array[12]),
  'a Price financing without interest splits the financed amount'
);

-- The rounding difference lands on the last instalment
select is(
  (select sum(amount) from unnest(public.financing_installment_amounts(100, 0, 3, 'SAC')) as amount),
  100.00::numeric,
  'a financed amount that does not divide evenly still adds up'
);
select is(
  (public.financing_installment_amounts(100, 0, 3, 'SAC'))[3],
  33.34::numeric,
  'the last instalment absorbs the rounding'
);
select ok(
  (select sum(amount) from unnest(public.financing_installment_amounts(7777.77, 0.0237, 17, 'SAC')) as amount) > 7777.77,
  'an awkward SAC schedule pays more than the financed amount'
);

-- Rejections
select throws_ok($$ select public.financing_installment_amounts(0, 0.01, 12, 'SAC') $$, '23514', null, 'a zero financed amount is rejected');
select throws_ok($$ select public.financing_installment_amounts(1000, 0.01, 0, 'SAC') $$, '23514', null, 'zero instalments are rejected');

select is(
  (select provolatile from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'financing_installment_amounts'),
  'i'::"char",
  'financing_installment_amounts is immutable'
);
select is(
  (select provolatile from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'financing_monthly_rate'),
  'i'::"char",
  'financing_monthly_rate is immutable'
);
set local role anon;
select throws_ok($$ select public.financing_monthly_rate(1.5, 'MONTHLY') $$, '42501', null, 'anon cannot execute financing_monthly_rate');
select throws_ok($$ select public.financing_installment_amounts(1000, 0.01, 12, 'SAC') $$, '42501', null, 'anon cannot execute financing_installment_amounts');
reset role;

select * from finish();
rollback;
