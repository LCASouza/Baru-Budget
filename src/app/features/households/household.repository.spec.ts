import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { HouseholdRepository } from './household.repository';

describe('HouseholdRepository', () => {
  function repositoryWith(client: unknown): HouseholdRepository {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE_CLIENT, useValue: client }],
    });
    return TestBed.inject(HouseholdRepository);
  }

  /**
   * A plain insert that reads the row back is refused by the database: the
   * membership that makes the creator a member is written by an AFTER trigger,
   * so the read policy cannot see the row yet. Creation has to go through the
   * function, and this test is the guard that it keeps doing so.
   */
  it('creates a household through the function, never through a table insert', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'h1', name: 'Casa' }, error: null });
    const from = vi.fn();
    const created = await repositoryWith({ rpc, from }).create('Casa');

    expect(rpc).toHaveBeenCalledWith('create_household', { p_name: 'Casa' });
    expect(from).not.toHaveBeenCalled();
    expect(created.id).toBe('h1');
  });

  it('turns a refused creation into a DataError carrying the code', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'permission denied', code: '42501', details: '', hint: '', name: 'PostgrestError' },
    });
    await expect(repositoryWith({ rpc, from: vi.fn() }).create('Casa')).rejects.toMatchObject({
      code: '42501',
    });
  });
});
