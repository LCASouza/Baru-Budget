import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  MOCK_ACCOUNTS,
  MOCK_CATEGORIES,
  MOCK_ORIGINS,
  MOCK_STATUSES,
  TransactionKindOption,
} from '../transaction-form.mock';

@Component({
  selector: 'app-transaction-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatChipsModule,
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
  private readonly dialogRef = inject(MatDialogRef<TransactionFormDialog>);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly form = this.formBuilder.group({
    kind: this.formBuilder.control<TransactionKindOption>('EXPENSE'),
    description: '',
    amount: '',
    date: this.formBuilder.control<Date | null>(new Date()),
    categoryId: '',
    accountId: '',
    origin: 'CASH',
    status: 'PENDING',
    notes: '',
  });

  private readonly kind = toSignal(this.form.controls.kind.valueChanges, {
    initialValue: this.form.controls.kind.value,
  });

  protected readonly isExpense = computed(() => this.kind() === 'EXPENSE');
  protected readonly categories = computed(() =>
    MOCK_CATEGORIES.filter((category) => category.kind === this.kind()),
  );
  protected readonly accounts = MOCK_ACCOUNTS;
  protected readonly origins = MOCK_ORIGINS;
  protected readonly statuses = MOCK_STATUSES;

  constructor() {
    this.form.controls.kind.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.categoryId.reset());
  }

  protected save(): void {
    this.dialogRef.close();
    this.snackBar.open('Protótipo visual: nenhum dado foi salvo.', 'OK', { duration: 3500 });
  }
}
