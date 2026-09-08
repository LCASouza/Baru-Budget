import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { AccountsStore } from '../accounts/accounts.store';
import { CategoriesStore } from '../categories/categories.store';
import { DebtStatementInput } from '../../shared/components/debt-statement-dialog/debt-statement-dialog';
import { Transaction } from '../transactions/transaction.model';
import {
  DebtStatement,
  LoanInput,
  LoanView,
  buildLoanView,
  totalRemaining,
} from './loan.model';
import { LoanRepository } from './loan.repository';

@Injectable({ providedIn: 'root' })
export class LoansStore {
  private readonly context = inject(FinancialContextService);
  private readonly repository = inject(LoanRepository);
  private readonly accounts = inject(AccountsStore);
  private readonly categories = inject(CategoriesStore);

  // Loading starts only when a consumer says it needs this data. The dashboard
  // used to open every store at once, most of them for cards it may not show.
  private readonly active = signal(false);

  private readonly dataResource = resource({
    params: () => (this.active() ? (this.context.dataOwnerId() ?? undefined) : undefined),
    loader: async ({ params: ownerId }) => {
      const [loans, transactions, statements] = await Promise.all([
        this.repository.listByOwner(ownerId),
        this.repository.listTransactions(ownerId),
        this.repository.listStatements(ownerId),
      ]);
      return { loans, transactions, statements };
    },
  });

  private readonly transactions = computed<readonly Transaction[]>(() =>
    this.dataResource.hasValue() ? this.dataResource.value().transactions : [],
  );

  private readonly statements = computed<readonly DebtStatement[]>(() =>
    this.dataResource.hasValue() ? this.dataResource.value().statements : [],
  );

  readonly views = computed<readonly LoanView[]>(() => {
    if (!this.dataResource.hasValue()) {
      return [];
    }
    const accountNames = new Map(this.accounts.accounts().map((a) => [a.id, a.name]));
    const categoryNames = new Map(this.categories.visibleCategories().map((c) => [c.id, c.name]));
    return this.dataResource
      .value()
      .loans.map((loan) =>
        buildLoanView(loan, this.transactions(), accountNames, categoryNames, this.statements()),
      );
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

  async realignSchedule(loanId: string): Promise<number> {
    const changed = await this.repository.realignSchedule(loanId);
    this.reload();
    this.accounts.reloadBalances();
    return changed;
  }

  async generateSchedule(loanId: string, withDisbursement = true): Promise<number> {
    const created = await this.repository.generateSchedule(loanId, withDisbursement);
    this.reload();
    this.accounts.reloadBalances();
    return created;
  }

  async saveStatement(loanId: string, input: DebtStatementInput): Promise<void> {
    await this.repository.saveStatement(loanId, input);
    this.reload();
  }

  async removeStatement(id: string): Promise<void> {
    await this.repository.removeStatement(id);
    this.reload();
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
