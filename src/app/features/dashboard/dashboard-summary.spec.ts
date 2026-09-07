import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { makeAccount, makeCategory, makeTransaction } from '../../testing/finance-fixtures';
import { buildTransactionViews } from '../transactions/transaction.model';
import {
  MonthlyTotalRow,
  buildMonthlySeries,
  formatTickLabel,
  limitAmounts,
  niceTickStep,
  pendingByDueDate,
  recentTransactions,
  spendingByCategory,
  spendingByOwner,
  summarizeDashboard,
} from './dashboard-summary';

registerLocaleData(localePt);

const TODAY = '2026-09-06';

const views = buildTransactionViews(
  [
    makeTransaction({ id: 'salary', kind: 'INCOME', description: 'Salário', amount: 5400, category_id: 'cat-salary', date: '2026-09-05' }),
    makeTransaction({ id: 'extra', kind: 'INCOME', description: 'Extra', amount: 600, category_id: 'cat-salary', date: '2026-09-02' }),
    makeTransaction({ id: 'market', kind: 'EXPENSE', description: 'Supermercado', amount: 320.45, date: '2026-09-04' }),
    makeTransaction({ id: 'bakery', kind: 'EXPENSE', description: 'Padaria', amount: 35.9, date: '2026-09-04' }),
    makeTransaction({ id: 'rent', kind: 'EXPENSE', description: 'Aluguel', amount: 1850, category_id: 'cat-home', date: '2026-09-01' }),
    makeTransaction({ id: 'energy', kind: 'EXPENSE', description: 'Energia', amount: 180, category_id: 'cat-home', status: 'PENDING', due_date: '2026-09-02', date: '2026-09-01' }),
    makeTransaction({ id: 'internet', kind: 'EXPENSE', description: 'Internet', amount: 120, category_id: 'cat-home', status: 'PENDING', due_date: '2026-09-20', date: '2026-09-01' }),
    makeTransaction({ id: 'cinema', kind: 'EXPENSE', description: 'Cinema', amount: 60, status: 'CANCELLED', date: '2026-09-03' }),
    makeTransaction({ id: 'withdraw', kind: 'TRANSFER', description: 'Saque', amount: 200, category_id: null, destination_account_id: 'acc-cash', date: '2026-09-02' }),
    makeTransaction({ id: 'hidden', kind: 'EXPENSE', description: 'De outro membro', amount: 40, category_id: 'unknown', owner_user_id: 'u2', date: '2026-09-03' }),
  ],
  new Map([
    ['cat-food', makeCategory()],
    ['cat-home', makeCategory({ id: 'cat-home', name: 'Moradia' })],
    ['cat-salary', makeCategory({ id: 'cat-salary', kind: 'INCOME', name: 'Salário' })],
  ]),
  new Map([['acc-bank', makeAccount()]]),
  TODAY,
  new Map([
    ['u1', 'Alice'],
    ['u2', 'Bob'],
  ]),
);

