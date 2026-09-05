import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { PRIMARY_NAV_ITEMS } from '../../navigation/nav-items';
import { NavigationService } from '../../navigation/navigation.service';

@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomNav {
  readonly openMore = output<void>();

  protected readonly navigation = inject(NavigationService);
  protected readonly items = PRIMARY_NAV_ITEMS;
}
