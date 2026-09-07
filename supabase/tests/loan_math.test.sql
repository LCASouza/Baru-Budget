begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Monthly rates are used as given; yearly ones convert per model.
select is(public.loan_monthly_rate(1.5, 'MONTHLY', 'PRICE'), 0.015::numeric, 'a monthly rate is used as given');
select is(public.loan_monthly_rate(1.5, 'MONTHLY', 'SIMPLE'), 0.015::numeric, 'the model does not change a monthly rate');
select is(public.loan_monthly_rate(12, 'YEARLY', 'SIMPLE'), 0.01::numeric, 'simple interest converts a yearly rate proportionally');
select ok(
  abs(public.loan_monthly_rate(12, 'YEARLY', 'PRICE') - 0.009488792934583046) < 0.000000001,
  'Price converts a yearly rate to the equivalent effective monthly rate'
);
select ok(
  abs(power((1 + public.loan_monthly_rate(12, 'YEARLY', 'PRICE'))::double precision, 12) - 1.12) < 0.000001,
  'twelve equivalent monthly rates rebuild the yearly rate'
);

-- Price: 10000 in 12 instalments at 1.5% a month
select is(
  (public.loan_installment_amounts(10000, 0.015, 12, 'PRICE'))[1],
  916.80::numeric,
  'the Price instalment of 10000 in 12x at 1.5% is 916.80'
);
select is(
  (select count(distinct amount)::int from unnest(public.loan_installment_amounts(10000, 0.015, 12, 'PRICE')) as amount
    where amount <> (public.loan_installment_amounts(10000, 0.015, 12, 'PRICE'))[12]),
  1,
  'every Price instalment but the last has the same value'
);
select ok(
  abs((select sum(amount) from unnest(public.loan_installment_amounts(10000, 0.015, 12, 'PRICE')) as amount) - 11001.60) < 0.05,
  'the Price instalments add up to about 11001.60'
);
select is(array_length(public.loan_installment_amounts(10000, 0.015, 12, 'PRICE'), 1), 12, 'one amount per instalment');

-- Simple interest: 10000 in 10 instalments at 1% a month
select is(
  public.loan_installment_amounts(10000, 0.01, 10, 'SIMPLE'),
  array_fill(1100.00::numeric, array[10]),
  'simple interest splits principal and interest evenly'
);
select is(
  (select sum(amount) from unnest(public.loan_installment_amounts(10000, 0.01, 10, 'SIMPLE')) as amount),
  11000.00::numeric,
  'the simple interest instalments add up to the total'
);

-- Zero rate degenerates to the principal split
select is(
  public.loan_installment_amounts(1200, 0, 12, 'PRICE'),
  array_fill(100.00::numeric, array[12]),
  'a Price loan without interest splits the principal'
);
select is(
  public.loan_installment_amounts(1200, 0, 12, 'SIMPLE'),
  array_fill(100.00::numeric, array[12]),
  'a simple loan without interest splits the principal'
);

-- The rounding difference lands on the last instalment
select is(
  (select sum(amount) from unnest(public.loan_installment_amounts(100, 0, 3, 'SIMPLE')) as amount),
  100.00::numeric,
  'a principal that does not divide evenly still adds up'
);
select is(
  (public.loan_installment_amounts(100, 0, 3, 'SIMPLE'))[3],
  33.34::numeric,
  'the last instalment absorbs the rounding'
);
select is(
  (select sum(amount) from unnest(public.loan_installment_amounts(7777.77, 0.0237, 17, 'PRICE')) as amount)
    - (select sum(amount) from unnest(public.loan_installment_amounts(7777.77, 0.0237, 17, 'PRICE')) as amount),
  0::numeric,
  'an awkward Price schedule still produces a consistent total'
);

-- Rejections
select throws_ok($$ select public.loan_installment_amounts(0, 0.01, 12, 'PRICE') $$, '23514', null, 'a zero principal is rejected');
select throws_ok($$ select public.loan_installment_amounts(1000, 0.01, 0, 'PRICE') $$, '23514', null, 'zero instalments are rejected');

select is(
  (select provolatile from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'loan_installment_amounts'),
  'i'::"char",
  'loan_installment_amounts is immutable'
);
set local role anon;
select throws_ok($$ select public.loan_monthly_rate(1.5, 'MONTHLY', 'PRICE') $$, '42501', null, 'anon cannot execute loan_monthly_rate');
reset role;

select * from finish();
rollback;
