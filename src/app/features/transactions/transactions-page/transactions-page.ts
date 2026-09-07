import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { FinancialContextService } from '../../../core/context/financial-context.service';
import { ViewportService } from '../../../core/layout/viewport.service';
import {
  DISPLAY_STATUSES,
  DisplayStatus,
  transactionStatusLabel,
} from '../../../core/finance/transaction-status';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { PeriodFilter } from '../../../shared/components/period-filter/period-filter';
import { SummaryCard, SummaryCardData } from '../../../shared/components/summary-card/summary-card';
import { AccountsStore } from '../../accounts/accounts.store';
import { CardsStore } from '../../cards/cards.store';
import { CategoriesStore } from '../../categories/categories.store';
import { openTransactionDialog } from '../open-transaction-dialog';
import { KindTab } from '../transaction-summary';
import { TransactionView } from '../transaction.model';
import { TransactionsStore } from '../transactions.store';

interface KindTabOption {
  readonly kind: KindTab;
  readonly label: string;
  readonly queryParams: Record<string, string> | null;
}

const KIND_TABS: readonly KindTabOption[] = [
  { kind: null, label: 'Todas', queryParams: null },
  { kind: 'INCOME', label: 'Entradas', queryParams: { kind: 'INCOME' } },
  { kind: 'EXPENSE', label: 'Saídas', queryParams: { kind: 'EXPENSE' } },
];

const KIND_ICONS = {
  INCOME: 'arrow_downward',
  EXPENSE: 'arrow_upward',
  TRANSFER: 'swap_horiz',
  SETTLEMENT: 'handshake',
} as const;

function parseKindTab(value: string | undefined): KindTab {
  return value === 'INCOME' || value === 'EXPENSE' ? value : null;
}

@Component({
  selector: 'app-transactions-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTabsModule,
    EmptyState,
    PeriodFilter,
    SummaryCard,
  ],
  templateUrl: './transactions-page.html',
  styleUrl: './transactions-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionsPage {
  /** Bound from the `kind` query parameter. */
  readonly kind = input<string>();

  protected readonly store = inject(TransactionsStore);
  protected readonly accounts = inject(AccountsStore);
  protected readonly categories = inject(CategoriesStore);
  protected readonly cards = inject(CardsStore);
  protected readonly viewport = inject(ViewportService);
  protected readonly context = inject(FinancialContextService);
  private readonly dialog = inject(MatDialog);

  protected readonly tabs = KIND_TABS;
  protected readonly kindIcons = KIND_ICONS;
  protected readonly statusLabel = transactionStatusLabel;
  protected readonly statusOptions = computed(() =>
    DISPLAY_STATUSES.map((status) => ({
      value: status,
      label: transactionStatusLabel(status, this.store.filters().kind),
    })),
  );
  protected readonly filtersOpen = signal(false);

  protected readonly isHousehold = this.store.isHouseholdContext;
  protected readonly isShared = computed(() => this.context.context().kind === 'shared');

  // A household context filters over every visible category (members included).
  protected readonly categoryOptions = computed(() => {
    const kind = this.store.filters().kind;
    const ofKind = (k: 'INCOME' | 'EXPENSE') =>
      this.isHousehold() ? this.categories.visibleOfKind(k) : this.categories.ofKind(k);
    return {
      income: kind === 'EXPENSE' ? [] : ofKind('INCOME'),
      expense: kind === 'INCOME' ? [] : ofKind('EXPENSE'),
    };
  });

  protected readonly summaryCards = computed<readonly SummaryCardData[]>(() => {
    const summary = this.store.summary();
    const count = `${summary.count} ${summary.count === 1 ? 'lançamento' : 'lançamentos'}`;
    return [
      { label: 'Entradas', amount: summary.income, icon: 'arrow_downward', tone: 'income', hint: count },
      { label: 'Saídas', amount: summary.expense, icon: 'arrow_upward', tone: 'expense', hint: 'Pagas e pendentes' },
      {
        label: 'Saldo do período',
        amount: summary.balance,
        icon: 'account_balance_wallet',
        tone: 'balance',
        hint: 'Entradas menos saídas',
        signed: true,
      },
    ];
  });

  protected readonly hasAccounts = computed(() => this.accounts.accounts().length > 0);
  protected readonly isInitialLoading = computed(
    () => (this.store.isLoading() && !this.store.loaded()) || (this.accounts.isLoading() && !this.accounts.loaded()),
  );

  constructor() {
    effect(() => this.store.setKind(parseKindTab(this.kind())));
  }

  protected isTabActive(tab: KindTabOption): boolean {
    return this.store.filters().kind === tab.kind;
  }

  protected toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  protected onStatusChange(value: DisplayStatus | null): void {
    this.store.setStatus(value);
  }

  protected async create(): Promise<void> {
    const kind = this.store.filters().kind ?? undefined;
    await openTransactionDialog(this.dialog, this.viewport, { initialKind: kind });
  }

  protected async edit(view: TransactionView): Promise<void> {
    await openTransactionDialog(this.dialog, this.viewport, { transaction: view.transaction });
  }
}
