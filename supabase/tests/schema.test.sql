begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Enums
select has_enum('public', 'category_kind', 'category_kind enum exists');
select enum_has_labels('public', 'category_kind', array['INCOME', 'EXPENSE'], 'category_kind labels');
select has_enum('public', 'account_type', 'account_type enum exists');
select enum_has_labels('public', 'account_type', array['BANK', 'CASH', 'BENEFIT', 'OTHER'], 'account_type labels');
select has_enum('public', 'transaction_kind', 'transaction_kind enum exists');
select enum_has_labels('public', 'transaction_kind', array['INCOME', 'EXPENSE', 'TRANSFER', 'SETTLEMENT'], 'transaction_kind labels');

-- Tables and columns
select has_table('public', 'profiles', 'profiles table exists');
select has_pk('public', 'profiles', 'profiles has a primary key');
select col_not_null('public', 'profiles', 'display_name', 'profiles.display_name is not null');
select hasnt_column('public', 'profiles', 'password', 'profiles never stores a password');

select has_table('public', 'categories', 'categories table exists');
select col_type_is('public', 'categories', 'kind', 'category_kind', 'categories.kind uses the enum');
select col_not_null('public', 'categories', 'owner_user_id', 'categories.owner_user_id is not null');
select col_not_null('public', 'categories', 'created_by', 'categories.created_by is not null');
select col_not_null('public', 'categories', 'updated_by', 'categories.updated_by is not null');
select has_index('public', 'categories', 'categories_owner_kind_name_key', 'categories has the owner/kind/name unique index');
select index_is_unique('public', 'categories', 'categories_owner_kind_name_key', 'categories owner/kind/name index is unique');

select has_table('public', 'accounts', 'accounts table exists');
select col_type_is('public', 'accounts', 'type', 'account_type', 'accounts.type uses the enum');
select col_type_is('public', 'accounts', 'opening_balance', 'numeric(14,2)', 'accounts.opening_balance is numeric(14,2)');
select col_default_is('public', 'accounts', 'opening_balance', 0, 'accounts.opening_balance defaults to 0');
select has_index('public', 'accounts', 'accounts_owner_name_key', 'accounts has the owner/name unique index');
select index_is_unique('public', 'accounts', 'accounts_owner_name_key', 'accounts owner/name index is unique');

select has_enum('public', 'transaction_status', 'transaction_status enum exists');
select enum_has_labels('public', 'transaction_status', array['PENDING', 'PAID', 'CANCELLED'], 'transaction_status labels');

select has_table('public', 'transactions', 'transactions table exists');
select has_pk('public', 'transactions', 'transactions has a primary key');
select col_type_is('public', 'transactions', 'kind', 'transaction_kind', 'transactions.kind uses the enum');
select col_type_is('public', 'transactions', 'status', 'transaction_status', 'transactions.status uses the enum');
select col_type_is('public', 'transactions', 'amount', 'numeric(14,2)', 'transactions.amount is numeric(14,2)');
select col_type_is('public', 'transactions', 'date', 'date', 'transactions.date is a date');
select col_type_is('public', 'transactions', 'due_date', 'date', 'transactions.due_date is a date');
select col_not_null('public', 'transactions', 'owner_user_id', 'transactions.owner_user_id is not null');
select col_is_null('public', 'transactions', 'category_id', 'transactions.category_id is nullable');
select col_is_null('public', 'transactions', 'destination_account_id', 'transactions.destination_account_id is nullable');
select col_is_null('public', 'transactions', 'due_date', 'transactions.due_date is nullable');
select col_has_default('public', 'transactions', 'status', 'transactions.status has a default');
select col_default_is('public', 'transactions', 'created_by', 'auth.uid()', 'transactions.created_by defaults to auth.uid()');
select col_default_is('public', 'categories', 'created_by', 'auth.uid()', 'categories.created_by defaults to auth.uid()');
select col_default_is('public', 'accounts', 'updated_by', 'auth.uid()', 'accounts.updated_by defaults to auth.uid()');
select has_check('public', 'transactions', 'transactions has check constraints');
select fk_ok('public', 'transactions', 'category_id', 'public', 'categories', 'id', 'transactions.category_id references categories');
select fk_ok('public', 'transactions', 'account_id', 'public', 'accounts', 'id', 'transactions.account_id references accounts');
select fk_ok('public', 'transactions', 'destination_account_id', 'public', 'accounts', 'id', 'transactions.destination_account_id references accounts');
select has_index('public', 'transactions', 'transactions_owner_date_idx', 'transactions has the owner/date index');
select has_index('public', 'transactions', 'transactions_category_idx', 'transactions has the category index');
select has_index('public', 'transactions', 'transactions_account_idx', 'transactions has the account index');
select has_index('public', 'transactions', 'transactions_destination_account_idx', 'transactions has the destination account index');

