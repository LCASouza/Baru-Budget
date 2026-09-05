export interface MonthlyTotals {
  readonly month: string;
  readonly income: number;
  readonly expense: number;
}

export interface CategorySpending {
  readonly name: string;
  readonly amount: number;
}

export interface UpcomingPayment {
  readonly description: string;
  readonly dueDate: string;
  readonly amount: number;
  readonly icon: string;
}

export type RecentTransactionKind = 'INCOME' | 'EXPENSE';

export interface RecentTransaction {
  readonly description: string;
  readonly date: string;
  readonly amount: number;
  readonly kind: RecentTransactionKind;
  readonly category: string;
  readonly icon: string;
}

export interface SettlementEntry {
  readonly from: string;
  readonly to: string;
  readonly amount: number;
}
