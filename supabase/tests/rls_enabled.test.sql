begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select is_empty(
  $$
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  $$,
  'every table in the public schema has row level security enabled'
);

select is_empty(
  $$
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
  $$,
  'every table in the public schema has at least one policy'
);

select is_empty(
  $$ select policyname from pg_policies where schemaname = 'public' and 'anon' = any(roles) $$,
  'no policy grants access to the anon role'
);

select is_empty(
  $$ select policyname from pg_policies where schemaname = 'public' and 'public' = any(roles) $$,
  'no policy grants access to the public role'
);

select is_empty(
  $$
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and not coalesce(
        (select option_value::boolean
         from pg_options_to_table(c.reloptions)
         where option_name = 'security_invoker'),
        false)
  $$,
  'every view in the public schema runs with security_invoker'
);

select is_empty(
  $$
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')
  $$,
  'no security definer function is executable by anon'
);

select * from finish();
rollback;
