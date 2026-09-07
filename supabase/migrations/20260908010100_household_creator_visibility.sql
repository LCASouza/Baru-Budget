-- Creating a household failed from the application with a row level security
-- error. The membership that makes the creator a member is written by an AFTER
-- INSERT trigger, and `insert ... returning` is checked against the select
-- policy before that trigger fires, so the creator could not read back the row
-- they had just created. The database tests missed it because they insert
-- without returning; the client always asks for the row back.
--
-- The select policy is left exactly as it was, because widening it to the
-- creator would also let someone removed from a household they created keep
-- seeing it. Instead the two writes happen inside one function, and the read
-- comes after the membership exists. Invoker rights, so row level security
-- still decides both the insert and the read.

create or replace function public.create_household(p_name text)
returns public.households
language plpgsql
set search_path = ''
as $$
declare
  new_id uuid := gen_random_uuid();
  result public.households;
begin
  insert into public.households (id, name) values (new_id, p_name);

  select * into result from public.households where id = new_id;
  if not found then
    raise exception 'household % could not be read back after creation', new_id
      using errcode = 'insufficient_privilege';
  end if;

  return result;
end;
$$;

comment on function public.create_household(text) is 'Creates a household and returns it, reading it back only after the creator became a member.';

revoke execute on function public.create_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;
