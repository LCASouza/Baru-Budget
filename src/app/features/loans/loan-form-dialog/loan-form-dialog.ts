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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CurrencyPipe } from '@angular/common';
import { FinancialContextService } from '../../../core/context/financial-context.service';
import { describeDataError } from '../../../core/supabase/data-error';
import { parseIsoDate, toIsoDate } from '../../../shared/dates/iso-date';
import { formatRateInput, parseRateInput } from '../../../shared/finance/rate';
import { formatAmountInput, parseAmountInput } from '../../../shared/money/money';
import { AccountsStore } from '../../accounts/accounts.store';
import { CategoriesStore } from '../../categories/categories.store';
import {
  INTEREST_PERIODS,
  INTEREST_PERIOD_LABELS,
  InterestPeriod,
  LOAN_INTEREST_MODELS,
  LOAN_INTEREST_MODEL_DESCRIPTIONS,
  LOAN_INTEREST_MODEL_LABELS,
  LoanInterestModel,
  buildSchedule,
  monthlyRate,
  scheduleTotals,
} from '../loan-math';
import { LoanInput, LoanView } from '../loan.model';
import { LoansStore } from '../loans.store';

export interface LoanFormData {
  readonly loan?: LoanView;
}

function amountValidator(control: AbstractControl<string>): ValidationErrors | null {
  const amount = parseAmountInput(control.value);
  return amount === null || amount <= 0 ? { amount: true } : null;
}

function nonNegativeAmountValidator(control: AbstractControl<string>): ValidationErrors | null {
  const amount = parseAmountInput(control.value);
  return amount === null || amount < 0 ? { amount: true } : null;
}

function rateValidator(control: AbstractControl<string>): ValidationErrors | null {
  const rate = parseRateInput(control.value);
  return rate === null || rate < 0 || rate >= 100 ? { rate: true } : null;
}

