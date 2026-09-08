import { Injectable, inject } from '@angular/core';
import { toDataError } from '../../core/supabase/data-error';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { Transaction } from '../transactions/transaction.model';
import { Financing, FinancingInput } from './financing.model';

@Injectable({ providedIn: 'root' })
export class FinancingRepository {
  private readonly client = inject(SUPABASE_CLIENT);

  async listByOwner(ownerId: string): Promise<Financing[]> {
    const { data, error } = await this.client
      .from('financings')
      .select('*')
      .eq('owner_user_id', ownerId)
      .order('acquisition_date', { ascending: false });
    if (error) {
      throw toDataError(error, 'Failed to load financings');
    }
    return data;
  }

  /** Every transaction linked to a financing of the owner: down payments and instalments. */
  async listTransactions(ownerId: string): Promise<Transaction[]> {
    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .eq('owner_user_id', ownerId)
      .not('financing_id', 'is', null)
      .order('financing_installment_number');
    if (error) {
      throw toDataError(error, 'Failed to load financing transactions');
    }
    return data;
  }

  async create(ownerId: string, input: FinancingInput): Promise<Financing> {
    const { data, error } = await this.client
      .from('financings')
      .insert({ owner_user_id: ownerId, ...toRow(input) })
      .select('*')
      .single();
    if (error) {
      throw toDataError(error, 'Failed to create financing');
    }
    return data;
  }

  async update(id: string, input: FinancingInput): Promise<void> {
    const { error } = await this.client.from('financings').update(toRow(input)).eq('id', id);
    if (error) {
      throw toDataError(error, 'Failed to update financing');
    }
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from('financings').delete().eq('id', id);
    if (error) {
      throw toDataError(error, 'Failed to delete financing');
    }
  }

  async generateSchedule(financingId: string, withDownPayment: boolean): Promise<number> {
    const { data, error } = await this.client.rpc('generate_financing_schedule', {
      p_financing_id: financingId,
      p_with_down_payment: withDownPayment,
    });
    if (error) {
      throw toDataError(error, 'Failed to generate the financing schedule');
    }
    return data ?? 0;
  }

  /** Brings pending instalments back in line with the schedule after an edit. */
  async realignSchedule(financingId: string): Promise<number> {
    const { data, error } = await this.client.rpc('realign_financing_schedule', {
      p_financing_id: financingId,
    });
    if (error) {
      throw toDataError(error, 'Failed to realign the financing schedule');
    }
    return data ?? 0;
  }
}

function toRow(input: FinancingInput) {
  return {
    description: input.description,
    institution: input.institution,
    account_id: input.accountId,
    category_id: input.categoryId,
    down_payment_category_id: input.downPaymentCategoryId,
    household_id: input.householdId,
    asset_value: input.assetValue,
    down_payment: input.downPayment,
    interest_rate: input.interestRate,
    interest_period: input.interestPeriod,
    system: input.system,
    installment_count: input.installmentCount,
    acquisition_date: input.acquisitionDate,
    first_due_date: input.firstDueDate,
    notes: input.notes,
  };
}
