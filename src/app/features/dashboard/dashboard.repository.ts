import { Injectable, inject } from '@angular/core';
import { DateRange } from '../../core/period/period.model';
import { toDataError } from '../../core/supabase/data-error';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { readAllPages } from '../../shared/supabase/paginate';
import { Transaction } from '../transactions/transaction.model';
import { MonthlyTotalRow } from './dashboard-summary';

/** Totals of an owner (personal and shared) or of a household. */
export type TotalsScope =
  | { readonly ownerId: string; readonly householdId?: undefined }
  | { readonly householdId: string; readonly ownerId?: undefined };

@Injectable({ providedIn: 'root' })
export class DashboardRepository {
  private readonly client = inject(SUPABASE_CLIENT);

  async listMonthlyTotals(scope: TotalsScope, range: DateRange): Promise<MonthlyTotalRow[]> {
    let query = this.client
      .from('monthly_transaction_totals')
      .select('month, kind, total')
      .gte('month', range.start)
      .lte('month', range.end);
    query =
      scope.householdId !== undefined
        ? query.eq('household_id', scope.householdId)
        : query.eq('owner_user_id', scope.ownerId);
    const { data, error } = await query;
    if (error) {
      throw toDataError(error, 'Failed to load monthly totals');
    }
    return data
      .filter(
        (row): row is { month: string; kind: 'INCOME' | 'EXPENSE'; total: number } =>
          row.month !== null && row.total !== null && (row.kind === 'INCOME' || row.kind === 'EXPENSE'),
      )
      .map((row) => ({ month: row.month, kind: row.kind, total: row.total }));
  }

  /** Ordinary pending bills due in the range; debt instalments and cards are added separately. */
  async listDirectBillsDue(ownerId: string, range: DateRange): Promise<Transaction[]> {
    return readAllPages(
      (from, to) =>
        this.client
          .from('transactions')
          .select('*')
          .eq('owner_user_id', ownerId)
          .eq('kind', 'EXPENSE')
          .eq('status', 'PENDING')
          .is('credit_card_id', null)
          .is('loan_id', null)
          .is('financing_id', null)
          .or(
            `and(due_date.gte.${range.start},due_date.lte.${range.end}),and(due_date.is.null,date.gte.${range.start},date.lte.${range.end})`,
          )
          .order('due_date')
          .range(from, to),
      'Failed to load bills due in the next cycle',
    );
  }
}
