begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Closes on the 15th, due on the 25th of the same month
select is(public.invoice_due_date_for('2026-09-10', 15, 25), '2026-09-25'::date, 'purchase before closing goes to the invoice closing that month');
select is(public.invoice_due_date_for('2026-09-15', 15, 25), '2026-09-25'::date, 'purchase on the closing day goes to the invoice closing that day');
select is(public.invoice_due_date_for('2026-09-16', 15, 25), '2026-10-25'::date, 'purchase after closing goes to the next invoice');

-- Closes on the 28th, due on the 5th of the next month
select is(public.invoice_due_date_for('2026-09-20', 28, 5), '2026-10-05'::date, 'due day before closing day falls in the following month');
select is(public.invoice_due_date_for('2026-09-29', 28, 5), '2026-11-05'::date, 'purchase after closing skips to the next invoice');

-- Year turn
select is(public.invoice_due_date_for('2026-12-29', 28, 5), '2027-02-05'::date, 'year turn is handled');
select is(public.invoice_due_date_for('2026-12-10', 28, 5), '2027-01-05'::date, 'december purchase before closing is due in January');

-- Non-existent days are clamped
select is(public.invoice_due_date_for('2027-02-28', 31, 10), '2027-03-10'::date, 'closing day 31 closes on the last day of February');
select is(public.invoice_due_date_for('2026-04-21', 20, 31), '2026-05-31'::date, 'due day 31 is kept in a 31-day month');
select is(public.invoice_due_date_for('2026-03-21', 20, 31), '2026-04-30'::date, 'due day 31 is clamped to the last day of a 30-day month');
select is(public.invoice_due_date_for('2028-01-31', 31, 10), '2028-02-10'::date, 'purchase on the closing day of a 31-day month closes that month');
select is(public.invoice_due_date_for('2028-02-29', 29, 15), '2028-03-15'::date, 'leap day is handled');

select is(public.invoice_due_date_for(null, 15, 25), null, 'null purchase date returns null');
select is(public.last_day_of_month('2027-02-10'), 28, 'last day of February 2027');
select is(public.last_day_of_month('2028-02-10'), 29, 'last day of February 2028');

-- The function is immutable and not callable by anonymous users
select is(
  (select provolatile from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'invoice_due_date_for'),
  'i'::"char",
  'invoice_due_date_for is immutable'
);
set local role anon;
select throws_ok(
  $$ select public.invoice_due_date_for('2026-09-10', 15, 25) $$,
  '42501', null, 'anon cannot execute invoice_due_date_for'
);
reset role;

select * from finish();
rollback;
