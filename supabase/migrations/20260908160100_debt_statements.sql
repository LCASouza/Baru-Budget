-- Observed statements of an indexed debt.
--
-- A contract corrected by an index cannot be projected: nobody knows the future
-- value of the index, and a chosen rate would appear on screen with the same
-- authority as a real balance. What the system records instead is what the
-- lender reported for a competence, and the schedule is reprojected from the
-- most recent observation rather than from the original contract.
--
-- The analysis named this `financing_statements`. It became one table covering
-- both debts, because a loan statement and a financing statement have the same
-- shape, and `transactions` already models "belongs to at most one debt" this
-- way. Two tables would duplicate the policies, the tests and the workbook sheet
-- without describing anything the single table cannot.

create table public.debt_statements (
  id                  uuid primary key default gen_random_uuid(),
  loan_id             uuid references public.loans (id) on delete cascade,
  financing_id        uuid references public.financings (id) on delete cascade,
  -- First day of the month the lender reported, so two statements of the same
  -- month collide instead of both counting.
  competence          date not null,
  outstanding_balance numeric(14, 2) not null,
  installment_amount  numeric(14, 2) not null,
  insurance_amount    numeric(14, 2) not null default 0,
  fee_amount          numeric(14, 2) not null default 0,
  remaining_count     integer not null,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid not null default auth.uid() references public.profiles (id),
  updated_by          uuid not null default auth.uid() references public.profiles (id),
  constraint debt_statements_single_debt check ((loan_id is null) <> (financing_id is null)),
  constraint debt_statements_competence_month check (competence = date_trunc('month', competence)::date),
  constraint debt_statements_balance_range check (outstanding_balance >= 0),
  constraint debt_statements_installment_positive check (installment_amount > 0),
  constraint debt_statements_insurance_range check (insurance_amount >= 0),
  constraint debt_statements_fee_range check (fee_amount >= 0),
  constraint debt_statements_remaining_range check (remaining_count >= 0),
  constraint debt_statements_notes_length check (notes is null or char_length(notes) <= 1000)
);

comment on table public.debt_statements is 'What the lender reported for one competence. Never a projection: the schedule is reprojected from the most recent statement.';
comment on column public.debt_statements.competence is 'First day of the reported month.';
comment on column public.debt_statements.outstanding_balance is 'Balance the lender reported, already corrected by the contractual index.';
comment on column public.debt_statements.installment_amount is 'Instalment of principal plus interest, without insurance and fee.';
comment on column public.debt_statements.remaining_count is 'Instalments the lender still expects, which reanchors the schedule length.';

create unique index debt_statements_loan_competence_key
  on public.debt_statements (loan_id, competence)
  where loan_id is not null;

create unique index debt_statements_financing_competence_key
  on public.debt_statements (financing_id, competence)
  where financing_id is not null;

-- Definer helper: the statement carries no owner, so the parent debt decides.
create or replace function public.debt_owner(p_loan uuid, p_financing uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select l.owner_user_id from public.loans l where l.id = p_loan),
    (select f.owner_user_id from public.financings f where f.id = p_financing)
  );
$$;

revoke execute on function public.debt_owner(uuid, uuid) from public, anon;
grant execute on function public.debt_owner(uuid, uuid) to authenticated;

alter table public.debt_statements enable row level security;

create policy debt_statements_select_visible
  on public.debt_statements for select to authenticated
  using (public.can_view(public.debt_owner(loan_id, financing_id)));
create policy debt_statements_insert_manage
  on public.debt_statements for insert to authenticated
  with check (public.can_manage(public.debt_owner(loan_id, financing_id)));
create policy debt_statements_update_manage
  on public.debt_statements for update to authenticated
  using (public.can_manage(public.debt_owner(loan_id, financing_id)))
  with check (public.can_manage(public.debt_owner(loan_id, financing_id)));
create policy debt_statements_delete_manage
  on public.debt_statements for delete to authenticated
  using (public.can_manage(public.debt_owner(loan_id, financing_id)));

create trigger debt_statements_set_audit_on_insert
  before insert on public.debt_statements
  for each row execute function public.set_audit_on_insert();

create trigger debt_statements_set_audit_on_update
  before update on public.debt_statements
  for each row execute function public.set_audit_on_update();
