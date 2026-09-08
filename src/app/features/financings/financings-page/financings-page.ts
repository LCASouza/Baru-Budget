import { CurrencyPipe, DatePipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { describeDataError } from '../../../core/supabase/data-error';
import { confirmAction } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { SummaryCard, SummaryCardData } from '../../../shared/components/summary-card/summary-card';
import {
  FINANCING_SYSTEM_LABELS,
  INTEREST_PERIOD_LABELS,
} from '../financing-math';
import {
  FinancingFormData,
  FinancingFormDialog,
} from '../financing-form-dialog/financing-form-dialog';
import { FinancingView } from '../financing.model';
import { FinancingsStore } from '../financings.store';

@Component({
  selector: 'app-financings-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    PercentPipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    SummaryCard,
    EmptyState,
  ],
  templateUrl: './financings-page.html',
  styleUrl: './financings-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinancingsPage {
  protected readonly store = inject(FinancingsStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly systemLabels = FINANCING_SYSTEM_LABELS;
  protected readonly periodLabels = INTEREST_PERIOD_LABELS;

  protected readonly cards = computed<readonly SummaryCardData[]>(() => [
    {
      label: 'Total a pagar',
      amount: this.store.totalRemaining(),
      icon: 'house',
      tone: 'payable',
      hint: `${this.store.remainingCount()} ${this.store.remainingCount() === 1 ? 'parcela restante' : 'parcelas restantes'}`,
    },
    {
      label: 'Saldo devedor',
      amount: this.store.outstandingPrincipal(),
      icon: 'trending_down',
      tone: 'expense',
      hint: 'Valor financiado ainda não amortizado',
    },
  ]);

  protected openForm(view?: FinancingView): void {
    const data: FinancingFormData = { financing: view };
    this.dialog.open(FinancingFormDialog, {
      data,
      width: '560px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'dialog',
    });
  }

  protected async generate(view: FinancingView): Promise<void> {
    try {
      const created = await this.store.generateSchedule(view.financing.id);
      this.snackBar.open(
        created === 0
          ? 'O cronograma já estava completo.'
          : `${created} ${created === 1 ? 'lançamento gerado' : 'lançamentos gerados'}.`,
        undefined,
        { duration: 4000 },
      );
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, { fallback: 'Não foi possível gerar o cronograma.' }),
        'OK',
        { duration: 5000 },
      );
    }
  }

  protected async realign(view: FinancingView): Promise<void> {
    try {
      const changed = await this.store.realignSchedule(view.financing.id);
      this.snackBar.open(
        changed === 0
          ? 'As parcelas pendentes já seguiam o cronograma.'
          : `${changed} ${changed === 1 ? 'parcela atualizada' : 'parcelas atualizadas'}.`,
        undefined,
        { duration: 4000 },
      );
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, { fallback: 'Não foi possível atualizar as parcelas.' }),
        'OK',
        { duration: 5000 },
      );
    }
  }

  protected async remove(view: FinancingView): Promise<void> {
    const confirmed = await confirmAction(this.dialog, {
      title: 'Excluir financiamento',
      message: `"${view.financing.description}" será excluído. Os lançamentos já gerados continuam nas movimentações, sem o vínculo.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.store.remove(view.financing.id);
      this.snackBar.open('Financiamento excluído.', undefined, { duration: 3000 });
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, { fallback: 'Não foi possível excluir o financiamento.' }),
        'OK',
        { duration: 5000 },
      );
    }
  }

  /** The store loads on demand, so the screen that shows it asks for it. */
  constructor() {
    this.store.activate();
  }
}
