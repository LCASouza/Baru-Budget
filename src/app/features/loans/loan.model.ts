import { Tables } from '../../core/supabase/database.types';
import { IsoDate } from '../../shared/dates/iso-date';
import { sumAmounts } from '../../shared/money/money';
import { Transaction } from '../transactions/transaction.model';
import {
  InstalmentDrift,
  InterestPeriod,
  LoanInterestModel,
  ScheduleRow,
  ScheduleAnchor,
  buildScheduleByParts,
  instalmentDrift,
  instalmentNumberFor,
  monthlyRate,
  scheduleTotals,
} from './loan-math';

export type Loan = Tables<'loans'>;
export type DebtStatement = Tables<'debt_statements'>;

/** Where the outstanding balance shown on screen comes from. */
export type BalanceSource = 'OBSERVED' | 'PROJECTED';

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
  /** Statements the lender reported, oldest first. */
  readonly statements: readonly DebtStatement[];
  readonly lastStatement: DebtStatement | null;
  /** Whether the outstanding balance rests on an observation or on the contract. */
  readonly balanceSource: BalanceSource;
  /** Insurance plus fee charged with the next instalment. */
  readonly nextCharges: number;
  /** Pending instalments left behind by an edit to the loan. */
  readonly drifted: readonly InstalmentDrift[];
  readonly next: Transaction | null;
  readonly progressPercent: number;
  readonly accountName: string;
  readonly categoryName: string;
}

/**
 * Insurance plus fee of one instalment. The statement of that month wins,
 * because insurance is recalculated over the balance; every other month falls
 * back to what the contract charges. Mirrors `public.loan_charges_for`.
 */
function chargesFor(
  loan: Loan,
  statements: readonly DebtStatement[],
  number: number | null,
): number {
  const observed =
    number === null
      ? undefined
      : statements.find(
          (statement) => instalmentNumberFor(loan.first_due_date, statement.competence) === number,
        );
  return observed
    ? sumAmounts([observed.insurance_amount, observed.fee_amount])
    : sumAmounts([loan.insurance_amount, loan.fee_amount]);
}

export function buildLoanView(
  loan: Loan,
  transactions: readonly Transaction[],
  accountNames: ReadonlyMap<string, string>,
  categoryNames: ReadonlyMap<string, string>,
  allStatements: readonly DebtStatement[] = [],
): LoanView {
  const rate = monthlyRate(loan.interest_rate, loan.interest_period, loan.interest_model);
  const statements = allStatements
    .filter((statement) => statement.loan_id === loan.id)
    .slice()
    .sort((a, b) => a.competence.localeCompare(b.competence));
  const anchors: ScheduleAnchor[] = statements.map((statement) => ({
    number: instalmentNumberFor(loan.first_due_date, statement.competence),
    balance: statement.outstanding_balance,
    count: statement.remaining_count,
  }));
  const schedule = buildScheduleByParts(
    loan.principal,
    rate,
    loan.installment_count,
    loan.interest_model,
    anchors,
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
    statements,
    lastStatement: statements.at(-1) ?? null,
    balanceSource: statements.length > 0 ? 'OBSERVED' : 'PROJECTED',
    nextCharges: chargesFor(loan, statements, pending[0]?.loan_installment_number ?? null),
    drifted: instalmentDrift(
      pending.map((transaction) => ({
        number: transaction.loan_installment_number ?? 0,
        amount: transaction.amount,
      })),
      schedule,
    ),
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
