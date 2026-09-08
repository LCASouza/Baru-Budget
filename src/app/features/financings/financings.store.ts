import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { AccountsStore } from '../accounts/accounts.store';
import { CategoriesStore } from '../categories/categories.store';
import { Transaction } from '../transactions/transaction.model';
import {
  FinancingInput,
  FinancingView,
  buildFinancingView,
  totalRemaining,
} from './financing.model';
import { FinancingRepository } from './financing.repository';

@Injectable({ providedIn: 'root' })
export class FinancingsStore {
  private readonly context = inject(FinancialContextService);
  private readonly repository = inject(FinancingRepository);
  private readonly accounts = inject(AccountsStore);
  private readonly categories = inject(CategoriesStore);

  // Loading starts only when a consumer says it needs this data. The dashboard
  // used to open every store at once, most of them for cards it may not show.
  private readonly active = signal(false);

  private readonly dataResource = resource({
    params: () => (this.active() ? (this.context.dataOwnerId() ?? undefined) : undefined),
    loader: async ({ params: ownerId }) => {
      const [financings, transactions] = await Promise.all([
        this.repository.listByOwner(ownerId),
        this.repository.listTransactions(ownerId),
      ]);
      return { financings, transactions };
    },
  });

  private readonly transactions = computed<readonly Transaction[]>(() =>
    this.dataResource.hasValue() ? this.dataResource.value().transactions : [],
  );

  readonly views = computed<readonly FinancingView[]>(() => {
    if (!this.dataResource.hasValue()) {
      return [];
    }
    const accountNames = new Map(this.accounts.accounts().map((a) => [a.id, a.name]));
    const categoryNames = new Map(this.categories.visibleCategories().map((c) => [c.id, c.name]));
    return this.dataResource
      .value()
      .financings.map((financing) =>
        buildFinancingView(financing, this.transactions(), accountNames, categoryNames),
      );
  });

  readonly open = computed(() => this.views().filter((view) => view.remainingCount > 0));
  readonly totalRemaining = computed(() => totalRemaining(this.views()));
  readonly remainingCount = computed(() =>
    this.views().reduce((count, view) => count + view.remainingCount, 0),
  );
  readonly outstandingPrincipal = computed(() =>
    this.views().reduce((total, view) => total + view.outstandingPrincipal, 0),
  );
  readonly isLoading = this.dataResource.isLoading;
  readonly error = this.dataResource.error;
  readonly loaded = computed(() => this.dataResource.hasValue());
  readonly canManage = this.context.canManage;

  viewOf(financingId: string): FinancingView | null {
    return this.views().find((view) => view.financing.id === financingId) ?? null;
  }

  async create(input: FinancingInput): Promise<string> {
    const financing = await this.repository.create(this.requireOwnerId(), input);
    this.reload();
    return financing.id;
  }

  async update(id: string, input: FinancingInput): Promise<void> {
    await this.repository.update(id, input);
    this.reload();
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
    this.reload();
  }

  async generateSchedule(financingId: string, withDownPayment = true): Promise<number> {
    const created = await this.repository.generateSchedule(financingId, withDownPayment);
    this.reload();
    this.accounts.reloadBalances();
    return created;
  }

  async realignSchedule(financingId: string): Promise<number> {
    const changed = await this.repository.realignSchedule(financingId);
    this.reload();
    this.accounts.reloadBalances();
    return changed;
  }

  /** Declares that this data is about to be shown. Idempotent. */
  activate(): void {
    this.active.set(true);
  }

  reload(): void {
    this.dataResource.reload();
  }

  private requireOwnerId(): string {
    const ownerId = this.context.dataOwnerId();
    if (!ownerId) {
      throw new Error('No authenticated user.');
    }
    return ownerId;
  }
}
