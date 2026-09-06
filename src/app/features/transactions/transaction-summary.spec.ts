import { makeAccount, makeCategory, makeTransaction } from '../../testing/finance-fixtures';
import {
  EMPTY_FILTERS,
  countActiveFilters,
  filterTransactions,
  groupByDate,
  summarizeTransactions,
} from './transaction-summary';
import { buildTransactionViews } from './transaction.model';

const TODAY = '2026-09-06';

const views = buildTransactionViews(
  [
    makeTransaction({ id: 'salary', kind: 'INCOME', description: 'Salário', amount: 5400, category_id: 'cat-salary', date: '2026-09-05' }),
    makeTransaction({ id: 'market', kind: 'EXPENSE', description: 'Supermercado', amount: 320.45, date: '2026-09-04' }),
    makeTransaction({ id: 'bakery', kind: 'EXPENSE', description: 'Padaria', amount: 35.9, account_id: 'acc-cash', date: '2026-09-04' }),
    makeTransaction({ id: 'energy', kind: 'EXPENSE', description: 'Energia', amount: 180, status: 'PENDING', due_date: '2026-09-02', date: '2026-09-01' }),
    makeTransaction({ id: 'internet', kind: 'EXPENSE', description: 'Internet', amount: 120, status: 'PENDING', due_date: '2026-09-20', date: '2026-09-01' }),
    makeTransaction({ id: 'cinema', kind: 'EXPENSE', description: 'Cinema', amount: 60, status: 'CANCELLED', date: '2026-09-03' }),
    makeTransaction({ id: 'withdraw', kind: 'TRANSFER', description: 'Saque', amount: 200, category_id: null, destination_account_id: 'acc-cash', date: '2026-09-02' }),
  ],
  new Map([
    ['cat-food', makeCategory()],
    ['cat-salary', makeCategory({ id: 'cat-salary', kind: 'INCOME', name: 'Salário' })],
  ]),
  new Map([
    ['acc-bank', makeAccount()],
    ['acc-cash', makeAccount({ id: 'acc-cash', name: 'Dinheiro', type: 'CASH' })],
  ]),
  TODAY,
);

const ids = (list: readonly { transaction: { id: string } }[]) => list.map((v) => v.transaction.id);

describe('transaction-summary', () => {
  describe('filterTransactions', () => {
    it('returns everything with empty filters', () => {
      expect(filterTransactions(views, EMPTY_FILTERS)).toHaveLength(7);
    });

    it('filters by kind tab, keeping transfers only under all', () => {
      expect(ids(filterTransactions(views, { ...EMPTY_FILTERS, kind: 'INCOME' }))).toEqual(['salary']);
      expect(ids(filterTransactions(views, { ...EMPTY_FILTERS, kind: 'EXPENSE' }))).not.toContain('withdraw');
    });

    it('filters by category and by account on either side of a transfer', () => {
      expect(ids(filterTransactions(views, { ...EMPTY_FILTERS, categoryId: 'cat-salary' }))).toEqual(['salary']);
      expect(ids(filterTransactions(views, { ...EMPTY_FILTERS, accountId: 'acc-cash' }))).toEqual(['bakery', 'withdraw']);
    });

    it('filters by derived status', () => {
      expect(ids(filterTransactions(views, { ...EMPTY_FILTERS, status: 'OVERDUE' }))).toEqual(['energy']);
      expect(ids(filterTransactions(views, { ...EMPTY_FILTERS, status: 'PENDING' }))).toEqual(['internet']);
      expect(ids(filterTransactions(views, { ...EMPTY_FILTERS, status: 'CANCELLED' }))).toEqual(['cinema']);
    });

    it('searches descriptions ignoring case and accents', () => {
      expect(ids(filterTransactions(views, { ...EMPTY_FILTERS, search: 'SALARIO' }))).toEqual(['salary']);
      expect(ids(filterTransactions(views, { ...EMPTY_FILTERS, search: 'pad' }))).toEqual(['bakery']);
      expect(filterTransactions(views, { ...EMPTY_FILTERS, search: 'xyz' })).toHaveLength(0);
    });
  });

  it('counts active filters excluding the kind tab', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...EMPTY_FILTERS, kind: 'INCOME' })).toBe(0);
    expect(countActiveFilters({ kind: null, categoryId: 'c', accountId: 'a', status: 'PAID', search: ' x ' })).toBe(4);
    expect(countActiveFilters({ ...EMPTY_FILTERS, search: '   ' })).toBe(0);
  });

  it('summarizes incomes and expenses by competence, ignoring cancelled and transfers', () => {
    expect(summarizeTransactions(views)).toEqual({
      income: 5400,
      expense: 656.35,
      balance: 4743.65,
      count: 7,
    });
  });

  it('groups by date in descending order', () => {
    const groups = groupByDate(views);
    expect(groups.map((g) => g.date)).toEqual(['2026-09-05', '2026-09-04', '2026-09-03', '2026-09-02', '2026-09-01']);
    expect(ids(groups[1].items)).toEqual(['market', 'bakery']);
  });
});
