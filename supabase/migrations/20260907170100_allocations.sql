-- Who paid is the transaction owner; who is responsible lives here. When a
-- transaction has allocations, they add up to its amount: no silent partial split.

create table public.transaction_allocations (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete restrict,
  amount         numeric(14, 2) not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid not null default auth.uid() references public.profiles (id),
  updated_by     uuid not null default auth.uid() references public.profiles (id),
  constraint transaction_allocations_amount_positive check (amount > 0)
);

comment on table public.transaction_allocations is 'Share of an expense each person is responsible for. The sum always matches the transaction amount.';

create unique index transaction_allocations_unique_user
  on public.transaction_allocations (transaction_id, user_id);

create index transaction_allocations_user_idx on public.transaction_allocations (user_id);

-- Definer helpers keep the policies from recursing through the transactions
-- policy, which itself consults the allocations.

create or replace function public.is_allocated_to_me(p_transaction uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.transaction_allocations a
     where a.transaction_id = p_transaction
       and a.user_id = auth.uid()
  );
$$;

create or replace function public.can_view_transaction_owner(p_transaction uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select public.can_view(t.owner_user_id) from public.transactions t where t.id = p_transaction),
    false
  );
$$;

create or replace function public.can_manage_transaction_owner(p_transaction uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select public.can_manage(t.owner_user_id) from public.transactions t where t.id = p_transaction),
    false
  );
$$;

revoke execute on function public.is_allocated_to_me(uuid) from public, anon;
revoke execute on function public.can_view_transaction_owner(uuid) from public, anon;
revoke execute on function public.can_manage_transaction_owner(uuid) from public, anon;
grant execute on function public.is_allocated_to_me(uuid) to authenticated;
grant execute on function public.can_view_transaction_owner(uuid) to authenticated;
grant execute on function public.can_manage_transaction_owner(uuid) to authenticated;

alter table public.transaction_allocations enable row level security;

-- The responsible person always sees their own share, even without a grant:
-- otherwise they could never learn what they owe.
create policy transaction_allocations_select_related
  on public.transaction_allocations for select to authenticated
  using (
    (select auth.uid()) = user_id
    or public.is_allocated_to_me(transaction_id)
    or public.can_view_transaction_owner(transaction_id)
  );

create policy transaction_allocations_insert_manage
  on public.transaction_allocations for insert to authenticated
  with check (public.can_manage_transaction_owner(transaction_id));

create policy transaction_allocations_update_manage
  on public.transaction_allocations for update to authenticated
  using (public.can_manage_transaction_owner(transaction_id))
  with check (public.can_manage_transaction_owner(transaction_id));

create policy transaction_allocations_delete_manage
  on public.transaction_allocations for delete to authenticated
  using (public.can_manage_transaction_owner(transaction_id));

create trigger transaction_allocations_set_audit_on_insert
  before insert on public.transaction_allocations
  for each row execute function public.set_audit_on_insert();

create trigger transaction_allocations_set_audit_on_update
  before update on public.transaction_allocations
  for each row execute function public.set_audit_on_update();

-- Allocations only make sense on an expense.
create or replace function public.validate_allocation_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  transaction_kind public.transaction_kind;
begin
  select t.kind into transaction_kind
    from public.transactions t
   where t.id = new.transaction_id;

  if transaction_kind <> 'EXPENSE' then
    raise exception 'only an expense can be split between people'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger transaction_allocations_validate_transaction
  before insert or update on public.transaction_allocations
  for each row execute function public.validate_allocation_transaction();

-- The sum invariant spans rows, so it is checked at commit: replacing a whole
-- split passes through intermediate states without tripping.
create or replace function public.check_allocation_sum_for(p_transaction uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  total     numeric;
  allocated numeric;
begin
  select t.amount into total from public.transactions t where t.id = p_transaction;
  if not found then
    return;
  end if;

  select coalesce(sum(a.amount), 0)
    into allocated
    from public.transaction_allocations a
   where a.transaction_id = p_transaction;

  if allocated <> 0 and allocated <> total then
    raise exception 'allocations of transaction % add up to % but the amount is %',
      p_transaction, allocated, total
      using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function public.check_allocation_sum()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.check_allocation_sum_for(coalesce(new.transaction_id, old.transaction_id));
  return null;
end;
$$;

create or replace function public.check_transaction_allocation_sum()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.check_allocation_sum_for(new.id);
  return null;
end;
$$;

create constraint trigger transaction_allocations_sum_matches
  after insert or update or delete on public.transaction_allocations
  deferrable initially deferred
  for each row execute function public.check_allocation_sum();

create constraint trigger transactions_allocation_sum_matches
  after update of amount on public.transactions
  deferrable initially deferred
  for each row execute function public.check_transaction_allocation_sum();

revoke execute on function public.check_allocation_sum_for(uuid) from public, anon, authenticated;
revoke execute on function public.check_allocation_sum() from public, anon, authenticated;
revoke execute on function public.check_transaction_allocation_sum() from public, anon, authenticated;
revoke execute on function public.validate_allocation_transaction() from public, anon, authenticated;

-- Replaces the whole split of a transaction in one call. Invoker rights, so row
-- level security decides; the deferred trigger guarantees the sum at commit.
create or replace function public.set_transaction_allocations(
  p_transaction_id uuid,
  p_user_ids uuid[],
  p_amounts numeric[]
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  total     numeric;
  requested numeric;
  position  integer;
begin
  if coalesce(array_length(p_user_ids, 1), 0) <> coalesce(array_length(p_amounts, 1), 0) then
    raise exception 'each responsible person needs an amount'
      using errcode = 'check_violation';
  end if;

  select t.amount into total from public.transactions t where t.id = p_transaction_id;
  if not found then
    raise exception 'transaction % not found', p_transaction_id
      using errcode = 'foreign_key_violation';
  end if;

  delete from public.transaction_allocations where transaction_id = p_transaction_id;

  if coalesce(array_length(p_user_ids, 1), 0) = 0 then
    return 0;
  end if;

  select coalesce(sum(amount), 0) into requested from unnest(p_amounts) as amount;
  if requested <> total then
    raise exception 'the split adds up to % but the amount is %', requested, total
      using errcode = 'check_violation';
  end if;

  for position in 1..array_length(p_user_ids, 1) loop
    insert into public.transaction_allocations (transaction_id, user_id, amount)
    values (p_transaction_id, p_user_ids[position], p_amounts[position]);
  end loop;

  return array_length(p_user_ids, 1);
end;
$$;

revoke execute on function public.set_transaction_allocations(uuid, uuid[], numeric[]) from public, anon;
grant execute on function public.set_transaction_allocations(uuid, uuid[], numeric[]) to authenticated;
