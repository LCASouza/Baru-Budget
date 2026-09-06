import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { ViewportService } from '../../core/layout/viewport.service';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { PeriodFilter } from '../../shared/components/period-filter/period-filter';
import { SummaryCard } from '../../shared/components/summary-card/summary-card';
import { openTransactionDialog } from '../transactions/open-transaction-dialog';
import { TransactionView } from '../transactions/transaction.model';
import { CategoryChart } from './components/category-chart/category-chart';
import { IncomeExpenseChart } from './components/income-expense-chart/income-expense-chart';
import { PendingPayments } from './components/pending-payments/pending-payments';
import { TransactionList } from './components/transaction-list/transaction-list';
import { DashboardStore } from './dashboard.store';

@Component({
  selector: 'app-dashboard-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    PeriodFilter,
    SummaryCard,
    IncomeExpenseChart,
    CategoryChart,
    PendingPayments,
    TransactionList,
    EmptyState,
  ],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  protected readonly viewport = inject(ViewportService);
  protected readonly store = inject(DashboardStore);
  private readonly dialog = inject(MatDialog);

  protected async create(): Promise<void> {
    await openTransactionDialog(this.dialog, this.viewport);
  }

  protected async open(view: TransactionView): Promise<void> {
    await openTransactionDialog(this.dialog, this.viewport, { transaction: view.transaction });
  }
}
