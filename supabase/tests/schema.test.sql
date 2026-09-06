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
select col_not_null('public', 'transactions', 'account_id', 'transactions.account_id is not null');
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
select has_column('public', 'account_balances', 'account_id', 'account_balances.account_id exists');
select has_column('public', 'account_balances', 'owner_user_id', 'account_balances.owner_user_id exists');
select has_column('public', 'account_balances', 'opening_balance', 'account_balances.opening_balance exists');
select has_column('public', 'account_balances', 'current_balance', 'account_balances.current_balance exists');

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

-- Privileged functions are not callable by application roles
select function_privs_are('public', 'handle_new_user', array[]::text[], 'anon', array[]::text[], 'anon cannot execute handle_new_user');
select function_privs_are('public', 'handle_new_user', array[]::text[], 'authenticated', array[]::text[], 'authenticated cannot execute handle_new_user');
select function_privs_are('public', 'seed_default_categories', array['uuid'], 'authenticated', array[]::text[], 'authenticated cannot execute seed_default_categories');

select * from finish();
rollback;
