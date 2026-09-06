import { Injectable, computed, inject, resource } from '@angular/core';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { PeriodService } from '../../core/period/period.service';
import { monthRange, shiftMonth } from '../../core/period/period.model';
import { todayIso } from '../../shared/dates/iso-date';
import { SummaryCardData } from '../../shared/components/summary-card/summary-card';
import { AccountsStore } from '../accounts/accounts.store';
import { TransactionsStore } from '../transactions/transactions.store';
import {
  buildMonthlySeries,
  limitAmounts,
  pendingByDueDate,
  recentTransactions,
  spendingByCategory,
  spendingByOwner,
  summarizeDashboard,
} from './dashboard-summary';
import { DashboardRepository } from './dashboard.repository';

export const EVOLUTION_MONTHS = 6;
export const CATEGORY_LIMIT = 8;
export const RECENT_LIMIT = 5;

@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly context = inject(FinancialContextService);
  private readonly period = inject(PeriodService);
  private readonly repository = inject(DashboardRepository);
  private readonly transactions = inject(TransactionsStore);
  private readonly accounts = inject(AccountsStore);

  // Six-month window ending at the selected month; the current month itself comes
  // from the transactions already loaded for the page.
  private readonly totalsResource = resource({
    params: () => {
      const ownerId = this.context.dataOwnerId();
      if (!ownerId) {
        return undefined;
      }
      const householdId = this.context.householdId();
      const end = this.period.month();
      return {
        scope: householdId ? { householdId } : { ownerId },
        range: {
          start: monthRange(shiftMonth(end, -(EVOLUTION_MONTHS - 1))).start,
          end: monthRange(end).end,
        },
        end,
      };
    },
    loader: ({ params }) => this.repository.listMonthlyTotals(params.scope, params.range),
  });

  readonly isHousehold = computed(() => this.context.householdId() !== null);
  readonly canManage = this.context.canManage;
  readonly hasAccounts = computed(() => this.accounts.accounts().length > 0);

  private readonly views = computed(() => this.transactions.views());
  readonly summary = computed(() => summarizeDashboard(this.views()));

  readonly monthlySeries = computed(() =>
    buildMonthlySeries(
      this.totalsResource.hasValue() ? this.totalsResource.value() : [],
      this.period.month(),
      EVOLUTION_MONTHS,
    ),
  );
  readonly hasEvolutionData = computed(() =>
    this.monthlySeries().some((month) => month.income > 0 || month.expense > 0),
  );

  readonly byCategory = computed(() => limitAmounts(spendingByCategory(this.views()), CATEGORY_LIMIT));
  readonly byOwner = computed(() => limitAmounts(spendingByOwner(this.views()), CATEGORY_LIMIT));
  readonly pending = computed(() => pendingByDueDate(this.views(), todayIso()));
  readonly recent = computed(() => recentTransactions(this.views(), RECENT_LIMIT));

  readonly cards = computed<readonly SummaryCardData[]>(() => {
    const summary = this.summary();
    const cards: SummaryCardData[] = [
      {
        label: 'Receitas',
        amount: summary.income,
        icon: 'arrow_downward',
        tone: 'income',
        hint: countHint(summary.incomeCount, 'entrada', 'entradas'),
      },
      {
        label: 'Despesas',
        amount: summary.expense,
        icon: 'arrow_upward',
        tone: 'expense',
        hint: countHint(summary.expenseCount, 'saída', 'saídas'),
      },
      {
        label: 'Saldo do período',
        amount: summary.balance,
        icon: 'account_balance_wallet',
        tone: 'balance',
        hint: 'Receitas menos despesas',
        signed: true,
      },
      {
        label: 'Pendentes',
        amount: summary.pending,
        icon: 'schedule',
        tone: 'payable',
        hint:
          summary.overdueCount > 0
            ? `${countHint(summary.pendingCount, 'saída', 'saídas')} · ${summary.overdueCount} vencida${summary.overdueCount === 1 ? '' : 's'}`
            : countHint(summary.pendingCount, 'saída', 'saídas'),
      },
    ];

    // A household has no accounts of its own, so cash balances only make sense
    // in the personal and shared contexts.
    if (!this.isHousehold()) {
      const totals = this.accounts.totals();
      cards.push(
        {
          label: 'Saldo monetário',
          amount: totals.money,
          icon: 'savings',
          tone: 'benefit',
          hint: 'Contas e dinheiro, pelo que já foi pago',
          signed: true,
        },
        {
          label: 'Benefícios',
          amount: totals.benefit,
          icon: 'restaurant',
          tone: 'benefit',
          hint: 'Vale alimentação, refeição e similares',
          signed: true,
        },
      );
    }
    return cards;
  });

  readonly isLoading = computed(
    () =>
      this.totalsResource.isLoading() ||
      (this.transactions.isLoading() && !this.transactions.loaded()),
  );
  readonly error = computed(() => this.totalsResource.error() ?? this.transactions.error());
  readonly isEmptyMonth = computed(() => this.transactions.loaded() && this.views().length === 0);

  reload(): void {
    this.totalsResource.reload();
    this.transactions.reload();
  }
}

function countHint(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural} no período`;
}
