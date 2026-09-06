import { Injectable, computed, signal } from '@angular/core';
import {
  MonthPeriod,
  currentMonth,
  isSameMonth,
  monthLabel,
  monthRange,
  shiftMonth,
} from './period.model';

// Month selected in the header and shared by every page that lists financial data.
@Injectable({ providedIn: 'root' })
export class PeriodService {
  private readonly monthState = signal<MonthPeriod>(currentMonth());

  readonly month = this.monthState.asReadonly();
  readonly range = computed(() => monthRange(this.month()));
  readonly label = computed(() => monthLabel(this.month()));
  readonly isCurrentMonth = computed(() => isSameMonth(this.month(), currentMonth()));

  previous(): void {
    this.monthState.update((month) => shiftMonth(month, -1));
  }

  next(): void {
    this.monthState.update((month) => shiftMonth(month, 1));
  }

  reset(): void {
    this.monthState.set(currentMonth());
  }
}
