import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CategorySpending } from '../../dashboard.models';

interface CategoryRow extends CategorySpending {
  readonly percent: number;
}

@Component({
  selector: 'app-category-chart',
  imports: [CurrencyPipe],
  templateUrl: './category-chart.html',
  styleUrl: './category-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryChart {
  readonly data = input.required<readonly CategorySpending[]>();

  protected readonly total = computed(() =>
    this.data().reduce((sum, item) => sum + item.amount, 0),
  );

  protected readonly rows = computed<CategoryRow[]>(() => {
    const sorted = [...this.data()].sort((a, b) => b.amount - a.amount);
    const highest = sorted[0]?.amount ?? 0;
    return sorted.map((item) => ({
      ...item,
      percent: highest > 0 ? (item.amount / highest) * 100 : 0,
    }));
  });
}
