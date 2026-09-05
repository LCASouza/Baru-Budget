import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { UpcomingPayment } from '../../dashboard.models';

@Component({
  selector: 'app-upcoming-payments',
  imports: [CurrencyPipe, DatePipe, MatIconModule],
  templateUrl: './upcoming-payments.html',
  styleUrl: './upcoming-payments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpcomingPayments {
  readonly items = input.required<readonly UpcomingPayment[]>();
}
