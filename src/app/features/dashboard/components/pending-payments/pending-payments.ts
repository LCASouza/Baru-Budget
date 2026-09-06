import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { transactionStatusLabel } from '../../../../core/finance/transaction-status';
import { TransactionView } from '../../../transactions/transaction.model';
import { PendingItem } from '../../dashboard.models';

@Component({
  selector: 'app-pending-payments',
  imports: [CurrencyPipe, DatePipe, MatIconModule],
  templateUrl: './pending-payments.html',
  styleUrl: './pending-payments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingPayments {
  readonly items = input.required<readonly PendingItem[]>();
  readonly openTransaction = output<TransactionView>();

  protected readonly statusLabel = transactionStatusLabel;
}
