-- Insurance and operational fee. A real financing charges both every month on
-- top of principal and interest, and the model had nowhere to put them: the
-- generated instalment was short by exactly that amount, so the account never
-- matched the statement.
--
-- Both default to zero, so every debt that already exists keeps generating the
-- same numbers it generated before.
--
-- They live on the debt as the contracted value. When a statement reports the
-- charge of a competence it wins for that month, because insurance is usually
-- recalculated over the balance and the borrower's age.

alter table public.financings
  add column insurance_amount numeric(14, 2) not null default 0,
  add column fee_amount       numeric(14, 2) not null default 0,
  add constraint financings_insurance_range check (insurance_amount >= 0),
  add constraint financings_fee_range check (fee_amount >= 0);

alter table public.loans
  add column insurance_amount numeric(14, 2) not null default 0,
  add column fee_amount       numeric(14, 2) not null default 0,
  add constraint loans_insurance_range check (insurance_amount >= 0),
  add constraint loans_fee_range check (fee_amount >= 0);

comment on column public.financings.insurance_amount is 'Insurance charged with each instalment. Added to the transaction amount, never to the amortization.';
comment on column public.financings.fee_amount is 'Operational fee charged with each instalment. Added to the transaction amount, never to the amortization.';
comment on column public.loans.insurance_amount is 'Insurance charged with each instalment. Added to the transaction amount, never to the amortization.';
comment on column public.loans.fee_amount is 'Operational fee charged with each instalment. Added to the transaction amount, never to the amortization.';
