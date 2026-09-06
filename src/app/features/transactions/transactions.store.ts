import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { DisplayStatus } from '../../core/finance/transaction-status';
import { PeriodService } from '../../core/period/period.service';
import { todayIso } from '../../shared/dates/iso-date';
import { AccountsStore } from '../accounts/accounts.store';
import { CategoriesStore } from '../categories/categories.store';
import {
  EMPTY_FILTERS,
  KindTab,
  TransactionFilters,
  countActiveFilters,
  filterTransactions,
  groupByDate,
  summarizeTransactions,
} from './transaction-summary';
import { Transaction, TransactionInput, buildTransactionViews } from './transaction.model';
import { TransactionRepository } from './transaction.repository';

@Injectable({ providedIn: 'root' })
export class TransactionsStore {
  private readonly auth = inject(AuthService);
  private readonly period = inject(PeriodService);
  private readonly repository = inject(TransactionRepository);
  private readonly accounts = inject(AccountsStore);
  private readonly categories = inject(CategoriesStore);

  private readonly filtersState = signal<TransactionFilters>(EMPTY_FILTERS);

  private readonly listResource = resource({
    params: () => {
      const userId = this.auth.userId();
      return userId ? { userId, ...this.period.range() } : undefined;
    },
    loader: ({ params }) => this.repository.listByDateRange(params),
  });

  readonly filters = this.filtersState.asReadonly();
  readonly activeFilterCount = computed(() => countActiveFilters(this.filters()));

  readonly transactions = computed<readonly Transaction[]>(() =>
    this.listResource.hasValue() ? this.listResource.value() : [],
  );
  readonly isLoading = this.listResource.isLoading;
  readonly error = this.listResource.error;
  readonly loaded = computed(() => this.listResource.hasValue());

  readonly views = computed(() =>
    buildTransactionViews(
      this.transactions(),
      this.categories.byId(),
      this.accounts.byId(),
      todayIso(),
    ),
  );
  readonly filtered = computed(() => filterTransactions(this.views(), this.filters()));
  readonly summary = computed(() => summarizeTransactions(this.filtered()));
  readonly grouped = computed(() => groupByDate(this.filtered()));

  setKind(kind: KindTab): void {
    this.patchFilters({ kind, categoryId: null });
  }

  setCategory(categoryId: string | null): void {
    this.patchFilters({ categoryId });
  }

  setAccount(accountId: string | null): void {
    this.patchFilters({ accountId });
  }

  setStatus(status: DisplayStatus | null): void {
    this.patchFilters({ status });
  }

  setSearch(search: string): void {
    this.patchFilters({ search });
  }

  clearFilters(): void {
    this.filtersState.update((filters) => ({ ...EMPTY_FILTERS, kind: filters.kind }));
  }

  async create(input: TransactionInput): Promise<void> {
    await this.repository.create(this.requireUserId(), input);
    this.afterMutation();
  }

  async update(id: string, input: TransactionInput): Promise<void> {
    await this.repository.update(id, input);
    this.afterMutation();
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
    this.afterMutation();
  }

  reload(): void {
    this.listResource.reload();
  }

  private afterMutation(): void {
    this.listResource.reload();
    this.accounts.reloadBalances();
  }

  private patchFilters(patch: Partial<TransactionFilters>): void {
    this.filtersState.update((filters) => ({ ...filters, ...patch }));
  }

  private requireUserId(): string {
    const userId = this.auth.userId();
    if (!userId) {
      throw new Error('No authenticated user.');
    }
    return userId;
  }
}
