import { MonthPeriod, monthLabel, shiftMonth } from '../../core/period/period.model';
import { IsoDate } from '../../shared/dates/iso-date';

export type InvoiceStatus = 'OPEN' | 'CLOSED' | 'PARTIAL' | 'PAID';

export const INVOICE_STATUS_LABELS: Readonly<Record<InvoiceStatus, string>> = {
  OPEN: 'Aberta',
  CLOSED: 'Fechada',
  PARTIAL: 'Parcial',
  PAID: 'Paga',
};

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function lastDayOfMonth(period: MonthPeriod): number {
  return new Date(period.year, period.month, 0).getDate();
}

function toIso(period: MonthPeriod, day: number): IsoDate {
  return `${period.year}-${pad(period.month)}-${pad(day)}`;
}

function periodOf(date: IsoDate): MonthPeriod {
  const [year, month] = date.split('-').map(Number);
  return { year, month };
}

/**
 * Invoice a purchase belongs to, identified by its due date. Mirrors
 * `public.invoice_due_date_for`, which is the authority and stores the value;
 * this version only powers the preview in the transaction form.
 */
export function invoiceDueDateFor(
  purchaseDate: IsoDate,
  closingDay: number,
  dueDay: number,
): IsoDate {
  const purchaseMonth = periodOf(purchaseDate);
  const day = Number(purchaseDate.split('-')[2]);
  const closingInMonth = Math.min(closingDay, lastDayOfMonth(purchaseMonth));
  const closingMonth = day > closingInMonth ? shiftMonth(purchaseMonth, 1) : purchaseMonth;
  const dueMonth = dueDay > closingDay ? closingMonth : shiftMonth(closingMonth, 1);
  return toIso(dueMonth, Math.min(dueDay, lastDayOfMonth(dueMonth)));
}

/** Closing date of the invoice due on `dueDate`, for display. */
export function invoiceClosingDate(
  dueDate: IsoDate,
  closingDay: number,
  dueDay: number,
): IsoDate {
  const dueMonth = periodOf(dueDate);
  const closingMonth = dueDay > closingDay ? dueMonth : shiftMonth(dueMonth, -1);
  return toIso(closingMonth, Math.min(closingDay, lastDayOfMonth(closingMonth)));
}

export function invoiceStatus(
  total: number,
  paid: number,
  closingDate: IsoDate,
  today: IsoDate,
): InvoiceStatus {
  if (total > 0 && paid >= total) {
    return 'PAID';
  }
  if (paid > 0) {
    return 'PARTIAL';
  }
  return closingDate < today ? 'CLOSED' : 'OPEN';
}

export function invoiceLabel(dueDate: IsoDate): string {
  return `Fatura de ${monthLabel(periodOf(dueDate))}`;
}
