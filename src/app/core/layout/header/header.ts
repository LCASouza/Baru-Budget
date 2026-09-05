import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { PeriodFilter } from '../../../shared/components/period-filter/period-filter';
import { FinancialContextOption, MOCK_CONTEXTS, MOCK_USER } from '../shell.mock';
import { ViewportSize } from '../viewport.service';

@Component({
  selector: 'app-header',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatDividerModule, PeriodFilter],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  readonly title = input.required<string>();
  readonly size = input.required<ViewportSize>();
  readonly newTransaction = output<void>();

  protected readonly user = MOCK_USER;
  protected readonly contexts = MOCK_CONTEXTS;
  protected readonly selectedContext = signal<FinancialContextOption>(MOCK_CONTEXTS[0]);

  protected selectContext(option: FinancialContextOption): void {
    this.selectedContext.set(option);
  }
}
