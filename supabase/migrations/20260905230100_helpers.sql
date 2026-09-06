-- Shared trigger functions for audit columns.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Fills created_by/updated_by from the authenticated user. Values supplied by the
-- client are only kept when there is no authenticated user (privileged contexts).
create or replace function public.set_audit_on_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  new.updated_by := new.created_by;
  return new;
end;
$$;

-- Keeps creation columns immutable and refreshes update columns.
create or replace function public.set_audit_on_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by, old.updated_by);
  return new;
end;
$$;
