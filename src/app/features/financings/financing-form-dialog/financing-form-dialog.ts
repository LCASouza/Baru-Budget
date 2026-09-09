import { CurrencyPipe } from '@angular/common';
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
import { FinancialContextService } from '../../../core/context/financial-context.service';
import { describeDataError } from '../../../core/supabase/data-error';
import { parseIsoDate, toIsoDate } from '../../../shared/dates/iso-date';
import { formatRateInput, parseRateInput } from '../../../shared/finance/rate';
import { formatAmountInput, parseAmountInput } from '../../../shared/money/money';
import { AccountsStore } from '../../accounts/accounts.store';
import { CategoriesStore } from '../../categories/categories.store';
import {
  FINANCING_SYSTEMS,
  FINANCING_SYSTEM_DESCRIPTIONS,
  FINANCING_SYSTEM_LABELS,
  FinancingSystem,
  INTEREST_PERIODS,
  INTEREST_PERIOD_LABELS,
  InterestPeriod,
  buildSchedule,
  monthlyRate,
  scheduleTotals,
} from '../financing-math';
import { FinancingInput, FinancingView } from '../financing.model';
import { FinancingsStore } from '../financings.store';

export interface FinancingFormData {
  readonly financing?: FinancingView;
}

function amountValidator(control: AbstractControl<string>): ValidationErrors | null {
  const amount = parseAmountInput(control.value);
  return amount === null || amount <= 0 ? { amount: true } : null;
}

function nonNegativeValidator(control: AbstractControl<string>): ValidationErrors | null {
  const amount = parseAmountInput(control.value);
  return amount === null || amount < 0 ? { amount: true } : null;
}

function nonNegativeAmountValidator(control: AbstractControl<string>): ValidationErrors | null {
  const amount = parseAmountInput(control.value);
  return amount === null || amount < 0 ? { amount: true } : null;
}

function rateValidator(control: AbstractControl<string>): ValidationErrors | null {
  const rate = parseRateInput(control.value);
  return rate === null || rate < 0 || rate >= 100 ? { rate: true } : null;
}

/** The down payment has to leave something to finance. */
function downPaymentBelowAsset(group: AbstractControl): ValidationErrors | null {
  const assetValue = parseAmountInput(group.get('assetValue')?.value ?? '');
  const downPayment = parseAmountInput(group.get('downPayment')?.value ?? '');
  if (assetValue === null || downPayment === null) {
    return null;
  }
  return downPayment >= assetValue ? { downPaymentTooHigh: true } : null;
}

