import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ViewportService } from '../../../core/layout/viewport.service';
import { PeriodFilter } from '../../../shared/components/period-filter/period-filter';

@Component({
  selector: 'app-recurrences-page',
  imports: [MatTabsModule, RouterLink, RouterLinkActive, RouterOutlet, PeriodFilter],
  templateUrl: './recurrences-page.html',
  styleUrl: './recurrences-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurrencesPage {
  protected readonly viewport = inject(ViewportService);

  protected readonly tabs = [
    { path: 'expenses', label: 'Gastos fixos' },
    { path: 'incomes', label: 'Receitas recorrentes' },
  ];
}
