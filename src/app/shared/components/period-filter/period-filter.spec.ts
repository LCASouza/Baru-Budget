import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PeriodFilter } from './period-filter';

registerLocaleData(localePt);

describe('PeriodFilter', () => {
  let fixture: ComponentFixture<PeriodFilter>;

  const label = (): string =>
    (fixture.nativeElement as HTMLElement).querySelector('.period__label')?.textContent?.trim() ??
    '';

  const click = (selector: string): void => {
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(selector)?.click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PeriodFilter] }).compileComponents();
    fixture = TestBed.createComponent(PeriodFilter);
    fixture.detectChanges();
  });

  it('shows the base month in Portuguese', () => {
    expect(label()).toContain('Setembro 2026');
  });

  it('moves to the next and previous months', () => {
    click('[aria-label="Próximo mês"]');
    expect(label()).toContain('Outubro 2026');

    click('[aria-label="Mês anterior"]');
    click('[aria-label="Mês anterior"]');
    expect(label()).toContain('Agosto 2026');
  });

  it('crosses year boundaries', () => {
    for (let i = 0; i < 4; i++) {
      click('[aria-label="Próximo mês"]');
    }
    expect(label()).toContain('Janeiro 2027');
  });
});
