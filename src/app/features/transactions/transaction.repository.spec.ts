import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { PAGE_SIZE } from '../../shared/supabase/paginate';
import { makeTransaction } from '../../testing/finance-fixtures';
import { TransactionRepository } from './transaction.repository';

const RANGE = { start: '2026-09-01', end: '2026-09-30' };

describe('TransactionRepository pagination', () => {
  function clientReturning(pages: unknown[][]) {
    const range = vi.fn();
    pages.forEach((rows) => range.mockResolvedValueOnce({ data: rows, error: null }));
    const query = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range,
    };
    return { client: { from: vi.fn().mockReturnValue(query) }, query, range };
  }

  function repositoryWith(client: unknown): TransactionRepository {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE_CLIENT, useValue: client }],
    });
    return TestBed.inject(TransactionRepository);
  }

  it('reads a single page when the month is small', async () => {
    const { client, range } = clientReturning([[makeTransaction()]]);
    const rows = await repositoryWith(client).listByDateRange(RANGE, { ownerId: 'u1' });
    expect(rows).toHaveLength(1);
    expect(range).toHaveBeenCalledTimes(1);
    expect(range).toHaveBeenCalledWith(0, PAGE_SIZE - 1);
  });

  it('keeps reading past the PostgREST cap instead of truncating the month', async () => {
    const full = Array.from({ length: PAGE_SIZE }, (_, index) =>
      makeTransaction({ id: `tx-${index}` }),
    );
    const { client, range } = clientReturning([full, [makeTransaction({ id: 'tx-last' })]]);

    const rows = await repositoryWith(client).listByDateRange(RANGE, { ownerId: 'u1' });

    expect(rows).toHaveLength(PAGE_SIZE + 1);
    expect(range.mock.calls).toEqual([
      [0, PAGE_SIZE - 1],
      [PAGE_SIZE, PAGE_SIZE * 2 - 1],
    ]);
  });

  it('builds a fresh query per page instead of reusing an executed one', async () => {
    const full = Array.from({ length: PAGE_SIZE }, () => makeTransaction());
    const { client } = clientReturning([full, []]);
    await repositoryWith(client).listByDateRange(RANGE, { householdId: 'h1' });
    expect(client.from).toHaveBeenCalledTimes(2);
  });

  it('scopes by household or by owner', async () => {
    const { client, query } = clientReturning([[]]);
    await repositoryWith(client).listByDateRange(RANGE, { householdId: 'h1' });
    expect(query.eq).toHaveBeenCalledWith('household_id', 'h1');

    const owned = clientReturning([[]]);
    await repositoryWith(owned.client).listByDateRange(RANGE, { ownerId: 'u1' });
    expect(owned.query.eq).toHaveBeenCalledWith('owner_user_id', 'u1');
  });
});
