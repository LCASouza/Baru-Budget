import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type SummaryTone = 'income' | 'expense' | 'balance' | 'benefit' | 'receivable' | 'payable';

export interface SummaryCardData {
  readonly label: string;
  readonly amount: number;
  readonly icon: string;
  readonly tone: SummaryTone;
  readonly hint?: string;
  readonly signed?: boolean;
}

@Component({
  selector: 'app-summary-card',
  imports: [CurrencyPipe, MatIconModule],
  templateUrl: './summary-card.html',
  styleUrl: './summary-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SummaryCard {
  readonly data = input.required<SummaryCardData>();

  protected readonly absoluteAmount = computed(() => Math.abs(this.data().amount));
  protected readonly sign = computed(() => (this.data().amount < 0 ? '−' : '+'));
}
