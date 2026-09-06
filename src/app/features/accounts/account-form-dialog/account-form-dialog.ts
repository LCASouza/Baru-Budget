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
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, AccountType } from '../../../core/finance/account-type';
import { describeDataError } from '../../../core/supabase/data-error';
import { formatAmountInput, parseAmountInput } from '../../../shared/money/money';
import { Account, AccountInput } from '../account.model';
import { AccountsStore } from '../accounts.store';

export interface AccountFormData {
  readonly account?: Account;
}

export type AccountFormResult = 'saved';

function amountValidator(control: AbstractControl<string>): ValidationErrors | null {
  return parseAmountInput(control.value) === null ? { amount: true } : null;
}

@Component({
  selector: 'app-account-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './account-form-dialog.html',
  styleUrl: './account-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountFormDialog {
  private readonly dialogRef = inject(MatDialogRef<AccountFormDialog, AccountFormResult>);
  private readonly data = inject<AccountFormData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly store = inject(AccountsStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly account = this.data?.account ?? null;
  protected readonly isEdit = this.account !== null;
  protected readonly types = ACCOUNT_TYPES;
  protected readonly typeLabels = ACCOUNT_TYPE_LABELS;
  protected readonly submitting = signal(false);

  protected readonly form = this.formBuilder.group({
    name: [this.account?.name ?? '', [Validators.required, Validators.maxLength(60)]],
    type: this.formBuilder.control<AccountType>(this.account?.type ?? 'BANK', Validators.required),
    institution: [this.account?.institution ?? '', Validators.maxLength(80)],
    openingBalance: [
      formatAmountInput(this.account?.opening_balance ?? 0),
      [Validators.required, amountValidator],
    ],
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
    const input: AccountInput = {
      name: value.name.trim(),
      type: value.type,
      institution: value.institution.trim() || null,
      openingBalance: parseAmountInput(value.openingBalance) ?? 0,
    };

    this.submitting.set(true);
    try {
      if (this.account) {
        await this.store.update(this.account.id, input);
      } else {
        await this.store.create(input);
      }
      this.dialogRef.close('saved');
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, {
          unique: 'Já existe uma conta com este nome.',
          fallback: 'Não foi possível salvar a conta.',
        }),
        'OK',
        { duration: 5000 },
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
