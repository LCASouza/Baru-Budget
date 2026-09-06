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

-- Privileged functions are not callable by application roles
select function_privs_are('public', 'handle_new_user', array[]::text[], 'anon', array[]::text[], 'anon cannot execute handle_new_user');
select function_privs_are('public', 'handle_new_user', array[]::text[], 'authenticated', array[]::text[], 'authenticated cannot execute handle_new_user');
select function_privs_are('public', 'seed_default_categories', array['uuid'], 'authenticated', array[]::text[], 'authenticated cannot execute seed_default_categories');

select * from finish();
rollback;
