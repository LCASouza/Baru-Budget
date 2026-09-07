import { Tables } from '../../core/supabase/database.types';
import { IsoDate } from '../../shared/dates/iso-date';
import { sumAmounts } from '../../shared/money/money';
import { Transaction } from '../transactions/transaction.model';
import {
  InterestPeriod,
  LoanInterestModel,
  ScheduleRow,
  buildSchedule,
  monthlyRate,
  scheduleTotals,
} from './loan-math';

export type Loan = Tables<'loans'>;

export interface LoanInput {
  readonly description: string;
  readonly lender: string | null;
  readonly accountId: string;
  readonly categoryId: string;
  readonly disbursementCategoryId: string | null;
  readonly householdId: string | null;
  readonly principal: number;
  readonly interestRate: number;
  readonly interestPeriod: InterestPeriod;
  readonly interestModel: LoanInterestModel;
  readonly installmentCount: number;
  readonly startDate: IsoDate;
  readonly firstDueDate: IsoDate;
  readonly notes: string | null;
}

export interface LoanView {
  readonly loan: Loan;
  readonly monthlyRate: number;
  readonly schedule: readonly ScheduleRow[];
  readonly instalments: readonly Transaction[];
  readonly generated: boolean;
  readonly paidCount: number;
  readonly remainingCount: number;
  /** Instalments still to pay: principal plus future interest. */
  readonly remainingTotal: number;
  /** Principal not amortized yet, from the schedule. */
  readonly outstandingPrincipal: number;
  readonly totalToPay: number;
  readonly totalInterest: number;
  readonly next: Transaction | null;
  readonly progressPercent: number;
  readonly accountName: string;
  readonly categoryName: string;
}

export function buildLoanView(
  loan: Loan,
  transactions: readonly Transaction[],
  accountNames: ReadonlyMap<string, string>,
  categoryNames: ReadonlyMap<string, string>,
): LoanView {
  const rate = monthlyRate(loan.interest_rate, loan.interest_period, loan.interest_model);
  const schedule = buildSchedule(
    loan.principal,
    rate,
    loan.installment_count,
    loan.interest_model,
  );
  const totals = scheduleTotals(schedule);

  const instalments = transactions
    .filter((transaction) => transaction.loan_id === loan.id && transaction.loan_installment_number !== null)
    .sort((a, b) => (a.loan_installment_number ?? 0) - (b.loan_installment_number ?? 0));
  const open = instalments.filter((transaction) => transaction.status !== 'CANCELLED');
  const paid = open.filter((transaction) => transaction.status === 'PAID');
  const pending = open.filter((transaction) => transaction.status !== 'PAID');

  return {
    loan,
    monthlyRate: rate,
    schedule,
    instalments,
    generated: instalments.length > 0,
    paidCount: paid.length,
    remainingCount: pending.length,
    remainingTotal: sumAmounts(pending.map((transaction) => transaction.amount)),
    outstandingPrincipal:
      paid.length === 0 ? loan.principal : (schedule[paid.length - 1]?.balanceAfter ?? 0),
    totalToPay: totals.total,
    totalInterest: totals.interest,
    next: pending[0] ?? null,
    progressPercent:
      loan.installment_count > 0 ? (paid.length / loan.installment_count) * 100 : 0,
    accountName: accountNames.get(loan.account_id) ?? 'Conta',
    categoryName: categoryNames.get(loan.category_id) ?? 'Categoria',
  };
}

export function totalRemaining(views: readonly LoanView[]): number {
  return sumAmounts(views.map((view) => view.remainingTotal));
}
