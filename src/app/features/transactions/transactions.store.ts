import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { DisplayStatus } from '../../core/finance/transaction-status';
import { PeriodService } from '../../core/period/period.service';
import { todayIso } from '../../shared/dates/iso-date';
import { AccountsStore } from '../accounts/accounts.store';
import { CardsStore } from '../cards/cards.store';
import { InstallmentPurchaseInput } from '../installments/installment.repository';
import { InstallmentsStore } from '../installments/installments.store';
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
  private readonly context = inject(FinancialContextService);
  private readonly period = inject(PeriodService);
  private readonly repository = inject(TransactionRepository);
  private readonly accounts = inject(AccountsStore);
  private readonly categories = inject(CategoriesStore);
  private readonly cards = inject(CardsStore);
  private readonly installments = inject(InstallmentsStore);

  private readonly filtersState = signal<TransactionFilters>(EMPTY_FILTERS);

  // Personal and shared contexts list the owner's transactions; a household
  // context lists every transaction tagged with the household.
  private readonly listResource = resource({
    params: () => {
      const ownerId = this.context.dataOwnerId();
      if (!ownerId) {
        return undefined;
      }
      const householdId = this.context.householdId();
      return {
        range: this.period.range(),
        scope: householdId ? { householdId } : { ownerId },
      };
    },
    loader: ({ params }) => this.repository.listByDateRange(params.range, params.scope),
  });

  readonly isHouseholdContext = computed(() => this.context.householdId() !== null);
  readonly canManage = this.context.canManage;

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
      this.context.memberNameById(),
      this.cards.nameById(),
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

  setCard(cardId: string | null): void {
    this.patchFilters({ cardId });
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

  canEdit(transaction: Transaction): boolean {
    return this.context.canManageOwner(transaction.owner_user_id);
  }

  async create(input: TransactionInput): Promise<void> {
    await this.repository.create(this.requireOwnerId(), input);
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

  /** Generates every instalment of a purchase in the database, in one call. */
  async createInstallments(input: Omit<InstallmentPurchaseInput, 'ownerUserId'>): Promise<void> {
    await this.installments.create(input);
    this.afterMutation();
  }

  async removeInstallmentGroup(groupId: string): Promise<void> {
    await this.installments.removeGroup(groupId);
    this.afterMutation();
  }

  reload(): void {
    this.listResource.reload();
  }

  private afterMutation(): void {
    this.listResource.reload();
    this.accounts.reloadBalances();
    this.cards.reload();
  }

  private patchFilters(patch: Partial<TransactionFilters>): void {
    this.filtersState.update((filters) => ({ ...filters, ...patch }));
  }

  private requireOwnerId(): string {
    const ownerId = this.context.dataOwnerId();
    if (!ownerId) {
      throw new Error('No authenticated user.');
    }
    return ownerId;
  }
}