describe('dashboard-summary', () => {
  it('summarizes incomes, expenses and pending amounts of the period', () => {
    expect(summarizeDashboard(views)).toEqual({
      income: 6000,
      expense: 2546.35,
      balance: 3453.65,
      pending: 300,
      incomeCount: 2,
      expenseCount: 6,
      pendingCount: 2,
      overdueCount: 1,
    });
  });

  it('counts a financing as expenses only, never as income', () => {
    const financing = buildTransactionViews(
      [
        makeTransaction({
          id: 'entry',
          kind: 'EXPENSE',
          description: 'Financiamento do carro',
          amount: 15000,
          category_id: 'cat-home',
          date: '2026-09-05',
          financing_id: 'fin-1',
        }),
        makeTransaction({
          id: 'fin-1-1',
          kind: 'EXPENSE',
          description: 'Financiamento do carro',
          amount: 1387.5,
          category_id: 'cat-home',
          status: 'PENDING',
          due_date: '2026-09-10',
          date: '2026-09-10',
          financing_id: 'fin-1',
          financing_installment_number: 1,
        }),
      ],
      new Map([['cat-home', makeCategory({ id: 'cat-home', name: 'Moradia' })]]),
      new Map([['acc-bank', makeAccount()]]),
      TODAY,
      new Map([['u1', 'Alice']]),
    );
    const summary = summarizeDashboard(financing);
    expect(summary.income).toBe(0);
    expect(summary.expense).toBe(16387.5);
    expect(summary.pending).toBe(1387.5);
  });

  it('groups expenses by category, ignoring transfers and cancelled entries', () => {
    expect(spendingByCategory(views)).toEqual([
      { name: 'Moradia', amount: 2150 },
      { name: 'Alimentação', amount: 356.35 },
      { name: 'Sem categoria', amount: 40 },
    ]);
  });

  it('groups expenses by person', () => {
    expect(spendingByOwner(views)).toEqual([
      { name: 'Alice', amount: 2506.35 },
      { name: 'Bob', amount: 40 },
    ]);
  });

  it('collapses the smallest entries into a single row', () => {
    const entries = [
      { name: 'A', amount: 100 },
      { name: 'B', amount: 50 },
      { name: 'C', amount: 30 },
      { name: 'D', amount: 20 },
    ];
    expect(limitAmounts(entries, 3)).toEqual([
      { name: 'A', amount: 100 },
      { name: 'B', amount: 50 },
      { name: 'Outras', amount: 50 },
    ]);
    expect(limitAmounts(entries, 4)).toEqual(entries);
    expect(limitAmounts([], 3)).toEqual([]);
  });

  it('lists pending transactions with the overdue ones first', () => {
    const pending = pendingByDueDate(views, TODAY);
    expect(pending.map((item) => item.view.transaction.id)).toEqual(['energy', 'internet']);
    expect(pending[0].status).toBe('OVERDUE');
    expect(pending[1].status).toBe('PENDING');
    expect(pending[0].dueDate).toBe('2026-09-02');
  });

  it('falls back to the transaction date when there is no due date', () => {
    const pending = pendingByDueDate(
      buildTransactionViews(
        [makeTransaction({ status: 'PENDING', due_date: null, date: '2026-09-01' })],
        new Map(),
        new Map(),
        TODAY,
      ),
      TODAY,
    );
    expect(pending[0].dueDate).toBe('2026-09-01');
    expect(pending[0].status).toBe('OVERDUE');
  });

  it('takes the most recent transactions by date and creation', () => {
    expect(recentTransactions(views, 3).map((view) => view.transaction.id)).toEqual([
      'salary',
      'market',
      'bakery',
    ]);
    expect(recentTransactions(views, 50)).toHaveLength(views.length);
  });

  describe('buildMonthlySeries', () => {
    const rows: readonly MonthlyTotalRow[] = [
      { month: '2026-09-01', kind: 'INCOME', total: 5000 },
      { month: '2026-09-01', kind: 'INCOME', total: 400 },
      { month: '2026-09-01', kind: 'EXPENSE', total: 2000 },
      { month: '2026-07-01', kind: 'EXPENSE', total: 800 },
    ];

    it('produces a continuous series ending at the selected month', () => {
      const series = buildMonthlySeries(rows, { year: 2026, month: 9 }, 3);
      expect(series).toEqual([
        { month: 'Jul', key: '2026-07-01', income: 0, expense: 800 },
        { month: 'Ago', key: '2026-08-01', income: 0, expense: 0 },
        { month: 'Set', key: '2026-09-01', income: 5400, expense: 2000 },
      ]);
    });

    it('crosses the year boundary', () => {
      const series = buildMonthlySeries([], { year: 2027, month: 1 }, 3);
      expect(series.map((month) => month.key)).toEqual(['2026-11-01', '2026-12-01', '2027-01-01']);
      expect(series.map((month) => month.month)).toEqual(['Nov', 'Dez', 'Jan']);
    });
  });

  describe('niceTickStep', () => {
    it('picks steps of 1, 2 or 5 times a power of ten', () => {
      expect(niceTickStep(300)).toBe(100);
      expect(niceTickStep(800)).toBe(200);
      expect(niceTickStep(8000)).toBe(2000);
      expect(niceTickStep(7400)).toBe(2000);
      expect(niceTickStep(300000)).toBe(100000);
      expect(niceTickStep(45)).toBe(20);
    });

    it('never returns zero', () => {
      expect(niceTickStep(0)).toBe(1);
      expect(niceTickStep(-5)).toBe(1);
      expect(niceTickStep(Number.NaN)).toBe(1);
    });
  });

  it('formats axis labels in pt-BR', () => {
    expect(formatTickLabel(0)).toBe('0');
    expect(formatTickLabel(500)).toBe('500');
    expect(formatTickLabel(2000)).toBe('2 mil');
    expect(formatTickLabel(1500)).toBe('1,5 mil');
    expect(formatTickLabel(100000)).toBe('100 mil');
  });
});
