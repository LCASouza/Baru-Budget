import { registerLocaleData } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import localePt from '@angular/common/locales/pt';
import { currentMonth, monthLabel, shiftMonth } from '../../../core/period/period.model';
import { PeriodService } from '../../../core/period/period.service';
import { PeriodFilter } from './period-filter';

registerLocaleData(localePt);

describe('PeriodFilter', () => {
  let fixture: ComponentFixture<PeriodFilter>;
  let service: PeriodService;

  const label = (): string =>
    (fixture.nativeElement as HTMLElement).querySelector('.period__label')?.textContent?.trim() ??
    '';

  const click = (selector: string): void => {
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(selector)?.click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PeriodFilter] }).compileComponents();
    service = TestBed.inject(PeriodService);
    fixture = TestBed.createComponent(PeriodFilter);
    fixture.detectChanges();
  });

  it('shows the shared month in Portuguese', () => {
    expect(label()).toContain(monthLabel(currentMonth()));
  });

  it('navigates the shared period service', () => {
    click('[aria-label="Próximo mês"]');
    expect(service.month()).toEqual(shiftMonth(currentMonth(), 1));
    expect(label()).toContain(monthLabel(shiftMonth(currentMonth(), 1)));

    click('[aria-label="Mês anterior"]');
    click('[aria-label="Mês anterior"]');
    expect(label()).toContain(monthLabel(shiftMonth(currentMonth(), -1)));
  });

  it('returns to the current month from the label button', () => {
    click('[aria-label="Próximo mês"]');
    click('.period__label');
    expect(service.isCurrentMonth()).toBe(true);
  });
});
