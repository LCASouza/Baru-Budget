import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FinancialContextService } from '../../../core/context/financial-context.service';
import { ACCESS_PERMISSION_LABELS } from '../../../core/finance/access-permission';
import { describeDataError } from '../../../core/supabase/data-error';
import { confirmAction } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { GrantFormDialog } from '../grant-form-dialog/grant-form-dialog';
import { GivenGrant, ReceivedGrantView } from '../grant.model';
import { GrantsStore } from '../grants.store';

@Component({
  selector: 'app-sharing-page',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatProgressBarModule, EmptyState],
  templateUrl: './sharing-page.html',
  styleUrl: './sharing-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharingPage {
  protected readonly store = inject(GrantsStore);
  private readonly context = inject(FinancialContextService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly permissionLabels = ACCESS_PERMISSION_LABELS;

  protected openForm(): void {
    this.dialog.open(GrantFormDialog, { width: '480px', maxWidth: 'calc(100vw - 32px)', autoFocus: 'dialog' });
  }

  protected openContext(grant: ReceivedGrantView): void {
    this.context.select({
      kind: 'shared',
      ownerId: grant.ownerId,
      ownerName: grant.ownerName,
      permission: grant.permission,
    });
  }

  protected async togglePermission(grant: GivenGrant): Promise<void> {
    const permission = grant.permission === 'VIEW' ? 'MANAGE' : 'VIEW';
    try {
      await this.store.setPermission(grant.id, permission);
    } catch (error) {
      this.snackBar.open(describeDataError(error, { fallback: 'Não foi possível alterar a permissão.' }), 'OK', { duration: 5000 });
    }
  }

  protected async revoke(grant: GivenGrant): Promise<void> {
    const confirmed = await confirmAction(this.dialog, {
      title: 'Revogar acesso',
      message: `${grant.grantedUserName} deixará de acessar suas finanças imediatamente.`,
      confirmLabel: 'Revogar',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.store.revoke(grant.id);
      this.snackBar.open('Acesso revogado.', undefined, { duration: 3000 });
    } catch (error) {
      this.snackBar.open(describeDataError(error, { fallback: 'Não foi possível revogar o acesso.' }), 'OK', { duration: 5000 });
    }
  }
}
