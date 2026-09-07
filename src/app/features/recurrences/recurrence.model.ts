import { Tables } from '../../core/supabase/database.types';
import { IsoDate } from '../../shared/dates/iso-date';
import { sumAmounts } from '../../shared/money/money';
import { Transaction } from '../transactions/transaction.model';
import {
  RecurrenceFrequency,
  RecurrenceType,
  competenceDate,
  occursInMonth,
} from './recurrence';
import { MonthPeriod } from '../../core/period/period.model';

export type FixedExpense = Tables<'fixed_expenses'>;
export type RecurringIncome = Tables<'recurring_incomes'>;

/** Shape shared by the two tables, used by the list and the form. */
export interface RecurrenceTemplate {
  readonly id: string;
  readonly type: RecurrenceType;
  readonly description: string;
  readonly categoryId: string;
  readonly accountId: string | null;
  readonly creditCardId: string | null;
  readonly householdId: string | null;
  readonly defaultAmount: number;
  readonly day: number;
  readonly frequency: RecurrenceFrequency;
  readonly anchorMonth: number | null;
  readonly active: boolean;
  readonly notes: string | null;
}

export interface RecurrenceInput {
  readonly description: string;
  readonly categoryId: string;
  readonly accountId: string | null;
  readonly creditCardId: string | null;
  readonly householdId: string | null;
  readonly defaultAmount: number;
  readonly day: number;
  readonly frequency: RecurrenceFrequency;
  readonly anchorMonth: number | null;
  readonly notes: string | null;
}

export function fromFixedExpense(row: FixedExpense): RecurrenceTemplate {
  return {
    id: row.id,
    type: 'EXPENSE',
    description: row.description,
    categoryId: row.category_id,
    accountId: row.account_id,
    creditCardId: row.credit_card_id,
    householdId: row.household_id,
    defaultAmount: row.default_amount,
    day: row.due_day,
    frequency: row.frequency,
    anchorMonth: row.anchor_month,
    active: row.active,
    notes: row.notes,
  };
}

export function fromRecurringIncome(row: RecurringIncome): RecurrenceTemplate {
  return {
    id: row.id,
    type: 'INCOME',
    description: row.description,
    categoryId: row.category_id,
    accountId: row.account_id,
    creditCardId: null,
    householdId: row.household_id,
    defaultAmount: row.default_amount,
    day: row.receipt_day,
    frequency: row.frequency,
    anchorMonth: row.anchor_month,
    active: row.active,
    notes: row.notes,
  };
}

export type MonthStatus = 'GENERATED' | 'MISSING' | 'NOT_DUE' | 'INACTIVE';

export const MONTH_STATUS_LABELS: Readonly<Record<MonthStatus, string>> = {
  GENERATED: 'Lançado',
  MISSING: 'Falta gerar',
  NOT_DUE: 'Fora do mês',
  INACTIVE: 'Inativo',
};

export interface RecurrenceView extends RecurrenceTemplate {
  readonly status: MonthStatus;
  readonly instance: Transaction | null;
  readonly categoryName: string | null;
  readonly originName: string;
  readonly competence: IsoDate;
}

export function buildRecurrenceViews(
  templates: readonly RecurrenceTemplate[],
  instances: readonly Transaction[],
  period: MonthPeriod,
  categoryNames: ReadonlyMap<string, string>,
  accountNames: ReadonlyMap<string, string>,
  cardNames: ReadonlyMap<string, string>,
): RecurrenceView[] {
  const byTemplate = new Map<string, Transaction>();
  for (const instance of instances) {
    const templateId = instance.fixed_expense_id ?? instance.recurring_income_id;
    if (templateId) {
      byTemplate.set(templateId, instance);
    }
  }

  return templates
    .map((template) => {
      const instance = byTemplate.get(template.id) ?? null;
      const status: MonthStatus = !template.active
        ? 'INACTIVE'
        : !occursInMonth(template.frequency, template.anchorMonth, period)
          ? 'NOT_DUE'
          : instance
            ? 'GENERATED'
            : 'MISSING';
      return {
        ...template,
        status,
        instance,
        categoryName: categoryNames.get(template.categoryId) ?? null,
        originName: template.creditCardId
          ? (cardNames.get(template.creditCardId) ?? 'Cartão')
          : template.accountId
            ? (accountNames.get(template.accountId) ?? 'Conta')
            : '—',
        competence: competenceDate(period, template.day),
      };
    })
    .sort((a, b) => a.day - b.day || a.description.localeCompare(b.description, 'pt-BR'));
}

export function missingCount(views: readonly RecurrenceView[]): number {
  return views.filter((view) => view.status === 'MISSING').length;
}

/** Expected total of the month: the real amount when generated, the suggestion otherwise. */
export function expectedTotal(views: readonly RecurrenceView[]): number {
  return sumAmounts(
    views
      .filter((view) => view.status === 'GENERATED' || view.status === 'MISSING')
      .map((view) => view.instance?.amount ?? view.defaultAmount),
  );
}
