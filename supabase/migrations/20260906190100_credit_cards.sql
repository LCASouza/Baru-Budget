-- Credit cards belong to a user, like accounts and categories. A card is not an
-- account: money only leaves an account when the invoice is paid.

create table public.credit_cards (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  name          text not null,
  institution   text,
  limit_amount  numeric(14, 2),
  closing_day   integer not null,
  due_day       integer not null,
  color         text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid not null default auth.uid() references public.profiles (id),
  updated_by    uuid not null default auth.uid() references public.profiles (id),
  constraint credit_cards_name_length check (char_length(name) between 1 and 60),
  constraint credit_cards_institution_length check (institution is null or char_length(institution) between 1 and 80),
  constraint credit_cards_limit_positive check (limit_amount is null or limit_amount >= 0),
  constraint credit_cards_closing_day_range check (closing_day between 1 and 31),
  constraint credit_cards_due_day_range check (due_day between 1 and 31),
  constraint credit_cards_color_format check (color is null or color ~ '^#[0-9a-fA-F]{6}$')
);

comment on table public.credit_cards is 'Credit cards owned by a user. The limit is informative and never blocks a purchase.';

create unique index credit_cards_owner_name_key on public.credit_cards (owner_user_id, lower(name));

alter table public.credit_cards enable row level security;

create policy credit_cards_select_visible
  on public.credit_cards for select to authenticated
  using (public.can_view(owner_user_id));

create policy credit_cards_insert_manage
  on public.credit_cards for insert to authenticated
  with check (public.can_manage(owner_user_id));

create policy credit_cards_update_manage
  on public.credit_cards for update to authenticated
  using (public.can_manage(owner_user_id))
  with check (public.can_manage(owner_user_id));

create policy credit_cards_delete_manage
  on public.credit_cards for delete to authenticated
  using (public.can_manage(owner_user_id));

create trigger credit_cards_set_audit_on_insert
  before insert on public.credit_cards
  for each row execute function public.set_audit_on_insert();

create trigger credit_cards_set_audit_on_update
  before update on public.credit_cards
  for each row execute function public.set_audit_on_update();

create or replace function public.last_day_of_month(reference date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select extract(day from (date_trunc('month', reference) + interval '1 month - 1 day'))::integer;
$$;

-- Invoice a purchase belongs to, identified by its due date.
--   1. The closing day is clamped to the last day of the month, so a card that
--      closes on the 31st closes on the 28th in February.
--   2. A purchase made on or before the closing day belongs to the invoice that
--      closes in that month; a later purchase belongs to the next one.
--   3. The invoice is due in the closing month when the due day is after the
--      closing day, otherwise in the following month, clamped the same way.
create or replace function public.invoice_due_date_for(
  purchase_date date,
  closing_day integer,
  due_day integer
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  purchase_month   date;
  closing_in_month date;
  closing_month    date;
  due_month        date;
begin
  if purchase_date is null or closing_day is null or due_day is null then
    return null;
  end if;

  purchase_month := date_trunc('month', purchase_date)::date;
  closing_in_month := purchase_month
    + (least(closing_day, public.last_day_of_month(purchase_month)) - 1);

  closing_month := case
    when purchase_date > closing_in_month then (purchase_month + interval '1 month')::date
    else purchase_month
  end;

  due_month := case
    when due_day > closing_day then closing_month
    else (closing_month + interval '1 month')::date
  end;

  return due_month + (least(due_day, public.last_day_of_month(due_month)) - 1);
end;
$$;

revoke execute on function public.last_day_of_month(date) from public, anon;
revoke execute on function public.invoice_due_date_for(date, integer, integer) from public, anon;
grant execute on function public.last_day_of_month(date) to authenticated;
grant execute on function public.invoice_due_date_for(date, integer, integer) to authenticated;