@Component({
  selector: 'app-financing-form-dialog',
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
  templateUrl: './financing-form-dialog.html',
  styleUrl: './financing-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinancingFormDialog {
  private readonly dialogRef = inject(MatDialogRef<FinancingFormDialog, 'saved'>);
  private readonly data = inject<FinancingFormData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly store = inject(FinancingsStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly accountsStore = inject(AccountsStore);
  private readonly categoriesStore = inject(CategoriesStore);
  private readonly context = inject(FinancialContextService);

  protected readonly financing = this.data?.financing?.financing ?? null;
  protected readonly isEdit = this.financing !== null;
  protected readonly systems = FINANCING_SYSTEMS;
  protected readonly systemLabels = FINANCING_SYSTEM_LABELS;
  protected readonly systemDescriptions = FINANCING_SYSTEM_DESCRIPTIONS;
  protected readonly periods = INTEREST_PERIODS;
  protected readonly periodLabels = INTEREST_PERIOD_LABELS;
  protected readonly submitting = signal(false);

  protected readonly form = this.formBuilder.group(
    {
      description: [
        this.financing?.description ?? '',
        [Validators.required, Validators.maxLength(120)],
      ],
      institution: [this.financing?.institution ?? '', Validators.maxLength(80)],
      accountId: [this.financing?.account_id ?? '', Validators.required],
      categoryId: [this.financing?.category_id ?? '', Validators.required],
      downPaymentCategoryId: [this.financing?.down_payment_category_id ?? ''],
      assetValue: [
        this.financing ? formatAmountInput(this.financing.asset_value) : '',
        [Validators.required, amountValidator],
      ],
      downPayment: [
        formatAmountInput(this.financing?.down_payment ?? 0),
        [Validators.required, nonNegativeValidator],
      ],
      interestRate: [
        this.financing ? formatRateInput(this.financing.interest_rate) : '0,00',
        [Validators.required, rateValidator],
      ],
      insuranceAmount: [
        this.financing ? formatAmountInput(this.financing.insurance_amount) : '0,00',
        [Validators.required, nonNegativeAmountValidator],
      ],
      feeAmount: [
        this.financing ? formatAmountInput(this.financing.fee_amount) : '0,00',
        [Validators.required, nonNegativeAmountValidator],
      ],
      interestPeriod: this.formBuilder.control<InterestPeriod>(
        this.financing?.interest_period ?? 'MONTHLY',
      ),
      system: this.formBuilder.control<FinancingSystem>(
        this.financing?.system ?? 'PRICE',
        Validators.required,
      ),
      installmentCount: this.formBuilder.control<number>(this.financing?.installment_count ?? 48, [
        Validators.required,
        Validators.min(1),
        Validators.max(480),
      ]),
      acquisitionDate: this.formBuilder.control<Date | null>(
        this.financing ? parseIsoDate(this.financing.acquisition_date) : new Date(),
        Validators.required,
      ),
      firstDueDate: this.formBuilder.control<Date | null>(
        this.financing ? parseIsoDate(this.financing.first_due_date) : null,
        Validators.required,
      ),
      householdId: [this.financing?.household_id ?? ''],
      notes: [this.financing?.notes ?? '', Validators.maxLength(1000)],
    },
    { validators: downPaymentBelowAsset },
  );

  private readonly assetValue = toSignal(this.form.controls.assetValue.valueChanges, {
    initialValue: this.form.controls.assetValue.value,
  });
  private readonly downPayment = toSignal(this.form.controls.downPayment.valueChanges, {
    initialValue: this.form.controls.downPayment.value,
  });
  private readonly rate = toSignal(this.form.controls.interestRate.valueChanges, {
    initialValue: this.form.controls.interestRate.value,
  });
  private readonly period = toSignal(this.form.controls.interestPeriod.valueChanges, {
    initialValue: this.form.controls.interestPeriod.value,
  });
  private readonly system = toSignal(this.form.controls.system.valueChanges, {
    initialValue: this.form.controls.system.value,
  });
  private readonly count = toSignal(this.form.controls.installmentCount.valueChanges, {
    initialValue: this.form.controls.installmentCount.value,
  });

  /** Live preview of the financed amount, the instalments and the interest. */
  protected readonly preview = computed(() => {
    const assetValue = parseAmountInput(this.assetValue() ?? '');
    const downPayment = parseAmountInput(this.downPayment() ?? '') ?? 0;
    const rate = parseRateInput(this.rate() ?? '');
    const count = this.count();
    if (assetValue === null || rate === null || !count || count < 1) {
      return null;
    }
    const financed = Math.round((assetValue - downPayment) * 100) / 100;
    if (financed <= 0) {
      return null;
    }
    const system = this.system();
    const schedule = buildSchedule(financed, monthlyRate(rate, this.period()), count, system);
    if (schedule.length === 0) {
      return null;
    }
    const totals = scheduleTotals(schedule);
    return {
      financed,
      downPayment,
      first: schedule[0].amount,
      last: schedule[schedule.length - 1].amount,
      varies: schedule[0].amount !== schedule[schedule.length - 1].amount,
      total: Math.round((totals.total + downPayment) * 100) / 100,
      interest: totals.interest,
      count,
    };
  });

  protected readonly accounts = computed(() =>
    this.accountsStore.accounts().filter((a) => a.active || a.id === this.financing?.account_id),
  );
  protected readonly expenseCategories = computed(() =>
    this.categoriesStore
      .ofKind('EXPENSE')
      .filter((c) => c.active || c.id === this.financing?.category_id),
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
    const input: FinancingInput = {
      description: value.description.trim(),
      institution: value.institution.trim() || null,
      accountId: value.accountId,
      categoryId: value.categoryId,
      downPaymentCategoryId: value.downPaymentCategoryId || null,
      householdId: value.householdId || null,
      assetValue: parseAmountInput(value.assetValue) ?? 0,
      downPayment: parseAmountInput(value.downPayment) ?? 0,
      interestRate: parseRateInput(value.interestRate) ?? 0,
      interestPeriod: value.interestPeriod,
      system: value.system,
      installmentCount: value.installmentCount,
      acquisitionDate: toIsoDate(value.acquisitionDate as Date),
      firstDueDate: toIsoDate(value.firstDueDate as Date),
      insuranceAmount: parseAmountInput(value.insuranceAmount) ?? 0,
      feeAmount: parseAmountInput(value.feeAmount) ?? 0,
      notes: value.notes.trim() || null,
    };

    this.submitting.set(true);
    try {
      if (this.financing) {
        await this.store.update(this.financing.id, input);
      } else {
        await this.store.create(input);
      }
      this.dialogRef.close('saved');
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, { fallback: 'Não foi possível salvar o financiamento.' }),
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
