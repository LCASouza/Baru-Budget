import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { CurrentProfileService } from '../../profile/current-profile.service';
import { PeriodFilter } from '../../../shared/components/period-filter/period-filter';
import { FinancialContextOption, MOCK_CONTEXTS } from '../shell.mock';
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
  protected readonly contexts = MOCK_CONTEXTS;
  protected readonly selectedContext = signal<FinancialContextOption>(MOCK_CONTEXTS[0]);

  protected selectContext(option: FinancialContextOption): void {
    this.selectedContext.set(option);
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
