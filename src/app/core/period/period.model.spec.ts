import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { currentMonth, isSameMonth, monthLabel, monthRange, shiftMonth } from './period.model';

registerLocaleData(localePt);

describe('period.model', () => {
  it('derives the current month from a date', () => {
    expect(currentMonth(new Date(2026, 8, 6))).toEqual({ year: 2026, month: 9 });
    expect(currentMonth(new Date(2026, 0, 31))).toEqual({ year: 2026, month: 1 });
  });

  it('shifts months across year boundaries', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 9 }, -14)).toEqual({ year: 2025, month: 7 });
  });

  it('computes inclusive month ranges', () => {
    expect(monthRange({ year: 2026, month: 9 })).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(monthRange({ year: 2024, month: 2 })).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(monthRange({ year: 2025, month: 2 })).toEqual({ start: '2025-02-01', end: '2025-02-28' });
    expect(monthRange({ year: 2026, month: 12 })).toEqual({ start: '2026-12-01', end: '2026-12-31' });
  });

  it('labels the month in Portuguese with a capital letter', () => {
    expect(monthLabel({ year: 2026, month: 9 })).toBe('Setembro 2026');
    expect(monthLabel({ year: 2027, month: 1 })).toBe('Janeiro 2027');
  });

  it('compares months', () => {
    expect(isSameMonth({ year: 2026, month: 9 }, { year: 2026, month: 9 })).toBe(true);
    expect(isSameMonth({ year: 2026, month: 9 }, { year: 2025, month: 9 })).toBe(false);
  });
});
