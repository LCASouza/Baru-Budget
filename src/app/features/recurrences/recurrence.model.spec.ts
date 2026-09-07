import { makeTransaction } from '../../testing/finance-fixtures';
import {
  RecurrenceTemplate,
  buildRecurrenceViews,
  expectedTotal,
  missingCount,
} from './recurrence.model';

const PERIOD = { year: 2026, month: 9 };

function template(overrides: Partial<RecurrenceTemplate> = {}): RecurrenceTemplate {
  return {
    id: 't1',
    type: 'EXPENSE',
    description: 'Aluguel',
    categoryId: 'cat-home',
    accountId: 'acc-bank',
    creditCardId: null,
    householdId: null,
    defaultAmount: 1850,
    day: 10,
    frequency: 'MONTHLY',
    anchorMonth: null,
    active: true,
    notes: null,
    ...overrides,
  };
}

const NAMES = {
  categories: new Map([
    ['cat-home', 'Moradia'],
    ['cat-subs', 'Assinaturas'],
  ]),
  accounts: new Map([['acc-bank', 'Conta corrente']]),
  cards: new Map([['card-1', 'Cartão principal']]),
};

describe('recurrence.model', () => {
  const templates = [
    template(),
    template({ id: 't2', description: 'Streaming', categoryId: 'cat-subs', accountId: null, creditCardId: 'card-1', defaultAmount: 49.9, day: 8 }),
    template({ id: 't3', description: 'Academia', defaultAmount: 120, day: 5, active: false }),
    template({ id: 't4', description: 'IPVA', defaultAmount: 900, day: 15, frequency: 'YEARLY', anchorMonth: 2 }),
  ];
  const instances = [
    makeTransaction({ id: 'i1', fixed_expense_id: 't1', amount: 1975.4, date: '2026-09-10', recurrence_month: '2026-09-01' }),
  ];

  const views = buildRecurrenceViews(
    templates,
    instances,
    PERIOD,
    NAMES.categories,
    NAMES.accounts,
    NAMES.cards,
  );

  it('orders by day and resolves category and origin names', () => {
    expect(views.map((view) => view.description)).toEqual(['Academia', 'Streaming', 'Aluguel', 'IPVA']);
    expect(views.find((view) => view.id === 't1')?.categoryName).toBe('Moradia');
    expect(views.find((view) => view.id === 't1')?.originName).toBe('Conta corrente');
    expect(views.find((view) => view.id === 't2')?.originName).toBe('Cartão principal');
  });

  it('derives the status of each template in the month', () => {
    const status = (id: string) => views.find((view) => view.id === id)?.status;
    expect(status('t1')).toBe('GENERATED');
    expect(status('t2')).toBe('MISSING');
    expect(status('t3')).toBe('INACTIVE');
    expect(status('t4')).toBe('NOT_DUE');
  });

  it('attaches the generated instance and its competence date', () => {
    const rent = views.find((view) => view.id === 't1')!;
    expect(rent.instance?.id).toBe('i1');
    expect(rent.competence).toBe('2026-09-10');
    expect(views.find((view) => view.id === 't2')?.instance).toBeNull();
  });

  it('counts what is still missing', () => {
    expect(missingCount(views)).toBe(1);
  });

  it('totals the real amount when generated and the suggestion otherwise', () => {
    // 1975.40 from the instance plus 49.90 still to generate; inactive and
    // out-of-month templates do not count.
    expect(expectedTotal(views)).toBe(2025.3);
  });

  it('reports the yearly template in its anchor month', () => {
    const february = buildRecurrenceViews(
      templates,
      [],
      { year: 2027, month: 2 },
      NAMES.categories,
      NAMES.accounts,
      NAMES.cards,
    );
    expect(february.find((view) => view.id === 't4')?.status).toBe('MISSING');
    expect(february.find((view) => view.id === 't4')?.competence).toBe('2027-02-15');
  });
});
