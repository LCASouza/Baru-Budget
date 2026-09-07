import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { PeriodService } from '../../core/period/period.service';
import { monthRange } from '../../core/period/period.model';
import { makeAccount, makeTransaction } from '../../testing/finance-fixtures';
import { AccountsStore } from '../accounts/accounts.store';
import { CardsStore } from '../cards/cards.store';
import { InstallmentRepository } from './installment.repository';
import { InstallmentsStore } from './installments.store';

registerLocaleData(localePt);

describe('InstallmentsStore', () => {
  const ownerId = signal<string | null>('u1');
  let repository: Record<
    'listPurchases' | 'listInstallmentsFrom' | 'listGroupInstallments' | 'create' | 'removeGroup',
    ReturnType<typeof vi.fn>
  >;
  let store: InstallmentsStore;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();
  const range = () => monthRange(TestBed.inject(PeriodService).month());

  beforeEach(() => {
    ownerId.set('u1');
    repository = {
      listPurchases: vi.fn().mockResolvedValue([
        {
          id: 'g1',
          description: 'Notebook',
          installmentCount: 12,
          recordedCount: 12,
          totalAmount: 4200,
          firstCompetence: '2026-10-05',
          lastCompetence: '2027-09-05',
          remainingCount: 9,
          remainingAmount: 3150,
          creditCardId: 'card-1',
          accountId: null,
          categoryId: 'cat-shop',
        },
        {
          id: 'g2',
          description: 'Geladeira',
          installmentCount: 4,
          recordedCount: 4,
          totalAmount: 1800,
          firstCompetence: '2026-08-10',
          lastCompetence: '2026-11-10',
          remainingCount: 0,
          remainingAmount: 0,
          creditCardId: null,
          accountId: 'acc-bank',
          categoryId: 'cat-shop',
        },
      ]),
      listInstallmentsFrom: vi.fn().mockResolvedValue([]),
      listGroupInstallments: vi.fn().mockResolvedValue([
        makeTransaction({ id: 'i1', installment_group_id: 'g1', installment_number: 1, installment_count: 12 }),
        makeTransaction({ id: 'i2', installment_group_id: 'g1', installment_number: 2, installment_count: 12 }),
      ]),
      create: vi.fn().mockResolvedValue('g3'),
      removeGroup: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: FinancialContextService, useValue: { dataOwnerId: ownerId } },
        { provide: InstallmentRepository, useValue: repository },
        { provide: CardsStore, useValue: { nameById: signal(new Map([['card-1', 'Cartão principal']])) } },
        { provide: AccountsStore, useValue: { accounts: signal([makeAccount({ id: 'acc-bank', name: 'Conta corrente' })]) } },
      ],
    });
    store = TestBed.inject(InstallmentsStore);
  });

  it('loads the purchases of the context owner and names their origin', async () => {
    await settle();
    expect(repository.listPurchases).toHaveBeenCalledWith('u1');
    expect(store.views().map((purchase) => purchase.originName)).toEqual([
      'Cartão principal',
      'Conta corrente',
    ]);
    expect(store.ongoing().map((purchase) => purchase.id)).toEqual(['g1']);
  });

  it('totals what is still committed', async () => {
    await settle();
    expect(store.totalRemaining()).toBe(3150);
    expect(store.remainingCount()).toBe(9);
  });

  it('sums the instalments whose competence falls in the selected period', async () => {
    const { start } = range();
    repository.listInstallmentsFrom.mockResolvedValue([
      makeTransaction({ id: 'a', amount: 350, date: start, invoice_due_date: start }),
      makeTransaction({ id: 'b', amount: 100, date: '2020-01-01', invoice_due_date: '2020-01-01' }),
      makeTransaction({ id: 'c', amount: 900, date: start, invoice_due_date: start, status: 'CANCELLED' }),
    ]);
    TestBed.resetTestingModule();
    beforeEachSetup();
    await settle();
    expect(store.inSelectedPeriod().map((t) => t.id)).toEqual(['a']);
    expect(store.totalInSelectedPeriod()).toBe(350);
  });

  it('loads the instalments of an expanded group and closes it again', async () => {
    await settle();
    store.toggle('g1');
    await settle();
    expect(repository.listGroupInstallments).toHaveBeenCalledWith('g1');
    expect(store.groupInstallments()).toHaveLength(2);
    expect(store.expanded()).toBe('g1');
    store.toggle('g1');
    expect(store.expanded()).toBeNull();
  });

  it('creates and deletes installment purchases through the repository', async () => {
    await settle();
    await store.create({
      description: 'TV',
      totalAmount: 1200,
      installmentCount: 3,
      date: '2026-09-07',
      categoryId: 'cat-shop',
      creditCardId: 'card-1',
      accountId: null,
      householdId: null,
      notes: null,
    });
    await settle();
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerUserId: 'u1', description: 'TV', installmentCount: 3 }),
    );
    expect(repository.listPurchases).toHaveBeenCalledTimes(2);

    await store.removeGroup('g1');
    await settle();
    expect(repository.removeGroup).toHaveBeenCalledWith('g1');
    expect(store.expanded()).toBeNull();
  });

  it('clears after logout', async () => {
    await settle();
    ownerId.set(null);
    await settle();
    expect(store.views()).toEqual([]);
  });

  // The period-scoped test rebuilds the module with the mocked instalments.
  function beforeEachSetup(): void {
    TestBed.configureTestingModule({
      providers: [
        { provide: FinancialContextService, useValue: { dataOwnerId: ownerId } },
        { provide: InstallmentRepository, useValue: repository },
        { provide: CardsStore, useValue: { nameById: signal(new Map([['card-1', 'Cartão principal']])) } },
        { provide: AccountsStore, useValue: { accounts: signal([makeAccount({ id: 'acc-bank', name: 'Conta corrente' })]) } },
      ],
    });
    store = TestBed.inject(InstallmentsStore);
  }
});
