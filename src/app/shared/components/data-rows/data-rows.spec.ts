import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ViewportService, ViewportSize } from '../../../core/layout/viewport.service';
import { DataColumn, DataRow, DataRows } from './data-rows';

const COLUMNS: readonly DataColumn[] = [
  { key: 'number', label: 'Parcela' },
  { key: 'due', label: 'Vencimento' },
  { key: 'amount', label: 'Valor', numeric: true },
  { key: 'interest', label: 'Juros', numeric: true, secondary: true },
];

const ROWS: readonly DataRow[] = [
  {
    id: '1',
    actionable: true,
    cells: [
      { key: 'number', text: '1' },
      { key: 'due', text: '10/10/2026' },
      { key: 'amount', text: 'R$ 916,80', note: 'lançado R$ 900,00' },
      { key: 'interest', text: 'R$ 150,00' },
    ],
  },
  {
    id: '2',
    muted: true,
    cells: [
      { key: 'number', text: '2' },
      { key: 'due', text: '10/11/2026' },
      { key: 'amount', text: 'R$ 916,80' },
      { key: 'interest', text: 'R$ 140,00' },
    ],
  },
];

describe('DataRows', () => {
  const size = signal<ViewportSize>('desktop');
  let fixture: ComponentFixture<DataRows>;

  const query = (selector: string) => fixture.nativeElement.querySelectorAll(selector);

  async function setup(viewport: ViewportSize): Promise<void> {
    size.set(viewport);
    await TestBed.configureTestingModule({
      imports: [DataRows],
      providers: [
        {
          provide: ViewportService,
          useValue: {
            size,
            isMobile: () => size() === 'mobile',
            isTablet: () => size() === 'tablet',
            isDesktop: () => size() === 'desktop',
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DataRows);
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('rows', ROWS);
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('renders a table on the desktop with every column', async () => {
    await setup('desktop');
    expect(query('table')).toHaveLength(1);
    expect(query('thead th')).toHaveLength(4);
    expect(query('tbody tr')).toHaveLength(2);
  });

  it('renders cards on a phone and drops the secondary columns', async () => {
    await setup('mobile');
    expect(query('table')).toHaveLength(0);
    expect(query('.rows__card')).toHaveLength(2);
    // Three columns per card: the secondary one is dropped, not scrolled to.
    expect(query('.rows__card')[0].querySelectorAll('.rows__field')).toHaveLength(3);
  });

  it('carries the column label into every card field', async () => {
    await setup('mobile');
    const labels = [...query('.rows__card')[0].querySelectorAll('.rows__label')].map(
      (node) => (node as HTMLElement).textContent?.trim(),
    );
    expect(labels).toEqual(['Parcela', 'Vencimento', 'Valor']);
  });

  it('makes an actionable row reachable and operable by keyboard', async () => {
    await setup('desktop');
    const rows = query('tbody tr');
    expect(rows[0].getAttribute('role')).toBe('button');
    expect(rows[0].getAttribute('tabindex')).toBe('0');
    expect(rows[1].getAttribute('role')).toBeNull();
    expect(rows[1].getAttribute('tabindex')).toBeNull();

    const activated: string[] = [];
    fixture.componentInstance.activate.subscribe((id) => activated.push(id));

    rows[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    rows[0].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    rows[0].click();
    rows[1].click();

    expect(activated).toEqual(['1', '1', '1']);
  });

  it('keeps the keyboard contract on the phone cards too', async () => {
    await setup('mobile');
    const cards = query('.rows__card');
    expect(cards[0].getAttribute('role')).toBe('button');
    expect(cards[0].getAttribute('tabindex')).toBe('0');
  });

  it('shows the note under the value', async () => {
    await setup('desktop');
    expect(fixture.nativeElement.textContent).toContain('lançado R$ 900,00');
  });
});
