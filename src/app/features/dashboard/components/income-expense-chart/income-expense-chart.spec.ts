import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ViewportService, ViewportSize } from '../../../../core/layout/viewport.service';
import { IncomeExpenseChart } from './income-expense-chart';

registerLocaleData(localePt);

describe('IncomeExpenseChart accessibility', () => {
  const size = signal<ViewportSize>('desktop');
  let fixture: ComponentFixture<IncomeExpenseChart>;

  async function setup(data: { key: string; month: string; income: number; expense: number }[]) {
    await TestBed.configureTestingModule({
      imports: [IncomeExpenseChart],
      providers: [
        {
          provide: ViewportService,
          useValue: {
            size,
            isMobile: () => size() === 'mobile',
            isTablet: () => false,
            isDesktop: () => size() === 'desktop',
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(IncomeExpenseChart);
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  const label = () => fixture.nativeElement.querySelector('svg')?.getAttribute('aria-label') ?? '';

  it('describes the data, not the drawing', async () => {
    await setup([
      { key: '2026-08-01', month: 'Ago', income: 5000, expense: 2500 },
      { key: '2026-09-01', month: 'Set', income: 6000, expense: 3000 },
    ]);
    expect(label()).toContain('Ago');
    expect(label()).toContain('Set');
    expect(label()).toContain('5.000,00');
    expect(label()).toContain('3.000,00');
  });

  it('says so when there is nothing to show', async () => {
    await setup([]);
    expect(label()).toContain('sem dados');
  });

  it('keeps the image role so a screen reader reads the label instead of the shapes', async () => {
    await setup([{ key: '2026-09-01', month: 'Set', income: 10, expense: 5 }]);
    expect(fixture.nativeElement.querySelector('svg')?.getAttribute('role')).toBe('img');
  });
});
