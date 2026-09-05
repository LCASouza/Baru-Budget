import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { RouterOutlet } from '@angular/router';
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

  protected async openNewTransaction(): Promise<void> {
    const { TransactionFormDialog } =
      await import('../../../features/transactions/transaction-form-dialog/transaction-form-dialog');

    if (this.viewport.isMobile()) {
      this.dialog.open(TransactionFormDialog, {
        width: '100vw',
        maxWidth: '100vw',
        height: '100dvh',
        maxHeight: '100dvh',
        panelClass: 'bb-dialog-fullscreen',
        autoFocus: false,
      });
      return;
    }

    this.dialog.open(TransactionFormDialog, {
      width: '600px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'dialog',
    });
  }

  protected openMoreMenu(): void {
    this.bottomSheet.open(MoreMenuSheet);
  }
}
