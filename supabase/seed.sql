-- Local development seed. Applied only by `supabase db reset` on the local stack;
-- `supabase db push` never runs seeds against the hosted project.

-- Development user for the local login flow: dev@baru.local / baru-dev-123
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  email_change_token_current
)
values (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'dev@baru.local',
  extensions.crypt('baru-dev-123', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"display_name": "Dev Local"}',
  now(),
  now(),
  '',
  '',
  '',
  '',
  ''
);

insert into auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  gen_random_uuid(),
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'email',
  '{"sub": "00000000-0000-4000-8000-000000000001", "email": "dev@baru.local", "email_verified": true}',
  now(),
  now(),
  now()
);

-- Sample accounts and transactions for the development user, dated relative to
-- the current month so the local data never goes stale.
do $$
declare
  dev_user       constant uuid := '00000000-0000-4000-8000-000000000001';
  month_start    constant date := date_trunc('month', current_date)::date;
  previous_month constant date := (date_trunc('month', current_date) - interval '1 month')::date;
  bank_account   uuid;
  cash_account   uuid;
  meal_account   uuid;
  cat_salary     uuid;
  cat_benefit    uuid;
  cat_food       uuid;
  cat_housing    uuid;
  cat_leisure    uuid;
  cat_subs       uuid;
begin
  insert into public.accounts (owner_user_id, name, type, institution, opening_balance, created_by, updated_by)
  values
    (dev_user, 'Conta corrente', 'BANK', 'Banco', 2500.00, dev_user, dev_user),
    (dev_user, 'Dinheiro', 'CASH', null, 150.00, dev_user, dev_user),
    (dev_user, 'Vale alimentação', 'BENEFIT', 'Benefícios', 0, dev_user, dev_user);

  select id into bank_account from public.accounts where owner_user_id = dev_user and name = 'Conta corrente';
  select id into cash_account from public.accounts where owner_user_id = dev_user and name = 'Dinheiro';
  select id into meal_account from public.accounts where owner_user_id = dev_user and name = 'Vale alimentação';

  select id into cat_salary  from public.categories where owner_user_id = dev_user and kind = 'INCOME'  and name = 'Salário';
  select id into cat_benefit from public.categories where owner_user_id = dev_user and kind = 'INCOME'  and name = 'Benefício';
  select id into cat_food    from public.categories where owner_user_id = dev_user and kind = 'EXPENSE' and name = 'Alimentação';
  select id into cat_housing from public.categories where owner_user_id = dev_user and kind = 'EXPENSE' and name = 'Moradia';
  select id into cat_leisure from public.categories where owner_user_id = dev_user and kind = 'EXPENSE' and name = 'Lazer';
  select id into cat_subs    from public.categories where owner_user_id = dev_user and kind = 'EXPENSE' and name = 'Assinaturas';

  insert into public.transactions
    (owner_user_id, kind, description, amount, date, due_date, status, category_id, account_id, destination_account_id, created_by, updated_by)
  values
    -- current month
    (dev_user, 'INCOME',   'Salário',          5400.00, month_start + 4, null,             'PAID',    cat_salary,  bank_account, null,         dev_user, dev_user),
    (dev_user, 'INCOME',   'Vale alimentação',  700.00, month_start + 4, null,             'PAID',    cat_benefit, meal_account, null,         dev_user, dev_user),
    (dev_user, 'TRANSFER', 'Saque',             200.00, month_start + 2, null,             'PAID',    null,        bank_account, cash_account, dev_user, dev_user),
    (dev_user, 'EXPENSE',  'Supermercado',      320.45, month_start + 3, null,             'PAID',    cat_food,    meal_account, null,         dev_user, dev_user),
    (dev_user, 'EXPENSE',  'Padaria',            35.90, month_start + 5, null,             'PAID',    cat_food,    cash_account, null,         dev_user, dev_user),
    (dev_user, 'EXPENSE',  'Energia',           180.00, month_start + 1, month_start + 9,  'PENDING', cat_housing, bank_account, null,         dev_user, dev_user),
    (dev_user, 'EXPENSE',  'Internet',          120.00, month_start + 1, month_start + 19, 'PENDING', cat_subs,    bank_account, null,         dev_user, dev_user),
    -- previous month
    (dev_user, 'INCOME',   'Salário',          5400.00, previous_month + 4, null,          'PAID',      cat_salary,  bank_account, null,       dev_user, dev_user),
    (dev_user, 'EXPENSE',  'Aluguel',          1850.00, previous_month + 9, null,          'PAID',      cat_housing, bank_account, null,       dev_user, dev_user),
    (dev_user, 'EXPENSE',  'Supermercado',      410.20, previous_month + 12, null,         'PAID',      cat_food,    bank_account, null,       dev_user, dev_user),
    (dev_user, 'EXPENSE',  'Cinema',             60.00, previous_month + 20, null,         'CANCELLED', cat_leisure, bank_account, null,       dev_user, dev_user);
end;
$$;

