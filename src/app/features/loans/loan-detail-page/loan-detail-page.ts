import { CurrencyPipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { ViewportService } from '../../../core/layout/viewport.service';
import { AsyncState } from '../../../shared/components/async-state/async-state';
import { DataColumn, DataRow, DataRows } from '../../../shared/components/data-rows/data-rows';
import { displayAmount, displayDate } from '../../../shared/format/display';
import { openTransactionDialog } from '../../transactions/open-transaction-dialog';
import { Transaction } from '../../transactions/transaction.model';
import { INTEREST_PERIOD_LABELS, LOAN_INTEREST_MODEL_LABELS } from '../loan-math';
import { LoansStore } from '../loans.store';

export const SCHEDULE_COLUMNS: readonly DataColumn[] = [
  { key: 'number', label: 'Parcela' },
  { key: 'due', label: 'Vencimento' },
  { key: 'amount', label: 'Valor', numeric: true },
  { key: 'interest', label: 'Juros', numeric: true, secondary: true },
  { key: 'amortization', label: 'Amortização', numeric: true, secondary: true },
  { key: 'balance', label: 'Saldo', numeric: true },
];

@Component({
  selector: 'app-loan-detail-page',
  imports: [
    CurrencyPipe,
    PercentPipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    AsyncState,
    DataRows,
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
  protected readonly columns = SCHEDULE_COLUMNS;

  protected readonly view = computed(() => this.store.viewOf(this.id()));

  private readonly transactionByNumber = computed(() => {
    const view = this.view();
    return new Map(
      (view?.instalments ?? []).map((transaction) => [
        transaction.loan_installment_number,
        transaction,
      ]),
    );
  });

  protected readonly rows = computed<readonly DataRow[]>(() => {
    const view = this.view();
    if (!view) {
      return [];
    }
    const byNumber = this.transactionByNumber();
    return view.schedule.map((line) => {
      const transaction = byNumber.get(line.number) ?? null;
      const difference = transaction
        ? Math.round((transaction.amount - line.amount) * 100) / 100
        : 0;
      return {
        id: String(line.number),
        muted: transaction?.status === 'PAID',
        actionable: transaction !== null,
        cells: [
          { key: 'number', text: String(line.number) },
          { key: 'due', text: displayDate(transaction?.date ?? null) },
          {
            key: 'amount',
            text: displayAmount(line.amount),
            note: difference !== 0 ? `lançado ${displayAmount(transaction!.amount)}` : undefined,
          },
          { key: 'interest', text: displayAmount(line.interest) },
          { key: 'amortization', text: displayAmount(line.amortization) },
          { key: 'balance', text: displayAmount(line.balanceAfter) },
        ],
      };
    });
  });

  protected readonly hasDifferences = computed(() =>
    this.rows().some((row) => row.cells.some((cell) => cell.note)),
  );

  protected async activate(number: string): Promise<void> {
    const transaction = this.transactionByNumber().get(Number(number)) ?? null;
    await this.open(transaction);
  }

  private async open(transaction: Transaction | null): Promise<void> {
    if (!transaction) {
      return;
    }
    const result = await openTransactionDialog(this.dialog, this.viewport, { transaction });
    if (result) {
      this.store.reload();
    }
  }

  /** The store loads on demand, so the screen that shows it asks for it. */
  constructor() {
    this.store.activate();
  }
}
