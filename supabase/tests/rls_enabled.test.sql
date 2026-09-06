begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

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

select * from finish();
rollback;
