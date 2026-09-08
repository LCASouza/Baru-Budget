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
import { recordStatement } from '../../../shared/components/debt-statement-dialog/debt-statement-dialog';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { SummaryCard, SummaryCardData } from '../../../shared/components/summary-card/summary-card';
import { LOAN_INTEREST_MODEL_LABELS, INTEREST_PERIOD_LABELS } from '../loan-math';
import { LoanFormData, LoanFormDialog } from '../loan-form-dialog/loan-form-dialog';
import { LoanView } from '../loan.model';
import { LoansStore } from '../loans.store';

@Component({
  selector: 'app-loans-page',
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
  templateUrl: './loans-page.html',
  styleUrl: './loans-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoansPage {
  protected readonly store = inject(LoansStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly modelLabels = LOAN_INTEREST_MODEL_LABELS;
  protected readonly periodLabels = INTEREST_PERIOD_LABELS;

  protected readonly cards = computed<readonly SummaryCardData[]>(() => [
    {
      label: 'Total a pagar',
      amount: this.store.totalRemaining(),
      icon: 'account_balance',
      tone: 'payable',
      hint: `${this.store.remainingCount()} ${this.store.remainingCount() === 1 ? 'parcela restante' : 'parcelas restantes'}`,
    },
    {
      label: 'Saldo devedor',
      amount: this.store.views().reduce((total, view) => total + view.outstandingPrincipal, 0),
      icon: 'trending_down',
      tone: 'expense',
      hint: 'Principal ainda não amortizado',
    },
  ]);

  protected openForm(view?: LoanView): void {
    const data: LoanFormData = { loan: view };
    this.dialog.open(LoanFormDialog, {
      data,
      width: '560px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'dialog',
    });
  }

  protected async generate(view: LoanView): Promise<void> {
    try {
      const created = await this.store.generateSchedule(view.loan.id);
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

  protected async addStatement(view: LoanView): Promise<void> {
    const input = await recordStatement(this.dialog, {
      title: 'Registrar extrato',
      hint: 'Informe o que o credor reportou neste mês. O cronograma passa a partir daqui, em vez de projetar do contrato.',
    });
    if (!input) {
      return;
    }
    try {
      await this.store.saveStatement(view.loan.id, input);
      this.snackBar.open('Extrato registrado.', undefined, { duration: 4000 });
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, { fallback: 'Não foi possível registrar o extrato.' }),
        'OK',
        { duration: 5000 },
      );
    }
  }

  protected async realign(view: LoanView): Promise<void> {
    try {
      const changed = await this.store.realignSchedule(view.loan.id);
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

  protected async remove(view: LoanView): Promise<void> {
    const confirmed = await confirmAction(this.dialog, {
      title: 'Excluir empréstimo',
      message: `"${view.loan.description}" será excluído. Os lançamentos já gerados continuam nas movimentações, sem o vínculo.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.store.remove(view.loan.id);
      this.snackBar.open('Empréstimo excluído.', undefined, { duration: 3000 });
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, { fallback: 'Não foi possível excluir o empréstimo.' }),
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
