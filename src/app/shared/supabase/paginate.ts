import { PostgrestError } from '@supabase/supabase-js';
import { DataError, toDataError } from '../../core/supabase/data-error';

/** PostgREST answers at most this many rows per request. */
export const PAGE_SIZE = 1000;

export interface PageResult<Row> {
  readonly data: Row[] | null;
  readonly error: PostgrestError | null;
}

/**
 * Reads every page of a query instead of stopping at the PostgREST cap. A list
 * silently cut at one thousand rows shows wrong totals without warning, which
 * is worse than being slow.
 */
export async function readAllPages<Row>(
  page: (from: number, to: number) => PromiseLike<PageResult<Row>>,
  context: string,
  pageSize: number = PAGE_SIZE,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) {
      throw toDataError(error, context);
    }
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) {
      return rows;
    }
  }
}

export { DataError };
