import { Injectable, inject } from '@angular/core';
import { toDataError } from '../../core/supabase/data-error';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { Transaction } from '../transactions/transaction.model';
import { CardInput, CreditCard, Invoice } from './card.model';

@Injectable({ providedIn: 'root' })
export class CardRepository {
  private readonly client = inject(SUPABASE_CLIENT);

  async listByOwner(ownerId: string): Promise<CreditCard[]> {
    const { data, error } = await this.client
      .from('credit_cards')
      .select('*')
      .eq('owner_user_id', ownerId)
      .order('active', { ascending: false })
      .order('name');
    if (error) {
      throw toDataError(error, 'Failed to load credit cards');
    }
    return data;
  }

  // The invoice view has no owner column: scoping by the owner cards keeps a
  // shared context from mixing in the cards of the signed-in user.
  async listInvoices(cardIds: readonly string[]): Promise<Invoice[]> {
    if (cardIds.length === 0) {
      return [];
    }
    const { data, error } = await this.client
      .from('credit_card_invoices')
      .select('credit_card_id, invoice_due_date, total, paid, purchase_count')
      .in('credit_card_id', [...cardIds]);
    if (error) {
      throw toDataError(error, 'Failed to load invoices');
    }
    return data
      .filter((row) => row.credit_card_id !== null && row.invoice_due_date !== null)
      .map((row) => ({
        cardId: row.credit_card_id as string,
        dueDate: row.invoice_due_date as string,
        total: row.total ?? 0,
        paid: row.paid ?? 0,
        purchaseCount: row.purchase_count ?? 0,
      }));
  }

  /** Transactions of one invoice: purchases and the payments made against it. */
  async listInvoiceTransactions(cardId: string, invoiceDueDate: string): Promise<Transaction[]> {
    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .eq('credit_card_id', cardId)
      .eq('invoice_due_date', invoiceDueDate)
      .order('date')
      .order('created_at');
    if (error) {
      throw toDataError(error, 'Failed to load invoice transactions');
    }
    return data;
  }

  async create(ownerUserId: string, input: CardInput): Promise<CreditCard> {
    const { data, error } = await this.client
      .from('credit_cards')
      .insert({ owner_user_id: ownerUserId, ...toRow(input) })
      .select('*')
      .single();
    if (error) {
      throw toDataError(error, 'Failed to create credit card');
    }
    return data;
  }

  async update(id: string, input: CardInput): Promise<void> {
    const { error } = await this.client.from('credit_cards').update(toRow(input)).eq('id', id);
    if (error) {
      throw toDataError(error, 'Failed to update credit card');
    }
  }

  async setActive(id: string, active: boolean): Promise<void> {
    const { error } = await this.client.from('credit_cards').update({ active }).eq('id', id);
    if (error) {
      throw toDataError(error, 'Failed to update credit card');
    }
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from('credit_cards').delete().eq('id', id);
    if (error) {
      throw toDataError(error, 'Failed to delete credit card');
    }
  }
}

function toRow(input: CardInput) {
  return {
    name: input.name,
    institution: input.institution,
    limit_amount: input.limitAmount,
    closing_day: input.closingDay,
    due_day: input.dueDay,
  };
}
