import { MonthPeriod } from '../../core/period/period.model';
import { Database } from '../../core/supabase/database.types';
import { IsoDate } from '../../shared/dates/iso-date';

export type RecurrenceFrequency = Database['public']['Enums']['recurrence_frequency'];

/** Fixed expenses and recurring incomes live in separate tables but share a shape. */
export type RecurrenceType = 'EXPENSE' | 'INCOME';

export const RECURRENCE_FREQUENCIES: readonly RecurrenceFrequency[] = ['MONTHLY', 'YEARLY'];

export const RECURRENCE_FREQUENCY_LABELS: Readonly<Record<RecurrenceFrequency, string>> = {
  MONTHLY: 'Mensal',
  YEARLY: 'Anual',
};

export const RECURRENCE_TYPE_LABELS: Readonly<Record<RecurrenceType, string>> = {
  EXPENSE: 'Gasto fixo',
  INCOME: 'Receita recorrente',
};

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function lastDayOfMonth(period: MonthPeriod): number {
  return new Date(period.year, period.month, 0).getDate();
}

/** First day of the month, the competence key of an instance. */
export function monthKey(period: MonthPeriod): IsoDate {
  return `${period.year}-${pad(period.month)}-01`;
}

/** Day of the template within the month, clamped to the last day. */
export function competenceDate(period: MonthPeriod, day: number): IsoDate {
  return `${period.year}-${pad(period.month)}-${pad(Math.min(day, lastDayOfMonth(period)))}`;
}

export function occursInMonth(
  frequency: RecurrenceFrequency,
  anchorMonth: number | null,
  period: MonthPeriod,
): boolean {
  return frequency === 'MONTHLY' || anchorMonth === period.month;
}
