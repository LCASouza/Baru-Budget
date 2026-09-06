import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/auth/auth.service';
import { FinancialContextService } from '../../../core/context/financial-context.service';
import { HOUSEHOLD_ROLE_LABELS } from '../../../core/finance/household-role';
import { describeDataError } from '../../../core/supabase/data-error';
import { confirmAction } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import {
  HouseholdFormData,
  HouseholdFormDialog,
} from '../household-form-dialog/household-form-dialog';
import {
  HouseholdMember,
  HouseholdWithMembers,
  activeAdminCount,
  activeMembers,
  roleOf,
} from '../household.model';
import { HouseholdsStore } from '../households.store';
import { MemberFormData, MemberFormDialog } from '../member-form-dialog/member-form-dialog';

@Component({
  selector: 'app-households-page',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatProgressBarModule, EmptyState],
  templateUrl: './households-page.html',
  styleUrl: './households-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HouseholdsPage {
  protected readonly store = inject(HouseholdsStore);
  private readonly auth = inject(AuthService);
  private readonly context = inject(FinancialContextService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly roleLabels = HOUSEHOLD_ROLE_LABELS;
  protected readonly activeMembers = activeMembers;

  protected isAdmin(household: HouseholdWithMembers): boolean {
    return roleOf(household, this.auth.userId() ?? '') === 'ADMIN';
  }

  protected isMe(member: HouseholdMember): boolean {
    return member.userId === this.auth.userId();
  }

  protected isLastAdmin(household: HouseholdWithMembers, member: HouseholdMember): boolean {
    return member.role === 'ADMIN' && activeAdminCount(household) === 1;
  }

  protected openContext(household: HouseholdWithMembers): void {
    const role = roleOf(household, this.auth.userId() ?? '') ?? 'MEMBER';
    this.context.select({ kind: 'household', householdId: household.id, name: household.name, role });
  }

  protected openForm(household?: HouseholdWithMembers): void {
    const data: HouseholdFormData = { household };
    this.dialog.open(HouseholdFormDialog, { data, width: '440px', maxWidth: 'calc(100vw - 32px)', autoFocus: 'dialog' });
  }

  protected openMemberForm(household: HouseholdWithMembers): void {
    const data: MemberFormData = { householdId: household.id, householdName: household.name };
    this.dialog.open(MemberFormDialog, { data, width: '440px', maxWidth: 'calc(100vw - 32px)', autoFocus: 'dialog' });
  }

  protected async setRole(household: HouseholdWithMembers, member: HouseholdMember): Promise<void> {
    const role = member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN';
    try {
      await this.store.setMemberRole(household.id, member.userId, role);
    } catch (error) {
      this.snackBar.open(this.describe(error, 'Não foi possível alterar o papel.'), 'OK', { duration: 5000 });
    }
  }

  protected async removeMember(household: HouseholdWithMembers, member: HouseholdMember): Promise<void> {
    const confirmed = await confirmAction(this.dialog, {
      title: 'Remover membro',
      message: `${member.displayName} deixará de ver as movimentações do grupo "${household.name}". As movimentações que registrou continuam no grupo.`,
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.store.removeMember(household.id, member.userId);
    } catch (error) {
      this.snackBar.open(this.describe(error, 'Não foi possível remover o membro.'), 'OK', { duration: 5000 });
    }
  }

  protected async leave(household: HouseholdWithMembers): Promise<void> {
    const confirmed = await confirmAction(this.dialog, {
      title: 'Sair do grupo',
      message: `Você deixará de ver as movimentações do grupo "${household.name}".`,
      confirmLabel: 'Sair',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.store.leave(household.id);
    } catch (error) {
      this.snackBar.open(this.describe(error, 'Não foi possível sair do grupo.'), 'OK', { duration: 5000 });
    }
  }

  protected async remove(household: HouseholdWithMembers): Promise<void> {
    const confirmed = await confirmAction(this.dialog, {
      title: 'Excluir grupo',
      message: `O grupo "${household.name}" será excluído. As movimentações marcadas com ele voltam a ser pessoais de quem as registrou.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.store.remove(household.id);
      this.snackBar.open('Grupo excluído.', undefined, { duration: 3000 });
    } catch (error) {
      this.snackBar.open(this.describe(error, 'Não foi possível excluir o grupo.'), 'OK', { duration: 5000 });
    }
  }

  private describe(error: unknown, fallback: string): string {
    return describeDataError(error, {
      fallback:
        error instanceof Error && error.message.includes('administrator')
          ? 'O grupo precisa manter pelo menos um administrador.'
          : fallback,
    });
  }
}
