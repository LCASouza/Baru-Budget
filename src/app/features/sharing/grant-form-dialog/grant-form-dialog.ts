import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  ACCESS_PERMISSIONS,
  ACCESS_PERMISSION_DESCRIPTIONS,
  ACCESS_PERMISSION_LABELS,
  AccessPermission,
} from '../../../core/finance/access-permission';
import { describeDataError } from '../../../core/supabase/data-error';
import { GrantUserNotFoundError, GrantsStore, SelfGrantError } from '../grants.store';

@Component({
  selector: 'app-grant-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
  ],
  templateUrl: './grant-form-dialog.html',
  styleUrl: './grant-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrantFormDialog {
  private readonly dialogRef = inject(MatDialogRef<GrantFormDialog, 'saved'>);
  private readonly store = inject(GrantsStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly permissions = ACCESS_PERMISSIONS;
  protected readonly permissionLabels = ACCESS_PERMISSION_LABELS;
  protected readonly permissionDescriptions = ACCESS_PERMISSION_DESCRIPTIONS;
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    permission: this.formBuilder.control<AccessPermission>('VIEW', Validators.required),
  });

  protected async save(): Promise<void> {
    if (this.submitting()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      await this.store.grantByEmail(value.email.trim(), value.permission);
      this.dialogRef.close('saved');
    } catch (error) {
      if (error instanceof GrantUserNotFoundError) {
        this.errorMessage.set('Nenhum usuário com este e-mail.');
        return;
      }
      if (error instanceof SelfGrantError) {
        this.errorMessage.set('Não é possível compartilhar com você mesmo.');
        return;
      }
      this.snackBar.open(
        describeDataError(error, {
          unique: 'Já existe um compartilhamento ativo com esta pessoa.',
          fallback: 'Não foi possível compartilhar.',
        }),
        'OK',
        { duration: 5000 },
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
