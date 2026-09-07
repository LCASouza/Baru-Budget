import { DisplayStatus } from '../../core/finance/transaction-status';
import { sumAmounts } from '../../shared/money/money';
import { includesNormalized } from '../../shared/text/normalize';
import { TransactionView } from './transaction.model';

export type KindTab = 'INCOME' | 'EXPENSE' | null;

export interface TransactionFilters {
  /** Tab: incomes, expenses or every kind (including transfers). */
  readonly kind: KindTab;
  readonly categoryId: string | null;
  readonly accountId: string | null;
  readonly cardId: string | null;
  readonly status: DisplayStatus | null;
  readonly search: string;
}

export const EMPTY_FILTERS: TransactionFilters = {
  kind: null,
  categoryId: null,
  accountId: null,
  cardId: null,
  status: null,
  search: '',
};

export function countActiveFilters(filters: TransactionFilters): number {
  let count = 0;
  if (filters.categoryId) count++;
  if (filters.accountId) count++;
  if (filters.cardId) count++;
  if (filters.status) count++;
  if (filters.search.trim()) count++;
  return count;
}

export function filterTransactions(
  views: readonly TransactionView[],
  filters: TransactionFilters,
): TransactionView[] {
  return views.filter(({ transaction, displayStatus }) => {
    if (filters.kind && transaction.kind !== filters.kind) {
      return false;
    }
    if (filters.categoryId && transaction.category_id !== filters.categoryId) {
      return false;
    }
    if (
      filters.accountId &&
      transaction.account_id !== filters.accountId &&
      transaction.destination_account_id !== filters.accountId
    ) {
      return false;
    }
    if (filters.cardId && transaction.credit_card_id !== filters.cardId) {
      return false;
    }
    if (filters.status && displayStatus !== filters.status) {
      return false;
    }
    return includesNormalized(transaction.description, filters.search);
  });
}

export interface PeriodSummary {
  readonly income: number;
  readonly expense: number;
  readonly balance: number;
  readonly count: number;
}

// Competence view of the period: paid and pending incomes and expenses count;
// cancelled transactions and transfers between own accounts do not.
export function summarizeTransactions(views: readonly TransactionView[]): PeriodSummary {
  const counted = views
    .map((view) => view.transaction)
    .filter((transaction) => transaction.status !== 'CANCELLED');
  const income = sumAmounts(counted.filter((t) => t.kind === 'INCOME').map((t) => t.amount));
  const expense = sumAmounts(counted.filter((t) => t.kind === 'EXPENSE').map((t) => t.amount));
  return {
    income,
    expense,
    balance: sumAmounts([income, -expense]),
    count: views.length,
  };
}

export interface TransactionGroup {
  readonly date: string;
  readonly items: readonly TransactionView[];
}

export function groupByDate(views: readonly TransactionView[]): TransactionGroup[] {
  const groups = new Map<string, TransactionView[]>();
  for (const view of views) {
    const items = groups.get(view.transaction.date);
    if (items) {
      items.push(view);
    } else {
      groups.set(view.transaction.date, [view]);
    }
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, items]) => ({ date, items }));
}
