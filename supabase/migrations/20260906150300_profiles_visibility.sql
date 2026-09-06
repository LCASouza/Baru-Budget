-- Profiles become visible to the people a user shares finances with, so names
-- can be displayed in households and grants. Everyone else stays invisible.

drop policy profiles_select_own on public.profiles;

create policy profiles_select_related
  on public.profiles
  for select
  to authenticated
  using (
    (select auth.uid()) = id
    or public.is_grant_counterpart(id)
    or public.shares_household_with(id)
  );

-- Exact e-mail lookup used to add household members and to grant access. The
-- application is private and accounts are created by the administrator, so the
-- exposure is limited to confirming that an exact address exists.
create or replace function public.lookup_user_by_email(email_address text)
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name
  from auth.users u
  join public.profiles p on p.id = u.id
  where auth.uid() is not null
    and lower(u.email) = lower(trim(email_address))
  limit 1;
$$;

revoke execute on function public.lookup_user_by_email(text) from public, anon;
grant execute on function public.lookup_user_by_email(text) to authenticated;
