import { ApplicationRef, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { PeriodService } from '../../core/period/period.service';
import { makeAccount, makeCategory, makeTransaction } from '../../testing/finance-fixtures';
import { AccountsStore } from '../accounts/accounts.store';
import { CardsStore } from '../cards/cards.store';
import { CategoriesStore } from '../categories/categories.store';
import { TransactionRepository } from './transaction.repository';
import { TransactionsStore } from './transactions.store';

describe('TransactionsStore', () => {
  const ownerId = signal<string | null>('u1');
  const householdId = signal<string | null>(null);
  const memberNameById = signal<ReadonlyMap<string, string>>(new Map());
  let repository: {
    listByDateRange: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let reloadBalances: ReturnType<typeof vi.fn>;
  let store: TransactionsStore;
  let period: PeriodService;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  beforeEach(() => {
    ownerId.set('u1');
    householdId.set(null);
    memberNameById.set(new Map());
    repository = {
      listByDateRange: vi.fn().mockResolvedValue([
        makeTransaction({ id: 'salary', kind: 'INCOME', description: 'Salário', amount: 5000, category_id: 'salary' }),
        makeTransaction({ id: 'market', kind: 'EXPENSE', description: 'Supermercado', amount: 300 }),
        makeTransaction({ id: 'cash', kind: 'EXPENSE', description: 'Padaria', amount: 20, account_id: 'acc-cash' }),
      ]),
      create: vi.fn().mockResolvedValue(makeTransaction()),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    reloadBalances = vi.fn();
    const accounts = signal([makeAccount(), makeAccount({ id: 'acc-cash', name: 'Dinheiro', type: 'CASH' })]);
    const categories = signal([makeCategory(), makeCategory({ id: 'salary', kind: 'INCOME', name: 'Salário' })]);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: FinancialContextService,
          useValue: {
            dataOwnerId: ownerId,
            householdId,
            memberNameById,
            canManage: signal(true),
            canManageOwner: (id: string) => id === 'u1',
          },
        },
        { provide: TransactionRepository, useValue: repository },
        {
          provide: CardsStore,
          useValue: {
            cards: signal([]),
            activeCards: signal([]),
            byId: signal(new Map()),
            nameById: signal(new Map()),
            invoicesOf: () => [],
            dueBetween: () => [],
            totalDueBetween: () => 0,
            reload: vi.fn(),
          },
        },
        {
          provide: AccountsStore,
          useValue: {
            byId: computed(() => new Map(accounts().map((a) => [a.id, a]))),
            reloadBalances,
          },
        },
        {
          provide: CategoriesStore,
          useValue: { byId: computed(() => new Map(categories().map((c) => [c.id, c]))) },
        },
      ],
    });
    period = TestBed.inject(PeriodService);
    store = TestBed.inject(TransactionsStore);
  });

  it('loads the selected month for the context owner', async () => {
    await settle();
    expect(repository.listByDateRange).toHaveBeenCalledWith(period.range(), { ownerId: 'u1' });
    expect(store.views()).toHaveLength(3);
    expect(store.views()[0].categoryName).toBe('Salário');
    expect(store.summary()).toEqual({ income: 5000, expense: 320, balance: 4680, count: 3 });
  });

  it('reloads when the period changes', async () => {
    await settle();
    period.previous();
    await settle();
    expect(repository.listByDateRange).toHaveBeenCalledTimes(2);
    expect(repository.listByDateRange).toHaveBeenLastCalledWith(period.range(), { ownerId: 'u1' });
  });

  it('lists the household transactions and resolves member names in a household context', async () => {
    await settle();
    householdId.set('h1');
    memberNameById.set(new Map([['u1', 'Alice']]));
    await settle();
    expect(repository.listByDateRange).toHaveBeenLastCalledWith(period.range(), { householdId: 'h1' });
    expect(store.isHouseholdContext()).toBe(true);
    expect(store.views()[0].ownerName).toBe('Alice');
    expect(store.canEdit(store.views()[0].transaction)).toBe(true);
    expect(store.canEdit(makeTransaction({ owner_user_id: 'u2' }))).toBe(false);
  });

  it('applies filters on the loaded month', async () => {
    await settle();
    store.setKind('EXPENSE');
    expect(store.filtered().map((v) => v.transaction.id)).toEqual(['market', 'cash']);
    store.setAccount('acc-cash');
    expect(store.filtered().map((v) => v.transaction.id)).toEqual(['cash']);
    expect(store.activeFilterCount()).toBe(1);
    store.clearFilters();
    expect(store.filters().kind).toBe('EXPENSE');
    expect(store.filters().accountId).toBeNull();
    expect(store.grouped()[0].items).toHaveLength(2);
  });

  it('resets the category filter when the kind tab changes', async () => {
    await settle();
    store.setCategory('cat-food');
    store.setKind('INCOME');
    expect(store.filters().categoryId).toBeNull();
  });

  it('reloads the list and the balances after a mutation', async () => {
    await settle();
    await store.create({
      kind: 'EXPENSE',
      description: 'Café',
      amount: 5,
      date: '2026-09-06',
      dueDate: null,
      status: 'PAID',
      categoryId: 'cat-food',
      accountId: 'acc-bank',
      destinationAccountId: null,
      creditCardId: null,
      invoiceDueDate: null,
      householdId: null,
      notes: null,
    });
    await settle();
    expect(repository.create).toHaveBeenCalledWith('u1', expect.objectContaining({ description: 'Café' }));
    expect(repository.listByDateRange).toHaveBeenCalledTimes(2);
    expect(reloadBalances).toHaveBeenCalledTimes(1);

    await store.remove('market');
    await settle();
    expect(repository.remove).toHaveBeenCalledWith('market');
    expect(reloadBalances).toHaveBeenCalledTimes(2);
  });

  it('clears after logout and surfaces load errors', async () => {
    await settle();
    ownerId.set(null);
    await settle();
    expect(store.transactions()).toEqual([]);

    repository.listByDateRange.mockRejectedValueOnce(new Error('offline'));
    ownerId.set('u2');
    await settle();
    expect(store.error()).toBeTruthy();
  });
});
