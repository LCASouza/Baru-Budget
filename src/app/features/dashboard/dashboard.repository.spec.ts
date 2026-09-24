import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { PAGE_SIZE } from '../../shared/supabase/paginate';
import { makeTransaction } from '../../testing/finance-fixtures';
import { DashboardRepository } from './dashboard.repository';

describe('DashboardRepository', () => {
  it('loads ordinary pending bills by due date for the next payment cycle', async () => {
    const range = vi.fn().mockResolvedValue({
      data: [makeTransaction({ id: 'internet', status: 'PENDING' })],
      error: null,
    });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range,
    };
    const client = { from: vi.fn().mockReturnValue(query) };
    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE_CLIENT, useValue: client }],
    });

    const rows = await TestBed.inject(DashboardRepository).listDirectBillsDue('u1', {
      start: '2026-10-01',
      end: '2026-10-31',
    });

    expect(rows.map((row) => row.id)).toEqual(['internet']);
    expect(query.eq).toHaveBeenCalledWith('owner_user_id', 'u1');
    expect(query.eq).toHaveBeenCalledWith('kind', 'EXPENSE');
    expect(query.eq).toHaveBeenCalledWith('status', 'PENDING');
    expect(query.is).toHaveBeenCalledWith('credit_card_id', null);
    expect(query.is).toHaveBeenCalledWith('loan_id', null);
    expect(query.is).toHaveBeenCalledWith('financing_id', null);
    expect(query.or).toHaveBeenCalledWith(
      'and(due_date.gte.2026-10-01,due_date.lte.2026-10-31),and(due_date.is.null,date.gte.2026-10-01,date.lte.2026-10-31)',
    );
    expect(range).toHaveBeenCalledWith(0, PAGE_SIZE - 1);
  });

  it('loads card purchases by invoice due date for the category breakdown', async () => {
    const range = vi.fn().mockResolvedValue({
      data: [makeTransaction({ id: 'purchase', credit_card_id: 'card-1' })],
      error: null,
    });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range,
    };
    const client = { from: vi.fn().mockReturnValue(query) };
    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE_CLIENT, useValue: client }],
    });

    const rows = await TestBed.inject(DashboardRepository).listCardPurchasesDue('u1', {
      start: '2026-10-01',
      end: '2026-10-31',
    });

    expect(rows.map((row) => row.id)).toEqual(['purchase']);
    expect(query.not).toHaveBeenCalledWith('credit_card_id', 'is', null);
    expect(query.neq).toHaveBeenCalledWith('status', 'CANCELLED');
    expect(query.gte).toHaveBeenCalledWith('invoice_due_date', '2026-10-01');
    expect(query.lte).toHaveBeenCalledWith('invoice_due_date', '2026-10-31');
  });
});
