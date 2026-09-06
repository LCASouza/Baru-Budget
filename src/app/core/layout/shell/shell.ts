import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { RouterOutlet } from '@angular/router';
import { openTransactionDialog } from '../../../features/transactions/open-transaction-dialog';
import { FinancialContextService } from '../../context/financial-context.service';
import { NavigationService } from '../../navigation/navigation.service';
import { BottomNav } from '../bottom-nav/bottom-nav';
import { Header } from '../header/header';
import { MoreMenuSheet } from '../more-menu-sheet/more-menu-sheet';
import { Sidebar } from '../sidebar/sidebar';
import { ViewportService } from '../viewport.service';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    MatSidenavModule,
    MatButtonModule,
    MatIconModule,
    Sidebar,
    Header,
    BottomNav,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly dialog = inject(MatDialog);
  private readonly bottomSheet = inject(MatBottomSheet);
  protected readonly viewport = inject(ViewportService);
  protected readonly navigation = inject(NavigationService);
  protected readonly context = inject(FinancialContextService);

  protected async openNewTransaction(): Promise<void> {
    await openTransactionDialog(this.dialog, this.viewport);
  }

  protected openMoreMenu(): void {
    this.bottomSheet.open(MoreMenuSheet);
  }
}
