import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { makeTransaction } from '../../testing/finance-fixtures';
import {
  InstallmentPurchase,
  buildPurchaseViews,
  commitmentByMonth,
  installmentCompetence,
} from './installment.model';

registerLocaleData(localePt);

const PURCHASES: readonly InstallmentPurchase[] = [
  {
    id: 'g1',
    description: 'Notebook',
    installmentCount: 12,
    recordedCount: 12,
    totalAmount: 4200,
    firstCompetence: '2026-10-05',
    lastCompetence: '2027-09-05',
    remainingCount: 9,
    remainingAmount: 3150,
    creditCardId: 'card-1',
    accountId: null,
    categoryId: 'cat-shop',
  },
  {
    id: 'g2',
    description: 'Geladeira',
    installmentCount: 4,
    recordedCount: 4,
    totalAmount: 1800,
    firstCompetence: '2026-08-10',
    lastCompetence: '2026-11-10',
    remainingCount: 0,
    remainingAmount: 0,
    creditCardId: null,
    accountId: 'acc-bank',
    categoryId: 'cat-shop',
  },
];

describe('installment.model', () => {
  const views = buildPurchaseViews(
    PURCHASES,
    new Map([['card-1', 'Cartão principal']]),
    new Map([['acc-bank', 'Conta corrente']]),
  );

  it('orders the purchases from the most recent competence', () => {
    expect(views.map((purchase) => purchase.id)).toEqual(['g1', 'g2']);
  });

  it('derives progress, instalment amount and origin', () => {
    const notebook = views[0];
    expect(notebook.settledCount).toBe(3);
    expect(notebook.installmentAmount).toBe(350);
    expect(notebook.originName).toBe('Cartão principal');
    expect(notebook.done).toBe(false);
    expect(notebook.progressPercent).toBe(25);

    const fridge = views[1];
    expect(fridge.done).toBe(true);
    expect(fridge.originName).toBe('Conta corrente');
    expect(fridge.progressPercent).toBe(100);
  });

  it('falls back when the origin is not visible', () => {
    const [orphan] = buildPurchaseViews(
      [{ ...PURCHASES[0], creditCardId: 'gone' }],
      new Map(),
      new Map(),
    );
    expect(orphan.originName).toBe('Cartão');
  });

  it('uses the invoice as competence on a card and the date on an account', () => {
    expect(
      installmentCompetence(makeTransaction({ invoice_due_date: '2026-10-05', date: '2026-09-06' })),
    ).toBe('2026-10-05');
    expect(installmentCompetence(makeTransaction({ date: '2026-09-06' }))).toBe('2026-09-06');
  });

  describe('commitmentByMonth', () => {
    const label = (month: string) => month;
    const installments = [
      makeTransaction({ id: 'past', amount: 100, date: '2026-08-10' }),
      makeTransaction({ id: 'now', amount: 100, date: '2026-09-07' }),
      makeTransaction({ id: 'next-1', amount: 350, date: '2026-10-06', invoice_due_date: '2026-11-05' }),
      makeTransaction({ id: 'next-2', amount: 350, date: '2026-11-06', invoice_due_date: '2026-12-05' }),
      makeTransaction({ id: 'next-3', amount: 200, date: '2026-11-20', invoice_due_date: '2026-12-20' }),
      makeTransaction({ id: 'cancelled', amount: 900, date: '2026-12-06', invoice_due_date: '2027-01-05', status: 'CANCELLED' }),
    ];

    it('groups future instalments by competence month', () => {
      expect(commitmentByMonth(installments, '2026-09-07', label, 6)).toEqual([
        { month: '2026-11', label: '2026-11', amount: 350 },
        { month: '2026-12', label: '2026-12', amount: 550 },
      ]);
    });

    it('ignores what is not ahead and limits the number of months', () => {
      expect(commitmentByMonth(installments, '2027-01-01', label, 6)).toEqual([]);
      expect(commitmentByMonth(installments, '2026-09-07', label, 1)).toEqual([
        { month: '2026-11', label: '2026-11', amount: 350 },
      ]);
    });
  });
});
