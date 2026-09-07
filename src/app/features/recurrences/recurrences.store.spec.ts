import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { PeriodService } from '../../core/period/period.service';
import { currentMonth } from '../../core/period/period.model';
import { makeAccount, makeCategory, makeTransaction } from '../../testing/finance-fixtures';
import { AccountsStore } from '../accounts/accounts.store';
import { CardsStore } from '../cards/cards.store';
import { CategoriesStore } from '../categories/categories.store';
import { monthKey } from './recurrence';
import { RecurrenceTemplate } from './recurrence.model';
import { RecurrenceRepository } from './recurrence.repository';
import { RecurrencesStore } from './recurrences.store';

function template(overrides: Partial<RecurrenceTemplate> = {}): RecurrenceTemplate {
  return {
    id: 't1',
    type: 'EXPENSE',
    description: 'Aluguel',
    categoryId: 'cat-food',
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

describe('RecurrencesStore', () => {
  const ownerId = signal<string | null>('u1');
  const canManage = signal(true);
  let repository: Record<
    'listTemplates' | 'listInstances' | 'create' | 'update' | 'setActive' | 'remove' | 'generate',
    ReturnType<typeof vi.fn>
  >;
  let store: RecurrencesStore;
  let period: PeriodService;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  beforeEach(() => {
    ownerId.set('u1');
    canManage.set(true);
    repository = {
      listTemplates: vi.fn().mockResolvedValue([
        template(),
        template({ id: 't2', type: 'INCOME', description: 'Salário', defaultAmount: 5400, day: 5 }),
      ]),
      listInstances: vi.fn().mockResolvedValue([
        makeTransaction({ id: 'i1', fixed_expense_id: 't1', amount: 1900 }),
      ]),
      create: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      setActive: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      generate: vi.fn().mockResolvedValue(1),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: FinancialContextService, useValue: { dataOwnerId: ownerId, canManage, households: signal([]), context: signal({ kind: 'personal' }) } },
        { provide: RecurrenceRepository, useValue: repository },
        { provide: CategoriesStore, useValue: { visibleCategories: signal([makeCategory({ id: 'cat-food', name: 'Alimentação' })]) } },
        { provide: AccountsStore, useValue: { accounts: signal([makeAccount()]) } },
        { provide: CardsStore, useValue: { nameById: signal(new Map()) } },
      ],
    });
    period = TestBed.inject(PeriodService);
    store = TestBed.inject(RecurrencesStore);
  });

  it('loads the templates and the instances of the selected month', async () => {
    await settle();
    expect(repository.listTemplates).toHaveBeenCalledWith('u1');
    expect(repository.listInstances).toHaveBeenCalledWith('u1', monthKey(currentMonth()));
    expect(store.viewsOf('EXPENSE')).toHaveLength(1);
    expect(store.viewsOf('INCOME')).toHaveLength(1);
  });

  it('separates the two types and reports what is missing', async () => {
    await settle();
    expect(store.viewsOf('EXPENSE')[0].status).toBe('GENERATED');
    expect(store.viewsOf('INCOME')[0].status).toBe('MISSING');
    expect(store.missingOf('EXPENSE')).toBe(0);
    expect(store.missingOf('INCOME')).toBe(1);
    expect(store.totalMissing()).toBe(1);
  });

  it('totals the month with the real amount of what is generated', async () => {
    await settle();
    expect(store.expectedTotalOf('EXPENSE')).toBe(1900);
    expect(store.expectedTotalOf('INCOME')).toBe(5400);
  });

  it('reloads when the month changes', async () => {
    await settle();
    period.previous();
    await settle();
    expect(repository.listInstances).toHaveBeenCalledTimes(2);
    expect(repository.listInstances).toHaveBeenLastCalledWith('u1', monthKey(period.month()));
  });

  it('generates the selected month and reloads', async () => {
    await settle();
    await expect(store.generate()).resolves.toBe(1);
    await settle();
    expect(repository.generate).toHaveBeenCalledWith('u1', monthKey(currentMonth()));
    expect(repository.listTemplates).toHaveBeenCalledTimes(2);
  });

  it('creates, updates, deactivates and deletes templates by type', async () => {
    await settle();
    const input = {
      description: 'Internet',
      categoryId: 'cat-food',
      accountId: 'acc-bank',
      creditCardId: null,
      householdId: null,
      defaultAmount: 120,
      day: 20,
      frequency: 'MONTHLY' as const,
      anchorMonth: null,
      notes: null,
    };
    await store.create('EXPENSE', input);
    await store.update('t1', 'EXPENSE', input);
    await store.setActive('t1', 'EXPENSE', false);
    await store.remove('t2', 'INCOME');
    expect(repository.create).toHaveBeenCalledWith('u1', 'EXPENSE', input);
    expect(repository.update).toHaveBeenCalledWith('t1', 'EXPENSE', input);
    expect(repository.setActive).toHaveBeenCalledWith('t1', 'EXPENSE', false);
    expect(repository.remove).toHaveBeenCalledWith('t2', 'INCOME');
  });

  it('clears after logout', async () => {
    await settle();
    ownerId.set(null);
    await settle();
    expect(store.viewsOf('EXPENSE')).toEqual([]);
  });
});
