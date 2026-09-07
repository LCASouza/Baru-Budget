import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { invoiceClosingDate, invoiceDueDateFor, invoiceLabel, invoiceStatus } from './invoice';

registerLocaleData(localePt);

// Same cases as supabase/tests/invoice_due_date.test.sql; the database is the
// authority and this mirror only powers the form preview.
const CASES: readonly [string, number, number, string][] = [
  ['2026-09-10', 15, 25, '2026-09-25'],
  ['2026-09-15', 15, 25, '2026-09-25'],
  ['2026-09-16', 15, 25, '2026-10-25'],
  ['2026-09-20', 28, 5, '2026-10-05'],
  ['2026-09-29', 28, 5, '2026-11-05'],
  ['2026-12-29', 28, 5, '2027-02-05'],
  ['2026-12-10', 28, 5, '2027-01-05'],
  ['2027-02-28', 31, 10, '2027-03-10'],
  ['2026-04-21', 20, 31, '2026-05-31'],
  ['2026-03-21', 20, 31, '2026-04-30'],
  ['2028-01-31', 31, 10, '2028-02-10'],
  ['2028-02-29', 29, 15, '2028-03-15'],
];

describe('invoice', () => {
  describe('invoiceDueDateFor', () => {
    for (const [purchase, closingDay, dueDay, expected] of CASES) {
      it(`purchase ${purchase} on a card closing ${closingDay} and due ${dueDay} falls in ${expected}`, () => {
        expect(invoiceDueDateFor(purchase, closingDay, dueDay)).toBe(expected);
      });
    }
  });

  describe('invoiceClosingDate', () => {
    it('finds the closing date of an invoice from its due date', () => {
      expect(invoiceClosingDate('2026-10-05', 28, 5)).toBe('2026-09-28');
      expect(invoiceClosingDate('2026-09-25', 15, 25)).toBe('2026-09-15');
      expect(invoiceClosingDate('2027-03-10', 31, 10)).toBe('2027-02-28');
      expect(invoiceClosingDate('2027-01-05', 28, 5)).toBe('2026-12-28');
    });

    it('is the inverse of invoiceDueDateFor for a purchase on the closing day', () => {
      for (const [, closingDay, dueDay] of CASES) {
        const closing = invoiceClosingDate(
          invoiceDueDateFor('2026-06-01', closingDay, dueDay),
          closingDay,
          dueDay,
        );
        expect(closing.startsWith('2026-06')).toBe(true);
      }
    });
  });

  describe('invoiceStatus', () => {
    it('is open before closing and closed after it', () => {
      expect(invoiceStatus(100, 0, '2026-09-28', '2026-09-20')).toBe('OPEN');
      expect(invoiceStatus(100, 0, '2026-09-28', '2026-09-28')).toBe('OPEN');
      expect(invoiceStatus(100, 0, '2026-09-28', '2026-09-29')).toBe('CLOSED');
    });

    it('reports partial and full payments', () => {
      expect(invoiceStatus(100, 40, '2026-09-28', '2026-09-29')).toBe('PARTIAL');
      expect(invoiceStatus(100, 100, '2026-09-28', '2026-09-29')).toBe('PAID');
      expect(invoiceStatus(100, 120, '2026-09-28', '2026-09-20')).toBe('PAID');
    });

    it('keeps an empty invoice out of the paid state', () => {
      expect(invoiceStatus(0, 0, '2026-09-28', '2026-09-29')).toBe('CLOSED');
    });
  });

  it('labels an invoice by the month it is due', () => {
    expect(invoiceLabel('2026-10-05')).toBe('Fatura de Outubro 2026');
    expect(invoiceLabel('2027-01-15')).toBe('Fatura de Janeiro 2027');
  });
});
