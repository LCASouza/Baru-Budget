import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { ProfileRepository } from '../../core/profile/profile.repository';
import { AccountsStore } from '../accounts/accounts.store';
import { GrantsStore } from '../sharing/grants.store';
import {
  BalanceTotals,
  LedgerItem,
  PersonBalance,
  balanceTotals,
  buildLedgerItems,
  sortBalances,
} from './allocation.model';
import { SettlementInput, SettlementsRepository } from './settlements.repository';

export interface PersonOption {
  readonly id: string;
  readonly name: string;
}

@Injectable({ providedIn: 'root' })
export class SettlementsStore {
  private readonly context = inject(FinancialContextService);
  private readonly repository = inject(SettlementsRepository);
  private readonly profiles = inject(ProfileRepository);
  private readonly grants = inject(GrantsStore);
  private readonly accounts = inject(AccountsStore);

  private readonly balancesResource = resource({
    params: () => this.context.dataOwnerId() ?? undefined,
    loader: async () => {
      const rows = await this.repository.listBalances();
      const names = await this.profiles.findManyByIds(rows.map((row) => row.userId));
      const byId = new Map(names.map((profile) => [profile.id, profile.display_name]));
      return rows.map((row) => ({
        userId: row.userId,
        name: byId.get(row.userId) ?? 'Usuário',
        balance: row.balance,
      }));
    },
  });

  readonly balances = computed<readonly PersonBalance[]>(() =>
    this.balancesResource.hasValue() ? sortBalances(this.balancesResource.value()) : [],
  );
  readonly open = computed(() => this.balances().filter((entry) => entry.balance !== 0));
  readonly totals = computed<BalanceTotals>(() => balanceTotals(this.balances()));
  readonly isLoading = this.balancesResource.isLoading;
  readonly error = this.balancesResource.error;
  readonly loaded = computed(() => this.balancesResource.hasValue());
  readonly canManage = this.context.canManage;

  /** People a split or a settlement can involve: household members and grant counterparts. */
  readonly people = computed<readonly PersonOption[]>(() => {
    const me = this.context.dataOwnerId();
    const options = new Map<string, string>();
    for (const [id, name] of this.context.memberNameById()) {
      options.set(id, name);
    }
    for (const grant of this.grants.given()) {
      options.set(grant.grantedUserId, grant.grantedUserName);
    }
    for (const grant of this.grants.received()) {
      options.set(grant.ownerId, grant.ownerName);
    }
    for (const balance of this.balances()) {
      options.set(balance.userId, balance.name);
    }
    if (me) {
      options.delete(me);
    }
    return [...options.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  });

  private readonly selectedPerson = signal<string | null>(null);
  private readonly itemsResource = resource({
    params: () => {
      const me = this.context.dataOwnerId();
      const other = this.selectedPerson();
      return me && other ? { me, other } : undefined;
    },
    loader: async ({ params }) => {
      const [allocations, settlements] = await Promise.all([
        this.repository.listPairAllocations(params.me, params.other),
        this.repository.listPairSettlements(params.me, params.other),
      ]);
      return buildLedgerItems(allocations, settlements, params.me, params.other);
    },
  });

  readonly selected = this.selectedPerson.asReadonly();
  readonly items = computed<readonly LedgerItem[]>(() =>
    this.itemsResource.hasValue() ? this.itemsResource.value() : [],
  );
  readonly itemsLoading = this.itemsResource.isLoading;

  toggle(userId: string): void {
    this.selectedPerson.update((current) => (current === userId ? null : userId));
  }

  async recordSettlement(input: Omit<SettlementInput, 'ownerUserId'>): Promise<void> {
    await this.repository.createSettlement({ ...input, ownerUserId: this.requireOwnerId() });
    this.reload();
    this.accounts.reloadBalances();
  }

  reload(): void {
    this.balancesResource.reload();
    this.itemsResource.reload();
  }

  private requireOwnerId(): string {
    const ownerId = this.context.dataOwnerId();
    if (!ownerId) {
      throw new Error('No authenticated user.');
    }
    return ownerId;
  }
}
