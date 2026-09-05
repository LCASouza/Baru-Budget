import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ViewportService } from '../../../../core/layout/viewport.service';
import { MonthlyTotals } from '../../dashboard.models';

const DESKTOP_WIDTH = 600;
const MOBILE_WIDTH = 360;
const HEIGHT = 220;
const PADDING = { top: 12, right: 8, bottom: 28, left: 52 } as const;
const TICK_STEP = 2000;
const BAR_RADIUS = 4;
const BAR_GAP = 4;
const MAX_BAR_WIDTH = 22;

interface Bar {
  readonly path: string;
  readonly value: number;
}

interface BarGroup {
  readonly month: string;
  readonly labelX: number;
  readonly income: Bar;
  readonly expense: Bar;
}

interface Tick {
  readonly y: number;
  readonly label: string;
}

function roundedTopBar(x: number, y: number, width: number, height: number): string {
  const radius = Math.min(BAR_RADIUS, height / 2, width / 2);
  const right = x + width;
  const bottom = y + height;
  return [
    `M${x},${bottom}`,
    `V${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    `H${right - radius}`,
    `Q${right},${y} ${right},${y + radius}`,
    `V${bottom}`,
    'Z',
  ].join(' ');
}

function yFor(value: number, max: number): number {
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  return PADDING.top + plotHeight * (1 - value / max);
}

@Component({
  selector: 'app-income-expense-chart',
  imports: [CurrencyPipe],
  templateUrl: './income-expense-chart.html',
  styleUrl: './income-expense-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncomeExpenseChart {
  readonly data = input.required<readonly MonthlyTotals[]>();

  private readonly viewport = inject(ViewportService);

  private readonly width = computed(() =>
    this.viewport.isMobile() ? MOBILE_WIDTH : DESKTOP_WIDTH,
  );

  protected readonly viewBox = computed(() => `0 0 ${this.width()} ${HEIGHT}`);
  protected readonly plotLeft = PADDING.left;
  protected readonly plotRight = computed(() => this.width() - PADDING.right);
  protected readonly baseline = HEIGHT - PADDING.bottom;

  private readonly maxValue = computed(() => {
    const highest = Math.max(...this.data().flatMap((item) => [item.income, item.expense]));
    return Math.max(TICK_STEP, Math.ceil(highest / TICK_STEP) * TICK_STEP);
  });

  protected readonly ticks = computed<Tick[]>(() => {
    const max = this.maxValue();
    const ticks: Tick[] = [];
    for (let value = 0; value <= max; value += TICK_STEP) {
      ticks.push({ y: yFor(value, max), label: value === 0 ? '0' : `${value / 1000} mil` });
    }
    return ticks;
  });

  protected readonly groups = computed<BarGroup[]>(() => {
    const data = this.data();
    const max = this.maxValue();
    const plotWidth = this.width() - PADDING.left - PADDING.right;
    const groupWidth = plotWidth / data.length;
    const barWidth = Math.min(MAX_BAR_WIDTH, groupWidth * 0.28);

    return data.map((item, index) => {
      const center = PADDING.left + groupWidth * index + groupWidth / 2;
      return {
        month: item.month,
        labelX: center,
        income: this.bar(center - barWidth - BAR_GAP / 2, item.income, max, barWidth),
        expense: this.bar(center + BAR_GAP / 2, item.expense, max, barWidth),
      };
    });
  });

  private bar(x: number, value: number, max: number, width: number): Bar {
    const y = yFor(value, max);
    return { path: roundedTopBar(x, y, width, this.baseline - y), value };
  }
}
