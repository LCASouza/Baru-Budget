import { Injectable, computed, inject, resource } from '@angular/core';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { todayIso } from '../../shared/dates/iso-date';
import { sumAmounts } from '../../shared/money/money';
import { CardInput, CreditCard, Invoice, InvoiceView, buildInvoiceViews, cardUsage, nextInvoice } from './card.model';
import { CardRepository } from './card.repository';

export interface CardSummary {
  readonly card: CreditCard;
  readonly invoices: readonly InvoiceView[];
  readonly next: InvoiceView | null;
  readonly used: number;
  readonly available: number | null;
}

@Injectable({ providedIn: 'root' })
export class CardsStore {
  private readonly context = inject(FinancialContextService);
  private readonly repository = inject(CardRepository);

  private readonly cardsResource = resource({
    params: () => this.context.dataOwnerId() ?? undefined,
    loader: async ({ params: ownerId }) => {
      const cards = await this.repository.listByOwner(ownerId);
      const invoices = await this.repository.listInvoices(cards.map((card) => card.id));
      return { cards, invoices };
    },
  });

  readonly cards = computed<readonly CreditCard[]>(() =>
    this.cardsResource.hasValue() ? this.cardsResource.value().cards : [],
  );
  readonly activeCards = computed(() => this.cards().filter((card) => card.active));
  readonly byId = computed(() => new Map(this.cards().map((card) => [card.id, card])));
  readonly nameById = computed<ReadonlyMap<string, string>>(
    () => new Map(this.cards().map((card) => [card.id, card.name])),
  );
  private readonly invoices = computed<readonly Invoice[]>(() =>
    this.cardsResource.hasValue() ? this.cardsResource.value().invoices : [],
  );

  readonly summaries = computed<readonly CardSummary[]>(() => {
    const today = todayIso();
    return this.cards().map((card) => {
      const invoices = buildInvoiceViews(card, this.invoices(), today);
      const usage = cardUsage(card, invoices);
      return { card, invoices, next: nextInvoice(invoices), used: usage.used, available: usage.available };
    });
  });

  readonly isLoading = this.cardsResource.isLoading;
  readonly error = this.cardsResource.error;
  readonly loaded = computed(() => this.cardsResource.hasValue());

  summaryOf(cardId: string): CardSummary | null {
    return this.summaries().find((summary) => summary.card.id === cardId) ?? null;
  }

  invoicesOf(cardId: string): readonly InvoiceView[] {
    return this.summaryOf(cardId)?.invoices ?? [];
  }

  /** Unpaid invoices due within the given range, used by the dashboard. */
  dueBetween(start: string, end: string): readonly InvoiceView[] {
    return this.summaries()
      .flatMap((summary) => summary.invoices)
      .filter(
        (invoice) =>
          invoice.status !== 'PAID' && invoice.dueDate >= start && invoice.dueDate <= end,
      );
  }

  totalDueBetween(start: string, end: string): number {
    return sumAmounts(this.dueBetween(start, end).map((invoice) => invoice.remaining));
  }

  async create(input: CardInput): Promise<void> {
    await this.repository.create(this.requireOwnerId(), input);
    this.reload();
  }

  async update(id: string, input: CardInput): Promise<void> {
    await this.repository.update(id, input);
    this.reload();
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await this.repository.setActive(id, active);
    this.reload();
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
    this.reload();
  }

  reload(): void {
    this.cardsResource.reload();
  }

  private requireOwnerId(): string {
    const ownerId = this.context.dataOwnerId();
    if (!ownerId) {
      throw new Error('No authenticated user.');
    }
    return ownerId;
  }
}
