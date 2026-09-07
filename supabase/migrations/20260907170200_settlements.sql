-- A settlement is a payment between people. It is a transaction of its own kind:
-- it moves real money out of or into an account, and it never touches the expense
-- that created the debt.

create type public.settlement_direction as enum ('PAY', 'RECEIVE');

alter table public.transactions
  add column counterparty_user_id uuid references public.profiles (id) on delete restrict,
  add column settlement_direction public.settlement_direction;

comment on column public.transactions.counterparty_user_id is 'The other person of a settlement.';
comment on column public.transactions.settlement_direction is 'PAY debits the owner account; RECEIVE credits it.';

create index transactions_counterparty_idx
  on public.transactions (counterparty_user_id)
  where counterparty_user_id is not null;

-- Every kind of the vocabulary is now supported.
alter table public.transactions drop constraint transactions_kind_supported;

alter table public.transactions add constraint transactions_settlement_fields check (
  case
    when kind = 'SETTLEMENT'
      then counterparty_user_id is not null and settlement_direction is not null
    else counterparty_user_id is null and settlement_direction is null
  end
);

alter table public.transactions drop constraint transactions_shape;

alter table public.transactions add constraint transactions_shape check (
  case
    -- Settlement between two people, settled in an account
    when kind = 'SETTLEMENT' then
      account_id is not null
      and credit_card_id is null
      and destination_account_id is null
      and category_id is null
      and invoice_due_date is null
      and counterparty_user_id <> owner_user_id
    -- Transfer between two own accounts
    when credit_card_id is null and kind = 'TRANSFER' then
      account_id is not null
      and destination_account_id is not null
      and destination_account_id <> account_id
      and category_id is null
      and invoice_due_date is null
    -- Income or expense settled in an account
    when credit_card_id is null then
      account_id is not null
      and destination_account_id is null
      and category_id is not null
      and invoice_due_date is null
    -- Card purchase: no account, the money leaves when the invoice is paid
    when kind = 'EXPENSE' then
      account_id is null
      and destination_account_id is null
      and category_id is not null
      and invoice_due_date is not null
    -- Invoice payment: transfer from an account to a card invoice
    when kind = 'TRANSFER' then
      account_id is not null
      and destination_account_id is null
      and category_id is null
      and invoice_due_date is not null
    else false
  end
);

-- A settlement moves money: paying debits the account, receiving credits it.
create or replace view public.account_balances
with (security_invoker = true) as
select
  a.id as account_id,
  a.owner_user_id,
  a.opening_balance,
  a.opening_balance + coalesce(m.movement, 0) as current_balance
from public.accounts a
left join (
  select account_id, sum(delta) as movement
  from (
    select account_id,
           case
             when kind = 'INCOME' then amount
             when kind = 'SETTLEMENT' and settlement_direction = 'RECEIVE' then amount
             else -amount
           end as delta
      from public.transactions
     where status = 'PAID'
    union all
    select destination_account_id, amount
      from public.transactions
     where status = 'PAID' and kind = 'TRANSFER'
  ) as movements
  group by account_id
) as m on m.account_id = a.id;

-- People who share a ledger entry with the current user can see each other names.
create or replace function public.shares_ledger_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.transaction_allocations a
      join public.transactions t on t.id = a.transaction_id
     where (t.owner_user_id = auth.uid() and a.user_id = other)
        or (t.owner_user_id = other and a.user_id = auth.uid())
  )
  or exists (
    select 1
      from public.transactions t
     where t.kind = 'SETTLEMENT'
       and ((t.owner_user_id = auth.uid() and t.counterparty_user_id = other)
         or (t.owner_user_id = other and t.counterparty_user_id = auth.uid()))
  );
$$;

revoke execute on function public.shares_ledger_with(uuid) from public, anon;
grant execute on function public.shares_ledger_with(uuid) to authenticated;

-- The counterparty of a settlement and the person responsible for a share can
-- read the transaction that involves them, and nothing else of that owner.
drop policy transactions_select_visible on public.transactions;

create policy transactions_select_visible
  on public.transactions for select to authenticated
  using (
    public.can_view(owner_user_id)
    or (household_id is not null and public.is_household_member(household_id))
    or (kind = 'SETTLEMENT' and counterparty_user_id = (select auth.uid()))
    or public.is_allocated_to_me(id)
  );

drop policy profiles_select_related on public.profiles;

create policy profiles_select_related
  on public.profiles for select to authenticated
  using (
    (select auth.uid()) = id
    or public.is_grant_counterpart(id)
    or public.shares_household_with(id)
    or public.shares_ledger_with(id)
  );
