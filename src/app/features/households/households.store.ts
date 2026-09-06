import { Injectable, computed, inject, resource } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { HouseholdRole } from '../../core/finance/household-role';
import { DataError } from '../../core/supabase/data-error';
import { ProfileRepository } from '../../core/profile/profile.repository';
import { HouseholdWithMembers } from './household.model';
import { HouseholdRepository } from './household.repository';

export class UserNotFoundError extends DataError {
  constructor() {
    super('No user with this e-mail', 'USER_NOT_FOUND');
  }
}

@Injectable({ providedIn: 'root' })
export class HouseholdsStore {
  private readonly auth = inject(AuthService);
  private readonly repository = inject(HouseholdRepository);
  private readonly profiles = inject(ProfileRepository);
  private readonly context = inject(FinancialContextService);

  private readonly householdsResource = resource({
    params: () => this.auth.userId() ?? undefined,
    loader: () => this.repository.listMine(),
  });

  readonly households = computed<readonly HouseholdWithMembers[]>(() =>
    this.householdsResource.hasValue() ? this.householdsResource.value() : [],
  );
  readonly isLoading = this.householdsResource.isLoading;
  readonly error = this.householdsResource.error;
  readonly loaded = computed(() => this.householdsResource.hasValue());

  async create(name: string): Promise<void> {
    await this.repository.create(name);
    this.afterMutation();
  }

  async rename(id: string, name: string): Promise<void> {
    await this.repository.rename(id, name);
    this.afterMutation();
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
    this.afterMutation();
  }

  async addMemberByEmail(householdId: string, email: string, role: HouseholdRole): Promise<void> {
    const user = await this.profiles.lookupByEmail(email);
    if (!user) {
      throw new UserNotFoundError();
    }
    await this.repository.addMember(householdId, user.id, role);
    this.afterMutation();
  }

  async setMemberRole(householdId: string, userId: string, role: HouseholdRole): Promise<void> {
    await this.repository.setMemberRole(householdId, userId, role);
    this.afterMutation();
  }

  async removeMember(householdId: string, userId: string): Promise<void> {
    await this.repository.removeMember(householdId, userId);
    this.afterMutation();
  }

  async leave(householdId: string): Promise<void> {
    await this.repository.leave(householdId);
    this.afterMutation();
  }

  reload(): void {
    this.householdsResource.reload();
  }

  private afterMutation(): void {
    this.householdsResource.reload();
    this.context.reloadOptions();
  }
}
