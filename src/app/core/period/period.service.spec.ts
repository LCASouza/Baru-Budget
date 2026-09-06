import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { TestBed } from '@angular/core/testing';
import { currentMonth, monthLabel, monthRange, shiftMonth } from './period.model';
import { PeriodService } from './period.service';

registerLocaleData(localePt);

describe('PeriodService', () => {
  let service: PeriodService;

  beforeEach(() => {
    service = TestBed.inject(PeriodService);
  });

  it('starts at the current month', () => {
    const month = currentMonth();
    expect(service.month()).toEqual(month);
    expect(service.range()).toEqual(monthRange(month));
    expect(service.label()).toBe(monthLabel(month));
    expect(service.isCurrentMonth()).toBe(true);
  });

  it('moves the shared range when navigating', () => {
    const month = currentMonth();
    service.next();
    expect(service.month()).toEqual(shiftMonth(month, 1));
    expect(service.range()).toEqual(monthRange(shiftMonth(month, 1)));
    expect(service.isCurrentMonth()).toBe(false);

    service.previous();
    service.previous();
    expect(service.month()).toEqual(shiftMonth(month, -1));
  });

  it('resets to the current month', () => {
    service.previous();
    service.reset();
    expect(service.isCurrentMonth()).toBe(true);
  });
});
