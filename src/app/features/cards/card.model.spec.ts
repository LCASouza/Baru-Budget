import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { CreditCard, Invoice, buildInvoiceViews, cardUsage, nextInvoice } from './card.model';

registerLocaleData(localePt);

const CARD: CreditCard = {
  id: 'card-1',
  owner_user_id: 'u1',
  name: 'Cartão',
  institution: 'Banco',
  limit_amount: 5000,
  closing_day: 20,
  due_day: 5,
  color: null,
  active: true,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  created_by: 'u1',
  updated_by: 'u1',
};

const INVOICES: readonly Invoice[] = [
  { cardId: 'card-1', dueDate: '2026-09-05', total: 400, paid: 400, purchaseCount: 3 },
  { cardId: 'card-1', dueDate: '2026-10-05', total: 300, paid: 100, purchaseCount: 2 },
  { cardId: 'card-1', dueDate: '2026-11-05', total: 150, paid: 0, purchaseCount: 1 },
  { cardId: 'card-2', dueDate: '2026-10-10', total: 999, paid: 0, purchaseCount: 1 },
];

describe('card.model', () => {
  const views = buildInvoiceViews(CARD, INVOICES, '2026-10-01');

  it('keeps only the invoices of the card, most recent first', () => {
    expect(views.map((invoice) => invoice.dueDate)).toEqual([
      '2026-11-05',
      '2026-10-05',
      '2026-09-05',
    ]);
  });

  it('derives closing date, remaining amount, status and label', () => {
    const october = views.find((invoice) => invoice.dueDate === '2026-10-05')!;
    expect(october.closingDate).toBe('2026-09-20');
    expect(october.remaining).toBe(200);
    expect(october.status).toBe('PARTIAL');
    expect(october.label).toBe('Fatura de Outubro 2026');

    expect(views.find((invoice) => invoice.dueDate === '2026-09-05')!.status).toBe('PAID');
    expect(views.find((invoice) => invoice.dueDate === '2026-11-05')!.status).toBe('OPEN');
  });

  it('sums what is still owed and the available limit', () => {
    expect(cardUsage(CARD, views)).toEqual({ used: 350, available: 4650 });
  });

  it('reports no available amount when the card has no limit', () => {
    expect(cardUsage({ ...CARD, limit_amount: null }, views)).toEqual({ used: 350, available: null });
  });

  it('points to the oldest unpaid invoice as the next one', () => {
    expect(nextInvoice(views)?.dueDate).toBe('2026-10-05');
    expect(nextInvoice(views.filter((invoice) => invoice.status === 'PAID'))).toBeNull();
    expect(nextInvoice([])).toBeNull();
  });
});
