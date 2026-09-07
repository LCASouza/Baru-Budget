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
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FinancialContextService } from '../../../core/context/financial-context.service';
import { PaymentMethod } from '../../../core/finance/payment-method';
import { describeDataError } from '../../../core/supabase/data-error';
import { formatAmountInput, parseAmountInput } from '../../../shared/money/money';
import { AccountsStore } from '../../accounts/accounts.store';
import { CardsStore } from '../../cards/cards.store';
import { CategoriesStore } from '../../categories/categories.store';
import {
  RECURRENCE_FREQUENCIES,
  RECURRENCE_FREQUENCY_LABELS,
  RECURRENCE_TYPE_LABELS,
  RecurrenceFrequency,
  RecurrenceType,
} from '../recurrence';
import { RecurrenceInput, RecurrenceView } from '../recurrence.model';
import { RecurrencesStore } from '../recurrences.store';

export interface RecurrenceFormData {
  readonly type: RecurrenceType;
  readonly template?: RecurrenceView;
}

const DAYS: readonly number[] = Array.from({ length: 31 }, (_, index) => index + 1);
const MONTHS: readonly { value: number; label: string }[] = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
].map((label, index) => ({ value: index + 1, label }));

function amountValidator(control: AbstractControl<string>): ValidationErrors | null {
  const amount = parseAmountInput(control.value);
  return amount === null || amount <= 0 ? { amount: true } : null;
}

@Component({
  selector: 'app-recurrence-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './recurrence-form-dialog.html',
  styleUrl: './recurrence-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurrenceFormDialog {
  private readonly dialogRef = inject(MatDialogRef<RecurrenceFormDialog, 'saved'>);
  protected readonly data = inject<RecurrenceFormData>(MAT_DIALOG_DATA);
  private readonly store = inject(RecurrencesStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly categoriesStore = inject(CategoriesStore);
  private readonly accountsStore = inject(AccountsStore);
  private readonly cardsStore = inject(CardsStore);
  private readonly context = inject(FinancialContextService);

  protected readonly template = this.data.template ?? null;
  protected readonly isEdit = this.template !== null;
  protected readonly isExpense = this.data.type === 'EXPENSE';
  protected readonly typeLabel = RECURRENCE_TYPE_LABELS[this.data.type];
  protected readonly days = DAYS;
  protected readonly months = MONTHS;
  protected readonly frequencies = RECURRENCE_FREQUENCIES;
  protected readonly frequencyLabels = RECURRENCE_FREQUENCY_LABELS;
  protected readonly submitting = signal(false);

  protected readonly form = this.formBuilder.group({
    description: [this.template?.description ?? '', [Validators.required, Validators.maxLength(120)]],
    categoryId: [this.template?.categoryId ?? '', Validators.required],
    paymentMethod: this.formBuilder.control<PaymentMethod>(
      this.template?.creditCardId ? 'CARD' : 'ACCOUNT',
    ),
    accountId: [this.template?.accountId ?? ''],
    creditCardId: [this.template?.creditCardId ?? ''],
    defaultAmount: [
      this.template ? formatAmountInput(this.template.defaultAmount) : '',
      [Validators.required, amountValidator],
    ],
    day: this.formBuilder.control<number>(this.template?.day ?? 5, Validators.required),
    frequency: this.formBuilder.control<RecurrenceFrequency>(this.template?.frequency ?? 'MONTHLY'),
    anchorMonth: this.formBuilder.control<number | null>(this.template?.anchorMonth ?? null),
    householdId: [this.template?.householdId ?? ''],
    notes: [this.template?.notes ?? '', Validators.maxLength(1000)],
  });

  private readonly method = toSignal(this.form.controls.paymentMethod.valueChanges, {
    initialValue: this.form.controls.paymentMethod.value,
  });
  private readonly frequency = toSignal(this.form.controls.frequency.valueChanges, {
    initialValue: this.form.controls.frequency.value,
  });

  protected readonly usesCard = computed(() => this.isExpense && this.method() === 'CARD');
  protected readonly isYearly = computed(() => this.frequency() === 'YEARLY');
  protected readonly showMethodToggle = computed(
    () => this.isExpense && this.cardsStore.activeCards().length > 0,
  );

  protected readonly categories = computed(() => {
    const current = this.template?.categoryId ?? null;
    return this.categoriesStore
      .ofKind(this.isExpense ? 'EXPENSE' : 'INCOME')
      .filter((category) => category.active || category.id === current);
  });
  protected readonly accounts = computed(() =>
    this.accountsStore
      .accounts()
      .filter((account) => account.active || account.id === this.template?.accountId),
  );
  protected readonly cards = computed(() =>
    this.cardsStore
      .cards()
      .filter((card) => card.active || card.id === this.template?.creditCardId),
  );
  protected readonly householdOptions = this.context.households;
  protected readonly showHouseholdField = computed(
    () => this.context.context().kind !== 'shared' && this.householdOptions().length > 0,
  );

  constructor() {
    this.form.controls.paymentMethod.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.applyShape());
    this.form.controls.frequency.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.applyShape());
    this.applyShape();
  }

  protected async save(): Promise<void> {
    if (this.submitting()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const usesCard = this.usesCard();
    const input: RecurrenceInput = {
      description: value.description.trim(),
      categoryId: value.categoryId,
      accountId: usesCard ? null : value.accountId,
      creditCardId: usesCard ? value.creditCardId : null,
      householdId: value.householdId || null,
      defaultAmount: parseAmountInput(value.defaultAmount) ?? 0,
      day: value.day,
      frequency: value.frequency,
      anchorMonth: value.frequency === 'YEARLY' ? value.anchorMonth : null,
      notes: value.notes.trim() || null,
    };

    this.submitting.set(true);
    try {
      if (this.template) {
        await this.store.update(this.template.id, this.data.type, input);
      } else {
        await this.store.create(this.data.type, input);
      }
      this.dialogRef.close('saved');
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, { fallback: 'Não foi possível salvar o modelo.' }),
        'OK',
        { duration: 5000 },
      );
    } finally {
      this.submitting.set(false);
    }
  }

  // Exactly one origin, and a reference month only for yearly templates.
  private applyShape(): void {
    const { accountId, creditCardId, anchorMonth } = this.form.controls;
    accountId.clearValidators();
    creditCardId.clearValidators();
    anchorMonth.clearValidators();

    if (this.usesCard()) {
      creditCardId.setValidators(Validators.required);
      accountId.reset('', { emitEvent: false });
    } else {
      accountId.setValidators(Validators.required);
      creditCardId.reset('', { emitEvent: false });
    }
    if (this.isYearly()) {
      anchorMonth.setValidators(Validators.required);
    } else {
      anchorMonth.reset(null, { emitEvent: false });
    }

    accountId.updateValueAndValidity({ emitEvent: false });
    creditCardId.updateValueAndValidity({ emitEvent: false });
    anchorMonth.updateValueAndValidity({ emitEvent: false });
  }
}
