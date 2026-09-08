import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { makeAccount, makeCategory, makeTransaction } from '../../testing/finance-fixtures';
import { AccountsStore } from '../accounts/accounts.store';
import { CategoriesStore } from '../categories/categories.store';
import { Loan } from './loan.model';
import { LoanRepository } from './loan.repository';
import { LoansStore } from './loans.store';

const LOAN: Loan = {
  id: 'loan-1',
  owner_user_id: 'u1',
  description: 'Empréstimo',
  lender: null,
  account_id: 'acc-bank',
  category_id: 'cat-food',
  disbursement_category_id: null,
  household_id: null,
  principal: 1200,
  interest_rate: 0,
  interest_period: 'MONTHLY',
  interest_model: 'SIMPLE',
  installment_count: 12,
  start_date: '2026-09-05',
  first_due_date: '2026-10-10',
  notes: null,
  insurance_amount: 0,
  fee_amount: 0,
  created_at: '2026-09-05T00:00:00Z',
  updated_at: '2026-09-05T00:00:00Z',
  created_by: 'u1',
  updated_by: 'u1',
};

describe('LoansStore', () => {
  const ownerId = signal<string | null>('u1');
  let repository: Record<
    | 'listByOwner'
    | 'listTransactions'
    | 'create'
    | 'update'
    | 'remove'
    | 'generateSchedule'
    | 'realignSchedule'
    | 'listStatements'
    | 'saveStatement'
    | 'removeStatement',
    ReturnType<typeof vi.fn>
  >;
  let reloadBalances: ReturnType<typeof vi.fn>;
  let store: LoansStore;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();
  /** The store only loads once a consumer asks for it. */
  const load = async () => {
    store.activate();
    await settle();
  };

  function providers() {
    return [
        { provide: FinancialContextService, useValue: { dataOwnerId: ownerId, canManage: signal(true) } },
        { provide: LoanRepository, useValue: repository },
        { provide: AccountsStore, useValue: { accounts: signal([makeAccount()]), reloadBalances } },
        { provide: CategoriesStore, useValue: { visibleCategories: signal([makeCategory()]) } },
    ];
  }

  beforeEach(() => {
    ownerId.set('u1');
    repository = {
      listByOwner: vi.fn().mockResolvedValue([LOAN]),
      listTransactions: vi.fn().mockResolvedValue([
        makeTransaction({ id: 'i1', kind: 'EXPENSE', amount: 100, loan_id: 'loan-1', loan_installment_number: 1, status: 'PAID' }),
        makeTransaction({ id: 'i2', kind: 'EXPENSE', amount: 100, loan_id: 'loan-1', loan_installment_number: 2, status: 'PENDING' }),
      ]),
      create: vi.fn().mockResolvedValue({ ...LOAN, id: 'loan-2' }),
      update: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      generateSchedule: vi.fn().mockResolvedValue(12),
      listStatements: vi.fn().mockResolvedValue([]),
      saveStatement: vi.fn().mockResolvedValue(undefined),
      removeStatement: vi.fn().mockResolvedValue(undefined),
      realignSchedule: vi.fn().mockResolvedValue(9),
    };
    reloadBalances = vi.fn();
    TestBed.configureTestingModule({ providers: providers() });
    store = TestBed.inject(LoansStore);
  });

  it('loads nothing until a consumer asks for the data', async () => {
    await settle();
    expect(repository.listByOwner).not.toHaveBeenCalled();
    await load();
    expect(repository.listByOwner).toHaveBeenCalledWith('u1');
  });

  it('loads the loans of the context owner with their transactions', async () => {
    await load();
    expect(repository.listByOwner).toHaveBeenCalledWith('u1');
    expect(repository.listTransactions).toHaveBeenCalledWith('u1');
    expect(store.views()).toHaveLength(1);
    expect(store.viewOf('loan-1')?.paidCount).toBe(1);
    expect(store.viewOf('missing')).toBeNull();
  });

  it('totals what is still to pay', async () => {
    await load();
    expect(store.totalRemaining()).toBe(100);
    expect(store.remainingCount()).toBe(1);
    expect(store.open()).toHaveLength(1);
  });

  it('generates the schedule and refreshes the account balances', async () => {
    await load();
    await expect(store.generateSchedule('loan-1')).resolves.toBe(12);
    await settle();
    expect(repository.generateSchedule).toHaveBeenCalledWith('loan-1', true);
    expect(repository.listByOwner).toHaveBeenCalledTimes(2);
    expect(reloadBalances).toHaveBeenCalled();
  });

  it('realigns the pending instalments and refreshes the account balances', async () => {
    await load();
    await expect(store.realignSchedule('loan-1')).resolves.toBe(9);
    await settle();
    expect(repository.realignSchedule).toHaveBeenCalledWith('loan-1');
    expect(repository.listByOwner).toHaveBeenCalledTimes(2);
    expect(reloadBalances).toHaveBeenCalled();
  });

  it('records an observed statement and reloads', async () => {
    await load();
    const input = {
      competence: '2026-12-01',
      outstandingBalance: 8000,
      installmentAmount: 900,
      insuranceAmount: 10,
      feeAmount: 5,
      remainingCount: 9,
      notes: null,
    };
    await store.saveStatement('loan-1', input);
    await settle();
    expect(repository.saveStatement).toHaveBeenCalledWith('loan-1', input);
    expect(repository.listByOwner).toHaveBeenCalledTimes(2);
  });

  it('loads the statements together with the loans', async () => {
    await load();
    expect(repository.listStatements).toHaveBeenCalledWith('u1');
  });

  it('creates, updates and deletes loans', async () => {
    await load();
    const input = {
      description: 'Novo',
      lender: null,
      accountId: 'acc-bank',
      categoryId: 'cat-food',
      disbursementCategoryId: null,
      householdId: null,
      principal: 1000,
      interestRate: 1,
      interestPeriod: 'MONTHLY' as const,
      interestModel: 'PRICE' as const,
      installmentCount: 10,
      startDate: '2026-09-05',
      firstDueDate: '2026-10-10',
      notes: null,
    };
    await expect(store.create(input)).resolves.toBe('loan-2');
    await store.update('loan-1', input);
    await store.remove('loan-1');
    expect(repository.create).toHaveBeenCalledWith('u1', input);
    expect(repository.update).toHaveBeenCalledWith('loan-1', input);
    expect(repository.remove).toHaveBeenCalledWith('loan-1');
  });

  it('clears after logout', async () => {
    await load();
    ownerId.set(null);
    await settle();
    expect(store.views()).toEqual([]);
  });
});
