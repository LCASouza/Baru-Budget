import { Tables } from '../../core/supabase/database.types';
import { IsoDate } from '../../shared/dates/iso-date';
import { sumAmounts } from '../../shared/money/money';
import { Transaction } from '../transactions/transaction.model';
import {
  FinancingSystem,
  InterestPeriod,
  ScheduleRow,
  buildSchedule,
  monthlyRate,
  scheduleTotals,
} from './financing-math';

export type Financing = Tables<'financings'>;

export interface FinancingInput {
  readonly description: string;
  readonly institution: string | null;
  readonly accountId: string;
  readonly categoryId: string;
  readonly downPaymentCategoryId: string | null;
  readonly householdId: string | null;
  readonly assetValue: number;
  readonly downPayment: number;
  readonly interestRate: number;
  readonly interestPeriod: InterestPeriod;
  readonly system: FinancingSystem;
  readonly installmentCount: number;
  readonly acquisitionDate: IsoDate;
  readonly firstDueDate: IsoDate;
  readonly notes: string | null;
}

export interface FinancingView {
  readonly financing: Financing;
  readonly monthlyRate: number;
  readonly schedule: readonly ScheduleRow[];
  readonly instalments: readonly Transaction[];
  /** The down payment expense, when it has already been generated. */
  readonly downPaymentTransaction: Transaction | null;
  readonly generated: boolean;
  readonly paidCount: number;
  readonly remainingCount: number;
  /** Instalments still to pay: principal plus future interest. */
  readonly remainingTotal: number;
  /** Financed amount not amortized yet, from the schedule. */
  readonly outstandingPrincipal: number;
  /** Everything that leaves the pocket: down payment plus every instalment. */
  readonly totalToPay: number;
  readonly totalInterest: number;
  readonly next: Transaction | null;
  readonly progressPercent: number;
  readonly accountName: string;
  readonly categoryName: string;
}

export function buildFinancingView(
  financing: Financing,
  transactions: readonly Transaction[],
  accountNames: ReadonlyMap<string, string>,
  categoryNames: ReadonlyMap<string, string>,
): FinancingView {
  const rate = monthlyRate(financing.interest_rate, financing.interest_period);
  const schedule = buildSchedule(
    financing.financed_amount,
    rate,
    financing.installment_count,
    financing.system,
  );
  const totals = scheduleTotals(schedule);

  const linked = transactions.filter(
    (transaction) => transaction.financing_id === financing.id,
  );
  const instalments = linked
    .filter((transaction) => transaction.financing_installment_number !== null)
    .sort(
      (a, b) =>
        (a.financing_installment_number ?? 0) - (b.financing_installment_number ?? 0),
    );
  const open = instalments.filter((transaction) => transaction.status !== 'CANCELLED');
  const paid = open.filter((transaction) => transaction.status === 'PAID');
  const pending = open.filter((transaction) => transaction.status !== 'PAID');

  return {
    financing,
    monthlyRate: rate,
    schedule,
    instalments,
    downPaymentTransaction:
      linked.find((transaction) => transaction.financing_installment_number === null) ?? null,
    generated: instalments.length > 0,
    paidCount: paid.length,
    remainingCount: pending.length,
    remainingTotal: sumAmounts(pending.map((transaction) => transaction.amount)),
    outstandingPrincipal:
      paid.length === 0
        ? financing.financed_amount
        : (schedule[paid.length - 1]?.balanceAfter ?? 0),
    totalToPay: sumAmounts([financing.down_payment, totals.total]),
    totalInterest: totals.interest,
    next: pending[0] ?? null,
    progressPercent:
      financing.installment_count > 0 ? (paid.length / financing.installment_count) * 100 : 0,
    accountName: accountNames.get(financing.account_id) ?? 'Conta',
    categoryName: categoryNames.get(financing.category_id) ?? 'Categoria',
  };
}

export function totalRemaining(views: readonly FinancingView[]): number {
  return sumAmounts(views.map((view) => view.remainingTotal));
}
