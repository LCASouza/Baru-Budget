import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';
import { IsoDate, parseIsoDate, toIsoDate } from '../../dates/iso-date';
import { formatAmountInput, parseAmountInput } from '../../money/money';

/** What the lender reported for one month. Never a projection. */
export interface DebtStatementInput {
  readonly competence: IsoDate;
  readonly outstandingBalance: number;
  readonly installmentAmount: number;
  readonly insuranceAmount: number;
  readonly feeAmount: number;
  readonly remainingCount: number;
  readonly notes: string | null;
}

export interface DebtStatementDialogData {
  readonly title: string;
  readonly hint: string;
  readonly statement?: DebtStatementInput;
}

function amountValidator(control: AbstractControl<string>): ValidationErrors | null {
  const amount = parseAmountInput(control.value);
  return amount === null || amount <= 0 ? { amount: true } : null;
}

function optionalAmountValidator(control: AbstractControl<string>): ValidationErrors | null {
  if (control.value.trim() === '') {
    return null;
  }
  const amount = parseAmountInput(control.value);
  return amount === null || amount < 0 ? { amount: true } : null;
}

@Component({
  selector: 'app-debt-statement-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
  ],
  templateUrl: './debt-statement-dialog.html',
  styleUrl: './debt-statement-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DebtStatementDialog {
  protected readonly data = inject<DebtStatementDialogData>(MAT_DIALOG_DATA);
  private readonly reference = inject(MatDialogRef<DebtStatementDialog, DebtStatementInput>);
  private readonly builder = inject(NonNullableFormBuilder);

  protected readonly form = this.builder.group({
    competence: this.builder.control(
      parseIsoDate(this.data.statement?.competence ?? toIsoDate(new Date())),
      Validators.required,
    ),
    outstandingBalance: this.builder.control(
      this.data.statement ? formatAmountInput(this.data.statement.outstandingBalance) : '',
      amountValidator,
    ),
    installmentAmount: this.builder.control(
      this.data.statement ? formatAmountInput(this.data.statement.installmentAmount) : '',
      amountValidator,
    ),
    insuranceAmount: this.builder.control(
      this.data.statement ? formatAmountInput(this.data.statement.insuranceAmount) : '0,00',
      optionalAmountValidator,
    ),
    feeAmount: this.builder.control(
      this.data.statement ? formatAmountInput(this.data.statement.feeAmount) : '0,00',
      optionalAmountValidator,
    ),
    remainingCount: this.builder.control(String(this.data.statement?.remainingCount ?? ''), [
      Validators.required,
      Validators.pattern(/^\d+$/),
    ]),
    notes: this.builder.control(this.data.statement?.notes ?? ''),
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    // The competence is a month, so it is stored on the first day of it and the
    // day the user happened to pick is dropped.
    const picked = value.competence;
    const competence = toIsoDate(new Date(picked.getFullYear(), picked.getMonth(), 1));
    this.reference.close({
      competence,
      outstandingBalance: parseAmountInput(value.outstandingBalance) ?? 0,
      installmentAmount: parseAmountInput(value.installmentAmount) ?? 0,
      insuranceAmount: parseAmountInput(value.insuranceAmount) ?? 0,
      feeAmount: parseAmountInput(value.feeAmount) ?? 0,
      remainingCount: Number(value.remainingCount),
      notes: value.notes.trim() === '' ? null : value.notes.trim(),
    });
  }
}

export async function recordStatement(
  dialog: MatDialog,
  data: DebtStatementDialogData,
): Promise<DebtStatementInput | null> {
  const reference = dialog.open(DebtStatementDialog, { data, width: '520px', autoFocus: 'dialog' });
  return (await firstValueFrom(reference.afterClosed())) ?? null;
}
