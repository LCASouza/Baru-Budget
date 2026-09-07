import { Injectable, inject } from '@angular/core';
import { toDataError } from '../../core/supabase/data-error';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { readAllPages } from '../../shared/supabase/paginate';
import { DatabaseRow, ExportableTable, OwnedTable, SharedTable } from './workbook-schema';

const WRITE_BATCH = 200;

/**
 * Reads and writes used by the Excel format. Everything goes through the
 * authenticated client, so row level security decides each row: the workbook
 * never carries authority.
 */
@Injectable({ providedIn: 'root' })
export class DataTransferRepository {
  private readonly client = inject(SUPABASE_CLIENT);

  /** Reads a whole table in pages, so a backup is never truncated. */
  async listOwned(table: OwnedTable, ownerId: string): Promise<DatabaseRow[]> {
    return readAllPages<DatabaseRow>(
      (from, to) =>
        this.client.from(table).select('*').eq('owner_user_id', ownerId).range(from, to),
      `Failed to read ${table}`,
    );
  }

  /** Reads a table without an owner column: row level security is the filter. */
  async listVisible(table: SharedTable): Promise<DatabaseRow[]> {
    return readAllPages<DatabaseRow>(
      (from, to) => this.client.from(table).select('*').range(from, to),
      `Failed to read ${table}`,
    );
  }

  /** Writes in batches and returns how many rows the database accepted. */
  async upsertAll(table: ExportableTable, rows: readonly DatabaseRow[]): Promise<void> {
    for (let index = 0; index < rows.length; index += WRITE_BATCH) {
      const batch = rows.slice(index, index + WRITE_BATCH);
      // The table name is chosen by the contract at runtime, so the generated
      // per-table row types cannot be applied here. The database validates the
      // shape, and row level security decides whether the write happens at all.
      const { error } = await this.client.from(table).upsert(batch as never[]);
      if (error) {
        throw toDataError(error, `Failed to write ${table}`);
      }
    }
  }

  /**
   * Allocations go through the same function the application uses, so the
   * deferred sum invariant is respected instead of worked around.
   */
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
      throw toDataError(error, 'Failed to write transaction_allocations');
    }
  }
}
