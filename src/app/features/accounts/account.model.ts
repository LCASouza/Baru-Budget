import { AccountType } from '../../core/finance/account-type';
import { Tables } from '../../core/supabase/database.types';
import { sumAmounts } from '../../shared/money/money';

export type Account = Tables<'accounts'>;

export interface AccountBalance {
  readonly accountId: string;
  readonly openingBalance: number;
  readonly currentBalance: number;
}

export interface AccountInput {
  readonly name: string;
  readonly type: AccountType;
  readonly institution: string | null;
  readonly openingBalance: number;
}

export interface BalanceTotals {
  /** Active accounts that are not benefits (bank, cash, other). */
  readonly money: number;
  /** Active BENEFIT accounts (meal and food vouchers and similar). */
  readonly benefit: number;
}

export function isBenefitAccount(account: Pick<Account, 'type'>): boolean {
  return account.type === 'BENEFIT';
}

export function splitBalances(
  accounts: readonly Account[],
  balanceByAccountId: ReadonlyMap<string, number>,
): BalanceTotals {
  const active = accounts.filter((account) => account.active);
  const balanceOf = (account: Account) => balanceByAccountId.get(account.id) ?? account.opening_balance;
  return {
    money: sumAmounts(active.filter((account) => !isBenefitAccount(account)).map(balanceOf)),
    benefit: sumAmounts(active.filter(isBenefitAccount).map(balanceOf)),
  };
}
