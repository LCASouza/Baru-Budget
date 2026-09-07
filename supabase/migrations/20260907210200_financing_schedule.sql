-- Financing transactions. Everything linked to a financing is an expense: the
-- down payment carries no number, each instalment carries its own. The asset
-- value has no transaction at all, so acquisition and instalments can never add
-- up to more than what was actually paid.

alter table public.transactions
  add column financing_id uuid references public.financings (id) on delete set null,
  add column financing_installment_number integer;

comment on column public.transactions.financing_id is 'Financing this transaction belongs to: the down payment (no number) or one instalment (numbered).';
comment on column public.transactions.financing_installment_number is 'Position of the instalment in the schedule; null on the down payment.';

-- Deleting the financing clears the link and the transactions stay as history,
-- keeping their number, so the orphan shape has to be accepted.
alter table public.transactions add constraint transactions_financing_shape check (
  case
    when financing_id is not null then
      kind = 'EXPENSE'
      and (financing_installment_number is null or financing_installment_number >= 1)
    else
      financing_installment_number is null
      or (kind = 'EXPENSE' and financing_installment_number >= 1)
  end
);

-- A transaction belongs to at most one debt.
alter table public.transactions add constraint transactions_single_debt check (
  loan_id is null or financing_id is null
);

create unique index transactions_financing_down_payment_key
  on public.transactions (financing_id)
  where financing_id is not null and financing_installment_number is null;

create unique index transactions_financing_installment_key
  on public.transactions (financing_id, financing_installment_number)
  where financing_installment_number is not null;

create index transactions_financing_idx on public.transactions (financing_id)
  where financing_id is not null;

-- Creates the down payment and the instalments that are still missing, and
-- returns how many were created. Invoker rights: row level security decides.
create or replace function public.generate_financing_schedule(
  p_financing_id uuid,
  p_with_down_payment boolean default true
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  financing  public.financings;
  amounts    numeric[];
  monthly    numeric;
  created    integer := 0;
  competence date;
  position   integer;
begin
  select * into financing from public.financings where id = p_financing_id;
  if not found then
    raise exception 'financing % not found', p_financing_id using errcode = 'foreign_key_violation';
  end if;

  monthly := public.financing_monthly_rate(financing.interest_rate, financing.interest_period);
  amounts := public.financing_installment_amounts(
    financing.financed_amount, monthly, financing.installment_count, financing.system
  );

  -- The down payment is the only expense of the acquisition. The asset value
  -- and the financed amount never become transactions.
  if p_with_down_payment and financing.down_payment > 0 then
    insert into public.transactions (
      owner_user_id, kind, description, amount, date, status,
      category_id, account_id, household_id, financing_id
    )
    values (
      financing.owner_user_id, 'EXPENSE', financing.description, financing.down_payment,
      financing.acquisition_date, 'PAID',
      coalesce(financing.down_payment_category_id, financing.category_id),
      financing.account_id, financing.household_id, financing.id
    )
    on conflict do nothing;
    if found then
      created := created + 1;
    end if;
  end if;

  for position in 1..financing.installment_count loop
    competence := public.shift_month_day(financing.first_due_date, position - 1);

    insert into public.transactions (
      owner_user_id, kind, description, amount, date, due_date, status,
      category_id, account_id, household_id, financing_id, financing_installment_number
    )
    values (
      financing.owner_user_id, 'EXPENSE', financing.description, amounts[position],
      competence, competence, 'PENDING',
      financing.category_id, financing.account_id, financing.household_id,
      financing.id, position
    )
    on conflict do nothing;
    if found then
      created := created + 1;
    end if;
  end loop;

  return created;
end;
$$;

revoke execute on function public.generate_financing_schedule(uuid, boolean) from public, anon;
grant execute on function public.generate_financing_schedule(uuid, boolean) to authenticated;
