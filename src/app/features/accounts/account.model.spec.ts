import { makeAccount } from '../../testing/finance-fixtures';
import { isBenefitAccount, splitBalances } from './account.model';

describe('account.model', () => {
  it('identifies benefit accounts', () => {
    expect(isBenefitAccount(makeAccount({ type: 'BENEFIT' }))).toBe(true);
    expect(isBenefitAccount(makeAccount({ type: 'BANK' }))).toBe(false);
  });

  it('splits money and benefit balances of active accounts', () => {
    const accounts = [
      makeAccount({ id: 'bank', type: 'BANK', opening_balance: 100 }),
      makeAccount({ id: 'cash', type: 'CASH', opening_balance: 20 }),
      makeAccount({ id: 'other', type: 'OTHER', opening_balance: 5 }),
      makeAccount({ id: 'meal', type: 'BENEFIT', opening_balance: 0 }),
      makeAccount({ id: 'old', type: 'BANK', opening_balance: 999, active: false }),
    ];
    const balances = new Map([
      ['bank', 1179.75],
      ['cash', 30.1],
      ['meal', 950],
      ['old', 999],
    ]);

    expect(splitBalances(accounts, balances)).toEqual({ money: 1214.85, benefit: 950 });
  });

  it('falls back to the opening balance when the view has no row yet', () => {
    const accounts = [makeAccount({ id: 'bank', type: 'BANK', opening_balance: 250 })];
    expect(splitBalances(accounts, new Map())).toEqual({ money: 250, benefit: 0 });
  });
});
