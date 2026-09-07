-- Transversal guard over the function surface. Coverage used to be written per
-- feature, so a function added without its revoke slipped through. These
-- assertions hold for every function in `public`, including the ones written
-- tomorrow.

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- A function without a fixed search_path can be tricked into resolving a name
-- against a schema the caller controls.
select is_empty(
  $$
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, array[]::text[])) as config
         where config like 'search_path=%'
      )
  $$,
  'every function in public pins its search_path'
);

select is_empty(
  $$
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'execute')
  $$,
  'no function in public is executable by anon'
);

-- Trigger functions are called by the database. An application role holding
-- execute on them is surface with no purpose.
select is_empty(
  $$
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_type t on t.oid = p.prorettype
    where n.nspname = 'public'
      and t.typname = 'trigger'
      and (has_function_privilege('authenticated', p.oid, 'execute')
        or has_function_privilege('anon', p.oid, 'execute'))
  $$,
  'no trigger function is executable by an application role'
);

-- The privileged helpers stay out of reach even for an authenticated user.
select is_empty(
  $$
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('handle_new_user', 'seed_default_categories')
      and (has_function_privilege('authenticated', p.oid, 'execute')
        or has_function_privilege('anon', p.oid, 'execute'))
  $$,
  'the account bootstrap functions are not callable by application roles'
);

-- Audit cannot be forged: the columns are filled from the session, and a value
-- sent by the client is overwritten.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', '{"display_name": "Bob"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

insert into public.accounts (id, owner_user_id, name, type, created_by, updated_by)
values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Bank', 'BANK',
        '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222');

select is(
  (select created_by from public.accounts where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'created_by comes from the session, not from the payload'
);
select is(
  (select updated_by from public.accounts where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'updated_by comes from the session, not from the payload'
);

update public.accounts
   set name = 'Renamed', created_by = '22222222-2222-2222-2222-222222222222'
 where id = 'aaaaaaaa-0000-4000-8000-000000000001';

select is(
  (select created_by from public.accounts where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'created_by cannot be rewritten by an update'
);

insert into public.transactions (id, owner_user_id, kind, description, amount, date, category_id, account_id, created_by)
values ('aaaaaaaa-0000-4000-8000-0000000000e1', '11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Mercado', 100, '2026-09-05',
        (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Outros'),
        'aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222');
select is(
  (select created_by from public.transactions where id = 'aaaaaaaa-0000-4000-8000-0000000000e1'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'a transaction cannot claim another author either'
);

-- Every table with audit columns carries both triggers, so the rule above is
-- not something one table happens to do.
select is_empty(
  $$
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and exists (
        select 1 from information_schema.columns col
         where col.table_schema = 'public' and col.table_name = c.relname and col.column_name = 'created_by'
      )
      and not (
        exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname like '%set_audit_on_insert')
        and exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname like '%set_audit_on_update')
      )
  $$,
  'every table with audit columns has both audit triggers'
);

reset role;
select * from finish();
rollback;
