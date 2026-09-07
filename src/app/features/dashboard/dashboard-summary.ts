import { formatDate } from '@angular/common';
import { MonthPeriod, shiftMonth } from '../../core/period/period.model';
import { IsoDate } from '../../shared/dates/iso-date';
import { sumAmounts } from '../../shared/money/money';
import { TransactionView } from '../transactions/transaction.model';
import { DashboardSummary, MonthlyTotals, NamedAmount, PendingItem } from './dashboard.models';

const UNCATEGORIZED = 'Sem categoria';
const UNKNOWN_MEMBER = 'Outro membro';
const OTHERS = 'Outras';

/**
 * Incomes and expenses of the period. Transfers and cancelled entries never
 * count, and money received from a loan increases cash without being income.
 */
export function summarizeDashboard(views: readonly TransactionView[]): DashboardSummary {
  const counted = views.filter((view) => view.transaction.status !== 'CANCELLED');
  const incomes = counted.filter(
    (view) => view.transaction.kind === 'INCOME' && view.transaction.loan_id === null,
  );
  const expenses = counted.filter((view) => view.transaction.kind === 'EXPENSE');
  const pending = expenses.filter((view) => view.transaction.status === 'PENDING');
  const income = sumAmounts(incomes.map((view) => view.transaction.amount));
  const expense = sumAmounts(expenses.map((view) => view.transaction.amount));

  return {
    income,
    expense,
    balance: sumAmounts([income, -expense]),
    pending: sumAmounts(pending.map((view) => view.transaction.amount)),
    incomeCount: incomes.length,
    expenseCount: expenses.length,
    pendingCount: pending.length,
    overdueCount: pending.filter((view) => view.displayStatus === 'OVERDUE').length,
  };
}

function groupExpenses(
  views: readonly TransactionView[],
  nameOf: (view: TransactionView) => string,
): NamedAmount[] {
  const totals = new Map<string, number[]>();
  for (const view of views) {
    if (view.transaction.kind !== 'EXPENSE' || view.transaction.status === 'CANCELLED') {
      continue;
    }
    const name = nameOf(view);
    const amounts = totals.get(name);
    if (amounts) {
      amounts.push(view.transaction.amount);
    } else {
      totals.set(name, [view.transaction.amount]);
    }
  }
  return [...totals.entries()]
    .map(([name, amounts]) => ({ name, amount: sumAmounts(amounts) }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'pt-BR'));
}

export function spendingByCategory(views: readonly TransactionView[]): NamedAmount[] {
  return groupExpenses(views, (view) => view.categoryName ?? UNCATEGORIZED);
}

export function spendingByOwner(views: readonly TransactionView[]): NamedAmount[] {
  return groupExpenses(views, (view) => view.ownerName ?? UNKNOWN_MEMBER);
}

/** Keeps the largest entries and collapses the remainder into a single row. */
export function limitAmounts(entries: readonly NamedAmount[], limit: number): NamedAmount[] {
  if (entries.length <= limit) {
    return [...entries];
  }
  const head = entries.slice(0, limit - 1);
  const rest = entries.slice(limit - 1);
  return [...head, { name: OTHERS, amount: sumAmounts(rest.map((entry) => entry.amount)) }];
}

/** Pending expenses of the period, overdue first, then by due date. */
export function pendingByDueDate(
  views: readonly TransactionView[],
  today: IsoDate,
): PendingItem[] {
  return views
    .filter(
      (view) => view.transaction.status === 'PENDING' && view.transaction.kind !== 'TRANSFER',
    )
    .map((view) => ({
      view,
      dueDate: view.transaction.due_date ?? view.transaction.date,
      status: view.displayStatus,
    }))
    .sort((a, b) => {
      const aOverdue = a.dueDate < today;
      const bOverdue = b.dueDate < today;
      if (aOverdue !== bOverdue) {
        return aOverdue ? -1 : 1;
      }
      return a.dueDate.localeCompare(b.dueDate);
    });
}

export function recentTransactions(
  views: readonly TransactionView[],
  limit: number,
): TransactionView[] {
  return [...views]
    .sort(
      (a, b) =>
        b.transaction.date.localeCompare(a.transaction.date) ||
        b.transaction.created_at.localeCompare(a.transaction.created_at),
    )
    .slice(0, limit);
}

export interface MonthlyTotalRow {
  readonly month: string;
  readonly kind: 'INCOME' | 'EXPENSE';
  readonly total: number;
}

function monthKey(period: MonthPeriod): string {
  return `${period.year}-${period.month.toString().padStart(2, '0')}-01`;
}

function monthShortLabel(period: MonthPeriod): string {
  const text = formatDate(new Date(period.year, period.month - 1, 1), 'MMM', 'pt-BR').replace('.', '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Continuous series ending at `end`; months without data are reported as zero. */
export function buildMonthlySeries(
  rows: readonly MonthlyTotalRow[],
  end: MonthPeriod,
  months: number,
): MonthlyTotals[] {
  const income = new Map<string, number[]>();
  const expense = new Map<string, number[]>();
  for (const row of rows) {
    const target = row.kind === 'INCOME' ? income : expense;
    const amounts = target.get(row.month);
    if (amounts) {
      amounts.push(row.total);
    } else {
      target.set(row.month, [row.total]);
    }
  }

  const series: MonthlyTotals[] = [];
  for (let offset = months - 1; offset >= 0; offset--) {
    const period = shiftMonth(end, -offset);
    const key = monthKey(period);
    series.push({
      month: monthShortLabel(period),
      key,
      income: sumAmounts(income.get(key) ?? []),
      expense: sumAmounts(expense.get(key) ?? []),
    });
  }
  return series;
}

/** Axis step in 1, 2 or 5 times a power of ten, so labels stay readable. */
export function niceTickStep(maxValue: number, targetTicks = 4): number {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return 1;
  }
  const rough = maxValue / Math.max(1, targetTicks);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * magnitude;
}

export function formatTickLabel(value: number): string {
  if (value === 0) {
    return '0';
  }
  if (value >= 1000) {
    const thousands = value / 1000;
    return `${thousands.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  }
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}
