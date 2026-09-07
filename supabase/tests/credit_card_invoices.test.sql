begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.com', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.com', '{"display_name": "Bob"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.credit_cards (id, owner_user_id, name, closing_day, due_day)
values ('cccccccc-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cartão', 20, 5);
insert into public.accounts (id, owner_user_id, name, type, opening_balance)
values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'Bank', 'BANK', 1000);

insert into public.transactions (owner_user_id, kind, description, amount, date, status, category_id, credit_card_id)
values
  ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Compra 1', 100, '2026-09-10', 'PAID',
   (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
   'cccccccc-0000-4000-8000-000000000001'),
  ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Compra 2', 50.50, '2026-09-12', 'PAID',
   (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
   'cccccccc-0000-4000-8000-000000000001'),
  ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Cancelada', 900, '2026-09-13', 'CANCELLED',
   (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
   'cccccccc-0000-4000-8000-000000000001'),
  ('11111111-1111-1111-1111-111111111111', 'EXPENSE', 'Proxima fatura', 30, '2026-09-25', 'PAID',
   (select id from public.categories where owner_user_id = '11111111-1111-1111-1111-111111111111' and kind = 'EXPENSE' and name = 'Compras'),
   'cccccccc-0000-4000-8000-000000000001');

select is(
  (select total from public.credit_card_invoices where invoice_due_date = '2026-10-05'),
  150.50::numeric,
  'invoice total sums the paid purchases and ignores the cancelled one'
);
select is(
  (select purchase_count from public.credit_card_invoices where invoice_due_date = '2026-10-05'),
  2,
  'invoice purchase count ignores the cancelled purchase'
);
select is(
  (select paid from public.credit_card_invoices where invoice_due_date = '2026-10-05'),
  0::numeric,
  'an invoice without payments has nothing paid'
);
select is(
  (select total from public.credit_card_invoices where invoice_due_date = '2026-11-05'),
  30::numeric,
  'a purchase after the closing day lands on the next invoice'
);
select is((select count(*)::int from public.credit_card_invoices), 2, 'one row per invoice');

-- Partial and full payment
insert into public.transactions (owner_user_id, kind, description, amount, date, status, account_id, credit_card_id, invoice_due_date)
values ('11111111-1111-1111-1111-111111111111', 'TRANSFER', 'Pagamento parcial', 100, '2026-10-05', 'PAID',
        'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', '2026-10-05');
select is(
  (select paid from public.credit_card_invoices where invoice_due_date = '2026-10-05'),
  100::numeric,
  'a partial payment is reported'
);
insert into public.transactions (owner_user_id, kind, description, amount, date, status, account_id, credit_card_id, invoice_due_date)
values ('11111111-1111-1111-1111-111111111111', 'TRANSFER', 'Restante', 50.50, '2026-10-05', 'PAID',
        'aaaaaaaa-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', '2026-10-05');
select is(
  (select paid from public.credit_card_invoices where invoice_due_date = '2026-10-05'),
  150.50::numeric,
  'payments of the same invoice are summed'
);
select is(
  (select total from public.credit_card_invoices where invoice_due_date = '2026-10-05'),
  150.50::numeric,
  'payments never change the invoice total'
);
select is(
  (select current_balance from public.account_balances where account_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  849.50::numeric,
  'both payments debited the account'
);

-- Visibility
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.credit_card_invoices), 0, 'unrelated user sees no invoices');

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.financial_access_grants (owner_user_id, granted_user_id, permission)
values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'VIEW');
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.credit_card_invoices), 2, 'VIEW grantee sees the owner invoices');

set local role anon;
select is((select count(*)::int from public.credit_card_invoices), 0, 'anon sees no invoices');
reset role;

select * from finish();
rollback;
