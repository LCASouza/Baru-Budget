import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PeriodService } from '../../../core/period/period.service';

@Component({
  selector: 'app-period-filter',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './period-filter.html',
  styleUrl: './period-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeriodFilter {
  readonly compact = input(false);

  protected readonly period = inject(PeriodService);
}
