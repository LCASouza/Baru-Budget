begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select is(public.split_installment_amounts(900.00, 3), array[300.00, 300.00, 300.00]::numeric[], '900 in 3 instalments splits evenly');
select is(public.split_installment_amounts(100.00, 3), array[33.34, 33.33, 33.33]::numeric[], 'the remaining cent goes to the first instalment');
select is(public.split_installment_amounts(0.05, 2), array[0.03, 0.02]::numeric[], 'five cents split into two');
select is(public.split_installment_amounts(1234.56, 7), array[176.40, 176.36, 176.36, 176.36, 176.36, 176.36, 176.36]::numeric[], '1234.56 in 7 instalments');
select is(public.split_installment_amounts(4200.00, 12), array_fill(350.00::numeric, array[12]), '4200 in 12 instalments of 350');

-- The instalments always add up to the total
select is(
  (select sum(amount) from unnest(public.split_installment_amounts(100.00, 3)) as amount),
  100.00::numeric,
  'the instalments of 100 in 3 add up to the total'
);
select is(
  (select sum(amount) from unnest(public.split_installment_amounts(1234.56, 7)) as amount),
  1234.56::numeric,
  'the instalments of 1234.56 in 7 add up to the total'
);
select is(
  (select sum(amount) from unnest(public.split_installment_amounts(19.99, 6)) as amount),
  19.99::numeric,
  'the instalments of 19.99 in 6 add up to the total'
);
select is(array_length(public.split_installment_amounts(19.99, 6), 1), 6, 'one amount per instalment');

-- Rejections
select throws_ok($$ select public.split_installment_amounts(100.00, 1) $$, '23514', null, 'a single instalment is rejected');
select throws_ok($$ select public.split_installment_amounts(100.00, 0) $$, '23514', null, 'zero instalments are rejected');
select throws_ok($$ select public.split_installment_amounts(0, 3) $$, '23514', null, 'a zero total is rejected');
select throws_ok($$ select public.split_installment_amounts(-10, 3) $$, '23514', null, 'a negative total is rejected');
select throws_ok($$ select public.split_installment_amounts(0.02, 3) $$, '23514', null, 'a total smaller than one cent per instalment is rejected');

-- Month shifting used by the instalment dates
select is(public.shift_month_day('2026-09-10', 0), '2026-09-10'::date, 'no shift keeps the date');
select is(public.shift_month_day('2026-09-10', 2), '2026-11-10'::date, 'shifting two months keeps the day');
select is(public.shift_month_day('2026-12-10', 2), '2027-02-10'::date, 'shifting crosses the year');
select is(public.shift_month_day('2027-01-31', 1), '2027-02-28'::date, 'day 31 is clamped to the last day of February');
select is(public.shift_month_day('2028-01-31', 1), '2028-02-29'::date, 'day 31 is clamped to the leap day');
select is(public.shift_month_day('2026-03-31', 1), '2026-04-30'::date, 'day 31 is clamped in a 30-day month');

select is(
  (select provolatile from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'split_installment_amounts'),
  'i'::"char",
  'split_installment_amounts is immutable'
);
set local role anon;
select throws_ok($$ select public.split_installment_amounts(100, 2) $$, '42501', null, 'anon cannot execute split_installment_amounts');
reset role;

select * from finish();
rollback;