@Component({
  selector: 'app-loan-form-dialog',
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
    MatDialogModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './loan-form-dialog.html',
  styleUrl: './loan-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoanFormDialog {
  private readonly dialogRef = inject(MatDialogRef<LoanFormDialog, 'saved'>);
  private readonly data = inject<LoanFormData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly store = inject(LoansStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly accountsStore = inject(AccountsStore);
  private readonly categoriesStore = inject(CategoriesStore);
  private readonly context = inject(FinancialContextService);

  protected readonly loan = this.data?.loan?.loan ?? null;
  protected readonly isEdit = this.loan !== null;
  protected readonly models = LOAN_INTEREST_MODELS;
  protected readonly modelLabels = LOAN_INTEREST_MODEL_LABELS;
  protected readonly modelDescriptions = LOAN_INTEREST_MODEL_DESCRIPTIONS;
  protected readonly periods = INTEREST_PERIODS;
  protected readonly periodLabels = INTEREST_PERIOD_LABELS;
  protected readonly submitting = signal(false);

  protected readonly form = this.formBuilder.group({
    description: [this.loan?.description ?? '', [Validators.required, Validators.maxLength(120)]],
    lender: [this.loan?.lender ?? '', Validators.maxLength(80)],
    accountId: [this.loan?.account_id ?? '', Validators.required],
    categoryId: [this.loan?.category_id ?? '', Validators.required],
    disbursementCategoryId: [this.loan?.disbursement_category_id ?? ''],
    principal: [
      this.loan ? formatAmountInput(this.loan.principal) : '',
      [Validators.required, amountValidator],
    ],
    interestRate: [
      this.loan ? formatRateInput(this.loan.interest_rate) : '0,00',
      [Validators.required, rateValidator],
    ],
    insuranceAmount: [
      this.loan ? formatAmountInput(this.loan.insurance_amount) : '0,00',
      [Validators.required, nonNegativeAmountValidator],
    ],
    feeAmount: [
      this.loan ? formatAmountInput(this.loan.fee_amount) : '0,00',
      [Validators.required, nonNegativeAmountValidator],
    ],
    interestPeriod: this.formBuilder.control<InterestPeriod>(this.loan?.interest_period ?? 'MONTHLY'),
    interestModel: this.formBuilder.control<LoanInterestModel>(
      this.loan?.interest_model ?? 'PRICE',
      Validators.required,
    ),
    installmentCount: this.formBuilder.control<number>(this.loan?.installment_count ?? 12, [
      Validators.required,
      Validators.min(1),
      Validators.max(480),
    ]),
    startDate: this.formBuilder.control<Date | null>(
      this.loan ? parseIsoDate(this.loan.start_date) : new Date(),
      Validators.required,
    ),
    firstDueDate: this.formBuilder.control<Date | null>(
      this.loan ? parseIsoDate(this.loan.first_due_date) : null,
      Validators.required,
    ),
    householdId: [this.loan?.household_id ?? ''],
    notes: [this.loan?.notes ?? '', Validators.maxLength(1000)],
  });

  private readonly principal = toSignal(this.form.controls.principal.valueChanges, {
    initialValue: this.form.controls.principal.value,
  });
  private readonly rate = toSignal(this.form.controls.interestRate.valueChanges, {
    initialValue: this.form.controls.interestRate.value,
  });
  private readonly period = toSignal(this.form.controls.interestPeriod.valueChanges, {
    initialValue: this.form.controls.interestPeriod.value,
  });
  private readonly model = toSignal(this.form.controls.interestModel.valueChanges, {
    initialValue: this.form.controls.interestModel.value,
  });
  private readonly count = toSignal(this.form.controls.installmentCount.valueChanges, {
    initialValue: this.form.controls.installmentCount.value,
  });

  /** Live preview of the instalment, the total and the interest. */
  protected readonly preview = computed(() => {
    const principal = parseAmountInput(this.principal() ?? '');
    const rate = parseRateInput(this.rate() ?? '');
    const count = this.count();
    if (principal === null || principal <= 0 || rate === null || !count || count < 1) {
      return null;
    }
    const model = this.model();
    const schedule = buildSchedule(principal, monthlyRate(rate, this.period(), model), count, model);
    if (schedule.length === 0) {
      return null;
    }
    const totals = scheduleTotals(schedule);
    return {
      first: schedule[0].amount,
      last: schedule[schedule.length - 1].amount,
      varies: schedule[0].amount !== schedule[schedule.length - 1].amount,
      total: totals.total,
      interest: totals.interest,
      count,
    };
  });

  protected readonly accounts = computed(() =>
    this.accountsStore.accounts().filter((a) => a.active || a.id === this.loan?.account_id),
  );
  protected readonly expenseCategories = computed(() =>
    this.categoriesStore.ofKind('EXPENSE').filter((c) => c.active || c.id === this.loan?.category_id),
  );
  protected readonly incomeCategories = computed(() =>
    this.categoriesStore
      .ofKind('INCOME')
      .filter((c) => c.active || c.id === this.loan?.disbursement_category_id),
  );
  protected readonly householdOptions = this.context.households;
  protected readonly showHouseholdField = computed(
    () => this.context.context().kind !== 'shared' && this.householdOptions().length > 0,
  );

  protected async save(): Promise<void> {
    if (this.submitting()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const input: LoanInput = {
      description: value.description.trim(),
      lender: value.lender.trim() || null,
      accountId: value.accountId,
      categoryId: value.categoryId,
      disbursementCategoryId: value.disbursementCategoryId || null,
      householdId: value.householdId || null,
      principal: parseAmountInput(value.principal) ?? 0,
      interestRate: parseRateInput(value.interestRate) ?? 0,
      interestPeriod: value.interestPeriod,
      interestModel: value.interestModel,
      installmentCount: value.installmentCount,
      startDate: toIsoDate(value.startDate as Date),
      firstDueDate: toIsoDate(value.firstDueDate as Date),
      insuranceAmount: parseAmountInput(value.insuranceAmount) ?? 0,
      feeAmount: parseAmountInput(value.feeAmount) ?? 0,
      notes: value.notes.trim() || null,
    };

    this.submitting.set(true);
    try {
      if (this.loan) {
        await this.store.update(this.loan.id, input);
      } else {
        await this.store.create(input);
      }
      this.dialogRef.close('saved');
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, { fallback: 'Não foi possível salvar o empréstimo.' }),
        'OK',
        { duration: 5000 },
      );
    } finally {
      this.submitting.set(false);
    }
  }

  /** The store loads on demand, so the screen that shows it asks for it. */
  constructor() {
    this.store.activate();
  }
}
