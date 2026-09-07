import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ViewportService } from '../../../core/layout/viewport.service';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { SummaryCard, SummaryCardData } from '../../../shared/components/summary-card/summary-card';
import { openTransactionDialog } from '../../transactions/open-transaction-dialog';
import { LedgerItem, PersonBalance } from '../allocation.model';
import {
  SettlementFormData,
  SettlementFormDialog,
} from '../settlement-form-dialog/settlement-form-dialog';
import { SettlementsStore } from '../settlements.store';

@Component({
  selector: 'app-settlements-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    SummaryCard,
    EmptyState,
  ],
  templateUrl: './settlements-page.html',
  styleUrl: './settlements-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettlementsPage {
  protected readonly store = inject(SettlementsStore);
  private readonly viewport = inject(ViewportService);
  private readonly dialog = inject(MatDialog);

  protected readonly cards = computed<readonly SummaryCardData[]>(() => {
    const totals = this.store.totals();
    return [
      {
        label: 'A receber',
        amount: totals.receivable,
        icon: 'call_received',
        tone: 'receivable',
        hint: `${this.store.balances().filter((b) => b.balance > 0).length} pessoas`,
      },
      {
        label: 'A pagar',
        amount: totals.payable,
        icon: 'call_made',
        tone: 'payable',
        hint: `${this.store.balances().filter((b) => b.balance < 0).length} pessoas`,
      },
      {
        label: 'Saldo líquido',
        amount: totals.net,
        icon: 'account_balance_wallet',
        tone: 'balance',
        hint: 'A receber menos a pagar',
        signed: true,
      },
    ];
  });

  protected openSettlement(person?: PersonBalance): void {
    const data: SettlementFormData = person
      ? { counterpartyUserId: person.userId, counterpartyName: person.name, balance: person.balance }
      : {};
    this.dialog.open(SettlementFormDialog, {
      data,
      width: '480px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'dialog',
    });
  }

  protected async openItem(item: LedgerItem): Promise<void> {
    const result = await openTransactionDialog(this.dialog, this.viewport, {
      transaction: item.transaction,
    });
    if (result) {
      this.store.reload();
    }
  }
}
