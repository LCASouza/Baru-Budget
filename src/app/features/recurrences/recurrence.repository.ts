import { Injectable, inject } from '@angular/core';
import { toDataError } from '../../core/supabase/data-error';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { IsoDate } from '../../shared/dates/iso-date';
import { Transaction } from '../transactions/transaction.model';
import { RecurrenceType } from './recurrence';
import {
  RecurrenceInput,
  RecurrenceTemplate,
  fromFixedExpense,
  fromRecurringIncome,
} from './recurrence.model';

@Injectable({ providedIn: 'root' })
export class RecurrenceRepository {
  private readonly client = inject(SUPABASE_CLIENT);

  async listTemplates(ownerId: string): Promise<RecurrenceTemplate[]> {
    const [expenses, incomes] = await Promise.all([
      this.client
        .from('fixed_expenses')
        .select('*')
        .eq('owner_user_id', ownerId)
        .order('active', { ascending: false })
        .order('due_day'),
      this.client
        .from('recurring_incomes')
        .select('*')
        .eq('owner_user_id', ownerId)
        .order('active', { ascending: false })
        .order('receipt_day'),
    ]);
    if (expenses.error) {
      throw toDataError(expenses.error, 'Failed to load fixed expenses');
    }
    if (incomes.error) {
      throw toDataError(incomes.error, 'Failed to load recurring incomes');
    }
    return [...expenses.data.map(fromFixedExpense), ...incomes.data.map(fromRecurringIncome)];
  }

  /** Instances already generated for one competence month. */
  async listInstances(ownerId: string, month: IsoDate): Promise<Transaction[]> {
    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .eq('owner_user_id', ownerId)
      .eq('recurrence_month', month);
    if (error) {
      throw toDataError(error, 'Failed to load recurrence instances');
    }
    return data;
  }

  async create(ownerId: string, type: RecurrenceType, input: RecurrenceInput): Promise<void> {
    const error =
      type === 'EXPENSE'
        ? (
            await this.client.from('fixed_expenses').insert({
              owner_user_id: ownerId,
              description: input.description,
              category_id: input.categoryId,
              account_id: input.accountId,
              credit_card_id: input.creditCardId,
              household_id: input.householdId,
              default_amount: input.defaultAmount,
              due_day: input.day,
              frequency: input.frequency,
              anchor_month: input.anchorMonth,
              notes: input.notes,
            })
          ).error
        : (
            await this.client.from('recurring_incomes').insert({
              owner_user_id: ownerId,
              description: input.description,
              category_id: input.categoryId,
              account_id: input.accountId as string,
              household_id: input.householdId,
              default_amount: input.defaultAmount,
              receipt_day: input.day,
              frequency: input.frequency,
              anchor_month: input.anchorMonth,
              notes: input.notes,
            })
          ).error;
    if (error) {
      throw toDataError(error, 'Failed to create recurrence template');
    }
  }

  async update(id: string, type: RecurrenceType, input: RecurrenceInput): Promise<void> {
    const error =
      type === 'EXPENSE'
        ? (
            await this.client
              .from('fixed_expenses')
              .update({
                description: input.description,
                category_id: input.categoryId,
                account_id: input.accountId,
                credit_card_id: input.creditCardId,
                household_id: input.householdId,
                default_amount: input.defaultAmount,
                due_day: input.day,
                frequency: input.frequency,
                anchor_month: input.anchorMonth,
                notes: input.notes,
              })
              .eq('id', id)
          ).error
        : (
            await this.client
              .from('recurring_incomes')
              .update({
                description: input.description,
                category_id: input.categoryId,
                account_id: input.accountId as string,
                household_id: input.householdId,
                default_amount: input.defaultAmount,
                receipt_day: input.day,
                frequency: input.frequency,
                anchor_month: input.anchorMonth,
                notes: input.notes,
              })
              .eq('id', id)
          ).error;
    if (error) {
      throw toDataError(error, 'Failed to update recurrence template');
    }
  }

  async setActive(id: string, type: RecurrenceType, active: boolean): Promise<void> {
    const error =
      type === 'EXPENSE'
        ? (await this.client.from('fixed_expenses').update({ active }).eq('id', id)).error
        : (await this.client.from('recurring_incomes').update({ active }).eq('id', id)).error;
    if (error) {
      throw toDataError(error, 'Failed to update recurrence template');
    }
  }

  async remove(id: string, type: RecurrenceType): Promise<void> {
    const error =
      type === 'EXPENSE'
        ? (await this.client.from('fixed_expenses').delete().eq('id', id)).error
        : (await this.client.from('recurring_incomes').delete().eq('id', id)).error;
    if (error) {
      throw toDataError(error, 'Failed to delete recurrence template');
    }
  }

  /** Creates the missing instances of the month and returns how many were created. */
  async generate(ownerId: string, month: IsoDate): Promise<number> {
    const { data, error } = await this.client.rpc('generate_recurrences', {
      p_owner_user_id: ownerId,
      p_month: month,
    });
    if (error) {
      throw toDataError(error, 'Failed to generate recurrences');
    }
    return data ?? 0;
  }
}
