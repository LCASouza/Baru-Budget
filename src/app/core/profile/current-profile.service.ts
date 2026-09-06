import { Injectable, computed, inject, resource } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { profileInitials } from './profile.model';
import { ProfileRepository } from './profile.repository';

@Injectable({ providedIn: 'root' })
export class CurrentProfileService {
  private readonly auth = inject(AuthService);
  private readonly repository = inject(ProfileRepository);

  private readonly profileResource = resource({
    params: () => this.auth.userId() ?? undefined,
    loader: ({ params: userId }) => this.repository.findById(userId),
  });

  readonly profile = computed(() =>
    this.profileResource.hasValue() ? this.profileResource.value() : null,
  );
  readonly isLoading = this.profileResource.isLoading;
  readonly email = computed(() => this.auth.user()?.email ?? '');
  readonly displayName = computed(() => this.profile()?.display_name ?? this.email());
  readonly initials = computed(() => profileInitials(this.displayName()));

  reload(): void {
    this.profileResource.reload();
  }
}
