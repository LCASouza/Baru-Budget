-- Owner-only policies are replaced by the authorization functions: VIEW grants
-- read access to everything owned by the owner, MANAGE adds write access, and
-- household members read the transactions tagged with their household.

alter table public.transactions
  add column household_id uuid references public.households (id) on delete set null;

comment on column public.transactions.household_id is 'Household the transaction belongs to; null for personal transactions. Members of the household can read it.';

create index transactions_household_idx
  on public.transactions (household_id)
  where household_id is not null;

-- A category is visible to a household member while some transaction of that
-- household uses it, so the list can show its name without exposing the rest
-- of the owner's categories.
create or replace function public.category_used_in_my_households(category uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.transactions t
    join public.household_members m on m.household_id = t.household_id
    where t.category_id = category
      and m.user_id = auth.uid()
      and m.status = 'ACTIVE'
  );
$$;

revoke execute on function public.category_used_in_my_households(uuid) from public, anon;
grant execute on function public.category_used_in_my_households(uuid) to authenticated;

create or replace function public.validate_transaction_references()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  referenced_category_kind public.category_kind;
begin
  if new.category_id is not null then
    select c.kind
      into referenced_category_kind
      from public.categories c
     where c.id = new.category_id
       and c.owner_user_id = new.owner_user_id;

    if not found then
      raise exception 'category % does not belong to the transaction owner', new.category_id
        using errcode = 'foreign_key_violation';
    end if;

    if referenced_category_kind::text <> new.kind::text then
      raise exception 'category kind % does not match transaction kind %', referenced_category_kind, new.kind
        using errcode = 'check_violation';
    end if;
  end if;

  if not exists (
    select 1 from public.accounts a
     where a.id = new.account_id
       and a.owner_user_id = new.owner_user_id
  ) then
    raise exception 'account % does not belong to the transaction owner', new.account_id
      using errcode = 'foreign_key_violation';
  end if;

  if new.destination_account_id is not null and not exists (
    select 1 from public.accounts a
     where a.id = new.destination_account_id
       and a.owner_user_id = new.owner_user_id
  ) then
    raise exception 'destination account % does not belong to the transaction owner', new.destination_account_id
      using errcode = 'foreign_key_violation';
  end if;

  if new.household_id is not null
     and not public.is_active_member(new.household_id, new.owner_user_id) then
    raise exception 'transaction owner is not an active member of household %', new.household_id
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

-- accounts
drop policy accounts_select_own on public.accounts;
drop policy accounts_insert_own on public.accounts;
drop policy accounts_update_own on public.accounts;
drop policy accounts_delete_own on public.accounts;

create policy accounts_select_visible
  on public.accounts for select to authenticated
  using (public.can_view(owner_user_id));

create policy accounts_insert_manage
  on public.accounts for insert to authenticated
  with check (public.can_manage(owner_user_id));

create policy accounts_update_manage
  on public.accounts for update to authenticated
  using (public.can_manage(owner_user_id))
  with check (public.can_manage(owner_user_id));

create policy accounts_delete_manage
  on public.accounts for delete to authenticated
  using (public.can_manage(owner_user_id));

-- categories
drop policy categories_select_own on public.categories;
drop policy categories_insert_own on public.categories;
drop policy categories_update_own on public.categories;
drop policy categories_delete_own on public.categories;

create policy categories_select_visible
  on public.categories for select to authenticated
  using (public.can_view(owner_user_id) or public.category_used_in_my_households(id));

create policy categories_insert_manage
  on public.categories for insert to authenticated
  with check (public.can_manage(owner_user_id));

create policy categories_update_manage
  on public.categories for update to authenticated
  using (public.can_manage(owner_user_id))
  with check (public.can_manage(owner_user_id));

create policy categories_delete_manage
  on public.categories for delete to authenticated
  using (public.can_manage(owner_user_id));

-- transactions
drop policy transactions_select_own on public.transactions;
drop policy transactions_insert_own on public.transactions;
drop policy transactions_update_own on public.transactions;
drop policy transactions_delete_own on public.transactions;

create policy transactions_select_visible
  on public.transactions for select to authenticated
  using (
    public.can_view(owner_user_id)
    or (household_id is not null and public.is_household_member(household_id))
  );

create policy transactions_insert_manage
  on public.transactions for insert to authenticated
  with check (public.can_manage(owner_user_id));

create policy transactions_update_manage
  on public.transactions for update to authenticated
  using (public.can_manage(owner_user_id))
  with check (public.can_manage(owner_user_id));

create policy transactions_delete_manage
  on public.transactions for delete to authenticated
  using (public.can_manage(owner_user_id));
