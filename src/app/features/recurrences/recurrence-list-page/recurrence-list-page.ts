import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ViewportService } from '../../../core/layout/viewport.service';
import { PeriodService } from '../../../core/period/period.service';
import { describeDataError } from '../../../core/supabase/data-error';
import { confirmAction } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { openTransactionDialog } from '../../transactions/open-transaction-dialog';
import {
  RECURRENCE_FREQUENCY_LABELS,
  RECURRENCE_TYPE_LABELS,
  RecurrenceType,
} from '../recurrence';
import { MONTH_STATUS_LABELS, RecurrenceView } from '../recurrence.model';
import {
  RecurrenceFormData,
  RecurrenceFormDialog,
} from '../recurrence-form-dialog/recurrence-form-dialog';
import { RecurrencesStore } from '../recurrences.store';

@Component({
  selector: 'app-recurrence-list-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    EmptyState,
  ],
  templateUrl: './recurrence-list-page.html',
  styleUrl: './recurrence-list-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurrenceListPage {
  /** Bound from the route data. */
  readonly type = input.required<RecurrenceType>();

  protected readonly store = inject(RecurrencesStore);
  protected readonly period = inject(PeriodService);
  private readonly viewport = inject(ViewportService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly statusLabels = MONTH_STATUS_LABELS;
  protected readonly frequencyLabels = RECURRENCE_FREQUENCY_LABELS;

  protected readonly views = computed(() => this.store.viewsOf(this.type()));
  protected readonly missing = computed(() => this.store.missingOf(this.type()));
  protected readonly expected = computed(() => this.store.expectedTotalOf(this.type()));
  protected readonly typeLabel = computed(() => RECURRENCE_TYPE_LABELS[this.type()]);
  protected readonly isExpense = computed(() => this.type() === 'EXPENSE');

  protected openForm(template?: RecurrenceView): void {
    const data: RecurrenceFormData = { type: this.type(), template };
    this.dialog.open(RecurrenceFormDialog, {
      data,
      width: '520px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'dialog',
    });
  }

  protected async generate(): Promise<void> {
    try {
      const created = await this.store.generate();
      this.snackBar.open(
        created === 0
          ? 'Nada a gerar neste mês.'
          : `${created} ${created === 1 ? 'lançamento gerado' : 'lançamentos gerados'}.`,
        undefined,
        { duration: 4000 },
      );
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, { fallback: 'Não foi possível gerar os lançamentos.' }),
        'OK',
        { duration: 5000 },
      );
    }
  }

  protected async openInstance(view: RecurrenceView): Promise<void> {
    if (!view.instance) {
      return;
    }
    const result = await openTransactionDialog(this.dialog, this.viewport, {
      transaction: view.instance,
    });
    if (result) {
      this.store.reload();
    }
  }

  protected async toggleActive(view: RecurrenceView): Promise<void> {
    try {
      await this.store.setActive(view.id, view.type, !view.active);
    } catch {
      this.snackBar.open('Não foi possível atualizar o modelo.', 'OK', { duration: 5000 });
    }
  }

  protected async remove(view: RecurrenceView): Promise<void> {
    const confirmed = await confirmAction(this.dialog, {
      title: 'Excluir modelo',
      message: `"${view.description}" deixará de gerar lançamentos. Os lançamentos já gerados continuam nas movimentações.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.store.remove(view.id, view.type);
      this.snackBar.open('Modelo excluído.', undefined, { duration: 3000 });
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, { fallback: 'Não foi possível excluir o modelo.' }),
        'OK',
        { duration: 5000 },
      );
    }
  }
}
