-- A generated month is an ordinary transaction linked back to its template, so
-- the amount of a single month can be adjusted without touching the template.

alter table public.transactions
  add column fixed_expense_id    uuid references public.fixed_expenses (id) on delete set null,
  add column recurring_income_id uuid references public.recurring_incomes (id) on delete set null,
  add column recurrence_month    date;

comment on column public.transactions.recurrence_month is 'First day of the month this instance covers. Unique per template, which makes generation idempotent.';

-- A competence month is always the first day of a month. A linked instance always
-- has one; an instance whose template was deleted keeps the month as history.
alter table public.transactions add constraint transactions_recurrence_shape check (
  (recurrence_month is null or extract(day from recurrence_month) = 1)
  and (
    (fixed_expense_id is null and recurring_income_id is null)
    or (
      recurrence_month is not null
      and (
        (fixed_expense_id is not null and recurring_income_id is null and kind = 'EXPENSE')
        or (recurring_income_id is not null and fixed_expense_id is null and kind = 'INCOME')
      )
    )
  )
);

-- Generation is idempotent because a template can only have one instance per month.
create unique index transactions_fixed_expense_month_key
  on public.transactions (fixed_expense_id, recurrence_month)
  where fixed_expense_id is not null;

create unique index transactions_recurring_income_month_key
  on public.transactions (recurring_income_id, recurrence_month)
  where recurring_income_id is not null;

-- Creates the missing instances of one month for the active templates of an
-- owner and returns how many were created. Runs with invoker rights, so row
-- level security decides each insert: VIEW cannot generate, MANAGE can.
create or replace function public.generate_recurrences(p_owner_user_id uuid, p_month date)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  month_start date := date_trunc('month', p_month)::date;
  month_number integer := extract(month from month_start)::integer;
  created integer := 0;
  template record;
  competence date;
begin
  for template in
    select f.*
      from public.fixed_expenses f
     where f.owner_user_id = p_owner_user_id
       and f.active
       and (f.frequency = 'MONTHLY' or f.anchor_month = month_number)
  loop
    competence := month_start + (least(template.due_day, public.last_day_of_month(month_start)) - 1);

    -- On a card the instance behaves like any card purchase: it is effective and
    -- the trigger routes it to the right invoice. On an account it is pending
    -- until the user settles it.
    insert into public.transactions (
      owner_user_id, kind, description, amount, date, due_date, status,
      category_id, account_id, credit_card_id, household_id, notes,
      fixed_expense_id, recurrence_month
    )
    values (
      template.owner_user_id, 'EXPENSE', template.description, template.default_amount,
      competence,
      case when template.credit_card_id is null then competence else null end,
      case when template.credit_card_id is null then 'PENDING' else 'PAID' end::public.transaction_status,
      template.category_id, template.account_id, template.credit_card_id,
      template.household_id, template.notes,
      template.id, month_start
    )
    on conflict do nothing;

    if found then
      created := created + 1;
    end if;
  end loop;

  for template in
    select r.*
      from public.recurring_incomes r
     where r.owner_user_id = p_owner_user_id
       and r.active
       and (r.frequency = 'MONTHLY' or r.anchor_month = month_number)
  loop
    competence := month_start + (least(template.receipt_day, public.last_day_of_month(month_start)) - 1);

    insert into public.transactions (
      owner_user_id, kind, description, amount, date, due_date, status,
      category_id, account_id, household_id, notes,
      recurring_income_id, recurrence_month
    )
    values (
      template.owner_user_id, 'INCOME', template.description, template.default_amount,
      competence, competence, 'PENDING',
      template.category_id, template.account_id,
      template.household_id, template.notes,
      template.id, month_start
    )
    on conflict do nothing;

    if found then
      created := created + 1;
    end if;
  end loop;

  return created;
end;
$$;

revoke execute on function public.generate_recurrences(uuid, date) from public, anon;
grant execute on function public.generate_recurrences(uuid, date) to authenticated;
