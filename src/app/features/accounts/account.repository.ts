import { Injectable, inject } from '@angular/core';
import { toDataError } from '../../core/supabase/data-error';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { Account, AccountBalance, AccountInput } from './account.model';

@Injectable({ providedIn: 'root' })
export class AccountRepository {
  private readonly client = inject(SUPABASE_CLIENT);

  async listByOwner(ownerId: string): Promise<Account[]> {
    const { data, error } = await this.client
      .from('accounts')
      .select('*')
      .eq('owner_user_id', ownerId)
      .order('active', { ascending: false })
      .order('name');
    if (error) {
      throw toDataError(error, 'Failed to load accounts');
    }
    return data;
  }

  async listBalances(ownerId: string): Promise<AccountBalance[]> {
    const { data, error } = await this.client
      .from('account_balances')
      .select('account_id, opening_balance, current_balance')
      .eq('owner_user_id', ownerId);
    if (error) {
      throw toDataError(error, 'Failed to load account balances');
    }
    return data
      .filter((row) => row.account_id !== null)
      .map((row) => ({
        accountId: row.account_id as string,
        openingBalance: row.opening_balance ?? 0,
        currentBalance: row.current_balance ?? 0,
      }));
  }

  async create(ownerUserId: string, input: AccountInput): Promise<Account> {
    const { data, error } = await this.client
      .from('accounts')
      .insert({ owner_user_id: ownerUserId, ...toRow(input) })
      .select('*')
      .single();
    if (error) {
      throw toDataError(error, 'Failed to create account');
    }
    return data;
  }

  async update(id: string, input: AccountInput): Promise<void> {
    const { error } = await this.client.from('accounts').update(toRow(input)).eq('id', id);
    if (error) {
      throw toDataError(error, 'Failed to update account');
    }
  }

  async setActive(id: string, active: boolean): Promise<void> {
    const { error } = await this.client.from('accounts').update({ active }).eq('id', id);
    if (error) {
      throw toDataError(error, 'Failed to update account');
    }
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from('accounts').delete().eq('id', id);
    if (error) {
      throw toDataError(error, 'Failed to delete account');
    }
  }
}

function toRow(input: AccountInput) {
  return {
    name: input.name,
    type: input.type,
    institution: input.institution,
    opening_balance: input.openingBalance,
  };
}
