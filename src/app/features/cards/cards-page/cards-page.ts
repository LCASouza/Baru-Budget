import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { FinancialContextService } from '../../../core/context/financial-context.service';
import { describeDataError } from '../../../core/supabase/data-error';
import { confirmAction } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { INVOICE_STATUS_LABELS } from '../invoice';
import { CardFormData, CardFormDialog } from '../card-form-dialog/card-form-dialog';
import { CreditCard } from '../card.model';
import { CardSummary, CardsStore } from '../cards.store';

@Component({
  selector: 'app-cards-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    EmptyState,
  ],
  templateUrl: './cards-page.html',
  styleUrl: './cards-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardsPage {
  protected readonly store = inject(CardsStore);
  protected readonly context = inject(FinancialContextService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly statusLabels = INVOICE_STATUS_LABELS;

  protected usedPercent(summary: CardSummary): number {
    const limit = summary.card.limit_amount;
    if (!limit || limit <= 0) {
      return 0;
    }
    return Math.min(100, (summary.used / limit) * 100);
  }

  protected openForm(card?: CreditCard): void {
    const data: CardFormData = { card };
    this.dialog.open(CardFormDialog, {
      data,
      width: '480px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'dialog',
    });
  }

  protected async toggleActive(card: CreditCard): Promise<void> {
    try {
      await this.store.setActive(card.id, !card.active);
    } catch {
      this.snackBar.open('Não foi possível atualizar o cartão.', 'OK', { duration: 5000 });
    }
  }

  protected async remove(card: CreditCard): Promise<void> {
    const confirmed = await confirmAction(this.dialog, {
      title: 'Excluir cartão',
      message: `O cartão "${card.name}" será excluído. Cartões com lançamentos não podem ser excluídos; nesse caso, desative-o.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.store.remove(card.id);
      this.snackBar.open('Cartão excluído.', undefined, { duration: 3000 });
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, {
          inUse: 'Este cartão possui lançamentos. Desative-o em vez de excluir.',
          fallback: 'Não foi possível excluir o cartão.',
        }),
        'OK',
        { duration: 6000 },
      );
    }
  }
}
