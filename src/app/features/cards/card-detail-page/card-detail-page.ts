import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, resource, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { FinancialContextService } from '../../../core/context/financial-context.service';
import { ViewportService } from '../../../core/layout/viewport.service';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { CategoriesStore } from '../../categories/categories.store';
import { openTransactionDialog } from '../../transactions/open-transaction-dialog';
import { Transaction } from '../../transactions/transaction.model';
import { INVOICE_STATUS_LABELS } from '../invoice';
import { InvoiceView } from '../card.model';
import { CardRepository } from '../card.repository';
import { CardsStore } from '../cards.store';

interface InvoiceLine {
  readonly transaction: Transaction;
  readonly categoryName: string | null;
  readonly isPayment: boolean;
}

@Component({
  selector: 'app-card-detail-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    EmptyState,
  ],
  templateUrl: './card-detail-page.html',
  styleUrl: './card-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardDetailPage {
  /** Bound from the `:id` route parameter. */
  readonly id = input.required<string>();

  protected readonly store = inject(CardsStore);
  protected readonly context = inject(FinancialContextService);
  private readonly categories = inject(CategoriesStore);
  private readonly repository = inject(CardRepository);
  private readonly viewport = inject(ViewportService);
  private readonly dialog = inject(MatDialog);

  protected readonly statusLabels = INVOICE_STATUS_LABELS;
  private readonly selectedDueDate = signal<string | null>(null);

  protected readonly summary = computed(() => this.store.summaryOf(this.id()));
  protected readonly invoices = computed(() => this.summary()?.invoices ?? []);
  protected readonly selected = computed<InvoiceView | null>(() => {
    const invoices = this.invoices();
    const due = this.selectedDueDate();
    return invoices.find((invoice) => invoice.dueDate === due) ?? invoices[0] ?? null;
  });

  private readonly linesResource = resource({
    params: () => {
      const invoice = this.selected();
      return invoice ? { cardId: invoice.cardId, dueDate: invoice.dueDate } : undefined;
    },
    loader: ({ params }) => this.repository.listInvoiceTransactions(params.cardId, params.dueDate),
  });

  protected readonly lines = computed<readonly InvoiceLine[]>(() => {
    if (!this.linesResource.hasValue()) {
      return [];
    }
    const categories = this.categories.byId();
    return this.linesResource.value().map((transaction) => ({
      transaction,
      categoryName: transaction.category_id
        ? (categories.get(transaction.category_id)?.name ?? null)
        : null,
      isPayment: transaction.kind === 'TRANSFER',
    }));
  });
  protected readonly linesLoading = this.linesResource.isLoading;

  constructor() {
    // A different card resets the selection to its most recent invoice.
    effect(() => {
      this.id();
      this.selectedDueDate.set(null);
    });
  }

  protected select(invoice: InvoiceView): void {
    this.selectedDueDate.set(invoice.dueDate);
  }

  protected async payInvoice(invoice: InvoiceView): Promise<void> {
    const card = this.summary()?.card;
    if (!card) {
      return;
    }
    const result = await openTransactionDialog(this.dialog, this.viewport, {
      invoicePayment: {
        cardId: card.id,
        cardName: card.name,
        invoiceDueDate: invoice.dueDate,
        amount: invoice.remaining,
      },
    });
    if (result) {
      this.store.reload();
      this.linesResource.reload();
    }
  }

  protected async open(transaction: Transaction): Promise<void> {
    const result = await openTransactionDialog(this.dialog, this.viewport, { transaction });
    if (result) {
      this.store.reload();
      this.linesResource.reload();
    }
  }
}
