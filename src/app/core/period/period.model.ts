import { formatDate } from '@angular/common';
import { IsoDate, toIsoDate } from '../../shared/dates/iso-date';

export interface MonthPeriod {
  readonly year: number;
  /** 1 to 12 */
  readonly month: number;
}

export interface DateRange {
  /** Inclusive first day, `yyyy-MM-dd`. */
  readonly start: IsoDate;
  /** Inclusive last day, `yyyy-MM-dd`. */
  readonly end: IsoDate;
}

export function currentMonth(now: Date = new Date()): MonthPeriod {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function shiftMonth(period: MonthPeriod, delta: number): MonthPeriod {
  const shifted = new Date(period.year, period.month - 1 + delta, 1);
  return { year: shifted.getFullYear(), month: shifted.getMonth() + 1 };
}

export function isSameMonth(a: MonthPeriod, b: MonthPeriod): boolean {
  return a.year === b.year && a.month === b.month;
}

export function monthRange(period: MonthPeriod): DateRange {
  const start = new Date(period.year, period.month - 1, 1);
  const end = new Date(period.year, period.month, 0);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export function monthLabel(period: MonthPeriod): string {
  const text = formatDate(new Date(period.year, period.month - 1, 1), 'MMMM yyyy', 'pt-BR');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
