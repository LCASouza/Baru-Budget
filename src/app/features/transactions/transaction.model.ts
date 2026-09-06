import { DisplayStatus, TransactionStatus } from '../../core/finance/transaction-status';
import { Tables } from '../../core/supabase/database.types';
import { IsoDate } from '../../shared/dates/iso-date';
import { Account } from '../accounts/account.model';
import { Category } from '../categories/category.model';

export type Transaction = Tables<'transactions'>;

export type SupportedTransactionKind = 'INCOME' | 'EXPENSE' | 'TRANSFER';

export const SUPPORTED_TRANSACTION_KINDS: readonly SupportedTransactionKind[] = [
  'INCOME',
  'EXPENSE',
  'TRANSFER',
];

export function isSupportedKind(value: unknown): value is SupportedTransactionKind {
  return (SUPPORTED_TRANSACTION_KINDS as readonly unknown[]).includes(value);
}

export interface TransactionInput {
  readonly kind: SupportedTransactionKind;
  readonly description: string;
  readonly amount: number;
  readonly date: IsoDate;
  readonly dueDate: IsoDate | null;
  readonly status: TransactionStatus;
  readonly categoryId: string | null;
  readonly accountId: string;
  readonly destinationAccountId: string | null;
  readonly notes: string | null;
}

// A PENDING transaction is overdue once its due date (or its date, when there is
// no due date) is in the past.
export function displayStatus(
  transaction: Pick<Transaction, 'status' | 'date' | 'due_date'>,
  today: IsoDate,
): DisplayStatus {
  if (transaction.status === 'PENDING' && (transaction.due_date ?? transaction.date) < today) {
    return 'OVERDUE';
  }
  return transaction.status;
}

export interface TransactionView {
  readonly transaction: Transaction;
  readonly categoryName: string | null;
  readonly accountName: string;
  readonly destinationAccountName: string | null;
  readonly displayStatus: DisplayStatus;
}

export function buildTransactionViews(
  transactions: readonly Transaction[],
  categoriesById: ReadonlyMap<string, Category>,
  accountsById: ReadonlyMap<string, Account>,
  today: IsoDate,
): TransactionView[] {
  const accountName = (id: string | null): string | null =>
    id ? (accountsById.get(id)?.name ?? 'Conta removida') : null;
  return transactions.map((transaction) => ({
    transaction,
    categoryName: transaction.category_id
      ? (categoriesById.get(transaction.category_id)?.name ?? 'Categoria removida')
      : null,
    accountName: accountName(transaction.account_id) ?? '',
    destinationAccountName: accountName(transaction.destination_account_id),
    displayStatus: displayStatus(transaction, today),
  }));
}
