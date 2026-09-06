import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CategoryKind } from '../../../core/finance/category-kind';
import { describeDataError } from '../../../core/supabase/data-error';
import { CategoriesStore } from '../categories.store';
import { Category } from '../category.model';

export interface CategoryFormData {
  readonly category?: Category;
  readonly kind?: CategoryKind;
}

export type CategoryFormResult = 'saved';

@Component({
  selector: 'app-category-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './category-form-dialog.html',
  styleUrl: './category-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryFormDialog {
  private readonly dialogRef = inject(MatDialogRef<CategoryFormDialog, CategoryFormResult>);
  private readonly data = inject<CategoryFormData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly store = inject(CategoriesStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly category = this.data?.category ?? null;
  protected readonly isEdit = this.category !== null;
  protected readonly submitting = signal(false);

  protected readonly form = this.formBuilder.group({
    // The kind cannot change on edit: existing transactions depend on it.
    kind: this.formBuilder.control<CategoryKind>(
      { value: this.category?.kind ?? this.data?.kind ?? 'EXPENSE', disabled: this.isEdit },
      Validators.required,
    ),
    name: [this.category?.name ?? '', [Validators.required, Validators.maxLength(60)]],
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
    const name = value.name.trim();

    this.submitting.set(true);
    try {
      if (this.category) {
        await this.store.rename(this.category.id, name);
      } else {
        await this.store.create({ kind: value.kind, name });
      }
      this.dialogRef.close('saved');
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, {
          unique: 'Já existe uma categoria com este nome.',
          fallback: 'Não foi possível salvar a categoria.',
        }),
        'OK',
        { duration: 5000 },
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
