import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ViewportService } from '../../core/layout/viewport.service';
import { PeriodFilter } from '../../shared/components/period-filter/period-filter';
import { SummaryCard } from '../../shared/components/summary-card/summary-card';
import { CategoryChart } from './components/category-chart/category-chart';
import { IncomeExpenseChart } from './components/income-expense-chart/income-expense-chart';
import { SettlementSummary } from './components/settlement-summary/settlement-summary';
import { TransactionList } from './components/transaction-list/transaction-list';
import { UpcomingPayments } from './components/upcoming-payments/upcoming-payments';
import {
  CATEGORY_SPENDING,
  MONTHLY_TOTALS,
  PAYABLES,
  RECEIVABLES,
  RECENT_TRANSACTIONS,
  SUMMARY_CARDS,
  UPCOMING_PAYMENTS,
} from './dashboard.mock';

@Component({
  selector: 'app-dashboard-page',
  imports: [
    PeriodFilter,
    SummaryCard,
    IncomeExpenseChart,
    CategoryChart,
    UpcomingPayments,
    TransactionList,
    SettlementSummary,
  ],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  protected readonly viewport = inject(ViewportService);

  protected readonly summaryCards = SUMMARY_CARDS;
  protected readonly monthlyTotals = MONTHLY_TOTALS;
  protected readonly categorySpending = CATEGORY_SPENDING;
  protected readonly upcomingPayments = UPCOMING_PAYMENTS;
  protected readonly recentTransactions = RECENT_TRANSACTIONS;
  protected readonly receivables = RECEIVABLES;
  protected readonly payables = PAYABLES;
}
