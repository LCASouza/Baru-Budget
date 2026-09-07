import { CurrencyPipe, DatePipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { ViewportService } from '../../../core/layout/viewport.service';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { openTransactionDialog } from '../../transactions/open-transaction-dialog';
import { Transaction } from '../../transactions/transaction.model';
import { INTEREST_PERIOD_LABELS, LOAN_INTEREST_MODEL_LABELS, ScheduleRow } from '../loan-math';
import { LoansStore } from '../loans.store';

interface ScheduleLine extends ScheduleRow {
  readonly transaction: Transaction | null;
  readonly paid: boolean;
  /** Difference between the schedule and what was actually recorded. */
  readonly difference: number;
}

@Component({
  selector: 'app-loan-detail-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    PercentPipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    EmptyState,
  ],
  templateUrl: './loan-detail-page.html',
  styleUrl: './loan-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoanDetailPage {
  /** Bound from the `:id` route parameter. */
  readonly id = input.required<string>();

  protected readonly store = inject(LoansStore);
  private readonly viewport = inject(ViewportService);
  private readonly dialog = inject(MatDialog);

  protected readonly modelLabels = LOAN_INTEREST_MODEL_LABELS;
  protected readonly periodLabels = INTEREST_PERIOD_LABELS;

  protected readonly view = computed(() => this.store.viewOf(this.id()));

  protected readonly lines = computed<readonly ScheduleLine[]>(() => {
    const view = this.view();
    if (!view) {
      return [];
    }
    const byNumber = new Map(
      view.instalments.map((transaction) => [transaction.loan_installment_number, transaction]),
    );
    return view.schedule.map((row) => {
      const transaction = byNumber.get(row.number) ?? null;
      return {
        ...row,
        transaction,
        paid: transaction?.status === 'PAID',
        difference: transaction ? Math.round((transaction.amount - row.amount) * 100) / 100 : 0,
      };
    });
  });

  protected readonly hasDifferences = computed(() =>
    this.lines().some((line) => line.transaction !== null && line.difference !== 0),
  );

  protected async open(transaction: Transaction | null): Promise<void> {
    if (!transaction) {
      return;
    }
    const result = await openTransactionDialog(this.dialog, this.viewport, { transaction });
    if (result) {
      this.store.reload();
    }
  }
}
