import { Injectable, inject } from '@angular/core';
import { toDataError } from '../../core/supabase/data-error';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { IsoDate } from '../../shared/dates/iso-date';
import { Transaction } from '../transactions/transaction.model';
import { Allocation } from './allocation.model';

export interface SettlementInput {
  readonly ownerUserId: string;
  readonly counterpartyUserId: string;
  readonly direction: 'PAY' | 'RECEIVE';
  readonly description: string;
  readonly amount: number;
  readonly date: IsoDate;
  readonly accountId: string;
}

interface RawBalance {
  counterparty_user_id: string | null;
  balance: number | null;
}

@Injectable({ providedIn: 'root' })
export class SettlementsRepository {
  private readonly client = inject(SUPABASE_CLIENT);

  async listBalances(): Promise<{ userId: string; balance: number }[]> {
    const { data, error } = await this.client
      .from('people_balances')
      .select('counterparty_user_id, balance');
    if (error) {
      throw toDataError(error, 'Failed to load balances');
    }
    return (data as RawBalance[])
      .filter((row) => row.counterparty_user_id !== null)
      .map((row) => ({ userId: row.counterparty_user_id as string, balance: row.balance ?? 0 }));
  }

  async listAllocations(transactionId: string): Promise<Allocation[]> {
    const { data, error } = await this.client
      .from('transaction_allocations')
      .select('*')
      .eq('transaction_id', transactionId);
    if (error) {
      throw toDataError(error, 'Failed to load allocations');
    }
    return data;
  }

  async listAllocationsIn(transactionIds: readonly string[]): Promise<Allocation[]> {
    if (transactionIds.length === 0) {
      return [];
    }
    const { data, error } = await this.client
      .from('transaction_allocations')
      .select('*')
      .in('transaction_id', [...transactionIds]);
    if (error) {
      throw toDataError(error, 'Failed to load allocations');
    }
    return data;
  }

  /** Allocations of the pair, with the transaction they belong to. */
  async listPairAllocations(
    meId: string,
    counterpartyId: string,
  ): Promise<(Allocation & { transaction: Transaction })[]> {
    const { data, error } = await this.client
      .from('transaction_allocations')
      .select('*, transaction:transactions!inner(*)')
      .in('user_id', [meId, counterpartyId])
      .overrideTypes<(Allocation & { transaction: Transaction })[], { merge: false }>();
    if (error) {
      throw toDataError(error, 'Failed to load shared expenses');
    }
    return data;
  }

  async listPairSettlements(meId: string, counterpartyId: string): Promise<Transaction[]> {
    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .eq('kind', 'SETTLEMENT')
      .or(
        `and(owner_user_id.eq.${meId},counterparty_user_id.eq.${counterpartyId}),and(owner_user_id.eq.${counterpartyId},counterparty_user_id.eq.${meId})`,
      );
    if (error) {
      throw toDataError(error, 'Failed to load settlements');
    }
    return data;
  }

  async setAllocations(
    transactionId: string,
    userIds: readonly string[],
    amounts: readonly number[],
  ): Promise<void> {
    const { error } = await this.client.rpc('set_transaction_allocations', {
      p_transaction_id: transactionId,
      p_user_ids: [...userIds],
      p_amounts: [...amounts],
    });
    if (error) {
      throw toDataError(error, 'Failed to save the split');
    }
  }

  async createSettlement(input: SettlementInput): Promise<void> {
    const { error } = await this.client.from('transactions').insert({
      owner_user_id: input.ownerUserId,
      kind: 'SETTLEMENT',
      description: input.description,
      amount: input.amount,
      date: input.date,
      status: 'PAID',
      account_id: input.accountId,
      counterparty_user_id: input.counterpartyUserId,
      settlement_direction: input.direction,
    });
    if (error) {
      throw toDataError(error, 'Failed to record the settlement');
    }
  }
}
