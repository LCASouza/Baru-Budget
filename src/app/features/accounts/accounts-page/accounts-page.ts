import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ACCOUNT_TYPE_LABELS } from '../../../core/finance/account-type';
import { describeDataError } from '../../../core/supabase/data-error';
import { confirmAction } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { SummaryCard, SummaryCardData } from '../../../shared/components/summary-card/summary-card';
import { Account } from '../account.model';
import { AccountFormDialog, AccountFormData } from '../account-form-dialog/account-form-dialog';
import { AccountsStore } from '../accounts.store';

@Component({
  selector: 'app-accounts-page',
  imports: [
    CurrencyPipe,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    SummaryCard,
    EmptyState,
  ],
  templateUrl: './accounts-page.html',
  styleUrl: './accounts-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountsPage {
  protected readonly store = inject(AccountsStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly typeLabels = ACCOUNT_TYPE_LABELS;

  protected readonly summaryCards = computed<readonly SummaryCardData[]>(() => {
    const totals = this.store.totals();
    return [
      {
        label: 'Saldo monetário',
        amount: totals.money,
        icon: 'account_balance_wallet',
        tone: 'balance',
        hint: 'Contas bancárias, dinheiro e outras',
        signed: true,
      },
      {
        label: 'Benefícios',
        amount: totals.benefit,
        icon: 'restaurant',
        tone: 'benefit',
        hint: 'Vale alimentação, refeição e similares',
        signed: true,
      },
    ];
  });

  protected balanceOf(account: Account): number {
    return this.store.balanceById().get(account.id) ?? account.opening_balance;
  }

  protected openForm(account?: Account): void {
    const data: AccountFormData = { account };
    this.dialog.open(AccountFormDialog, { data, maxWidth: 'calc(100vw - 32px)', autoFocus: 'dialog' });
  }

  protected async toggleActive(account: Account): Promise<void> {
    try {
      await this.store.setActive(account.id, !account.active);
    } catch {
      this.snackBar.open('Não foi possível atualizar a conta.', 'OK', { duration: 5000 });
    }
  }

  protected async remove(account: Account): Promise<void> {
    const confirmed = await confirmAction(this.dialog, {
      title: 'Excluir conta',
      message: `A conta "${account.name}" será excluída. Contas com movimentações não podem ser excluídas; nesse caso, desative-a.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.store.remove(account.id);
      this.snackBar.open('Conta excluída.', undefined, { duration: 3000 });
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, {
          inUse: 'Esta conta possui movimentações. Desative-a em vez de excluir.',
          fallback: 'Não foi possível excluir a conta.',
        }),
        'OK',
        { duration: 6000 },
      );
    }
  }
}
