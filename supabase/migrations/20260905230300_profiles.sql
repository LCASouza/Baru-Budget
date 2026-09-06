create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 80),
  constraint profiles_avatar_url_length check (avatar_url is null or char_length(avatar_url) <= 2048)
);

comment on table public.profiles is 'Application profile of an authenticated user. Never stores credentials.';

alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
