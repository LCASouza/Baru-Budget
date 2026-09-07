import { makeTransaction } from '../../testing/finance-fixtures';
import {
  Allocation,
  PersonBalance,
  balanceTotals,
  buildLedgerItems,
  sortBalances,
} from './allocation.model';

const BALANCES: readonly PersonBalance[] = [
  { userId: 'pai', name: 'Pai', balance: 420 },
  { userId: 'esposa', name: 'Esposa', balance: 150 },
  { userId: 'mae', name: 'Mãe', balance: -80 },
  { userId: 'zero', name: 'Zerado', balance: 0 },
];

function allocation(overrides: Partial<Allocation> = {}): Allocation {
  return {
    id: 'a1',
    transaction_id: 'tx-1',
    user_id: 'other',
    amount: 300,
    created_at: '2026-09-10T00:00:00Z',
    updated_at: '2026-09-10T00:00:00Z',
    created_by: 'me',
    updated_by: 'me',
    ...overrides,
  };
}

describe('allocation.model', () => {
  it('totals receivables, payables and the net balance of the specification example', () => {
    expect(balanceTotals(BALANCES)).toEqual({ receivable: 570, payable: 80, net: 490 });
  });

  it('sorts from the largest receivable to the largest payable', () => {
    expect(sortBalances(BALANCES).map((entry) => entry.userId)).toEqual([
      'pai',
      'esposa',
      'zero',
      'mae',
    ]);
  });

  describe('buildLedgerItems', () => {
    const mine = makeTransaction({ id: 'tx-1', owner_user_id: 'me', description: 'Mercado', date: '2026-09-10' });
    const theirs = makeTransaction({ id: 'tx-2', owner_user_id: 'other', description: 'Presente', date: '2026-09-12' });
    const allocations = [
      { ...allocation({ id: 'a1', transaction_id: 'tx-1', user_id: 'other', amount: 300 }), transaction: mine },
      { ...allocation({ id: 'a2', transaction_id: 'tx-1', user_id: 'me', amount: 300 }), transaction: mine },
      { ...allocation({ id: 'a3', transaction_id: 'tx-2', user_id: 'me', amount: 80 }), transaction: theirs },
      { ...allocation({ id: 'a4', transaction_id: 'tx-3', user_id: 'third', amount: 50 }), transaction: makeTransaction({ id: 'tx-3', owner_user_id: 'me' }) },
    ];
    const settlements = [
      makeTransaction({ id: 's1', kind: 'SETTLEMENT', owner_user_id: 'me', counterparty_user_id: 'other', settlement_direction: 'PAY', amount: 100, date: '2026-09-15', description: 'Pix' }),
      makeTransaction({ id: 's2', kind: 'SETTLEMENT', owner_user_id: 'other', counterparty_user_id: 'me', settlement_direction: 'PAY', amount: 40, date: '2026-09-14', description: 'Pix de volta' }),
    ];

    const items = buildLedgerItems(allocations, settlements, 'me', 'other');

    it('keeps only the items of the pair', () => {
      expect([...items].map((item) => item.id).sort()).toEqual(['a1', 'a3', 's1', 's2']);
    });

    it('signs each item against the current user', () => {
      const byId = new Map(items.map((item) => [item.id, item]));
      expect(byId.get('a1')).toMatchObject({ kind: 'OWED_TO_ME', amount: 300 });
      expect(byId.get('a3')).toMatchObject({ kind: 'I_OWE', amount: -80 });
      expect(byId.get('s1')).toMatchObject({ kind: 'SETTLEMENT', amount: 100 });
      expect(byId.get('s2')).toMatchObject({ kind: 'SETTLEMENT', amount: -40 });
    });

    it('drops the payer own share and third parties', () => {
      expect(items.some((item) => item.id === 'a2')).toBe(false);
      expect(items.some((item) => item.id === 'a4')).toBe(false);
    });

    it('orders from the most recent', () => {
      expect(items[0].date >= items[items.length - 1].date).toBe(true);
    });
  });
});
