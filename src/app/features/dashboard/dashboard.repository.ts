import { Injectable, inject } from '@angular/core';
import { DateRange } from '../../core/period/period.model';
import { toDataError } from '../../core/supabase/data-error';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
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
}
