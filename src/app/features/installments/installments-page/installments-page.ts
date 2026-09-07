import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FinancialContextService } from '../../../core/context/financial-context.service';
import { ViewportService } from '../../../core/layout/viewport.service';
import { transactionStatusLabel } from '../../../core/finance/transaction-status';
import { describeDataError } from '../../../core/supabase/data-error';
import { todayIso } from '../../../shared/dates/iso-date';
import { confirmAction } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { SummaryCard, SummaryCardData } from '../../../shared/components/summary-card/summary-card';
import { openTransactionDialog } from '../../transactions/open-transaction-dialog';
import { Transaction, displayStatus } from '../../transactions/transaction.model';
import { InstallmentPurchaseView, installmentCompetence } from '../installment.model';
import { InstallmentsStore } from '../installments.store';

type OriginFilter = 'ALL' | 'CARD' | 'ACCOUNT';
type StatusFilter = 'ALL' | 'ONGOING' | 'DONE';

@Component({
  selector: 'app-installments-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    SummaryCard,
    EmptyState,
  ],
  templateUrl: './installments-page.html',
  styleUrl: './installments-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstallmentsPage {
  protected readonly store = inject(InstallmentsStore);
  protected readonly context = inject(FinancialContextService);
  private readonly viewport = inject(ViewportService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly origin = signal<OriginFilter>('ALL');
  protected readonly status = signal<StatusFilter>('ONGOING');
  private readonly today = todayIso();

  protected readonly filtered = computed(() => {
    const origin = this.origin();
    const status = this.status();
    return this.store.views().filter((purchase) => {
      if (origin === 'CARD' && !purchase.creditCardId) {
        return false;
      }
      if (origin === 'ACCOUNT' && !purchase.accountId) {
        return false;
      }
      if (status === 'ONGOING' && purchase.done) {
        return false;
      }
      if (status === 'DONE' && !purchase.done) {
        return false;
      }
      return true;
    });
  });

  protected readonly cards = computed<readonly SummaryCardData[]>(() => [
    {
      label: 'Comprometido',
      amount: this.store.totalRemaining(),
      icon: 'event_repeat',
      tone: 'payable',
      hint: `${this.store.remainingCount()} ${this.store.remainingCount() === 1 ? 'parcela a vencer' : 'parcelas a vencer'}`,
    },
    {
      label: 'Parcelas do período',
      amount: this.store.totalInSelectedPeriod(),
      icon: 'today',
      tone: 'expense',
      hint: `${this.store.inSelectedPeriod().length} no período selecionado`,
    },
  ]);

  protected competenceOf(transaction: Transaction): string {
    return installmentCompetence(transaction);
  }

  protected statusOf(transaction: Transaction): string {
    return transactionStatusLabel(displayStatus(transaction, this.today), transaction.kind);
  }

  protected isFuture(transaction: Transaction): boolean {
    return installmentCompetence(transaction) > this.today;
  }

  protected async open(transaction: Transaction): Promise<void> {
    const result = await openTransactionDialog(this.dialog, this.viewport, { transaction });
    if (result) {
      this.store.reload();
    }
  }

  protected async removeGroup(purchase: InstallmentPurchaseView): Promise<void> {
    const confirmed = await confirmAction(this.dialog, {
      title: 'Excluir parcelamento',
      message: `As ${purchase.recordedCount} parcelas de "${purchase.description}" serão excluídas, inclusive as já lançadas.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.store.removeGroup(purchase.id);
      this.snackBar.open('Parcelamento excluído.', undefined, { duration: 3000 });
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, { fallback: 'Não foi possível excluir o parcelamento.' }),
        'OK',
        { duration: 5000 },
      );
    }
  }
}
