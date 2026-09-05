import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

const BASE_MONTH = new Date(2026, 8, 1);

@Component({
  selector: 'app-period-filter',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './period-filter.html',
  styleUrl: './period-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeriodFilter {
  readonly compact = input(false);

  private readonly monthOffset = signal(0);

  protected readonly label = computed(() => {
    const month = new Date(BASE_MONTH.getFullYear(), BASE_MONTH.getMonth() + this.monthOffset(), 1);
    const text = formatDate(month, 'MMMM yyyy', 'pt-BR');
    return text.charAt(0).toUpperCase() + text.slice(1);
  });

  protected previous(): void {
    this.monthOffset.update((offset) => offset - 1);
  }

  protected next(): void {
    this.monthOffset.update((offset) => offset + 1);
  }
}