select has_view('public', 'account_balances', 'account_balances view exists');
select has_view('public', 'monthly_transaction_totals', 'monthly_transaction_totals view exists');
select has_view('public', 'credit_card_invoices', 'credit_card_invoices view exists');
select has_column('public', 'credit_card_invoices', 'invoice_due_date', 'credit_card_invoices.invoice_due_date exists');
select has_column('public', 'credit_card_invoices', 'total', 'credit_card_invoices.total exists');
select has_column('public', 'credit_card_invoices', 'paid', 'credit_card_invoices.paid exists');

select has_table('public', 'credit_cards', 'credit_cards table exists');
select has_pk('public', 'credit_cards', 'credit_cards has a primary key');
select col_type_is('public', 'credit_cards', 'limit_amount', 'numeric(14,2)', 'credit_cards.limit_amount is numeric(14,2)');
select col_is_null('public', 'credit_cards', 'limit_amount', 'credit_cards.limit_amount is nullable');
select col_not_null('public', 'credit_cards', 'closing_day', 'credit_cards.closing_day is not null');
select col_not_null('public', 'credit_cards', 'due_day', 'credit_cards.due_day is not null');
select has_index('public', 'credit_cards', 'credit_cards_owner_name_key', 'credit_cards has the owner/name unique index');
select policies_are('public', 'credit_cards', array['credit_cards_select_visible', 'credit_cards_insert_manage', 'credit_cards_update_manage', 'credit_cards_delete_manage'], 'credit_cards policies');

select has_column('public', 'transactions', 'credit_card_id', 'transactions.credit_card_id exists');
select has_column('public', 'transactions', 'invoice_due_date', 'transactions.invoice_due_date exists');
select col_is_null('public', 'transactions', 'account_id', 'transactions.account_id is nullable');
select fk_ok('public', 'transactions', 'credit_card_id', 'public', 'credit_cards', 'id', 'transactions.credit_card_id references credit_cards');
select has_index('public', 'transactions', 'transactions_card_invoice_idx', 'transactions has the card/invoice index');
select has_function('public', 'invoice_due_date_for', array['date', 'integer', 'integer'], 'invoice_due_date_for exists');
select has_function('public', 'last_day_of_month', array['date'], 'last_day_of_month exists');
select has_column('public', 'monthly_transaction_totals', 'month', 'monthly_transaction_totals.month exists');
select has_column('public', 'monthly_transaction_totals', 'kind', 'monthly_transaction_totals.kind exists');
select has_column('public', 'monthly_transaction_totals', 'total', 'monthly_transaction_totals.total exists');
select has_column('public', 'monthly_transaction_totals', 'transaction_count', 'monthly_transaction_totals.transaction_count exists');
select has_column('public', 'monthly_transaction_totals', 'household_id', 'monthly_transaction_totals.household_id exists');
select has_column('public', 'account_balances', 'account_id', 'account_balances.account_id exists');
select has_column('public', 'account_balances', 'owner_user_id', 'account_balances.owner_user_id exists');
select has_column('public', 'account_balances', 'opening_balance', 'account_balances.opening_balance exists');
select has_column('public', 'account_balances', 'current_balance', 'account_balances.current_balance exists');

select has_enum('public', 'household_role', 'household_role enum exists');
select enum_has_labels('public', 'household_role', array['ADMIN', 'MEMBER'], 'household_role labels');
select has_enum('public', 'household_member_status', 'household_member_status enum exists');
select enum_has_labels('public', 'household_member_status', array['ACTIVE', 'INACTIVE'], 'household_member_status labels');
select has_enum('public', 'access_permission', 'access_permission enum exists');
select enum_has_labels('public', 'access_permission', array['VIEW', 'MANAGE'], 'access_permission labels');

select has_table('public', 'households', 'households table exists');
select has_pk('public', 'households', 'households has a primary key');
select has_table('public', 'household_members', 'household_members table exists');
select col_is_pk('public', 'household_members', array['household_id', 'user_id'], 'household_members primary key is (household_id, user_id)');
select col_type_is('public', 'household_members', 'role', 'household_role', 'household_members.role uses the enum');
select col_type_is('public', 'household_members', 'status', 'household_member_status', 'household_members.status uses the enum');
select has_index('public', 'household_members', 'household_members_user_idx', 'household_members has the user index');

select has_table('public', 'financial_access_grants', 'financial_access_grants table exists');
select col_type_is('public', 'financial_access_grants', 'permission', 'access_permission', 'grants.permission uses the enum');
select col_is_null('public', 'financial_access_grants', 'revoked_at', 'grants.revoked_at is nullable');
select has_index('public', 'financial_access_grants', 'grants_active_pair_key', 'grants has the active pair index');
select index_is_unique('public', 'financial_access_grants', 'grants_active_pair_key', 'grants active pair index is unique');
select has_index('public', 'financial_access_grants', 'grants_granted_user_idx', 'grants has the granted user index');

