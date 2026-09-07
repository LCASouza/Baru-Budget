import { Injectable, inject } from '@angular/core';
import { toDataError } from '../../core/supabase/data-error';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { IsoDate } from '../../shared/dates/iso-date';
import { Transaction } from '../transactions/transaction.model';
import { InstallmentPurchase } from './installment.model';

export interface InstallmentPurchaseInput {
  readonly ownerUserId: string;
  readonly description: string;
  readonly totalAmount: number;
  readonly installmentCount: number;
  readonly date: IsoDate;
  readonly categoryId: string;
  readonly creditCardId: string | null;
  readonly accountId: string | null;
  readonly householdId: string | null;
  readonly notes: string | null;
}

@Injectable({ providedIn: 'root' })
export class InstallmentRepository {
  private readonly client = inject(SUPABASE_CLIENT);

  async listPurchases(ownerId: string): Promise<InstallmentPurchase[]> {
    const { data, error } = await this.client
      .from('installment_purchases')
      .select('*')
      .eq('owner_user_id', ownerId);
    if (error) {
      throw toDataError(error, 'Failed to load installment purchases');
    }
    return data
      .filter((row) => row.id !== null && row.first_competence !== null)
      .map((row) => ({
        id: row.id as string,
        description: row.description ?? '',
        installmentCount: row.installment_count ?? 0,
        recordedCount: row.recorded_count ?? 0,
        totalAmount: row.total_amount ?? 0,
        firstCompetence: row.first_competence as string,
        lastCompetence: row.last_competence ?? (row.first_competence as string),
        remainingCount: row.remaining_count ?? 0,
        remainingAmount: row.remaining_amount ?? 0,
        creditCardId: row.credit_card_id,
        accountId: row.account_id,
        categoryId: row.category_id,
      }));
  }

  /**
   * Instalments from `fromDate` on. A card instalment is dated about a month
   * before its invoice, so the caller asks from a couple of months back and
   * filters by competence afterwards.
   */
  async listInstallmentsFrom(ownerId: string, fromDate: IsoDate): Promise<Transaction[]> {
    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .eq('owner_user_id', ownerId)
      .not('installment_group_id', 'is', null)
      .gte('date', fromDate)
      .order('date');
    if (error) {
      throw toDataError(error, 'Failed to load instalments');
    }
    return data;
  }

  async listGroupInstallments(groupId: string): Promise<Transaction[]> {
    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .eq('installment_group_id', groupId)
      .order('installment_number');
    if (error) {
      throw toDataError(error, 'Failed to load instalments');
    }
    return data;
  }

  async create(input: InstallmentPurchaseInput): Promise<string> {
    const { data, error } = await this.client.rpc('create_installment_purchase', {
      p_owner_user_id: input.ownerUserId,
      p_description: input.description,
      p_total_amount: input.totalAmount,
      p_installment_count: input.installmentCount,
      p_date: input.date,
      p_category_id: input.categoryId,
      p_credit_card_id: input.creditCardId ?? undefined,
      p_account_id: input.accountId ?? undefined,
      p_household_id: input.householdId ?? undefined,
      p_notes: input.notes ?? undefined,
    });
    if (error) {
      throw toDataError(error, 'Failed to create installment purchase');
    }
    return data as string;
  }

  async removeGroup(groupId: string): Promise<void> {
    const { error } = await this.client
      .from('transactions')
      .delete()
      .eq('installment_group_id', groupId);
    if (error) {
      throw toDataError(error, 'Failed to delete installment purchase');
    }
  }
}
