import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { describeDataError } from '../../../core/supabase/data-error';
import { toIsoDate } from '../../../shared/dates/iso-date';
import { formatAmountInput, parseAmountInput } from '../../../shared/money/money';
import { AccountsStore } from '../../accounts/accounts.store';
import { SettlementsStore } from '../settlements.store';

export interface SettlementFormData {
  readonly counterpartyUserId?: string;
  readonly counterpartyName?: string;
  /** Balance with that person: positive means they owe the user. */
  readonly balance?: number;
}

function amountValidator(control: AbstractControl<string>): ValidationErrors | null {
  const amount = parseAmountInput(control.value);
  return amount === null || amount <= 0 ? { amount: true } : null;
}

@Component({
  selector: 'app-settlement-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './settlement-form-dialog.html',
  styleUrl: './settlement-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettlementFormDialog {
  private readonly dialogRef = inject(MatDialogRef<SettlementFormDialog, 'saved'>);
  private readonly data = inject<SettlementFormData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly store = inject(SettlementsStore);
  private readonly accountsStore = inject(AccountsStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly people = this.store.people;
  protected readonly accounts = computed(() => this.accountsStore.activeAccounts());
  protected readonly submitting = signal(false);

  // A positive balance means the person owes the user, so the natural move is
  // receiving; a negative one means paying.
  private readonly initialDirection: 'PAY' | 'RECEIVE' =
    (this.data?.balance ?? 0) < 0 ? 'PAY' : 'RECEIVE';

  protected readonly form = this.formBuilder.group({
    counterpartyUserId: [this.data?.counterpartyUserId ?? '', Validators.required],
    direction: this.formBuilder.control<'PAY' | 'RECEIVE'>(this.initialDirection),
    description: [
      this.data?.counterpartyName ? `Acerto com ${this.data.counterpartyName}` : 'Acerto',
      [Validators.required, Validators.maxLength(120)],
    ],
    amount: [
      this.data?.balance ? formatAmountInput(Math.abs(this.data.balance)) : '',
      [Validators.required, amountValidator],
    ],
    date: this.formBuilder.control<Date | null>(new Date(), Validators.required),
    accountId: ['', Validators.required],
  });

  private readonly direction = toSignal(this.form.controls.direction.valueChanges, {
    initialValue: this.form.controls.direction.value,
  });
  protected readonly isPaying = computed(() => this.direction() === 'PAY');

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
    try {
      await this.store.recordSettlement({
        counterpartyUserId: value.counterpartyUserId,
        direction: value.direction,
        description: value.description.trim(),
        amount: parseAmountInput(value.amount) ?? 0,
        date: toIsoDate(value.date as Date),
        accountId: value.accountId,
      });
      this.dialogRef.close('saved');
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, { fallback: 'Não foi possível registrar o acerto.' }),
        'OK',
        { duration: 5000 },
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
