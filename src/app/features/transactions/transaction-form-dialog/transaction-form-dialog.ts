import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
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
import { DatePipe } from '@angular/common';
import { FinancialContextService } from '../../../core/context/financial-context.service';
import {
  TRANSACTION_STATUSES,
  TransactionStatus,
  transactionStatusLabel,
} from '../../../core/finance/transaction-status';
import { ProfileRepository } from '../../../core/profile/profile.repository';
import { describeDataError } from '../../../core/supabase/data-error';
import { confirmAction } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { parseIsoDate, toIsoDate } from '../../../shared/dates/iso-date';
import { formatAmountInput, parseAmountInput } from '../../../shared/money/money';
import { AccountsStore } from '../../accounts/accounts.store';
import { CategoriesStore } from '../../categories/categories.store';
import { TransactionFormData, TransactionFormResult } from '../open-transaction-dialog';
import { SupportedTransactionKind, TransactionInput } from '../transaction.model';
import { TransactionsStore } from '../transactions.store';

interface SelectOption {
  readonly id: string;
  readonly name: string;
}

interface AuditEntry {
  readonly label: string;
  readonly name: string;
  readonly at: string;
}

function amountValidator(control: AbstractControl<string>): ValidationErrors | null {
  const amount = parseAmountInput(control.value);
  return amount === null || amount <= 0 ? { amount: true } : null;
}

@Component({
  selector: 'app-transaction-form-dialog',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
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
  private readonly context = inject(FinancialContextService);
  private readonly profiles = inject(ProfileRepository);

  protected readonly transaction = this.data?.transaction ?? null;
  protected readonly isEdit = this.transaction !== null;
  // Editing is allowed for own records and, in a shared context, for the owner's
  // records under MANAGE. Anything else opens read-only.
  protected readonly readonly = this.transaction
    ? !this.context.canManageOwner(this.transaction.owner_user_id)
    : !this.context.canManage();
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
    householdId: [this.transaction?.household_id ?? this.context.householdId() ?? ''],
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
  protected readonly isPending = computed(() => this.status() === 'PENDING');
  protected readonly statusOptions = computed(() =>
    TRANSACTION_STATUSES.map((status) => ({
      value: status,
      label: transactionStatusLabel(status, this.kind()),
    })),
  );

  // The household field is offered in the personal and household contexts to
  // users who belong to at least one household. In a shared context the grantee
  // is not a member of the owner's households, so the value is only preserved.
  protected readonly householdOptions = this.context.households;
  protected readonly showHouseholdField = computed(
    () => this.context.context().kind !== 'shared' && this.householdOptions().length > 0,
  );

  // Inactive records stay selectable only when the transaction already uses them.
  // Records of another household member are not visible; a placeholder keeps the
  // read-only form meaningful.
  protected readonly categories = computed<readonly SelectOption[]>(() => {
    const kind = this.kind();
    if (kind === 'TRANSFER') {
      return [];
    }
    const current = this.transaction?.category_id ?? null;
    const options: SelectOption[] = this.categoriesStore
      .ofKind(kind)
      .filter((category) => category.active || category.id === current);
    if (current && !options.some((option) => option.id === current)) {
      const visible = this.categoriesStore.byId().get(current);
      options.push({ id: current, name: visible?.name ?? 'Categoria de outro usuário' });
    }
    return options;
  });
  protected readonly accounts = computed<readonly SelectOption[]>(() => {
    const current = this.transaction;
    const options: SelectOption[] = this.accountsStore
      .accounts()
      .filter(
        (account) =>
          account.active ||
          account.id === current?.account_id ||
          account.id === current?.destination_account_id,
      );
    for (const id of [current?.account_id, current?.destination_account_id]) {
      if (id && !options.some((option) => option.id === id)) {
        options.push({ id, name: this.ownerName() ? `Conta de ${this.ownerName()}` : 'Conta de outro usuário' });
      }
    }
    return options;
  });
  protected readonly hasAccounts = computed(() => this.accountsStore.activeAccounts().length > 0);
  protected readonly accountsLoading = computed(
    () => this.accountsStore.isLoading() && !this.accountsStore.loaded(),
  );
  protected readonly ownerName = computed(() =>
    this.transaction ? (this.context.memberNameById().get(this.transaction.owner_user_id) ?? null) : null,
  );

  // Basic audit: who registered and who last changed the record, when different
  // from the owner (a user with MANAGE or, for display, the owner in a household).
  private readonly auditResource = resource({
    params: () => {
      const transaction = this.transaction;
      if (!transaction) {
        return undefined;
      }
      const ids = [transaction.created_by, transaction.updated_by].filter(
        (id) => id !== transaction.owner_user_id,
      );
      return ids.length > 0 ? [...new Set(ids)] : undefined;
    },
    loader: ({ params: ids }) => this.profiles.findManyByIds(ids),
  });
  protected readonly auditEntries = computed<readonly AuditEntry[]>(() => {
    const transaction = this.transaction;
    if (!transaction || !this.auditResource.hasValue()) {
      return [];
    }
    const names = new Map(this.auditResource.value().map((p) => [p.id, p.display_name]));
    const nameOf = (id: string) => names.get(id) ?? 'outro usuário';
    const entries: AuditEntry[] = [];
    if (transaction.created_by !== transaction.owner_user_id) {
      entries.push({ label: 'Registrado por', name: nameOf(transaction.created_by), at: transaction.created_at });
    }
    if (transaction.updated_by !== transaction.owner_user_id && transaction.updated_by !== transaction.created_by) {
      entries.push({ label: 'Alterado por', name: nameOf(transaction.updated_by), at: transaction.updated_at });
    }
    return entries;
  });

  constructor() {
    this.form.controls.kind.valueChanges.pipe(takeUntilDestroyed()).subscribe((kind) => {
      this.form.controls.categoryId.reset('');
      this.applyKindValidators(kind);
    });
    this.form.controls.accountId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.destinationAccountId.updateValueAndValidity());
    this.applyKindValidators(this.form.controls.kind.value);
    if (this.readonly) {
      this.form.disable();
    }
  }

  protected async save(): Promise<void> {
    if (this.submitting() || this.readonly || !this.hasAccounts()) {
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
    if (!this.transaction || this.submitting() || this.readonly) {
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
      householdId: value.householdId || null,
      notes: value.notes.trim() || null,
    };
  }
}
