-- Households group people around a shared financial set. Membership only grants
-- visibility over transactions explicitly tagged with the household; personal
-- data of the members stays private.

create type public.household_role as enum ('ADMIN', 'MEMBER');
create type public.household_member_status as enum ('ACTIVE', 'INACTIVE');

create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles (id),
  updated_by uuid not null default auth.uid() references public.profiles (id),
  constraint households_name_length check (char_length(name) between 1 and 60)
);

comment on table public.households is 'Shared financial group (for example a family). Has no accounts or categories of its own.';

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         public.household_role not null default 'MEMBER',
  status       public.household_member_status not null default 'ACTIVE',
  joined_at    timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid not null default auth.uid() references public.profiles (id),
  updated_by   uuid not null default auth.uid() references public.profiles (id),
  primary key (household_id, user_id)
);

comment on table public.household_members is 'Membership of a user in a household. Leaving or removal sets status to INACTIVE to preserve history.';

create index household_members_user_idx
  on public.household_members (user_id)
  where status = 'ACTIVE';

-- Authorization helpers run with definer rights so policies on household_members
-- can consult household_members without recursing into row level security.

create or replace function public.is_active_member(household uuid, member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = household
      and m.user_id = member
      and m.status = 'ACTIVE'
  );
$$;

create or replace function public.is_household_member(household uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_member(household, auth.uid());
$$;

create or replace function public.is_household_admin(household uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = household
      and m.user_id = auth.uid()
      and m.status = 'ACTIVE'
      and m.role = 'ADMIN'
  );
$$;

create or replace function public.shares_household_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.user_id = auth.uid()
      and mine.status = 'ACTIVE'
      and theirs.user_id = other
      and theirs.status = 'ACTIVE'
  );
$$;

revoke execute on function public.is_active_member(uuid, uuid) from public, anon;
revoke execute on function public.is_household_member(uuid) from public, anon;
revoke execute on function public.is_household_admin(uuid) from public, anon;
revoke execute on function public.shares_household_with(uuid) from public, anon;
grant execute on function public.is_active_member(uuid, uuid) to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_admin(uuid) to authenticated;
grant execute on function public.shares_household_with(uuid) to authenticated;

-- The creator becomes the first administrator. Runs with definer rights because
-- the member insert policy requires an administrator that does not exist yet.
create or replace function public.add_household_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.household_members (household_id, user_id, role, status, created_by, updated_by)
  values (new.id, new.created_by, 'ADMIN', 'ACTIVE', new.created_by, new.created_by);
  return new;
end;
$$;

revoke execute on function public.add_household_creator() from public, anon, authenticated;

-- A household always keeps at least one active administrator. The check is
-- skipped while the household itself is being deleted (cascade).
create or replace function public.ensure_household_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'ADMIN' and old.status = 'ACTIVE'
     and (tg_op = 'DELETE' or new.role <> 'ADMIN' or new.status <> 'ACTIVE')
     and exists (select 1 from public.households h where h.id = old.household_id)
     and not exists (
       select 1
       from public.household_members m
       where m.household_id = old.household_id
         and m.user_id <> old.user_id
         and m.role = 'ADMIN'
         and m.status = 'ACTIVE'
     ) then
    raise exception 'household must keep at least one active administrator'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function public.ensure_household_admin() from public, anon, authenticated;

-- Members leave through this function so the only self-service change on a
-- membership row is deactivating it.
create or replace function public.leave_household(household uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.household_members
     set status = 'INACTIVE', updated_at = now(), updated_by = auth.uid()
   where household_id = household
     and user_id = auth.uid()
     and status = 'ACTIVE';
  if not found then
    raise exception 'not an active member of this household' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function public.leave_household(uuid) from public, anon;
grant execute on function public.leave_household(uuid) to authenticated;

alter table public.households enable row level security;

create policy households_select_member
  on public.households
  for select
  to authenticated
  using (public.is_household_member(id));

create policy households_insert_creator
  on public.households
  for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

create policy households_update_admin
  on public.households
  for update
  to authenticated
  using (public.is_household_admin(id))
  with check (public.is_household_admin(id));

create policy households_delete_admin
  on public.households
  for delete
  to authenticated
  using (public.is_household_admin(id));

alter table public.household_members enable row level security;

create policy household_members_select_member
  on public.household_members
  for select
  to authenticated
  using (public.is_household_member(household_id));

create policy household_members_insert_admin
  on public.household_members
  for insert
  to authenticated
  with check (public.is_household_admin(household_id));

create policy household_members_update_admin
  on public.household_members
  for update
  to authenticated
  using (public.is_household_admin(household_id))
  with check (public.is_household_admin(household_id));

create policy household_members_delete_admin
  on public.household_members
  for delete
  to authenticated
  using (public.is_household_admin(household_id));

create trigger households_set_audit_on_insert
  before insert on public.households
  for each row execute function public.set_audit_on_insert();

create trigger households_set_audit_on_update
  before update on public.households
  for each row execute function public.set_audit_on_update();

create trigger households_add_creator
  after insert on public.households
  for each row execute function public.add_household_creator();

create trigger household_members_set_audit_on_insert
  before insert on public.household_members
  for each row execute function public.set_audit_on_insert();

create trigger household_members_set_audit_on_update
  before update on public.household_members
  for each row execute function public.set_audit_on_update();

create trigger household_members_ensure_admin
  before update or delete on public.household_members
  for each row execute function public.ensure_household_admin();
