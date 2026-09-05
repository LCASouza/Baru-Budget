import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-feature-placeholder',
  imports: [MatIconModule],
  templateUrl: './feature-placeholder.html',
  styleUrl: './feature-placeholder.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturePlaceholder {
  readonly title = input.required<string>();
  readonly icon = input.required<string>();
  readonly description = input.required<string>();
  readonly plannedVersion = input.required<string>();
}
