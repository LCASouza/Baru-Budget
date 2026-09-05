import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SettlementEntry } from '../../dashboard.models';

function sum(entries: readonly SettlementEntry[]): number {
  return entries.reduce((total, entry) => total + entry.amount, 0);
}

@Component({
  selector: 'app-settlement-summary',
  imports: [CurrencyPipe, MatIconModule],
  templateUrl: './settlement-summary.html',
  styleUrl: './settlement-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettlementSummary {
  readonly receivables = input.required<readonly SettlementEntry[]>();
  readonly payables = input.required<readonly SettlementEntry[]>();

  protected readonly receivableTotal = computed(() => sum(this.receivables()));
  protected readonly payableTotal = computed(() => sum(this.payables()));
  protected readonly netBalance = computed(() => this.receivableTotal() - this.payableTotal());
  protected readonly netAbsolute = computed(() => Math.abs(this.netBalance()));
}
