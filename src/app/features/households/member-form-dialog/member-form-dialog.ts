import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  HOUSEHOLD_ROLES,
  HOUSEHOLD_ROLE_LABELS,
  HouseholdRole,
} from '../../../core/finance/household-role';
import { describeDataError } from '../../../core/supabase/data-error';
import { HouseholdsStore, UserNotFoundError } from '../households.store';

export interface MemberFormData {
  readonly householdId: string;
  readonly householdName: string;
}

@Component({
  selector: 'app-member-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './member-form-dialog.html',
  styleUrl: './member-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberFormDialog {
  private readonly dialogRef = inject(MatDialogRef<MemberFormDialog, 'saved'>);
  protected readonly data = inject<MemberFormData>(MAT_DIALOG_DATA);
  private readonly store = inject(HouseholdsStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly roles = HOUSEHOLD_ROLES;
  protected readonly roleLabels = HOUSEHOLD_ROLE_LABELS;
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    role: this.formBuilder.control<HouseholdRole>('MEMBER', Validators.required),
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
      await this.store.addMemberByEmail(this.data.householdId, value.email.trim(), value.role);
      this.dialogRef.close('saved');
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        this.errorMessage.set('Nenhum usuário com este e-mail.');
        return;
      }
      this.snackBar.open(
        describeDataError(error, { fallback: 'Não foi possível adicionar o membro.' }),
        'OK',
        { duration: 5000 },
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
