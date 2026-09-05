import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { RecentTransaction } from '../../dashboard.models';

@Component({
  selector: 'app-transaction-list',
  imports: [CurrencyPipe, DatePipe, MatIconModule, RouterLink],
  templateUrl: './transaction-list.html',
  styleUrl: './transaction-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionList {
  readonly items = input.required<readonly RecentTransaction[]>();
}
