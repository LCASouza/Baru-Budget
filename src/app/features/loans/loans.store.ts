import { Injectable, computed, inject, resource } from '@angular/core';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { AccountsStore } from '../accounts/accounts.store';
import { CategoriesStore } from '../categories/categories.store';
import { Transaction } from '../transactions/transaction.model';
import { LoanInput, LoanView, buildLoanView, totalRemaining } from './loan.model';
import { LoanRepository } from './loan.repository';

@Injectable({ providedIn: 'root' })
export class LoansStore {
  private readonly context = inject(FinancialContextService);
  private readonly repository = inject(LoanRepository);
  private readonly accounts = inject(AccountsStore);
  private readonly categories = inject(CategoriesStore);

  private readonly dataResource = resource({
    params: () => this.context.dataOwnerId() ?? undefined,
    loader: async ({ params: ownerId }) => {
      const [loans, transactions] = await Promise.all([
        this.repository.listByOwner(ownerId),
        this.repository.listTransactions(ownerId),
      ]);
      return { loans, transactions };
    },
  });

  private readonly transactions = computed<readonly Transaction[]>(() =>
    this.dataResource.hasValue() ? this.dataResource.value().transactions : [],
  );

  readonly views = computed<readonly LoanView[]>(() => {
    if (!this.dataResource.hasValue()) {
      return [];
    }
    const accountNames = new Map(this.accounts.accounts().map((a) => [a.id, a.name]));
    const categoryNames = new Map(this.categories.visibleCategories().map((c) => [c.id, c.name]));
    return this.dataResource
      .value()
      .loans.map((loan) => buildLoanView(loan, this.transactions(), accountNames, categoryNames));
  });

  readonly open = computed(() => this.views().filter((view) => view.remainingCount > 0));
  readonly totalRemaining = computed(() => totalRemaining(this.views()));
  readonly remainingCount = computed(() =>
    this.views().reduce((count, view) => count + view.remainingCount, 0),
  );
  readonly isLoading = this.dataResource.isLoading;
  readonly error = this.dataResource.error;
  readonly loaded = computed(() => this.dataResource.hasValue());
  readonly canManage = this.context.canManage;

  viewOf(loanId: string): LoanView | null {
    return this.views().find((view) => view.loan.id === loanId) ?? null;
  }

  async create(input: LoanInput): Promise<string> {
    const loan = await this.repository.create(this.requireOwnerId(), input);
    this.reload();
    return loan.id;
  }

  async update(id: string, input: LoanInput): Promise<void> {
    await this.repository.update(id, input);
    this.reload();
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
    this.reload();
  }

  async generateSchedule(loanId: string, withDisbursement = true): Promise<number> {
    const created = await this.repository.generateSchedule(loanId, withDisbursement);
    this.reload();
    this.accounts.reloadBalances();
    return created;
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
