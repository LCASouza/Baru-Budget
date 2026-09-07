-- Card purchases and invoice payments. A purchase is an expense without an
-- account: it never moves money. Paying the invoice is a transfer that debits an
-- account, which is what keeps a card expense from being counted twice.

alter table public.transactions
  add column credit_card_id   uuid references public.credit_cards (id) on delete restrict,
  add column invoice_due_date date,
  alter column account_id drop not null;

comment on column public.transactions.credit_card_id is 'Card of a purchase (EXPENSE) or of the invoice being paid (TRANSFER).';
comment on column public.transactions.invoice_due_date is 'Due date identifying the invoice. Stored on write so past invoices do not move when the card closing day changes.';

create index transactions_card_invoice_idx
  on public.transactions (credit_card_id, invoice_due_date)
  where credit_card_id is not null;

-- Exactly one origin per transaction.
alter table public.transactions drop constraint transactions_shape;

alter table public.transactions add constraint transactions_shape check (
  case
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

create or replace function public.validate_transaction_references()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  referenced_category_kind public.category_kind;
  card_closing_day integer;
  card_due_day integer;
begin
  if new.category_id is not null then
    select c.kind
      into referenced_category_kind
      from public.categories c
     where c.id = new.category_id
       and c.owner_user_id = new.owner_user_id;

    if not found then
      raise exception 'category % does not belong to the transaction owner', new.category_id
        using errcode = 'foreign_key_violation';
    end if;

    if referenced_category_kind::text <> new.kind::text then
      raise exception 'category kind % does not match transaction kind %', referenced_category_kind, new.kind
        using errcode = 'check_violation';
    end if;
  end if;

  if new.account_id is not null and not exists (
    select 1 from public.accounts a
     where a.id = new.account_id
       and a.owner_user_id = new.owner_user_id
  ) then
    raise exception 'account % does not belong to the transaction owner', new.account_id
      using errcode = 'foreign_key_violation';
  end if;

  if new.destination_account_id is not null and not exists (
    select 1 from public.accounts a
     where a.id = new.destination_account_id
       and a.owner_user_id = new.owner_user_id
  ) then
    raise exception 'destination account % does not belong to the transaction owner', new.destination_account_id
      using errcode = 'foreign_key_violation';
  end if;

  if new.credit_card_id is not null then
    select c.closing_day, c.due_day
      into card_closing_day, card_due_day
      from public.credit_cards c
     where c.id = new.credit_card_id
       and c.owner_user_id = new.owner_user_id;

    if not found then
      raise exception 'credit card % does not belong to the transaction owner', new.credit_card_id
        using errcode = 'foreign_key_violation';
    end if;

    -- Purchases get their invoice from the card rules unless one was supplied.
    if new.kind = 'EXPENSE' and new.invoice_due_date is null then
      new.invoice_due_date := public.invoice_due_date_for(new.date, card_closing_day, card_due_day);
    end if;
  end if;

  if new.household_id is not null
     and not public.is_active_member(new.household_id, new.owner_user_id) then
    raise exception 'transaction owner is not an active member of household %', new.household_id
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;
