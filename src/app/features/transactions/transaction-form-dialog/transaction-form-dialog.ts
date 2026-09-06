import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
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
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import {
  TRANSACTION_STATUSES,
  TransactionStatus,
  transactionStatusLabel,
} from '../../../core/finance/transaction-status';
import { describeDataError } from '../../../core/supabase/data-error';
import { confirmAction } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { parseIsoDate, toIsoDate } from '../../../shared/dates/iso-date';
import { formatAmountInput, parseAmountInput } from '../../../shared/money/money';
import { AccountsStore } from '../../accounts/accounts.store';
import { CategoriesStore } from '../../categories/categories.store';
import { TransactionFormData, TransactionFormResult } from '../open-transaction-dialog';
import { SupportedTransactionKind, TransactionInput } from '../transaction.model';
import { TransactionsStore } from '../transactions.store';

function amountValidator(control: AbstractControl<string>): ValidationErrors | null {
  const amount = parseAmountInput(control.value);
  return amount === null || amount <= 0 ? { amount: true } : null;
}

@Component({
  selector: 'app-transaction-form-dialog',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './transaction-form-dialog.html',
  styleUrl: './transaction-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionFormDialog {
  private readonly dialogRef = inject(MatDialogRef<TransactionFormDialog, TransactionFormResult>);
  private readonly data = inject<TransactionFormData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly store = inject(TransactionsStore);
  private readonly accountsStore = inject(AccountsStore);
  private readonly categoriesStore = inject(CategoriesStore);

  protected readonly transaction = this.data?.transaction ?? null;
  protected readonly isEdit = this.transaction !== null;
  protected readonly submitting = signal(false);

  protected readonly form = this.formBuilder.group({
    kind: this.formBuilder.control<SupportedTransactionKind>(
      this.initialKind(),
      Validators.required,
    ),
    description: [
      this.transaction?.description ?? '',
      [Validators.required, Validators.maxLength(120)],
    ],
    amount: [
      this.transaction ? formatAmountInput(this.transaction.amount) : '',
      [Validators.required, amountValidator],
    ],
    date: this.formBuilder.control<Date | null>(
      this.transaction ? parseIsoDate(this.transaction.date) : new Date(),
      Validators.required,
    ),
    categoryId: [this.transaction?.category_id ?? ''],
    accountId: [this.transaction?.account_id ?? '', Validators.required],
    destinationAccountId: [this.transaction?.destination_account_id ?? ''],
    status: this.formBuilder.control<TransactionStatus>(this.transaction?.status ?? 'PAID'),
    dueDate: this.formBuilder.control<Date | null>(
      this.transaction?.due_date ? parseIsoDate(this.transaction.due_date) : null,
    ),
    notes: [this.transaction?.notes ?? '', Validators.maxLength(1000)],
  });

  private readonly kind = toSignal(this.form.controls.kind.valueChanges, {
    initialValue: this.form.controls.kind.value,
  });
  private readonly status = toSignal(this.form.controls.status.valueChanges, {
    initialValue: this.form.controls.status.value,
  });

  protected readonly isTransfer = computed(() => this.kind() === 'TRANSFER');
  protected readonly statusOptions = computed(() =>
    TRANSACTION_STATUSES.map((status) => ({
      value: status,
      label: transactionStatusLabel(status, this.kind()),
    })),
  );
  protected readonly isPending = computed(() => this.status() === 'PENDING');

  // Inactive records stay selectable only when the transaction already uses them.
  protected readonly categories = computed(() => {
    const kind = this.kind();
    if (kind === 'TRANSFER') {
      return [];
    }
    const current = this.transaction?.category_id;
    return this.categoriesStore
      .ofKind(kind)
      .filter((category) => category.active || category.id === current);
  });
  protected readonly accounts = computed(() => {
    const current = this.transaction;
    return this.accountsStore
      .accounts()
      .filter(
        (account) =>
          account.active ||
          account.id === current?.account_id ||
          account.id === current?.destination_account_id,
      );
  });
  protected readonly hasAccounts = computed(() => this.accountsStore.activeAccounts().length > 0);
  protected readonly accountsLoading = computed(
    () => this.accountsStore.isLoading() && !this.accountsStore.loaded(),
  );

  constructor() {
    this.form.controls.kind.valueChanges.pipe(takeUntilDestroyed()).subscribe((kind) => {
      this.form.controls.categoryId.reset('');
      this.applyKindValidators(kind);
    });
    this.form.controls.accountId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.destinationAccountId.updateValueAndValidity());
    this.applyKindValidators(this.form.controls.kind.value);
  }

  protected async save(): Promise<void> {
    if (this.submitting() || !this.hasAccounts()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const input = this.toInput();
    this.submitting.set(true);
    try {
      if (this.transaction) {
        await this.store.update(this.transaction.id, input);
      } else {
        await this.store.create(input);
      }
      this.dialogRef.close('saved');
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, { fallback: 'Não foi possível salvar a movimentação.' }),
        'OK',
        { duration: 5000 },
      );
    } finally {
      this.submitting.set(false);
    }
  }

  protected async remove(): Promise<void> {
    if (!this.transaction || this.submitting()) {
      return;
    }
    const confirmed = await confirmAction(this.dialog, {
      title: 'Excluir movimentação',
      message: `"${this.transaction.description}" será excluída permanentemente.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!confirmed) {
      return;
    }

    this.submitting.set(true);
    try {
      await this.store.remove(this.transaction.id);
      this.dialogRef.close('deleted');
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, { fallback: 'Não foi possível excluir a movimentação.' }),
        'OK',
        { duration: 5000 },
      );
    } finally {
      this.submitting.set(false);
    }
  }

  private initialKind(): SupportedTransactionKind {
    const kind = this.transaction?.kind ?? this.data?.initialKind ?? 'EXPENSE';
    return kind === 'SETTLEMENT' ? 'EXPENSE' : kind;
  }

  private applyKindValidators(kind: SupportedTransactionKind): void {
    const { categoryId, destinationAccountId } = this.form.controls;
    if (kind === 'TRANSFER') {
      categoryId.clearValidators();
      destinationAccountId.setValidators([Validators.required, this.differentAccountValidator]);
    } else {
      categoryId.setValidators(Validators.required);
      destinationAccountId.clearValidators();
      destinationAccountId.reset('');
    }
    categoryId.updateValueAndValidity();
    destinationAccountId.updateValueAndValidity();
  }

  private readonly differentAccountValidator = (
    control: AbstractControl<string>,
  ): ValidationErrors | null =>
    control.value && control.value === this.form?.controls.accountId.value
      ? { sameAccount: true }
      : null;

  private toInput(): TransactionInput {
    const value = this.form.getRawValue();
    const isTransfer = value.kind === 'TRANSFER';
    return {
      kind: value.kind,
      description: value.description.trim(),
      amount: parseAmountInput(value.amount) ?? 0,
      date: toIsoDate(value.date as Date),
      dueDate: value.status === 'PENDING' && value.dueDate ? toIsoDate(value.dueDate) : null,
      status: value.status,
      categoryId: isTransfer ? null : value.categoryId,
      accountId: value.accountId,
      destinationAccountId: isTransfer ? value.destinationAccountId : null,
      notes: value.notes.trim() || null,
    };
  }
}
