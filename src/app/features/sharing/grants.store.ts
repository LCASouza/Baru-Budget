import { Injectable, computed, inject, resource } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { AccessPermission } from '../../core/finance/access-permission';
import { DataError } from '../../core/supabase/data-error';
import { ProfileRepository } from '../../core/profile/profile.repository';
import { GivenGrant, ReceivedGrantView } from './grant.model';
import { GrantRepository } from './grant.repository';

export class GrantUserNotFoundError extends DataError {
  constructor() {
    super('No user with this e-mail', 'USER_NOT_FOUND');
  }
}

export class SelfGrantError extends DataError {
  constructor() {
    super('Cannot grant access to yourself', 'SELF_GRANT');
  }
}

@Injectable({ providedIn: 'root' })
export class GrantsStore {
  private readonly auth = inject(AuthService);
  private readonly repository = inject(GrantRepository);
  private readonly profiles = inject(ProfileRepository);
  private readonly context = inject(FinancialContextService);

  private readonly givenResource = resource({
    params: () => this.auth.userId() ?? undefined,
    loader: ({ params: userId }) => this.repository.listGiven(userId),
  });

  private readonly receivedResource = resource({
    params: () => this.auth.userId() ?? undefined,
    loader: ({ params: userId }) => this.repository.listReceived(userId),
  });

  readonly given = computed<readonly GivenGrant[]>(() =>
    this.givenResource.hasValue() ? this.givenResource.value() : [],
  );
  readonly received = computed<readonly ReceivedGrantView[]>(() =>
    this.receivedResource.hasValue() ? this.receivedResource.value() : [],
  );
  readonly isLoading = computed(
    () => this.givenResource.isLoading() || this.receivedResource.isLoading(),
  );
  readonly error = computed(() => this.givenResource.error() ?? this.receivedResource.error());
  readonly loaded = computed(() => this.givenResource.hasValue() && this.receivedResource.hasValue());

  async grantByEmail(email: string, permission: AccessPermission): Promise<void> {
    const ownerId = this.requireUserId();
    const user = await this.profiles.lookupByEmail(email);
    if (!user) {
      throw new GrantUserNotFoundError();
    }
    if (user.id === ownerId) {
      throw new SelfGrantError();
    }
    await this.repository.create(ownerId, user.id, permission);
    this.afterMutation();
  }

  async setPermission(id: string, permission: AccessPermission): Promise<void> {
    await this.repository.setPermission(id, permission);
    this.afterMutation();
  }

  async revoke(id: string): Promise<void> {
    await this.repository.revoke(id);
    this.afterMutation();
  }

  reload(): void {
    this.givenResource.reload();
    this.receivedResource.reload();
  }

  private afterMutation(): void {
    this.reload();
    this.context.reloadOptions();
  }

  private requireUserId(): string {
    const userId = this.auth.userId();
    if (!userId) {
      throw new Error('No authenticated user.');
    }
    return userId;
  }
}
