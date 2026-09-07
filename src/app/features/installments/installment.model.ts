import { IsoDate } from '../../shared/dates/iso-date';
import { sumAmounts } from '../../shared/money/money';
import { Transaction } from '../transactions/transaction.model';

export interface InstallmentPurchase {
  readonly id: string;
  readonly description: string;
  readonly installmentCount: number;
  readonly recordedCount: number;
  readonly totalAmount: number;
  readonly firstCompetence: IsoDate;
  readonly lastCompetence: IsoDate;
  readonly remainingCount: number;
  readonly remainingAmount: number;
  readonly creditCardId: string | null;
  readonly accountId: string | null;
  readonly categoryId: string | null;
}

export interface InstallmentPurchaseView extends InstallmentPurchase {
  /** Instalments whose competence has already passed. */
  readonly settledCount: number;
  readonly installmentAmount: number;
  readonly done: boolean;
  readonly originName: string;
  readonly progressPercent: number;
}

/** Competence of an instalment: the invoice on a card, the date on an account. */
export function installmentCompetence(transaction: Transaction): IsoDate {
  return transaction.invoice_due_date ?? transaction.date;
}

export function buildPurchaseViews(
  purchases: readonly InstallmentPurchase[],
  cardNames: ReadonlyMap<string, string>,
  accountNames: ReadonlyMap<string, string>,
): InstallmentPurchaseView[] {
  return purchases
    .map((purchase) => {
      const settledCount = purchase.recordedCount - purchase.remainingCount;
      return {
        ...purchase,
        settledCount,
        installmentAmount:
          purchase.recordedCount > 0 ? purchase.totalAmount / purchase.recordedCount : 0,
        done: purchase.remainingCount === 0,
        originName: purchase.creditCardId
          ? (cardNames.get(purchase.creditCardId) ?? 'Cartão')
          : purchase.accountId
            ? (accountNames.get(purchase.accountId) ?? 'Conta')
            : '—',
        progressPercent:
          purchase.recordedCount > 0 ? (settledCount / purchase.recordedCount) * 100 : 0,
      };
    })
    .sort((a, b) => b.firstCompetence.localeCompare(a.firstCompetence));
}

export interface MonthlyCommitment {
  readonly month: string;
  readonly label: string;
  readonly amount: number;
}

/** Commitment per month for the instalments still ahead of `today`. */
export function commitmentByMonth(
  installments: readonly Transaction[],
  today: IsoDate,
  monthLabels: (month: string) => string,
  months: number,
): MonthlyCommitment[] {
  const totals = new Map<string, number[]>();
  for (const transaction of installments) {
    const competence = installmentCompetence(transaction);
    if (competence <= today || transaction.status === 'CANCELLED') {
      continue;
    }
    const month = competence.slice(0, 7);
    const amounts = totals.get(month);
    if (amounts) {
      amounts.push(transaction.amount);
    } else {
      totals.set(month, [transaction.amount]);
    }
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, months)
    .map(([month, amounts]) => ({
      month,
      label: monthLabels(month),
      amount: sumAmounts(amounts),
    }));
}
