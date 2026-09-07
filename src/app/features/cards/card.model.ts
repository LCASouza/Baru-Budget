import { Tables } from '../../core/supabase/database.types';
import { IsoDate } from '../../shared/dates/iso-date';
import { sumAmounts } from '../../shared/money/money';
import { InvoiceStatus, invoiceClosingDate, invoiceLabel, invoiceStatus } from './invoice';

export type CreditCard = Tables<'credit_cards'>;

export interface CardInput {
  readonly name: string;
  readonly institution: string | null;
  readonly limitAmount: number | null;
  readonly closingDay: number;
  readonly dueDay: number;
}

export interface Invoice {
  readonly cardId: string;
  readonly dueDate: IsoDate;
  readonly total: number;
  readonly paid: number;
  readonly purchaseCount: number;
}

export interface InvoiceView extends Invoice {
  readonly closingDate: IsoDate;
  readonly status: InvoiceStatus;
  readonly remaining: number;
  readonly label: string;
}

export interface CardUsage {
  /** Amount still owed across every invoice that is not fully paid. */
  readonly used: number;
  /** Null when the card has no limit. */
  readonly available: number | null;
}

/** Invoices of a card, most recent first. */
export function buildInvoiceViews(
  card: CreditCard,
  invoices: readonly Invoice[],
  today: IsoDate,
): InvoiceView[] {
  return invoices
    .filter((invoice) => invoice.cardId === card.id)
    .map((invoice) => {
      const closingDate = invoiceClosingDate(invoice.dueDate, card.closing_day, card.due_day);
      return {
        ...invoice,
        closingDate,
        status: invoiceStatus(invoice.total, invoice.paid, closingDate, today),
        remaining: sumAmounts([invoice.total, -invoice.paid]),
        label: invoiceLabel(invoice.dueDate),
      };
    })
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
}

export function cardUsage(card: CreditCard, invoices: readonly InvoiceView[]): CardUsage {
  const used = sumAmounts(
    invoices.filter((invoice) => invoice.status !== 'PAID').map((invoice) => invoice.remaining),
  );
  return {
    used,
    available: card.limit_amount === null ? null : sumAmounts([card.limit_amount, -used]),
  };
}

/** Oldest invoice that is not fully paid, which is the one to settle next. */
export function nextInvoice(invoices: readonly InvoiceView[]): InvoiceView | null {
  return (
    [...invoices]
      .filter((invoice) => invoice.status !== 'PAID')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null
  );
}
