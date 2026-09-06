import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { DEFAULT_CURRENCY_CODE, LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MonthlyTotals } from '../../dashboard.models';
import { IncomeExpenseChart } from './income-expense-chart';

registerLocaleData(localePt);

const DATA: readonly MonthlyTotals[] = [
  { month: 'Abr', income: 6800, expense: 5200 },
  { month: 'Mai', income: 7400, expense: 6100 },
];

describe('IncomeExpenseChart', () => {
  let fixture: ComponentFixture<IncomeExpenseChart>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeExpenseChart],
      providers: [
        { provide: LOCALE_ID, useValue: 'pt-BR' },
        { provide: DEFAULT_CURRENCY_CODE, useValue: 'BRL' },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(IncomeExpenseChart);
    fixture.componentRef.setInput('data', DATA);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('scales the axis to the next tick above the highest value', () => {
    const ticks = Array.from(element.querySelectorAll('.chart__tick')).map((tick) =>
      tick.textContent?.trim(),
    );
    expect(ticks).toEqual(['0', '2 mil', '4 mil', '6 mil', '8 mil']);
  });

  it('draws two bars per month with a tooltip in BRL', () => {
    const bars = element.querySelectorAll('.chart__bar');
    expect(bars.length).toBe(DATA.length * 2);
    expect(bars[0].querySelector('title')?.textContent).toContain('Receitas · Abr');
    expect(bars[0].querySelector('title')?.textContent).toContain('R$');
    expect(bars[0].querySelector('title')?.textContent).toContain('6.800,00');
  });

  it('uses the desktop view box by default', () => {
    expect(element.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 600 220');
  });
});
