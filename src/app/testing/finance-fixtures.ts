import { Account } from '../features/accounts/account.model';
import { Category } from '../features/categories/category.model';
import { Transaction } from '../features/transactions/transaction.model';

const OWNER = 'u1';
const NOW = '2026-09-05T12:00:00Z';

export function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-bank',
    owner_user_id: OWNER,
    name: 'Conta corrente',
    type: 'BANK',
    institution: null,
    opening_balance: 0,
    color: null,
    active: true,
    created_at: NOW,
    updated_at: NOW,
    created_by: OWNER,
    updated_by: OWNER,
    ...overrides,
  };
}

export function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-food',
    owner_user_id: OWNER,
    kind: 'EXPENSE',
    name: 'Alimentação',
    icon: null,
    color: null,
    active: true,
    created_at: NOW,
    updated_at: NOW,
    created_by: OWNER,
    updated_by: OWNER,
    ...overrides,
  };
}

export function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    owner_user_id: OWNER,
    kind: 'EXPENSE',
    description: 'Supermercado',
    amount: 100,
    date: '2026-09-05',
    due_date: null,
    status: 'PAID',
    category_id: 'cat-food',
    account_id: 'acc-bank',
    destination_account_id: null,
    credit_card_id: null,
    invoice_due_date: null,
    household_id: null,
    notes: null,
    created_at: NOW,
    updated_at: NOW,
    created_by: OWNER,
    updated_by: OWNER,
    ...overrides,
  };
}