-- Second development user for sharing scenarios: dev2@baru.local / baru-dev-123
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current
)
values (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'dev2@baru.local',
  extensions.crypt('baru-dev-123', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"display_name": "Dev Dois"}',
  now(), now(), '', '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
values (
  gen_random_uuid(),
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000002',
  'email',
  '{"sub": "00000000-0000-4000-8000-000000000002", "email": "dev2@baru.local", "email_verified": true}',
  now(), now(), now()
);

-- Household shared by both development users, a VIEW grant from the second user
-- to the first, and household-tagged transactions from both.
do $$
declare
  dev_user   constant uuid := '00000000-0000-4000-8000-000000000001';
  dev2_user  constant uuid := '00000000-0000-4000-8000-000000000002';
  month_start constant date := date_trunc('month', current_date)::date;
  family     uuid;
  dev2_bank  uuid;
  dev2_food  uuid;
  dev2_salary uuid;
begin
  insert into public.households (name, created_by, updated_by)
  values ('Família', dev_user, dev_user)
  returning id into family;

  insert into public.household_members (household_id, user_id, role, status, created_by, updated_by)
  values (family, dev2_user, 'MEMBER', 'ACTIVE', dev_user, dev_user);

  insert into public.financial_access_grants (owner_user_id, granted_user_id, permission, created_by, updated_by)
  values (dev2_user, dev_user, 'VIEW', dev2_user, dev2_user);

  insert into public.accounts (owner_user_id, name, type, institution, opening_balance, created_by, updated_by)
  values (dev2_user, 'Conta corrente', 'BANK', 'Banco', 900.00, dev2_user, dev2_user)
  returning id into dev2_bank;

  select id into dev2_food   from public.categories where owner_user_id = dev2_user and kind = 'EXPENSE' and name = 'Alimentação';
  select id into dev2_salary from public.categories where owner_user_id = dev2_user and kind = 'INCOME'  and name = 'Salário';

  insert into public.transactions
    (owner_user_id, kind, description, amount, date, status, category_id, account_id, household_id, created_by, updated_by)
  values
    (dev2_user, 'INCOME',  'Salário',      3200.00, month_start + 4, 'PAID', dev2_salary, dev2_bank, null,   dev2_user, dev2_user),
    (dev2_user, 'EXPENSE', 'Feira',         145.30, month_start + 6, 'PAID', dev2_food,   dev2_bank, family, dev2_user, dev2_user),
    (dev2_user, 'EXPENSE', 'Farmácia',       62.00, month_start + 2, 'PAID', dev2_food,   dev2_bank, null,   dev2_user, dev2_user);

  update public.transactions
     set household_id = family
   where owner_user_id = dev_user and description = 'Supermercado' and date >= month_start;
end;
$$;

-- Credit card for the development user with two invoices: the oldest one already
-- paid and the current one still open.
do $$
declare
  dev_user    constant uuid := '00000000-0000-4000-8000-000000000001';
  month_start constant date := date_trunc('month', current_date)::date;
  prev_month  constant date := (date_trunc('month', current_date) - interval '1 month')::date;
  card        uuid;
  bank        uuid;
  cat_shop    uuid;
  cat_subs    uuid;
  cat_food    uuid;
  paid_due    date;
begin
  insert into public.credit_cards (owner_user_id, name, institution, limit_amount, closing_day, due_day, created_by, updated_by)
  values (dev_user, 'Cartão principal', 'Banco', 5000.00, 20, 5, dev_user, dev_user)
  returning id into card;

  select id into bank     from public.accounts   where owner_user_id = dev_user and name = 'Conta corrente';
  select id into cat_shop from public.categories where owner_user_id = dev_user and kind = 'EXPENSE' and name = 'Compras';
  select id into cat_subs from public.categories where owner_user_id = dev_user and kind = 'EXPENSE' and name = 'Assinaturas';
  select id into cat_food from public.categories where owner_user_id = dev_user and kind = 'EXPENSE' and name = 'Alimentação';

  -- Purchases; invoice_due_date is filled by the trigger from the card rules.
  insert into public.transactions
    (owner_user_id, kind, description, amount, date, status, category_id, credit_card_id, created_by, updated_by)
  values
    (dev_user, 'EXPENSE', 'Livraria',   129.90, prev_month + 9,  'PAID', cat_shop, card, dev_user, dev_user),
    (dev_user, 'EXPENSE', 'Streaming',   49.90, month_start + 2, 'PAID', cat_subs, card, dev_user, dev_user),
    (dev_user, 'EXPENSE', 'Restaurante', 96.40, month_start + 8, 'PAID', cat_food, card, dev_user, dev_user);

  -- Pay the oldest invoice in full, as a transfer from the bank account.
  select min(invoice_due_date) into paid_due
    from public.transactions
   where credit_card_id = card and kind = 'EXPENSE';

  insert into public.transactions
    (owner_user_id, kind, description, amount, date, status, account_id, credit_card_id, invoice_due_date, created_by, updated_by)
  select dev_user, 'TRANSFER', 'Pagamento da fatura', sum(amount), paid_due, 'PAID', bank, card, paid_due, dev_user, dev_user
    from public.transactions
   where credit_card_id = card and kind = 'EXPENSE' and invoice_due_date = paid_due;
end;
$$;
