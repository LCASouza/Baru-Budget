import { PostgrestError } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { DataError } from '../../core/supabase/data-error';
import { PAGE_SIZE, readAllPages } from './paginate';

function page<Row>(rows: Row[]) {
  return Promise.resolve({ data: rows, error: null });
}

describe('readAllPages', () => {
  it('stops at the first incomplete page', async () => {
    const request = vi.fn().mockResolvedValue({ data: [1, 2], error: null });
    await expect(readAllPages(request, 'ctx', 5)).resolves.toEqual([1, 2]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(0, 4);
  });

  it('walks every page and joins them in order', async () => {
    const request = vi
      .fn()
      .mockImplementationOnce(() => page([1, 2]))
      .mockImplementationOnce(() => page([3, 4]))
      .mockImplementationOnce(() => page([5]));

    await expect(readAllPages(request, 'ctx', 2)).resolves.toEqual([1, 2, 3, 4, 5]);
    expect(request.mock.calls).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
  });

  it('does not truncate a full page like the old fixed limit did', async () => {
    const full = Array.from({ length: PAGE_SIZE }, (_, index) => index);
    const request = vi
      .fn()
      .mockImplementationOnce(() => page(full))
      .mockImplementationOnce(() => page([PAGE_SIZE]));

    const rows = await readAllPages(request, 'ctx');
    expect(rows).toHaveLength(PAGE_SIZE + 1);
  });

  it('treats a missing payload as an empty page', async () => {
    const request = vi.fn().mockResolvedValue({ data: null, error: null });
    await expect(readAllPages(request, 'ctx', 5)).resolves.toEqual([]);
  });

  it('turns a database error into a DataError carrying its code', async () => {
    const error = { message: 'boom', code: '42501' } as PostgrestError;
    const request = vi.fn().mockResolvedValue({ data: null, error });
    await expect(readAllPages(request, 'Failed to read')).rejects.toBeInstanceOf(DataError);
    await expect(readAllPages(request, 'Failed to read')).rejects.toMatchObject({ code: '42501' });
  });
});
