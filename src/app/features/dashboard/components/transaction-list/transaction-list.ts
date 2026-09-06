import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TransactionView } from '../../../transactions/transaction.model';

const KIND_ICONS = {
  INCOME: 'arrow_downward',
  EXPENSE: 'arrow_upward',
  TRANSFER: 'swap_horiz',
  SETTLEMENT: 'handshake',
} as const;

@Component({
  selector: 'app-transaction-list',
  imports: [CurrencyPipe, DatePipe, MatIconModule, RouterLink],
  templateUrl: './transaction-list.html',
  styleUrl: './transaction-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionList {
  readonly items = input.required<readonly TransactionView[]>();
  /** Shows who registered the transaction instead of the account. */
  readonly showOwner = input(false);
  readonly openTransaction = output<TransactionView>();

  protected readonly kindIcons = KIND_ICONS;
}
