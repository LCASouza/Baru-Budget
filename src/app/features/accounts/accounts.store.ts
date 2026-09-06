import { Injectable, computed, inject, resource } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { Account, AccountInput, splitBalances } from './account.model';
import { AccountRepository } from './account.repository';

@Injectable({ providedIn: 'root' })
export class AccountsStore {
  private readonly auth = inject(AuthService);
  private readonly repository = inject(AccountRepository);

  private readonly accountsResource = resource({
    params: () => this.auth.userId() ?? undefined,
    loader: () => this.repository.listAll(),
  });

  private readonly balancesResource = resource({
    params: () => this.auth.userId() ?? undefined,
    loader: () => this.repository.listBalances(),
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
    await this.repository.create(this.requireUserId(), input);
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

  private requireUserId(): string {
    const userId = this.auth.userId();
    if (!userId) {
      throw new Error('No authenticated user.');
    }
    return userId;
  }
}
