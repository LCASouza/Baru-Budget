import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import {
  contextIcon,
  contextKey,
  contextLabel,
} from '../../context/financial-context.model';
import { FinancialContextService } from '../../context/financial-context.service';
import { ACCESS_PERMISSION_LABELS } from '../../finance/access-permission';
import { CurrentProfileService } from '../../profile/current-profile.service';
import { PeriodFilter } from '../../../shared/components/period-filter/period-filter';
import { ViewportSize } from '../viewport.service';

@Component({
  selector: 'app-header',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
    RouterLink,
    PeriodFilter,
  ],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  readonly title = input.required<string>();
  readonly size = input.required<ViewportSize>();
  readonly newTransaction = output<void>();

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly currentProfile = inject(CurrentProfileService);
  protected readonly context = inject(FinancialContextService);

  protected readonly contextKey = contextKey;
  protected readonly contextLabel = contextLabel;
  protected readonly contextIcon = contextIcon;
  protected readonly permissionLabels = ACCESS_PERMISSION_LABELS;

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
