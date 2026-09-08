import { Tables } from '../../core/supabase/database.types';
import { IsoDate } from '../../shared/dates/iso-date';
import { sumAmounts } from '../../shared/money/money';
import { Transaction } from '../transactions/transaction.model';
import {
  FinancingSystem,
  InstalmentDrift,
  InterestPeriod,
  ScheduleRow,
  ScheduleAnchor,
  buildScheduleByParts,
  instalmentDrift,
  instalmentNumberFor,
  monthlyRate,
  scheduleTotals,
} from './financing-math';

export type Financing = Tables<'financings'>;
export type DebtStatement = Tables<'debt_statements'>;

/** Where the outstanding balance shown on screen comes from. */
export type BalanceSource = 'OBSERVED' | 'PROJECTED';

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
  /** Statements the lender reported, oldest first. */
  readonly statements: readonly DebtStatement[];
  readonly lastStatement: DebtStatement | null;
  /** Whether the outstanding balance rests on an observation or on the contract. */
  readonly balanceSource: BalanceSource;
  /** Insurance plus fee charged with the next instalment. */
  readonly nextCharges: number;
  /** Pending instalments left behind by an edit to the financing. */
  readonly drifted: readonly InstalmentDrift[];
  readonly next: Transaction | null;
  readonly progressPercent: number;
  readonly accountName: string;
  readonly categoryName: string;
}

/**
 * Insurance plus fee of one instalment. The statement of that month wins,
 * because insurance is recalculated over the balance; every other month falls
 * back to what the contract charges. Mirrors `public.financing_charges_for`.
 */
function chargesFor(
  financing: Financing,
  statements: readonly DebtStatement[],
  number: number | null,
): number {
  const observed =
    number === null
      ? undefined
      : statements.find(
          (statement) => instalmentNumberFor(financing.first_due_date, statement.competence) === number,
        );
  return observed
    ? sumAmounts([observed.insurance_amount, observed.fee_amount])
    : sumAmounts([financing.insurance_amount, financing.fee_amount]);
}

export function buildFinancingView(
  financing: Financing,
  transactions: readonly Transaction[],
  accountNames: ReadonlyMap<string, string>,
  categoryNames: ReadonlyMap<string, string>,
  allStatements: readonly DebtStatement[] = [],
): FinancingView {
  const rate = monthlyRate(financing.interest_rate, financing.interest_period);
  const statements = allStatements
    .filter((statement) => statement.financing_id === financing.id)
    .slice()
    .sort((a, b) => a.competence.localeCompare(b.competence));
  const anchors: ScheduleAnchor[] = statements.map((statement) => ({
    number: instalmentNumberFor(financing.first_due_date, statement.competence),
    balance: statement.outstanding_balance,
    count: statement.remaining_count,
  }));
  const schedule = buildScheduleByParts(
    financing.financed_amount,
    rate,
    financing.installment_count,
    financing.system,
    anchors,
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
    statements,
    lastStatement: statements.at(-1) ?? null,
    balanceSource: statements.length > 0 ? 'OBSERVED' : 'PROJECTED',
    nextCharges: chargesFor(financing, statements, pending[0]?.financing_installment_number ?? null),
    drifted: instalmentDrift(
      pending.map((transaction) => ({
        number: transaction.financing_installment_number ?? 0,
        amount: transaction.amount,
      })),
      schedule,
    ),
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
