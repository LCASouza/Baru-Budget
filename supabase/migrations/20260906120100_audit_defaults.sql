-- Audit columns default to the authenticated user so clients do not have to
-- supply them. The audit triggers keep overriding client-supplied values.

alter table public.categories
  alter column created_by set default auth.uid(),
  alter column updated_by set default auth.uid();

alter table public.accounts
  alter column created_by set default auth.uid(),
  alter column updated_by set default auth.uid();
