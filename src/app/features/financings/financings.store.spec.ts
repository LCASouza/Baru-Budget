import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { makeAccount, makeCategory, makeTransaction } from '../../testing/finance-fixtures';
import { AccountsStore } from '../accounts/accounts.store';
import { CategoriesStore } from '../categories/categories.store';
import { Financing } from './financing.model';
import { FinancingRepository } from './financing.repository';
import { FinancingsStore } from './financings.store';

const FINANCING: Financing = {
  id: 'fin-1',
  owner_user_id: 'u1',
  description: 'Financiamento',
  institution: null,
  account_id: 'acc-bank',
  category_id: 'cat-food',
  down_payment_category_id: null,
  household_id: null,
  asset_value: 1500,
  down_payment: 300,
  financed_amount: 1200,
  interest_rate: 0,
  interest_period: 'MONTHLY',
  system: 'PRICE',
  installment_count: 12,
  acquisition_date: '2026-09-05',
  first_due_date: '2026-10-10',
  notes: null,
  created_at: '2026-09-05T00:00:00Z',
  updated_at: '2026-09-05T00:00:00Z',
  created_by: 'u1',
  updated_by: 'u1',
};

describe('FinancingsStore', () => {
  const ownerId = signal<string | null>('u1');
  let repository: Record<
    'listByOwner' | 'listTransactions' | 'create' | 'update' | 'remove' | 'generateSchedule',
    ReturnType<typeof vi.fn>
  >;
  let reloadBalances: ReturnType<typeof vi.fn>;
  let store: FinancingsStore;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  beforeEach(() => {
    ownerId.set('u1');
    repository = {
      listByOwner: vi.fn().mockResolvedValue([FINANCING]),
      listTransactions: vi.fn().mockResolvedValue([
        makeTransaction({ id: 'entry', kind: 'EXPENSE', amount: 300, financing_id: 'fin-1' }),
        makeTransaction({
          id: 'i1',
          kind: 'EXPENSE',
          amount: 100,
          financing_id: 'fin-1',
          financing_installment_number: 1,
          status: 'PAID',
        }),
        makeTransaction({
          id: 'i2',
          kind: 'EXPENSE',
          amount: 100,
          financing_id: 'fin-1',
          financing_installment_number: 2,
          status: 'PENDING',
        }),
      ]),
      create: vi.fn().mockResolvedValue({ ...FINANCING, id: 'fin-2' }),
      update: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      generateSchedule: vi.fn().mockResolvedValue(13),
    };
    reloadBalances = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: FinancialContextService,
          useValue: { dataOwnerId: ownerId, canManage: signal(true) },
        },
        { provide: FinancingRepository, useValue: repository },
        { provide: AccountsStore, useValue: { accounts: signal([makeAccount()]), reloadBalances } },
        { provide: CategoriesStore, useValue: { visibleCategories: signal([makeCategory()]) } },
      ],
    });
    store = TestBed.inject(FinancingsStore);
  });

  it('loads the financings of the context owner with their transactions', async () => {
    await settle();
    expect(repository.listByOwner).toHaveBeenCalledWith('u1');
    expect(repository.listTransactions).toHaveBeenCalledWith('u1');
    expect(store.views()).toHaveLength(1);
    expect(store.viewOf('fin-1')?.paidCount).toBe(1);
    expect(store.viewOf('fin-1')?.downPaymentTransaction?.id).toBe('entry');
    expect(store.viewOf('missing')).toBeNull();
  });

  it('totals what is still to pay and what is still owed', async () => {
    await settle();
    expect(store.totalRemaining()).toBe(100);
    expect(store.remainingCount()).toBe(1);
    expect(store.outstandingPrincipal()).toBe(1100);
    expect(store.open()).toHaveLength(1);
  });

  it('generates the schedule and refreshes the account balances', async () => {
    await settle();
    await expect(store.generateSchedule('fin-1')).resolves.toBe(13);
    await settle();
    expect(repository.generateSchedule).toHaveBeenCalledWith('fin-1', true);
    expect(repository.listByOwner).toHaveBeenCalledTimes(2);
    expect(reloadBalances).toHaveBeenCalled();
  });

  it('creates, updates and deletes financings', async () => {
    await settle();
    const input = {
      description: 'Novo',
      institution: null,
      accountId: 'acc-bank',
      categoryId: 'cat-food',
      downPaymentCategoryId: null,
      householdId: null,
      assetValue: 1500,
      downPayment: 300,
      interestRate: 1,
      interestPeriod: 'MONTHLY' as const,
      system: 'SAC' as const,
      installmentCount: 10,
      acquisitionDate: '2026-09-05',
      firstDueDate: '2026-10-10',
      notes: null,
    };
    await expect(store.create(input)).resolves.toBe('fin-2');
    await store.update('fin-1', input);
    await store.remove('fin-1');
    expect(repository.create).toHaveBeenCalledWith('u1', input);
    expect(repository.update).toHaveBeenCalledWith('fin-1', input);
    expect(repository.remove).toHaveBeenCalledWith('fin-1');
  });

  it('clears after logout', async () => {
    await settle();
    ownerId.set(null);
    await settle();
    expect(store.views()).toEqual([]);
  });
});
