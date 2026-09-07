import { MonthPeriod, shiftMonth } from '../../core/period/period.model';
import { IsoDate } from '../../shared/dates/iso-date';
import { fromCents, toCents } from '../../shared/money/money';
import { invoiceDueDateFor } from '../cards/invoice';

export const MIN_INSTALLMENTS = 2;
export const MAX_INSTALLMENTS = 60;

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function lastDayOfMonth(period: MonthPeriod): number {
  return new Date(period.year, period.month, 0).getDate();
}

function periodOf(date: IsoDate): MonthPeriod {
  const [year, month] = date.split('-').map(Number);
  return { year, month };
}

/**
 * Splits an amount into whole cents, with the remainder on the first
 * instalment. Mirrors `public.split_installment_amounts`, which is the
 * authority; this version only powers the form preview.
 */
export function splitInstallmentAmounts(total: number, count: number): number[] {
  if (count < MIN_INSTALLMENTS || !Number.isFinite(total) || total <= 0) {
    return [];
  }
  const cents = toCents(total);
  if (cents < count) {
    return [];
  }
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  return Array.from({ length: count }, (_, index) =>
    fromCents(index === 0 ? base + remainder : base),
  );
}

/** Same day of the month, `months` later, clamped to the last day of that month. */
export function shiftMonthDay(date: IsoDate, months: number): IsoDate {
  const day = Number(date.split('-')[2]);
  const target = shiftMonth(periodOf(date), months);
  return `${target.year}-${pad(target.month)}-${pad(Math.min(day, lastDayOfMonth(target)))}`;
}

/** Invoice due dates of a card installment purchase, one per consecutive invoice. */
export function cardInstallmentDueDates(
  purchaseDate: IsoDate,
  closingDay: number,
  dueDay: number,
  count: number,
): IsoDate[] {
  const first = invoiceDueDateFor(purchaseDate, closingDay, dueDay);
  return Array.from({ length: count }, (_, index) => {
    const target = shiftMonth(periodOf(first), index);
    return `${target.year}-${pad(target.month)}-${pad(Math.min(dueDay, lastDayOfMonth(target)))}`;
  });
}

/** Dates of an account installment purchase, one per month. */
export function accountInstallmentDates(purchaseDate: IsoDate, count: number): IsoDate[] {
  return Array.from({ length: count }, (_, index) => shiftMonthDay(purchaseDate, index));
}

export function installmentLabel(current: number, total: number): string {
  return `${current}/${total}`;
}
