import { Tables } from '../../core/supabase/database.types';
import { sumAmounts } from '../../shared/money/money';
import { Transaction } from '../transactions/transaction.model';

export type Allocation = Tables<'transaction_allocations'>;

export interface PersonBalance {
  readonly userId: string;
  readonly name: string;
  /** Positive is receivable, negative is payable. */
  readonly balance: number;
}

export interface BalanceTotals {
  readonly receivable: number;
  readonly payable: number;
  readonly net: number;
}

export function balanceTotals(balances: readonly PersonBalance[]): BalanceTotals {
  const receivable = sumAmounts(
    balances.filter((entry) => entry.balance > 0).map((entry) => entry.balance),
  );
  const payable = sumAmounts(
    balances.filter((entry) => entry.balance < 0).map((entry) => -entry.balance),
  );
  return { receivable, payable, net: sumAmounts([receivable, -payable]) };
}

export function sortBalances(balances: readonly PersonBalance[]): PersonBalance[] {
  return [...balances].sort(
    (a, b) => b.balance - a.balance || a.name.localeCompare(b.name, 'pt-BR'),
  );
}

export type LedgerItemKind = 'OWED_TO_ME' | 'I_OWE' | 'SETTLEMENT';

export interface LedgerItem {
  readonly id: string;
  readonly kind: LedgerItemKind;
  readonly description: string;
  readonly date: string;
  /** Signed against the current user: positive increases what they are owed. */
  readonly amount: number;
  readonly transaction: Transaction;
}

/** Items that make up the balance with one person, most recent first. */
export function buildLedgerItems(
  allocations: readonly (Allocation & { transaction: Transaction })[],
  settlements: readonly Transaction[],
  meId: string,
  counterpartyId: string,
): LedgerItem[] {
  const fromAllocations = allocations
    .filter((row) => {
      const owner = row.transaction.owner_user_id;
      return (
        (owner === meId && row.user_id === counterpartyId) ||
        (owner === counterpartyId && row.user_id === meId)
      );
    })
    .map((row) => ({
      id: row.id,
      kind: (row.transaction.owner_user_id === meId ? 'OWED_TO_ME' : 'I_OWE') as LedgerItemKind,
      description: row.transaction.description,
      date: row.transaction.date,
      amount: row.transaction.owner_user_id === meId ? row.amount : -row.amount,
      transaction: row.transaction,
    }));

  const fromSettlements = settlements.map((transaction) => {
    const paidByMe =
      (transaction.owner_user_id === meId && transaction.settlement_direction === 'PAY') ||
      (transaction.owner_user_id === counterpartyId &&
        transaction.settlement_direction === 'RECEIVE');
    return {
      id: transaction.id,
      kind: 'SETTLEMENT' as LedgerItemKind,
      description: transaction.description,
      date: transaction.date,
      amount: paidByMe ? transaction.amount : -transaction.amount,
      transaction,
    };
  });

  return [...fromAllocations, ...fromSettlements].sort((a, b) => b.date.localeCompare(a.date));
}