select has_column('public', 'transactions', 'household_id', 'transactions.household_id exists');
select col_is_null('public', 'transactions', 'household_id', 'transactions.household_id is nullable');
select fk_ok('public', 'transactions', 'household_id', 'public', 'households', 'id', 'transactions.household_id references households');
select has_index('public', 'transactions', 'transactions_household_idx', 'transactions has the household index');

select policies_are('public', 'accounts', array['accounts_select_visible', 'accounts_insert_manage', 'accounts_update_manage', 'accounts_delete_manage'], 'accounts policies');
select policies_are('public', 'categories', array['categories_select_visible', 'categories_insert_manage', 'categories_update_manage', 'categories_delete_manage'], 'categories policies');
select policies_are('public', 'transactions', array['transactions_select_visible', 'transactions_insert_manage', 'transactions_update_manage', 'transactions_delete_manage'], 'transactions policies');
select policies_are('public', 'profiles', array['profiles_select_related', 'profiles_update_own'], 'profiles policies');
select policies_are('public', 'households', array['households_select_member', 'households_insert_creator', 'households_update_admin', 'households_delete_admin'], 'households policies');
select policies_are('public', 'household_members', array['household_members_select_member', 'household_members_insert_admin', 'household_members_update_admin', 'household_members_delete_admin'], 'household_members policies');
select policies_are('public', 'financial_access_grants', array['grants_select_parties', 'grants_insert_owner', 'grants_update_owner', 'grants_delete_owner'], 'grants policies');

-- Functions and triggers
select has_function('public', 'set_updated_at', 'set_updated_at exists');
select has_function('public', 'set_audit_on_insert', 'set_audit_on_insert exists');
select has_function('public', 'set_audit_on_update', 'set_audit_on_update exists');
select has_function('public', 'seed_default_categories', array['uuid'], 'seed_default_categories exists');
select has_function('public', 'handle_new_user', 'handle_new_user exists');
select is_definer('public', 'handle_new_user', 'handle_new_user is security definer');
select is_definer('public', 'seed_default_categories', array['uuid'], 'seed_default_categories is security definer');
select has_trigger('auth', 'users', 'on_auth_user_created', 'auth.users has the profile creation trigger');
select has_trigger('public', 'profiles', 'profiles_set_updated_at', 'profiles has the updated_at trigger');
select has_trigger('public', 'categories', 'categories_set_audit_on_insert', 'categories has the insert audit trigger');
select has_trigger('public', 'categories', 'categories_set_audit_on_update', 'categories has the update audit trigger');
select has_trigger('public', 'accounts', 'accounts_set_audit_on_insert', 'accounts has the insert audit trigger');
select has_trigger('public', 'accounts', 'accounts_set_audit_on_update', 'accounts has the update audit trigger');
select has_function('public', 'validate_transaction_references', 'validate_transaction_references exists');
select has_trigger('public', 'transactions', 'transactions_set_audit_on_insert', 'transactions has the insert audit trigger');
select has_trigger('public', 'transactions', 'transactions_set_audit_on_update', 'transactions has the update audit trigger');
select has_trigger('public', 'transactions', 'transactions_validate_references', 'transactions has the reference validation trigger');
select has_function('public', 'can_view', array['uuid'], 'can_view exists');
select is_definer('public', 'can_view', array['uuid'], 'can_view is security definer');
select has_function('public', 'can_manage', array['uuid'], 'can_manage exists');
select is_definer('public', 'can_manage', array['uuid'], 'can_manage is security definer');
select has_function('public', 'is_household_member', array['uuid'], 'is_household_member exists');
select has_function('public', 'is_household_admin', array['uuid'], 'is_household_admin exists');
select has_function('public', 'is_active_member', array['uuid', 'uuid'], 'is_active_member exists');
select has_function('public', 'shares_household_with', array['uuid'], 'shares_household_with exists');
select has_function('public', 'is_grant_counterpart', array['uuid'], 'is_grant_counterpart exists');
select has_function('public', 'category_used_in_my_households', array['uuid'], 'category_used_in_my_households exists');
select has_function('public', 'lookup_user_by_email', array['text'], 'lookup_user_by_email exists');
select has_function('public', 'leave_household', array['uuid'], 'leave_household exists');
select has_trigger('public', 'households', 'households_add_creator', 'households has the creator trigger');
select has_trigger('public', 'household_members', 'household_members_ensure_admin', 'household_members has the last admin guard');

-- Privileged functions are not callable by application roles
select function_privs_are('public', 'handle_new_user', array[]::text[], 'anon', array[]::text[], 'anon cannot execute handle_new_user');
select function_privs_are('public', 'handle_new_user', array[]::text[], 'authenticated', array[]::text[], 'authenticated cannot execute handle_new_user');
select function_privs_are('public', 'seed_default_categories', array['uuid'], 'authenticated', array[]::text[], 'authenticated cannot execute seed_default_categories');

select * from finish();
rollback;
