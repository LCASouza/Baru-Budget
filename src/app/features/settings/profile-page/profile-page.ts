import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/auth/auth.service';
import { CurrentProfileService } from '../../../core/profile/current-profile.service';
import { ProfileRepository } from '../../../core/profile/profile.repository';

@Component({
  selector: 'app-profile-page',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  private readonly auth = inject(AuthService);
  private readonly repository = inject(ProfileRepository);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  protected readonly currentProfile = inject(CurrentProfileService);

  protected readonly submitting = signal(false);

  protected readonly form = this.formBuilder.group({
    displayName: ['', [Validators.required, Validators.maxLength(80)]],
  });

  constructor() {
    effect(() => {
      const profile = this.currentProfile.profile();
      if (profile && !this.form.dirty) {
        this.form.setValue({ displayName: profile.display_name });
      }
    });
  }

  protected async save(): Promise<void> {
    const userId = this.auth.userId();
    if (this.submitting() || !userId) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    try {
      await this.repository.updateDisplayName(userId, this.form.getRawValue().displayName.trim());
      this.currentProfile.reload();
      this.form.markAsPristine();
      this.snackBar.open('Perfil atualizado.', undefined, { duration: 3000 });
    } catch {
      this.snackBar.open('Não foi possível salvar o perfil.', 'OK', { duration: 5000 });
    } finally {
      this.submitting.set(false);
    }
  }
}
