import { DisplayStatus } from '../../core/finance/transaction-status';
import { TransactionView } from '../transactions/transaction.model';

export interface MonthlyTotals {
  /** Short month label in pt-BR, for example "Set". */
  readonly month: string;
  /** First day of the month, `yyyy-MM-dd`, unique within the series. */
  readonly key: string;
  readonly income: number;
  readonly expense: number;
}

/** A labelled amount used by the horizontal bar charts. */
export interface NamedAmount {
  readonly name: string;
  readonly amount: number;
}

export interface PendingItem {
  readonly view: TransactionView;
  readonly dueDate: string;
  readonly status: DisplayStatus;
}

export interface DashboardSummary {
  readonly income: number;
  readonly expense: number;
  readonly balance: number;
  readonly pending: number;
  readonly incomeCount: number;
  readonly expenseCount: number;
  readonly pendingCount: number;
  readonly overdueCount: number;
}
