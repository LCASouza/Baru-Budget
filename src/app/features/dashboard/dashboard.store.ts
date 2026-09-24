import { Injectable, computed, effect, inject, resource } from '@angular/core';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { PeriodService } from '../../core/period/period.service';
import { monthLabel, monthRange, shiftMonth } from '../../core/period/period.model';
import { todayIso } from '../../shared/dates/iso-date';
import { displayDate } from '../../shared/format/display';
import { sumAmounts } from '../../shared/money/money';
import { SummaryCardData } from '../../shared/components/summary-card/summary-card';
import { AccountsStore } from '../accounts/accounts.store';
import { CardsStore } from '../cards/cards.store';
import { CategoriesStore } from '../categories/categories.store';
import { InstallmentsStore } from '../installments/installments.store';
import { SettlementsStore } from '../settlements/settlements.store';
import { FinancingsStore } from '../financings/financings.store';
import { LoansStore } from '../loans/loans.store';
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

export const EVOLUTION_MONTHS = 12;
export const CATEGORY_LIMIT = 8;
export const RECENT_LIMIT = 5;

@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly context = inject(FinancialContextService);
  private readonly period = inject(PeriodService);
  private readonly repository = inject(DashboardRepository);
  private readonly transactions = inject(TransactionsStore);
  private readonly accounts = inject(AccountsStore);
  private readonly cardsStore = inject(CardsStore);
  private readonly categories = inject(CategoriesStore);
  private readonly installments = inject(InstallmentsStore);
  private readonly settlements = inject(SettlementsStore);
  private readonly loans = inject(LoansStore);
  private readonly financings = inject(FinancingsStore);

  private readonly seriesEnd = computed(() => shiftMonth(this.period.month(), 9));

  // Twelve-month window with the selected month in the third position: two
  // months of context behind it and nine months ahead.
  private readonly totalsResource = resource({
    params: () => {
      const ownerId = this.context.dataOwnerId();
      if (!ownerId) {
        return undefined;
      }
      const householdId = this.context.householdId();
      const end = this.seriesEnd();
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

  private readonly paymentMonth = computed(() => shiftMonth(this.period.month(), 1));
  private readonly paymentRange = computed(() => monthRange(this.paymentMonth()));

  private readonly directBillsResource = resource({
    params: () => {
      const ownerId = this.context.dataOwnerId();
      if (!ownerId || this.context.householdId()) {
        return undefined;
      }
      return {
        ownerId,
        range: this.paymentRange(),
      };
    },
    loader: ({ params }) => this.repository.listDirectBillsDue(params.ownerId, params.range),
  });

  readonly isHousehold = computed(() => this.context.householdId() !== null);

  // The commitment cards only exist outside a household context, so the stores
  // behind them are asked for their data only when the home will show them.
  private readonly activateCommitments = effect(() => {
    if (!this.isHousehold()) {
      this.loans.activate();
      this.financings.activate();
    }
  });

  readonly canManage = this.context.canManage;
  readonly hasAccounts = computed(() => this.accounts.accounts().length > 0);

  private readonly views = computed(() => this.transactions.views());
  readonly summary = computed(() => summarizeDashboard(this.views()));

  readonly monthlySeries = computed(() =>
    buildMonthlySeries(
      this.totalsResource.hasValue() ? this.totalsResource.value() : [],
      this.seriesEnd(),
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
  readonly periodDescription = computed(() => {
    const range = this.period.range();
    const paymentRange = this.paymentRange();
    return `Receitas, gastos e saldo consideram os lançamentos de ${displayDate(range.start)} a ${displayDate(range.end)}. O total a pagar mostra os vencimentos de ${displayDate(paymentRange.start)} a ${displayDate(paymentRange.end)}.`;
  });

  readonly monthlyPayable = computed(() => {
    return this.payableFor(this.paymentRange());
  });

  readonly payableByType = computed(() => {
    const range = this.paymentRange();
    const parts = this.payableParts(range);
    const grouped = new Map<string, number[]>();
    for (const transaction of parts.directBills) {
      const category = transaction.category_id
        ? this.categories.byId().get(transaction.category_id)
        : null;
      const name = category?.name ?? 'Outras contas';
      const amounts = grouped.get(name) ?? [];
      amounts.push(transaction.amount);
      grouped.set(name, amounts);
    }
    const rows = [...grouped.entries()].map(([name, amounts]) => ({
      name,
      amount: sumAmounts(amounts),
    }));
    const fixed = [
      {
        name: 'Faturas de cartão',
        amount: sumAmounts(parts.invoices.map((invoice) => invoice.remaining)),
        icon: 'credit_card',
      },
      {
        name: 'Financiamentos',
        amount: sumAmounts(parts.financingInstalments.map((transaction) => transaction.amount)),
        icon: 'house',
      },
      {
        name: 'Empréstimos',
        amount: sumAmounts(parts.loanInstalments.map((transaction) => transaction.amount)),
        icon: 'account_balance',
      },
    ].filter((row) => row.amount > 0);
    return [...fixed, ...rows].sort((a, b) => b.amount - a.amount);
  });

  private payableFor(range: { readonly start: string; readonly end: string }) {
    const parts = this.payableParts(range);
    return {
      amount: sumAmounts([
        ...parts.directBills.map((transaction) => transaction.amount),
        ...parts.invoices.map((invoice) => invoice.remaining),
        ...parts.loanInstalments.map((transaction) => transaction.amount),
        ...parts.financingInstalments.map((transaction) => transaction.amount),
      ]),
      count:
        parts.directBills.length +
        parts.invoices.length +
        parts.loanInstalments.length +
        parts.financingInstalments.length,
    };
  }

  private payableParts(range: { readonly start: string; readonly end: string }) {
    const directBills = this.directBillsResource.hasValue()
      ? this.directBillsResource
          .value()
          .filter((transaction) => {
            const dueDate = transaction.due_date ?? transaction.date;
            return dueDate >= range.start && dueDate <= range.end;
          })
      : [];
    return {
      directBills,
      invoices: this.cardsStore.dueBetween(range.start, range.end),
      loanInstalments: this.loans.dueBetween(range.start, range.end),
      financingInstalments: this.financings.dueBetween(range.start, range.end),
    };
  }

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
        label: 'Gastos do mês',
        amount: summary.expense,
        icon: 'arrow_upward',
        tone: 'expense',
        hint: `${countHint(summary.expenseCount, 'saída', 'saídas')} · por data do lançamento`,
      },
      {
        label: 'Saldo do período',
        amount: summary.balance,
        icon: 'account_balance_wallet',
        tone: 'balance',
        hint: 'Receitas menos gastos do mês',
        signed: true,
      },
    ];

    // A household has no accounts or cards of its own, so cash balances and
    // invoices only make sense in the personal and shared contexts.
    if (!this.isHousehold()) {
      const payable = this.monthlyPayable();
      cards.push({
        label: `A pagar em ${monthLabel(this.paymentMonth()).split(' ')[0]}`,
        amount: payable.amount,
        icon: 'payments',
        tone: 'payable',
        hint: `${payable.count} ${payable.count === 1 ? 'compromisso pendente' : 'compromissos pendentes'} do próximo ciclo`,
      });
    }

    cards.push({
      label: 'Contas vencidas',
      amount: summary.overdue,
      icon: 'event_busy',
      tone: 'payable',
      hint: countHint(summary.overdueCount, 'conta vencida', 'contas vencidas'),
    });

    if (!this.isHousehold()) {
      const invoiceCount = this.cardsStore.currentInvoiceCount();
      if (invoiceCount > 0) {
        cards.push({
          label: 'Faturas a pagar',
          amount: this.cardsStore.totalCurrentInvoices(),
          icon: 'credit_card',
          tone: 'payable',
          hint: `${invoiceCount} ${invoiceCount === 1 ? 'fatura atual' : 'faturas atuais'} somada${invoiceCount === 1 ? '' : 's'}`,
        });
      }
      const loanRemaining = this.loans.remainingCount();
      if (loanRemaining > 0) {
        cards.push({
          label: 'Empréstimos',
          amount: this.loans.totalRemaining(),
          icon: 'account_balance',
          tone: 'payable',
          hint: `${loanRemaining} ${loanRemaining === 1 ? 'parcela restante' : 'parcelas restantes'}`,
        });
      }
      const financingRemaining = this.financings.remainingCount();
      if (financingRemaining > 0) {
        cards.push({
          label: 'Financiamentos',
          amount: this.financings.totalRemaining(),
          icon: 'house',
          tone: 'payable',
          hint: `${financingRemaining} ${financingRemaining === 1 ? 'parcela restante' : 'parcelas restantes'}`,
        });
      }
      const remainingInstallments = this.installments.remainingCount();
      if (remainingInstallments > 0) {
        cards.push({
          label: 'Parcelas futuras',
          amount: this.installments.totalRemaining(),
          icon: 'event_repeat',
          tone: 'payable',
          hint: `${remainingInstallments} ${remainingInstallments === 1 ? 'parcela a vencer' : 'parcelas a vencer'}`,
        });
      }
      const balances = this.settlements.totals();
      if (balances.receivable > 0 || balances.payable > 0) {
        cards.push(
          {
            label: 'A receber',
            amount: balances.receivable,
            icon: 'call_received',
            tone: 'receivable',
            hint: 'Divisões de despesas ainda não acertadas',
          },
          {
            label: 'A pagar',
            amount: balances.payable,
            icon: 'call_made',
            tone: 'payable',
            hint: 'O que você deve a outras pessoas',
          },
        );
      }
    }
    return cards;
  });

  readonly isLoading = computed(
    () =>
      this.totalsResource.isLoading() ||
      this.directBillsResource.isLoading() ||
      (this.transactions.isLoading() && !this.transactions.loaded()),
  );
  readonly error = computed(
    () =>
      this.totalsResource.error() ??
      this.directBillsResource.error() ??
      this.transactions.error(),
  );
  readonly isEmptyMonth = computed(() => this.transactions.loaded() && this.views().length === 0);

  reload(): void {
    this.totalsResource.reload();
    this.directBillsResource.reload();
    this.transactions.reload();
  }
}

function countHint(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural} no período`;
}
