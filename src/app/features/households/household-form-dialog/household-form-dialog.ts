import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { describeDataError } from '../../../core/supabase/data-error';
import { Household } from '../household.model';
import { HouseholdsStore } from '../households.store';

export interface HouseholdFormData {
  readonly household?: Household;
}

@Component({
  selector: 'app-household-form-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './household-form-dialog.html',
  styleUrl: './household-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HouseholdFormDialog {
  private readonly dialogRef = inject(MatDialogRef<HouseholdFormDialog, 'saved'>);
  private readonly data = inject<HouseholdFormData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly store = inject(HouseholdsStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly household = this.data?.household ?? null;
  protected readonly isEdit = this.household !== null;
  protected readonly submitting = signal(false);

  protected readonly form = this.formBuilder.group({
    name: [this.household?.name ?? '', [Validators.required, Validators.maxLength(60)]],
  });

  protected async save(): Promise<void> {
    if (this.submitting()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const name = this.form.getRawValue().name.trim();
    this.submitting.set(true);
    try {
      if (this.household) {
        await this.store.rename(this.household.id, name);
      } else {
        await this.store.create(name);
      }
      this.dialogRef.close('saved');
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, { fallback: 'Não foi possível salvar o grupo.' }),
        'OK',
        { duration: 5000 },
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
