-- Personal sharing: an owner gives another user VIEW or MANAGE access to their own
-- finances. Access is never transitive and MANAGE never includes security
-- administration (grants are managed by the owner only).

create type public.access_permission as enum ('VIEW', 'MANAGE');

create table public.financial_access_grants (
  id              uuid primary key default gen_random_uuid(),
  owner_user_id   uuid not null references public.profiles (id) on delete cascade,
  granted_user_id uuid not null references public.profiles (id) on delete cascade,
  permission      public.access_permission not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  revoked_at      timestamptz,
  created_by      uuid not null default auth.uid() references public.profiles (id),
  updated_by      uuid not null default auth.uid() references public.profiles (id),
  constraint grants_not_self check (owner_user_id <> granted_user_id)
);

comment on table public.financial_access_grants is 'Access to the personal finances of owner_user_id given to granted_user_id. Revocation keeps the row with revoked_at set.';

create unique index grants_active_pair_key
  on public.financial_access_grants (owner_user_id, granted_user_id)
  where revoked_at is null;

create index grants_granted_user_idx
  on public.financial_access_grants (granted_user_id)
  where revoked_at is null;

-- Only grants received directly by the current user count, so access received
-- from one owner can never be propagated to a third user.

create or replace function public.can_view(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select owner = auth.uid()
      or exists (
        select 1
        from public.financial_access_grants g
        where g.owner_user_id = owner
          and g.granted_user_id = auth.uid()
          and g.revoked_at is null
      );
$$;

create or replace function public.can_manage(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select owner = auth.uid()
      or exists (
        select 1
        from public.financial_access_grants g
        where g.owner_user_id = owner
          and g.granted_user_id = auth.uid()
          and g.permission = 'MANAGE'
          and g.revoked_at is null
      );
$$;

create or replace function public.is_grant_counterpart(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.financial_access_grants g
    where g.revoked_at is null
      and ((g.owner_user_id = auth.uid() and g.granted_user_id = other)
        or (g.owner_user_id = other and g.granted_user_id = auth.uid()))
  );
$$;

revoke execute on function public.can_view(uuid) from public, anon;
revoke execute on function public.can_manage(uuid) from public, anon;
revoke execute on function public.is_grant_counterpart(uuid) from public, anon;
grant execute on function public.can_view(uuid) to authenticated;
grant execute on function public.can_manage(uuid) to authenticated;
grant execute on function public.is_grant_counterpart(uuid) to authenticated;

alter table public.financial_access_grants enable row level security;

create policy grants_select_parties
  on public.financial_access_grants
  for select
  to authenticated
  using ((select auth.uid()) in (owner_user_id, granted_user_id));

create policy grants_insert_owner
  on public.financial_access_grants
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_user_id);

create policy grants_update_owner
  on public.financial_access_grants
  for update
  to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

create policy grants_delete_owner
  on public.financial_access_grants
  for delete
  to authenticated
  using ((select auth.uid()) = owner_user_id);

create trigger grants_set_audit_on_insert
  before insert on public.financial_access_grants
  for each row execute function public.set_audit_on_insert();

create trigger grants_set_audit_on_update
  before update on public.financial_access_grants
  for each row execute function public.set_audit_on_update();
