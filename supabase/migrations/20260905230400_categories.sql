create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  kind          public.category_kind not null,
  name          text not null,
  icon          text,
  color         text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid not null references public.profiles (id),
  updated_by    uuid not null references public.profiles (id),
  constraint categories_name_length check (char_length(name) between 1 and 60),
  constraint categories_icon_length check (icon is null or char_length(icon) between 1 and 60),
  constraint categories_color_format check (color is null or color ~ '^#[0-9a-fA-F]{6}$')
);

comment on table public.categories is 'Income and expense categories owned by a user.';

create unique index categories_owner_kind_name_key
  on public.categories (owner_user_id, kind, lower(name));

alter table public.categories enable row level security;

create policy categories_select_own
  on public.categories
  for select
  to authenticated
  using ((select auth.uid()) = owner_user_id);

create policy categories_insert_own
  on public.categories
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_user_id);

create policy categories_update_own
  on public.categories
  for update
  to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

create policy categories_delete_own
  on public.categories
  for delete
  to authenticated
  using ((select auth.uid()) = owner_user_id);

create trigger categories_set_audit_on_insert
  before insert on public.categories
  for each row execute function public.set_audit_on_insert();

create trigger categories_set_audit_on_update
  before update on public.categories
  for each row execute function public.set_audit_on_update();

-- Default categories created for every new profile. They become regular
-- user-owned records and can be edited or deactivated afterwards.
create or replace function public.seed_default_categories(profile_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.categories (owner_user_id, kind, name, created_by, updated_by)
  select profile_id, defaults.kind::public.category_kind, defaults.name, profile_id, profile_id
  from (
    values
      ('INCOME', 'Salário'),
      ('INCOME', 'Benefício'),
      ('INCOME', 'Trabalho extra'),
      ('INCOME', 'Presente'),
      ('INCOME', 'Reembolso'),
      ('INCOME', 'Rendimentos'),
      ('INCOME', 'Outros'),
      ('EXPENSE', 'Moradia'),
      ('EXPENSE', 'Alimentação'),
      ('EXPENSE', 'Transporte'),
      ('EXPENSE', 'Saúde'),
      ('EXPENSE', 'Educação'),
      ('EXPENSE', 'Lazer'),
      ('EXPENSE', 'Assinaturas'),
      ('EXPENSE', 'Compras'),
      ('EXPENSE', 'Outros')
  ) as defaults (kind, name)
  on conflict do nothing;
$$;

revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;
