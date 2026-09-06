create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  owner_user_id   uuid not null references public.profiles (id) on delete cascade,
  name            text not null,
  type            public.account_type not null,
  institution     text,
  opening_balance numeric(14, 2) not null default 0,
  color           text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid not null references public.profiles (id),
  updated_by      uuid not null references public.profiles (id),
  constraint accounts_name_length check (char_length(name) between 1 and 60),
  constraint accounts_institution_length check (institution is null or char_length(institution) between 1 and 80),
  constraint accounts_color_format check (color is null or color ~ '^#[0-9a-fA-F]{6}$')
);

comment on table public.accounts is 'Money and benefit accounts owned by a user. Current balance is always derived from opening_balance and transactions.';
comment on column public.accounts.opening_balance is 'Balance informed by the user at account creation. Never updated by transactions.';

create unique index accounts_owner_name_key
  on public.accounts (owner_user_id, lower(name));

alter table public.accounts enable row level security;

create policy accounts_select_own
  on public.accounts
  for select
  to authenticated
  using ((select auth.uid()) = owner_user_id);

create policy accounts_insert_own
  on public.accounts
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_user_id);

create policy accounts_update_own
  on public.accounts
  for update
  to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

create policy accounts_delete_own
  on public.accounts
  for delete
  to authenticated
  using ((select auth.uid()) = owner_user_id);

create trigger accounts_set_audit_on_insert
  before insert on public.accounts
  for each row execute function public.set_audit_on_insert();

create trigger accounts_set_audit_on_update
  before update on public.accounts
  for each row execute function public.set_audit_on_update();
