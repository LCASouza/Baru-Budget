# Security Review — Baru Budget v1.0

Date: 2026-09-07. Scope: the whole system as delivered through v0.13. Every conclusion below that can be a test is a test, because a reading ages and a test does not.

## 1. Fundamental rule

MASTER_PROMPT section 3: the Angular interface is not a security authority; hiding a button is not denying access. Verified as follows.

- The client holds only the publishable key, which is public by design. No occurrence of `service_role` exists anywhere under `src/`.
- Every table in `public` has row level security enabled, at least one policy, and all four commands covered when it has an owner. Proved by `rls_matrix.test.sql`.
- The Excel format, the only path that writes many rows at once, carries no `owner_user_id` column: the owner of every written row comes from the session. Proved by `import.service.spec.ts`.

## 2. Functions with definer rights

Twenty-two of the forty-seven functions in `public` run with definer rights. They exist to answer access questions without recursing through the policies that ask them.

All twenty-two pin `search_path` to the empty string, so no name resolves against a schema a caller controls. Fourteen are callable by `authenticated` because a policy has to call them; none is callable by `anon`.

| Function | search_path | Executable by |
|---|---|---|
| `add_household_creator` | "" | none |
| `can_manage` | "" | authenticated |
| `can_manage_transaction_owner` | "" | authenticated |
| `can_view` | "" | authenticated |
| `can_view_transaction_owner` | "" | authenticated |
| `category_used_in_my_households` | "" | authenticated |
| `check_allocation_sum` | "" | none |
| `check_allocation_sum_for` | "" | none |
| `check_transaction_allocation_sum` | "" | none |
| `ensure_household_admin` | "" | none |
| `handle_new_user` | "" | none |
| `is_active_member` | "" | authenticated |
| `is_allocated_to_me` | "" | authenticated |
| `is_grant_counterpart` | "" | authenticated |
| `is_household_admin` | "" | authenticated |
| `is_household_member` | "" | authenticated |
| `leave_household` | "" | authenticated |
| `lookup_user_by_email` | "" | authenticated |
| `seed_default_categories` | "" | none |
| `shares_household_with` | "" | authenticated |
| `shares_ledger_with` | "" | authenticated |
| `validate_allocation_transaction` | "" | none |

## 3. Functions with invoker rights

Twenty-five functions run with the caller's rights, which is deliberate: the generators (`generate_loan_schedule`, `generate_financing_schedule`, `generate_recurrences`, `create_installment_purchase`, `set_transaction_allocations`) write through row level security instead of around it, so a reader cannot generate for an owner they can only view. All pin `search_path`, and none is callable by `anon`.

## 4. Finding: trigger functions left executable

Six trigger functions kept the default grant while the ones written from v0.8 onwards were revoked: `set_updated_at`, `set_audit_on_insert`, `set_audit_on_update`, `validate_transaction_references`, `validate_fixed_expense_references` and `validate_recurring_income_references`.

Impact: none in practice. PostgreSQL refuses a direct call with "trigger functions can only be called as triggers", which was confirmed as `anon`. It was still surface with no purpose, and inconsistent with the convention the project adopted later.

Fixed by `20260907230100_function_grants.sql`, which revokes execute from `public`, `anon` and `authenticated` on all six. `security_surface.test.sql` now fails if any trigger function is ever executable by an application role again.

## 5. Views

Five views, all with `security_invoker = true`, which a transversal guard already checked. What was missing was proof that they isolate rather than merely inherit the setting.

`view_isolation.test.sql` gives two users the same shape of data and asserts that each sees only their own in `account_balances`, `credit_card_invoices`, `installment_purchases`, `monthly_transaction_totals` and `people_balances`, that the third party on the other side of a split sees exactly her side, and that `anon` sees nothing anywhere. A view added without a case in that file fails the first assertion.

## 6. Audit columns

`created_by` and `updated_by` are filled from the session by triggers. A client that sends another user's id has it overwritten on insert, and `created_by` cannot be rewritten by an update. Every table carrying audit columns has both triggers, which is asserted rather than assumed.

## 7. Secrets

No private key, token or service role key is versioned. The two keys in `src/environments/` are publishable keys, public by design, and access is decided by row level security rather than by key possession. `supabase/config.toml` references secrets only through environment variable substitution.

Logs follow MASTER_PROMPT section 64: the application logs no password, token or personal data.

## 8. Non-transitivity

A grant is not transitive: only a grant made directly to `auth.uid()` counts. Someone who manages another person's finances cannot pass that access on, and cannot create grants on the owner's behalf. Covered by `grants.test.sql` and by `rls_matrix.test.sql`.

## 9. Conclusion

One finding, hardening severity, fixed in this version. No vulnerability was found. The three transversal files (`rls_matrix`, `security_surface`, `view_isolation`) turn this review into something that keeps holding: a table, view or function added later without its policy, grant or isolation fails the suite instead of waiting for the next review.
