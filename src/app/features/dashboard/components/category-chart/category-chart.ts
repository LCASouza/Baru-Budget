import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { sumAmounts } from '../../../../shared/money/money';
import { categoryIconByName } from '../../../categories/category.model';
import { NamedAmount } from '../../dashboard.models';

interface AmountRow extends NamedAmount {
  readonly percent: number;
}

@Component({
  selector: 'app-category-chart',
  imports: [CurrencyPipe, MatIconModule],
  templateUrl: './category-chart.html',
  styleUrl: './category-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryChart {
  readonly data = input.required<readonly NamedAmount[]>();
  readonly title = input('Gastos por categoria');
  readonly emptyMessage = input('Sem despesas no período.');
  readonly showCategoryIcons = input(true);
  protected readonly categoryIcon = (row: NamedAmount) =>
    row.icon ?? categoryIconByName('EXPENSE', row.name);

  protected readonly total = computed(() => sumAmounts(this.data().map((item) => item.amount)));

  protected readonly rows = computed<AmountRow[]>(() => {
    const sorted = [...this.data()].sort((a, b) => b.amount - a.amount);
    const highest = sorted[0]?.amount ?? 0;
    return sorted.map((item) => ({
      ...item,
      percent: highest > 0 ? (item.amount / highest) * 100 : 0,
    }));
  });
}
