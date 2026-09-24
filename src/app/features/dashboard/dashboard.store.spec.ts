import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { PeriodService } from '../../core/period/period.service';
import { currentMonth, monthRange, shiftMonth } from '../../core/period/period.model';
import { makeAccount, makeCategory, makeTransaction } from '../../testing/finance-fixtures';
import { AccountsStore } from '../accounts/accounts.store';
import { CardsStore } from '../cards/cards.store';
import { CategoriesStore } from '../categories/categories.store';
import { SettlementsStore } from '../settlements/settlements.store';
import { FinancingsStore } from '../financings/financings.store';
import { LoansStore } from '../loans/loans.store';
import { InstallmentsStore } from '../installments/installments.store';
import { buildTransactionViews } from '../transactions/transaction.model';
import { TransactionsStore } from '../transactions/transactions.store';
import { DashboardRepository } from './dashboard.repository';
import { DashboardStore, EVOLUTION_MONTHS } from './dashboard.store';

registerLocaleData(localePt);

describe('DashboardStore', () => {
  const ownerId = signal<string | null>('u1');
  const householdId = signal<string | null>(null);
  const views = signal(
    buildTransactionViews(
      [
        makeTransaction({ id: 'salary', kind: 'INCOME', amount: 5000, category_id: 'cat-salary', date: '2026-09-05' }),
        makeTransaction({ id: 'market', kind: 'EXPENSE', amount: 300, date: '2026-09-04' }),
        makeTransaction({ id: 'energy', kind: 'EXPENSE', amount: 180, status: 'PENDING', due_date: '2026-09-02', date: '2026-09-01' }),
      ],
      new Map([
        ['cat-food', makeCategory()],
        ['cat-salary', makeCategory({ id: 'cat-salary', kind: 'INCOME', name: 'Salário' })],
      ]),
      new Map([['acc-bank', makeAccount()]]),
      '2026-09-06',
      new Map([['u1', 'Alice']]),
    ),
  );
  let listMonthlyTotals: ReturnType<typeof vi.fn>;
  let listDirectBillsDue: ReturnType<typeof vi.fn>;
  let reloadTransactions: ReturnType<typeof vi.fn>;
  let store: DashboardStore;
  let loansStore: { activate: ReturnType<typeof vi.fn> } & Record<string, unknown>;
  let financingsStore: { activate: ReturnType<typeof vi.fn> } & Record<string, unknown>;
  let period: PeriodService;

  const settle = () => TestBed.inject(ApplicationRef).whenStable();
  const label = (name: string) => store.cards().find((card) => card.label === name);

  beforeEach(() => {
    ownerId.set('u1');
    householdId.set(null);
    loansStore = {
      totalRemaining: signal(0),
      remainingCount: signal(0),
      reload: vi.fn(),
      activate: vi.fn(),
      dueBetween: vi.fn().mockReturnValue([
        makeTransaction({ id: 'loan-due', amount: 578.34, status: 'PENDING' }),
      ]),
      totalDueBetween: vi.fn().mockReturnValue(578.34),
    };
    financingsStore = {
      totalRemaining: signal(0),
      remainingCount: signal(0),
      reload: vi.fn(),
      activate: vi.fn(),
      dueBetween: vi.fn().mockReturnValue([
        makeTransaction({ id: 'financing-due', amount: 900, status: 'PENDING' }),
      ]),
      totalDueBetween: vi.fn().mockReturnValue(900),
    };
    listMonthlyTotals = vi.fn().mockResolvedValue([
      { month: '2026-09-01', kind: 'INCOME', total: 5000 },
      { month: '2026-09-01', kind: 'EXPENSE', total: 480 },
    ]);
    listDirectBillsDue = vi.fn().mockResolvedValue([
      makeTransaction({
        id: 'internet-due',
        kind: 'EXPENSE',
        amount: 180,
        status: 'PENDING',
        date: '2026-10-10',
        due_date: '2026-10-10',
      }),
    ]);
    reloadTransactions = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: FinancialContextService,
          useValue: { dataOwnerId: ownerId, householdId, canManage: signal(true) },
        },
        {
          provide: DashboardRepository,
          useValue: { listMonthlyTotals, listDirectBillsDue },
        },
        {
          provide: SettlementsStore,
          useValue: {
            totals: signal({ receivable: 0, payable: 0, net: 0 }),
            people: signal([]),
            reload: vi.fn(),
          },
        },
        {
          provide: LoansStore,
          useValue: loansStore,
        },
        {
          provide: FinancingsStore,
          useValue: financingsStore,
        },
        {
          provide: InstallmentsStore,
          useValue: {
            totalRemaining: signal(0),
            remainingCount: signal(0),
            create: vi.fn(),
            removeGroup: vi.fn(),
            reload: vi.fn(),
          },
        },
        {
          provide: CardsStore,
          useValue: {
            cards: signal([]),
            activeCards: signal([]),
            byId: signal(new Map()),
            nameById: signal(new Map()),
            invoicesOf: () => [],
            dueBetween: () => [{ remaining: 6000 }],
            totalDueBetween: () => 6000,
            currentInvoiceCount: signal(2),
            totalCurrentInvoices: signal(6164.89),
            reload: vi.fn(),
          },
        },
        {
          provide: CategoriesStore,
          useValue: {
            byId: signal(new Map([['cat-food', makeCategory()]])),
          },
        },
        {
          provide: TransactionsStore,
          useValue: {
            views,
            isLoading: signal(false),
            loaded: signal(true),
            error: signal(undefined),
            reload: reloadTransactions,
          },
        },
        {
          provide: AccountsStore,
          useValue: {
            accounts: signal([makeAccount()]),
            totals: signal({ money: 1200, benefit: 380 }),
          },
        },
      ],
    });
    period = TestBed.inject(PeriodService);
    store = TestBed.inject(DashboardStore);
  });

  it('requests two months behind and three months ahead of the selected month', async () => {
    await settle();
    const month = currentMonth();
    expect(listMonthlyTotals).toHaveBeenCalledWith(
      { ownerId: 'u1' },
      {
        start: monthRange(shiftMonth(month, -2)).start,
        end: monthRange(shiftMonth(month, 3)).end,
      },
    );
    expect(store.monthlySeries()).toHaveLength(EVOLUTION_MONTHS);
    expect(listDirectBillsDue).toHaveBeenCalledWith(
      'u1',
      {
        start: monthRange(shiftMonth(month, -1)).start,
        end: monthRange(shiftMonth(month, 4)).end,
      },
    );
    expect(store.paymentSeries()[2].key).toBe(monthRange(month).start);
    expect(store.paymentSeries()[2].expense).toBe(7658.34);
  });

  it('reloads the series when the month changes', async () => {
    await settle();
    period.previous();
    await settle();
    expect(listMonthlyTotals).toHaveBeenCalledTimes(2);
    expect(listMonthlyTotals).toHaveBeenLastCalledWith(
      { ownerId: 'u1' },
      expect.objectContaining({ end: monthRange(shiftMonth(currentMonth(), 2)).end }),
    );
  });

  it('scopes the series to the household in a household context', async () => {
    await settle();
    householdId.set('h1');
    await settle();
    expect(listMonthlyTotals).toHaveBeenLastCalledWith({ householdId: 'h1' }, expect.anything());
    expect(store.isHousehold()).toBe(true);
  });

  it('builds the personal cards from the loaded transactions and account totals', async () => {
    await settle();
    expect(store.cards().map((card) => card.label)).toEqual([
      'Receitas',
      'Gastos do mês',
      'Saldo do período',
      'A pagar em Outubro',
      'Contas vencidas',
      'Faturas a pagar',
    ]);
    expect(label('Receitas')?.amount).toBe(5000);
    expect(label('Gastos do mês')?.amount).toBe(480);
    expect(label('Saldo do período')?.amount).toBe(4520);
    expect(label('A pagar em Outubro')?.amount).toBe(7658.34);
    expect(label('A pagar em Outubro')?.hint).toBe(
      '4 compromissos pendentes do próximo ciclo',
    );
    expect(label('Contas vencidas')?.amount).toBe(180);
    expect(label('Contas vencidas')?.hint).toBe('1 conta vencida no período');
    expect(label('Faturas a pagar')?.amount).toBe(6164.89);
    expect(label('Faturas a pagar')?.hint).toBe('2 faturas atuais somadas');
    expect(label('Saldo disponível')).toBeUndefined();
    expect(label('Benefícios')).toBeUndefined();
    expect(store.payableByType()).toEqual([
      { name: 'Faturas de cartão', amount: 6000, icon: 'credit_card' },
      { name: 'Financiamentos', amount: 900, icon: 'house' },
      { name: 'Empréstimos', amount: 578.34, icon: 'account_balance' },
      { name: 'Alimentação', amount: 180 },
    ]);
  });

  it('drops the cash cards in a household context', async () => {
    householdId.set('h1');
    await settle();
    expect(store.cards().map((card) => card.label)).toEqual([
      'Receitas',
      'Gastos do mês',
      'Saldo do período',
      'Contas vencidas',
    ]);
  });

  it('derives category, person, pending and recent lists from the loaded month', async () => {
    await settle();
    expect(store.byCategory()).toEqual([{ name: 'Alimentação', amount: 480 }]);
    expect(store.byOwner()).toEqual([{ name: 'Alice', amount: 480 }]);
    expect(store.pending().map((item) => item.view.transaction.id)).toEqual(['energy']);
    expect(store.recent().map((view) => view.transaction.id)).toEqual(['salary', 'market', 'energy']);
    expect(store.isEmptyMonth()).toBe(false);
  });

  it('reports an empty month and surfaces load errors', async () => {
    await settle();
    views.set([]);
    expect(store.isEmptyMonth()).toBe(true);
    expect(store.hasEvolutionData()).toBe(true);

    listMonthlyTotals.mockRejectedValueOnce(new Error('offline'));
    ownerId.set('u2');
    await settle();
    expect(store.error()).toBeTruthy();
  });

  it('asks the commitment stores for their data only outside a household', async () => {
    await settle();
    expect(loansStore.activate).toHaveBeenCalled();
    expect(financingsStore.activate).toHaveBeenCalled();
  });

  it('stops asking for them once the context becomes a household', async () => {
    await settle();
    loansStore.activate.mockClear();
    financingsStore.activate.mockClear();

    householdId.set('h1');
    await settle();

    expect(loansStore.activate).not.toHaveBeenCalled();
    expect(financingsStore.activate).not.toHaveBeenCalled();
  });
});
