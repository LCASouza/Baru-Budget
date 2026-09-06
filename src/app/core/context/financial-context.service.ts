import { Injectable, computed, effect, inject, resource, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { ContextRepository } from './context.repository';
import {
  FinancialContext,
  HouseholdSummary,
  PERSONAL_CONTEXT,
  ReceivedGrant,
  buildContextOptions,
  contextKey,
  resolveContext,
} from './financial-context.model';

const STORAGE_PREFIX = 'baru-budget.context.';

function readStoredKey(userId: string): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + userId);
  } catch {
    return null;
  }
}

function writeStoredKey(userId: string, key: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + userId, key);
  } catch {
    // Storage may be unavailable (private mode); the context simply is not remembered.
  }
}

// Which finances the application is showing: the user's own, a household, or
// another user's finances shared through a grant.
@Injectable({ providedIn: 'root' })
export class FinancialContextService {
  private readonly auth = inject(AuthService);
  private readonly repository = inject(ContextRepository);

  private readonly optionsResource = resource({
    params: () => this.auth.userId() ?? undefined,
    loader: async ({ params: userId }) => {
      const [households, grants] = await Promise.all([
        this.repository.listMyHouseholds(userId),
        this.repository.listReceivedGrants(userId),
      ]);
      return { households, grants };
    },
  });

  private readonly selectedKey = signal<string | null>(null);

  readonly households = computed<readonly HouseholdSummary[]>(() =>
    this.optionsResource.hasValue() ? this.optionsResource.value().households : [],
  );
  readonly receivedGrants = computed<readonly ReceivedGrant[]>(() =>
    this.optionsResource.hasValue() ? this.optionsResource.value().grants : [],
  );
  readonly options = computed(() => buildContextOptions(this.households(), this.receivedGrants()));
  readonly isLoading = this.optionsResource.isLoading;

  readonly context = computed<FinancialContext>(() => {
    const userId = this.auth.userId();
    if (!userId) {
      return PERSONAL_CONTEXT;
    }
    return resolveContext(this.options(), this.selectedKey() ?? readStoredKey(userId));
  });

  /** Owner whose accounts, categories and personal transactions are shown. */
  readonly dataOwnerId = computed(() => {
    const context = this.context();
    return context.kind === 'shared' ? context.ownerId : this.auth.userId();
  });
  readonly householdId = computed(() => {
    const context = this.context();
    return context.kind === 'household' ? context.householdId : null;
  });
  readonly currentHousehold = computed(() => {
    const householdId = this.householdId();
    return householdId ? (this.households().find((h) => h.id === householdId) ?? null) : null;
  });
  /** Whether the user can create and edit records in the current context. */
  readonly canManage = computed(() => {
    const context = this.context();
    return context.kind !== 'shared' || context.permission === 'MANAGE';
  });
  readonly memberNameById = computed<ReadonlyMap<string, string>>(
    () =>
      new Map(
        this.households().flatMap((household) =>
          household.members.map((member) => [member.userId, member.displayName] as const),
        ),
      ),
  );

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      const key = this.selectedKey();
      if (userId && key) {
        writeStoredKey(userId, key);
      }
    });
  }

  select(context: FinancialContext): void {
    this.selectedKey.set(contextKey(context));
  }

  /** Whether records owned by `ownerId` can be edited in the current context. */
  canManageOwner(ownerId: string): boolean {
    const userId = this.auth.userId();
    if (ownerId === userId) {
      return true;
    }
    const context = this.context();
    return context.kind === 'shared' && context.ownerId === ownerId && context.permission === 'MANAGE';
  }

  reloadOptions(): void {
    this.optionsResource.reload();
  }
}
