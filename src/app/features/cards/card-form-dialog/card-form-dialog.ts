import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { describeDataError } from '../../../core/supabase/data-error';
import { formatAmountInput, parseAmountInput } from '../../../shared/money/money';
import { CardInput, CreditCard } from '../card.model';
import { CardsStore } from '../cards.store';

export interface CardFormData {
  readonly card?: CreditCard;
}

const DAYS: readonly number[] = Array.from({ length: 31 }, (_, index) => index + 1);

function optionalAmountValidator(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() === '' || parseAmountInput(control.value) !== null
    ? null
    : { amount: true };
}

@Component({
  selector: 'app-card-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './card-form-dialog.html',
  styleUrl: './card-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardFormDialog {
  private readonly dialogRef = inject(MatDialogRef<CardFormDialog, 'saved'>);
  private readonly data = inject<CardFormData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly store = inject(CardsStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly card = this.data?.card ?? null;
  protected readonly isEdit = this.card !== null;
  protected readonly days = DAYS;
  protected readonly submitting = signal(false);

  protected readonly form = this.formBuilder.group({
    name: [this.card?.name ?? '', [Validators.required, Validators.maxLength(60)]],
    institution: [this.card?.institution ?? '', Validators.maxLength(80)],
    limitAmount: [
      this.card?.limit_amount != null ? formatAmountInput(this.card.limit_amount) : '',
      optionalAmountValidator,
    ],
    closingDay: this.formBuilder.control<number>(this.card?.closing_day ?? 20, Validators.required),
    dueDay: this.formBuilder.control<number>(this.card?.due_day ?? 5, Validators.required),
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
    const input: CardInput = {
      name: value.name.trim(),
      institution: value.institution.trim() || null,
      limitAmount: value.limitAmount.trim() ? parseAmountInput(value.limitAmount) : null,
      closingDay: value.closingDay,
      dueDay: value.dueDay,
    };

    this.submitting.set(true);
    try {
      if (this.card) {
        await this.store.update(this.card.id, input);
      } else {
        await this.store.create(input);
      }
      this.dialogRef.close('saved');
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, {
          unique: 'Já existe um cartão com este nome.',
          fallback: 'Não foi possível salvar o cartão.',
        }),
        'OK',
        { duration: 5000 },
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
