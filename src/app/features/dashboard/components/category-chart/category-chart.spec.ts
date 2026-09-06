import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { DEFAULT_CURRENCY_CODE, LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryChart } from './category-chart';

registerLocaleData(localePt);

describe('CategoryChart', () => {
  let fixture: ComponentFixture<CategoryChart>;
  let element: HTMLElement;

  const rows = () =>
    Array.from(element.querySelectorAll('.categories__row')).map((row) => ({
      name: row.querySelector('.categories__name')?.textContent?.trim(),
      width: (row.querySelector('.categories__bar') as HTMLElement | null)?.style.width,
    }));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryChart],
      providers: [
        { provide: LOCALE_ID, useValue: 'pt-BR' },
        { provide: DEFAULT_CURRENCY_CODE, useValue: 'BRL' },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CategoryChart);
    fixture.componentRef.setInput('data', [
      { name: 'Alimentação', amount: 200 },
      { name: 'Moradia', amount: 800 },
    ]);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('sorts by amount and scales the bars against the largest one', () => {
    expect(rows()).toEqual([
      { name: 'Moradia', width: '100%' },
      { name: 'Alimentação', width: '25%' },
    ]);
    expect(element.querySelector('.bb-card__subtitle')?.textContent).toContain('1.000,00');
  });

  it('uses the given title and shows an empty message without data', () => {
    fixture.componentRef.setInput('title', 'Gastos por pessoa');
    fixture.componentRef.setInput('emptyMessage', 'Sem despesas do grupo.');
    fixture.componentRef.setInput('data', []);
    fixture.detectChanges();
    expect(element.querySelector('.bb-card__title')?.textContent?.trim()).toBe('Gastos por pessoa');
    expect(element.querySelector('.categories__empty')?.textContent?.trim()).toBe('Sem despesas do grupo.');
    expect(rows()).toEqual([]);
  });
});
