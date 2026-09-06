import { Injectable, computed, inject, resource } from '@angular/core';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { Account, AccountInput, splitBalances } from './account.model';
import { AccountRepository } from './account.repository';

@Injectable({ providedIn: 'root' })
export class AccountsStore {
  private readonly context = inject(FinancialContextService);
  private readonly repository = inject(AccountRepository);

  // Accounts of the context owner: the user's own in the personal and household
  // contexts, the owner's in a shared context.
  private readonly accountsResource = resource({
    params: () => this.context.dataOwnerId() ?? undefined,
    loader: ({ params: ownerId }) => this.repository.listByOwner(ownerId),
  });

  private readonly balancesResource = resource({
    params: () => this.context.dataOwnerId() ?? undefined,
    loader: ({ params: ownerId }) => this.repository.listBalances(ownerId),
  });

  readonly accounts = computed<readonly Account[]>(() =>
    this.accountsResource.hasValue() ? this.accountsResource.value() : [],
  );
  readonly activeAccounts = computed(() => this.accounts().filter((account) => account.active));
  readonly byId = computed(() => new Map(this.accounts().map((account) => [account.id, account])));
  readonly balanceById = computed<ReadonlyMap<string, number>>(() =>
    this.balancesResource.hasValue()
      ? new Map(this.balancesResource.value().map((row) => [row.accountId, row.currentBalance]))
      : new Map(),
  );
  readonly totals = computed(() => splitBalances(this.accounts(), this.balanceById()));
  readonly isLoading = computed(
    () => this.accountsResource.isLoading() || this.balancesResource.isLoading(),
  );
  readonly error = computed(() => this.accountsResource.error() ?? this.balancesResource.error());
  readonly loaded = computed(() => this.accountsResource.hasValue());

  async create(input: AccountInput): Promise<void> {
    await this.repository.create(this.requireOwnerId(), input);
    this.reload();
  }

  async update(id: string, input: AccountInput): Promise<void> {
    await this.repository.update(id, input);
    this.reload();
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await this.repository.setActive(id, active);
    this.reload();
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
    this.reload();
  }

  reload(): void {
    this.accountsResource.reload();
    this.balancesResource.reload();
  }

  reloadBalances(): void {
    this.balancesResource.reload();
  }

  private requireOwnerId(): string {
    const ownerId = this.context.dataOwnerId();
    if (!ownerId) {
      throw new Error('No authenticated user.');
    }
    return ownerId;
  }
}
