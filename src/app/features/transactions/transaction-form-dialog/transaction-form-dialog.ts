import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
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
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FinancialContextService } from '../../../core/context/financial-context.service';
import { PaymentMethod } from '../../../core/finance/payment-method';
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
import { CardsStore } from '../../cards/cards.store';
import { invoiceDueDateFor, invoiceLabel } from '../../cards/invoice';
import {
  MAX_INSTALLMENTS,
  cardInstallmentDueDates,
  splitInstallmentAmounts,
} from '../../installments/installment';
import { TransactionFormData, TransactionFormResult } from '../open-transaction-dialog';
import { SupportedTransactionKind, TransactionInput } from '../transaction.model';
import { TransactionsStore } from '../transactions.store';
import { SettlementsRepository } from '../../settlements/settlements.repository';
import { SettlementsStore } from '../../settlements/settlements.store';
import { isSplitValid, remainingToAllocate, splitEqually } from '../../settlements/allocation';

interface SelectOption {
  readonly id: string;
  readonly name: string;
}

interface SplitRow {
  readonly userId: string;
  readonly amount: string;
}

interface AuditEntry {
  readonly label: string;
  readonly name: string;
  readonly at: string;
}

// Card purchases have no pending state: the pendency of a card is the invoice.
const CARD_PURCHASE_STATUSES: readonly TransactionStatus[] = ['PAID', 'CANCELLED'];

function amountValidator(control: AbstractControl<string>): ValidationErrors | null {
  const amount = parseAmountInput(control.value);
  return amount === null || amount <= 0 ? { amount: true } : null;
}

