-- Trigger functions are called by the database, never by a client. Six of them
-- kept the default grant while the ones added from v0.8 onwards were revoked,
-- so the surface was inconsistent. Calling them directly fails anyway ("trigger
-- functions can only be called as triggers"), which is why this is hardening
-- rather than a vulnerability, but an application role has no reason to hold
-- execute on them.

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.set_audit_on_insert() from public, anon, authenticated;
revoke execute on function public.set_audit_on_update() from public, anon, authenticated;
revoke execute on function public.validate_transaction_references() from public, anon, authenticated;
revoke execute on function public.validate_fixed_expense_references() from public, anon, authenticated;
revoke execute on function public.validate_recurring_income_references() from public, anon, authenticated;
