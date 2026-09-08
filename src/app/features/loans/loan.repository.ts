import { Injectable, inject } from '@angular/core';
import { toDataError } from '../../core/supabase/data-error';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { Transaction } from '../transactions/transaction.model';
import { Loan, LoanInput } from './loan.model';

@Injectable({ providedIn: 'root' })
export class LoanRepository {
  private readonly client = inject(SUPABASE_CLIENT);

  async listByOwner(ownerId: string): Promise<Loan[]> {
    const { data, error } = await this.client
      .from('loans')
      .select('*')
      .eq('owner_user_id', ownerId)
      .order('start_date', { ascending: false });
    if (error) {
      throw toDataError(error, 'Failed to load loans');
    }
    return data;
  }

  /** Every transaction linked to a loan of the owner: disbursements and instalments. */
  async listTransactions(ownerId: string): Promise<Transaction[]> {
    const { data, error } = await this.client
      .from('transactions')
      .select('*')
      .eq('owner_user_id', ownerId)
      .not('loan_id', 'is', null)
      .order('loan_installment_number');
    if (error) {
      throw toDataError(error, 'Failed to load loan transactions');
    }
    return data;
  }

  async create(ownerId: string, input: LoanInput): Promise<Loan> {
    const { data, error } = await this.client
      .from('loans')
      .insert({ owner_user_id: ownerId, ...toRow(input) })
      .select('*')
      .single();
    if (error) {
      throw toDataError(error, 'Failed to create loan');
    }
    return data;
  }

  async update(id: string, input: LoanInput): Promise<void> {
    const { error } = await this.client.from('loans').update(toRow(input)).eq('id', id);
    if (error) {
      throw toDataError(error, 'Failed to update loan');
    }
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from('loans').delete().eq('id', id);
    if (error) {
      throw toDataError(error, 'Failed to delete loan');
    }
  }

  async generateSchedule(loanId: string, withDisbursement: boolean): Promise<number> {
    const { data, error } = await this.client.rpc('generate_loan_schedule', {
      p_loan_id: loanId,
      p_with_disbursement: withDisbursement,
    });
    if (error) {
      throw toDataError(error, 'Failed to generate the loan schedule');
    }
    return data ?? 0;
  }

  /** Brings pending instalments back in line with the schedule after an edit. */
  async realignSchedule(loanId: string): Promise<number> {
    const { data, error } = await this.client.rpc('realign_loan_schedule', { p_loan_id: loanId });
    if (error) {
      throw toDataError(error, 'Failed to realign the loan schedule');
    }
    return data ?? 0;
  }
}

function toRow(input: LoanInput) {
  return {
    description: input.description,
    lender: input.lender,
    account_id: input.accountId,
    category_id: input.categoryId,
    disbursement_category_id: input.disbursementCategoryId,
    household_id: input.householdId,
    principal: input.principal,
    interest_rate: input.interestRate,
    interest_period: input.interestPeriod,
    interest_model: input.interestModel,
    installment_count: input.installmentCount,
    start_date: input.startDate,
    first_due_date: input.firstDueDate,
    notes: input.notes,
  };
}
