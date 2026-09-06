import { Injectable, inject } from '@angular/core';
import { DateRange } from '../../core/period/period.model';
import { toDataError } from '../../core/supabase/data-error';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { Transaction, TransactionInput } from './transaction.model';

// PostgREST caps responses at 1000 rows; the limit is explicit so the cap is
// deterministic together with the ordering.
export const TRANSACTIONS_PAGE_LIMIT = 1000;

/** Personal (or shared) transactions of an owner, or every transaction of a household. */
export type TransactionScope =
  | { readonly ownerId: string; readonly householdId?: undefined }
  | { readonly householdId: string; readonly ownerId?: undefined };

@Injectable({ providedIn: 'root' })
export class TransactionRepository {
  private readonly client = inject(SUPABASE_CLIENT);

  async listByDateRange(range: DateRange, scope: TransactionScope): Promise<Transaction[]> {
    let query = this.client
      .from('transactions')
      .select('*')
      .gte('date', range.start)
      .lte('date', range.end);
    query =
      scope.householdId !== undefined
        ? query.eq('household_id', scope.householdId)
        : query.eq('owner_user_id', scope.ownerId);
    const { data, error } = await query
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(TRANSACTIONS_PAGE_LIMIT);
    if (error) {
      throw toDataError(error, 'Failed to load transactions');
    }
    return data;
  }

  async create(ownerUserId: string, input: TransactionInput): Promise<Transaction> {
    const { data, error } = await this.client
      .from('transactions')
      .insert({ owner_user_id: ownerUserId, ...toRow(input) })
      .select('*')
      .single();
    if (error) {
      throw toDataError(error, 'Failed to create transaction');
    }
    return data;
  }

  async update(id: string, input: TransactionInput): Promise<void> {
    const { error } = await this.client.from('transactions').update(toRow(input)).eq('id', id);
    if (error) {
      throw toDataError(error, 'Failed to update transaction');
    }
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from('transactions').delete().eq('id', id);
    if (error) {
      throw toDataError(error, 'Failed to delete transaction');
    }
  }
}

function toRow(input: TransactionInput) {
  return {
    kind: input.kind,
    description: input.description,
    amount: input.amount,
    date: input.date,
    due_date: input.dueDate,
    status: input.status,
    category_id: input.categoryId,
    account_id: input.accountId,
    destination_account_id: input.destinationAccountId,
    household_id: input.householdId,
    notes: input.notes,
  };
}