@Component({
  selector: 'app-transaction-form-dialog',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    CurrencyPipe,
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
  private readonly cardsStore = inject(CardsStore);
  protected readonly context = inject(FinancialContextService);
  private readonly profiles = inject(ProfileRepository);
  private readonly settlementsStore = inject(SettlementsStore);
  private readonly allocationsRepository = inject(SettlementsRepository);

  protected readonly transaction = this.data?.transaction ?? null;
  private readonly invoicePayment = this.data?.invoicePayment ?? null;
  protected readonly isEdit = this.transaction !== null;
  protected readonly readonly = this.transaction
    ? !this.context.canManageOwner(this.transaction.owner_user_id)
    : !this.context.canManage();
  protected readonly submitting = signal(false);

  protected readonly form = this.formBuilder.group({
    kind: this.formBuilder.control<SupportedTransactionKind>(
      this.initialKind(),
      Validators.required,
    ),
    paymentMethod: this.formBuilder.control<PaymentMethod>(this.initialMethod()),
    description: [
      this.transaction?.description ?? (this.invoicePayment ? 'Pagamento da fatura' : ''),
      [Validators.required, Validators.maxLength(120)],
    ],
    amount: [
      this.initialAmount(),
      [Validators.required, amountValidator],
    ],
    date: this.formBuilder.control<Date | null>(
      this.transaction ? parseIsoDate(this.transaction.date) : new Date(),
      Validators.required,
    ),
    categoryId: [this.transaction?.category_id ?? ''],
    accountId: [this.transaction?.account_id ?? ''],
    destinationAccountId: [this.transaction?.destination_account_id ?? ''],
    creditCardId: [this.transaction?.credit_card_id ?? this.invoicePayment?.cardId ?? ''],
    invoiceDueDate: [
      this.transaction?.invoice_due_date ?? this.invoicePayment?.invoiceDueDate ?? '',
    ],
    installmentCount: this.formBuilder.control<number>(1),
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
  private readonly method = toSignal(this.form.controls.paymentMethod.valueChanges, {
    initialValue: this.form.controls.paymentMethod.value,
  });
  private readonly status = toSignal(this.form.controls.status.valueChanges, {
    initialValue: this.form.controls.status.value,
  });
  private readonly selectedCardId = toSignal(this.form.controls.creditCardId.valueChanges, {
    initialValue: this.form.controls.creditCardId.value,
  });
  private readonly selectedDate = toSignal(this.form.controls.date.valueChanges, {
    initialValue: this.form.controls.date.value,
  });
  private readonly installmentCount = toSignal(this.form.controls.installmentCount.valueChanges, {
    initialValue: this.form.controls.installmentCount.value,
  });
  private readonly amountValue = toSignal(this.form.controls.amount.valueChanges, {
    initialValue: this.form.controls.amount.value,
  });

  protected readonly isTransfer = computed(() => this.kind() === 'TRANSFER');
  protected readonly usesCard = computed(() => this.method() === 'CARD');
  protected readonly isCardPurchase = computed(() => this.kind() === 'EXPENSE' && this.usesCard());
  protected readonly isInvoicePayment = computed(() => this.isTransfer() && this.usesCard());
  protected readonly showMethodToggle = computed(
    () => this.kind() !== 'INCOME' && this.cardsStore.activeCards().length > 0,
  );
  protected readonly isPending = computed(
    () => this.status() === 'PENDING' && !this.isCardPurchase(),
  );

  // Instalments exist only when creating an expense; editing one instalment never
  // changes the others.
  protected readonly canSplit = computed(() => !this.isEdit && this.kind() === 'EXPENSE');
  protected readonly isSplit = computed(() => this.canSplit() && this.installmentCount() > 1);
  protected readonly installmentOptions = Array.from(
    { length: MAX_INSTALLMENTS },
    (_, index) => index + 1,
  );
  protected readonly installmentGroupId = this.transaction?.installment_group_id ?? null;

  protected readonly installmentPreview = computed(() => {
    const count = this.installmentCount();
    const total = parseAmountInput(this.amountValue() ?? '');
    const date = this.selectedDate();
    if (!this.isSplit() || total === null || total <= 0 || !date) {
      return null;
    }
    const amounts = splitInstallmentAmounts(total, count);
    if (amounts.length === 0) {
      return null;
    }
    const card = this.usesCard() ? this.cardsStore.byId().get(this.selectedCardId()) : undefined;
    const firstCompetence = card
      ? cardInstallmentDueDates(toIsoDate(date), card.closing_day, card.due_day, 1)[0]
      : toIsoDate(date);
    return {
      count,
      firstAmount: amounts[0],
      otherAmount: amounts[amounts.length - 1],
      differs: amounts[0] !== amounts[amounts.length - 1],
      firstCompetence,
      firstLabel: card ? invoiceLabel(firstCompetence) : null,
    };
  });

  protected readonly statusOptions = computed(() => {
    const statuses = this.isCardPurchase() ? CARD_PURCHASE_STATUSES : TRANSACTION_STATUSES;
    return statuses.map((status) => ({
      value: status,
      label: transactionStatusLabel(status, this.kind()),
    }));
  });

  protected readonly cards = computed<readonly SelectOption[]>(() => {
    const current = this.transaction?.credit_card_id ?? null;
    return this.cardsStore
      .cards()
      .filter((card) => card.active || card.id === current)
      .map((card) => ({ id: card.id, name: card.name }));
  });

  /** Invoices of the selected card, for an invoice payment. */
  protected readonly invoices = computed(() => {
    const cardId = this.selectedCardId();
    if (!cardId) {
      return [];
    }
    const invoices = this.cardsStore
      .invoicesOf(cardId)
      .map((invoice) => ({ dueDate: invoice.dueDate, label: invoice.label }));
    const current = this.form.controls.invoiceDueDate.value;
    if (current && !invoices.some((invoice) => invoice.dueDate === current)) {
      invoices.unshift({ dueDate: current, label: invoiceLabel(current) });
    }
    return invoices;
  });

  /** Invoice a new card purchase will fall into, mirroring the database rule. */
  protected readonly invoicePreview = computed(() => {
    const cardId = this.selectedCardId();
    const date = this.selectedDate();
    if (!this.isCardPurchase() || !cardId || !date) {
      return null;
    }
    const card = this.cardsStore.byId().get(cardId);
    if (!card) {
      return null;
    }
    const dueDate = invoiceDueDateFor(toIsoDate(date), card.closing_day, card.due_day);
    return { dueDate, label: invoiceLabel(dueDate) };
  });

  // The household field is offered in the personal and household contexts to
  // users who belong to at least one household. In a shared context the grantee
  // is not a member of the owner households, so the value is only preserved.
  protected readonly householdOptions = this.context.households;
  protected readonly showHouseholdField = computed(
    () => this.context.context().kind !== 'shared' && this.householdOptions().length > 0,
  );

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
        options.push({
          id,
          name: this.ownerName() ? `Conta de ${this.ownerName()}` : 'Conta de outro usuário',
        });
      }
    }
    return options;
  });

  protected readonly hasAccounts = computed(() => this.accountsStore.activeAccounts().length > 0);
  protected readonly needsAccount = computed(() => !this.isCardPurchase());
  protected readonly accountsLoading = computed(
    () => this.accountsStore.isLoading() && !this.accountsStore.loaded(),
  );
  protected readonly ownerName = computed(() =>
    this.transaction
      ? (this.context.memberNameById().get(this.transaction.owner_user_id) ?? null)
      : null,
  );

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
      entries.push({
        label: 'Registrado por',
        name: nameOf(transaction.created_by),
        at: transaction.created_at,
      });
    }
    if (
      transaction.updated_by !== transaction.owner_user_id &&
      transaction.updated_by !== transaction.created_by
    ) {
      entries.push({
        label: 'Alterado por',
        name: nameOf(transaction.updated_by),
        at: transaction.updated_at,
      });
    }
    return entries;
  });

  // Splitting an expense between people: the payer's own share is a row like any
  // other, and the rows always add up to the amount.
  protected readonly splitRows = signal<SplitRow[]>([]);
  private splitLoaded = false;

  protected readonly canShare = computed(
    () => !this.readonly && this.kind() === 'EXPENSE' && this.settlementsStore.people().length > 0,
  );
  protected readonly splitPeople = this.settlementsStore.people;
  private readonly splitAmounts = computed(() =>
    this.splitRows()
      .map((row) => parseAmountInput(row.amount))
      .filter((amount): amount is number => amount !== null),
  );
  protected readonly splitRemaining = computed(() =>
    remainingToAllocate(parseAmountInput(this.amountValue() ?? '') ?? 0, this.splitAmounts()),
  );
  protected readonly splitValid = computed(() => {
    const rows = this.splitRows();
    if (rows.length === 0) {
      return true;
    }
    if (rows.some((row) => !row.userId || parseAmountInput(row.amount) === null)) {
      return false;
    }
    const ids = rows.map((row) => row.userId);
    if (new Set(ids).size !== ids.length) {
      return false;
    }
    return isSplitValid(parseAmountInput(this.amountValue() ?? '') ?? 0, this.splitAmounts());
  });

  private readonly existingAllocations = resource({
    params: () => this.transaction?.id,
    loader: ({ params: id }) => this.allocationsRepository.listAllocations(id),
  });

  protected ownerLabel(userId: string): string {
    if (userId === this.context.dataOwnerId()) {
      return 'Você';
    }
    return (
      this.settlementsStore.people().find((person) => person.id === userId)?.name ?? 'Usuário'
    );
  }

  protected addSplitRow(): void {
    this.splitRows.update((rows) => [...rows, { userId: '', amount: '' }]);
  }

  protected removeSplitRow(index: number): void {
    this.splitRows.update((rows) => rows.filter((_, position) => position !== index));
  }

  protected setSplitUser(index: number, userId: string): void {
    this.splitRows.update((rows) =>
      rows.map((row, position) => (position === index ? { ...row, userId } : row)),
    );
  }

  protected setSplitAmount(index: number, amount: string): void {
    this.splitRows.update((rows) =>
      rows.map((row, position) => (position === index ? { ...row, amount } : row)),
    );
  }

  /** Splits the amount evenly, making sure the payer has a row of their own. */
  protected splitEvenly(): void {
    const total = parseAmountInput(this.amountValue() ?? '');
    const ownerId = this.context.dataOwnerId();
    if (total === null || total <= 0 || !ownerId) {
      return;
    }
    const rows = this.splitRows().filter((row) => row.userId);
    if (!rows.some((row) => row.userId === ownerId)) {
      rows.unshift({ userId: ownerId, amount: '' });
    }
    const amounts = splitEqually(total, rows.length);
    if (amounts.length === 0) {
      return;
    }
    this.splitRows.set(
      rows.map((row, index) => ({ ...row, amount: formatAmountInput(amounts[index]) })),
    );
  }

  protected clearSplit(): void {
    this.splitRows.set([]);
  }

  constructor() {
    effect(() => {
      if (this.splitLoaded || !this.existingAllocations.hasValue()) {
        return;
      }
      this.splitLoaded = true;
      this.splitRows.set(
        this.existingAllocations
          .value()
          .map((allocation) => ({
            userId: allocation.user_id,
            amount: formatAmountInput(allocation.amount),
          })),
      );
    });
    this.form.controls.kind.valueChanges.pipe(takeUntilDestroyed()).subscribe((kind) => {
      this.form.controls.categoryId.reset('');
      if (kind === 'INCOME') {
        this.form.controls.paymentMethod.setValue('ACCOUNT', { emitEvent: false });
      }
      this.applyShape();
    });
    this.form.controls.paymentMethod.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.applyShape());
    this.form.controls.accountId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.destinationAccountId.updateValueAndValidity());
    this.applyShape();
    if (this.readonly) {
      this.form.disable();
    }
  }

  protected async save(): Promise<void> {
    if (this.submitting() || this.readonly) {
      return;
    }
    if (this.needsAccount() && !this.hasAccounts()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.splitValid()) {
      this.snackBar.open('A divisão precisa somar exatamente o valor da despesa.', 'OK', {
        duration: 5000,
      });
      return;
    }

    const input = this.toInput();
    this.submitting.set(true);
    try {
      if (this.isSplit()) {
        await this.store.createInstallments({
          description: input.description,
          totalAmount: input.amount,
          installmentCount: this.form.controls.installmentCount.value,
          date: input.date,
          categoryId: input.categoryId as string,
          creditCardId: input.creditCardId,
          accountId: input.accountId,
          householdId: input.householdId,
          notes: input.notes,
        });
        this.dialogRef.close('saved');
        return;
      }
      let transactionId: string;
      if (this.transaction) {
        await this.store.update(this.transaction.id, input);
        transactionId = this.transaction.id;
      } else {
        transactionId = (await this.store.create(input)).id;
      }
      await this.saveSplit(transactionId);
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

  protected async removeInstallmentGroup(): Promise<void> {
    const groupId = this.installmentGroupId;
    if (!groupId || this.submitting() || this.readonly) {
      return;
    }
    const confirmed = await confirmAction(this.dialog, {
      title: 'Excluir parcelamento',
      message: `Todas as ${this.transaction?.installment_count} parcelas de "${this.transaction?.description}" serão excluídas, inclusive as já lançadas.`,
      confirmLabel: 'Excluir tudo',
      danger: true,
    });
    if (!confirmed) {
      return;
    }

    this.submitting.set(true);
    try {
      await this.store.removeInstallmentGroup(groupId);
      this.dialogRef.close('deleted');
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, { fallback: 'Não foi possível excluir o parcelamento.' }),
        'OK',
        { duration: 5000 },
      );
    } finally {
      this.submitting.set(false);
    }
  }

  /** Writes the split when it changed; an empty list removes it. */
  private async saveSplit(transactionId: string): Promise<void> {
    const rows = this.splitRows().filter((row) => row.userId);
    const hadSplit = this.existingAllocations.hasValue()
      ? this.existingAllocations.value().length > 0
      : false;
    if (rows.length === 0 && !hadSplit) {
      return;
    }
    await this.store.setAllocations(
      transactionId,
      rows.map((row) => row.userId),
      rows.map((row) => parseAmountInput(row.amount) ?? 0),
    );
  }

  private initialKind(): SupportedTransactionKind {
    if (this.invoicePayment) {
      return 'TRANSFER';
    }
    const kind = this.transaction?.kind ?? this.data?.initialKind ?? 'EXPENSE';
    return kind === 'SETTLEMENT' ? 'EXPENSE' : kind;
  }

  private initialMethod(): PaymentMethod {
    if (this.invoicePayment) {
      return 'CARD';
    }
    return this.transaction?.credit_card_id ? 'CARD' : 'ACCOUNT';
  }

  private initialAmount(): string {
    if (this.transaction) {
      return formatAmountInput(this.transaction.amount);
    }
    return this.invoicePayment ? formatAmountInput(this.invoicePayment.amount) : '';
  }

  // Exactly one origin per transaction, mirroring the database constraint.
  private applyShape(): void {
    const { categoryId, accountId, destinationAccountId, creditCardId, invoiceDueDate, status } =
      this.form.controls;
    const kind = this.form.controls.kind.value;
    const method = this.form.controls.paymentMethod.value;
    const usesCard = method === 'CARD';

    for (const control of [categoryId, accountId, destinationAccountId, creditCardId, invoiceDueDate]) {
      control.clearValidators();
    }

    if (kind === 'TRANSFER') {
      accountId.setValidators(Validators.required);
      categoryId.reset('', { emitEvent: false });
      if (usesCard) {
        creditCardId.setValidators(Validators.required);
        invoiceDueDate.setValidators(Validators.required);
        destinationAccountId.reset('', { emitEvent: false });
      } else {
        destinationAccountId.setValidators([Validators.required, this.differentAccountValidator]);
        creditCardId.reset('', { emitEvent: false });
        invoiceDueDate.reset('', { emitEvent: false });
      }
    } else {
      categoryId.setValidators(Validators.required);
      destinationAccountId.reset('', { emitEvent: false });
      if (kind === 'EXPENSE' && usesCard) {
        creditCardId.setValidators(Validators.required);
        accountId.reset('', { emitEvent: false });
        if (status.value === 'PENDING') {
          status.setValue('PAID', { emitEvent: false });
        }
      } else {
        accountId.setValidators(Validators.required);
        creditCardId.reset('', { emitEvent: false });
        invoiceDueDate.reset('', { emitEvent: false });
      }
    }

    for (const control of [categoryId, accountId, destinationAccountId, creditCardId, invoiceDueDate]) {
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  private readonly differentAccountValidator = (
    control: AbstractControl<string>,
  ): ValidationErrors | null =>
    control.value && control.value === this.form?.controls.accountId.value
      ? { sameAccount: true }
      : null;

  private toInput(): TransactionInput {
    const value = this.form.getRawValue();
    const usesCard = value.paymentMethod === 'CARD';
    const isTransfer = value.kind === 'TRANSFER';
    const isCardPurchase = value.kind === 'EXPENSE' && usesCard;
    const isInvoicePayment = isTransfer && usesCard;
    const date = toIsoDate(value.date as Date);

    return {
      kind: value.kind,
      description: value.description.trim(),
      amount: parseAmountInput(value.amount) ?? 0,
      date,
      dueDate:
        value.status === 'PENDING' && !isCardPurchase && value.dueDate
          ? toIsoDate(value.dueDate)
          : null,
      status: value.status,
      categoryId: isTransfer ? null : value.categoryId,
      accountId: isCardPurchase ? null : value.accountId,
      destinationAccountId: isTransfer && !usesCard ? value.destinationAccountId : null,
      creditCardId: usesCard ? value.creditCardId : null,
      invoiceDueDate: isInvoicePayment
        ? value.invoiceDueDate
        : isCardPurchase
          ? (this.invoicePreview()?.dueDate ?? null)
          : null,
      householdId: value.householdId || null,
      notes: value.notes.trim() || null,
    };
  }

}
