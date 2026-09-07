import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { DataTransferRepository } from './data-transfer.repository';
import { DataSnapshot } from './data-snapshot';
import { ImportService } from './import.service';
import { PlannedRow, SheetPlan, WorkbookPlan } from './import-plan';
import { DatabaseRow, ExportableTable } from './workbook-schema';

const OWNER = 'owner-1';
const TRANSACTION = 'tx-1';
const ALICE = 'user-alice';
const BOB = 'user-bob';

function plannedRow(status: PlannedRow['status'], id: string, values: DatabaseRow): PlannedRow {
  return { line: 2, status, id, description: id, values, issues: [] };
}

function sheetPlan(sheetName: string, table: ExportableTable, rows: PlannedRow[]): SheetPlan {
  return {
    sheetName,
    table,
    rows,
    created: rows.filter((row) => row.status === 'new').length,
    updated: rows.filter((row) => row.status === 'updated').length,
    unchanged: rows.filter((row) => row.status === 'unchanged').length,
    invalid: rows.filter((row) => row.status === 'invalid').length,
    untouched: 0,
  };
}

function workbookPlan(sheets: SheetPlan[]): WorkbookPlan {
  return {
    sheets,
    created: sheets.reduce((total, sheet) => total + sheet.created, 0),
    updated: sheets.reduce((total, sheet) => total + sheet.updated, 0),
    unchanged: 0,
    invalid: 0,
    untouched: 0,
    hasWork: true,
  };
}

function snapshotWith(allocations: DatabaseRow[]): DataSnapshot {
  return {
    data: new Map([['Divisoes', allocations]]),
    catalogs: {} as DataSnapshot['catalogs'],
    existing: new Map(),
    transactionCount: 0,
  };
}

describe('ImportService', () => {
  let repository: {
    upsertAll: ReturnType<typeof vi.fn>;
    setAllocations: ReturnType<typeof vi.fn>;
    listOwned: ReturnType<typeof vi.fn>;
    listVisible: ReturnType<typeof vi.fn>;
  };
  let service: ImportService;

  beforeEach(() => {
    repository = {
      upsertAll: vi.fn().mockResolvedValue(undefined),
      setAllocations: vi.fn().mockResolvedValue(undefined),
      listOwned: vi.fn(),
      listVisible: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: DataTransferRepository, useValue: repository }],
    });
    service = TestBed.inject(ImportService);
  });

  it('writes only the new and updated rows', async () => {
    const plan = workbookPlan([
      sheetPlan('Contas', 'accounts', [
        plannedRow('new', 'acc-1', { name: 'Nova' }),
        plannedRow('unchanged', 'acc-2', { name: 'Igual' }),
        plannedRow('invalid', 'acc-3', { name: 'Ruim' }),
      ]),
    ]);

    const outcome = await service.apply(plan, snapshotWith([]), OWNER);

    expect(repository.upsertAll).toHaveBeenCalledTimes(1);
    const [table, rows] = repository.upsertAll.mock.calls[0];
    expect(table).toBe('accounts');
    expect(rows).toEqual([{ id: 'acc-1', owner_user_id: OWNER, name: 'Nova' }]);
    expect(outcome.written).toBe(1);
    expect(outcome.ok).toBe(true);
  });

  it('fills the owner from the context and never from the file', async () => {
    const plan = workbookPlan([
      sheetPlan('Contas', 'accounts', [
        plannedRow('new', 'acc-1', { name: 'Nova', owner_user_id: 'someone-else' }),
      ]),
    ]);
    await service.apply(plan, snapshotWith([]), OWNER);
    const [, rows] = repository.upsertAll.mock.calls[0];
    expect(rows[0].owner_user_id).toBe(OWNER);
  });

  it('applies the sheets in dependency order', async () => {
    const plan = workbookPlan([
      sheetPlan('Movimentacoes', 'transactions', [plannedRow('new', 'tx-9', { amount: 1 })]),
      sheetPlan('Contas', 'accounts', [plannedRow('new', 'acc-1', { name: 'Nova' })]),
      sheetPlan('Categorias', 'categories', [plannedRow('new', 'cat-1', { name: 'Nova' })]),
    ]);
    await service.apply(plan, snapshotWith([]), OWNER);
    expect(repository.upsertAll.mock.calls.map(([table]) => table)).toEqual([
      'accounts',
      'categories',
      'transactions',
    ]);
  });

  it('replaces a split through the same function the application uses', async () => {
    const plan = workbookPlan([
      sheetPlan('Divisoes', 'transaction_allocations', [
        plannedRow('updated', 'alloc-1', {
          transaction_id: TRANSACTION,
          user_id: ALICE,
          amount: 70,
        }),
      ]),
    ]);
    const snapshot = snapshotWith([
      { id: 'alloc-1', transaction_id: TRANSACTION, user_id: ALICE, amount: 50 },
      { id: 'alloc-2', transaction_id: TRANSACTION, user_id: BOB, amount: 50 },
    ]);

    await service.apply(plan, snapshot, OWNER);

    expect(repository.upsertAll).not.toHaveBeenCalled();
    expect(repository.setAllocations).toHaveBeenCalledTimes(1);
    const [transactionId, userIds, amounts] = repository.setAllocations.mock.calls[0];
    expect(transactionId).toBe(TRANSACTION);
    // Bob is absent from the file and stays in the split: absence never deletes.
    expect(userIds).toEqual([ALICE, BOB]);
    expect(amounts).toEqual([70, 50]);
  });

  it('reports the sheet that failed and keeps going', async () => {
    repository.upsertAll.mockImplementation((table: string) => {
      if (table === 'transactions') {
        throw new Error('Failed to write transactions: violação');
      }
      return Promise.resolve();
    });
    const plan = workbookPlan([
      sheetPlan('Contas', 'accounts', [plannedRow('new', 'acc-1', { name: 'Nova' })]),
      sheetPlan('Movimentacoes', 'transactions', [plannedRow('new', 'tx-1', { amount: 1 })]),
    ]);

    const outcome = await service.apply(plan, snapshotWith([]), OWNER);

    expect(outcome.ok).toBe(false);
    expect(outcome.written).toBe(1);
    expect(outcome.failed).toBe(1);
    expect(outcome.sheets.find((sheet) => sheet.sheetName === 'Movimentacoes')?.error).toContain(
      'violação',
    );
  });

  it('has no way to delete: the repository exposes none and none is called', async () => {
    const plan = workbookPlan([
      sheetPlan('Contas', 'accounts', [plannedRow('new', 'acc-1', { name: 'Nova' })]),
    ]);
    await service.apply(plan, snapshotWith([]), OWNER);
    expect(Object.keys(repository)).not.toContain('delete');
    expect(
      Object.getOwnPropertyNames(DataTransferRepository.prototype).some((name) =>
        name.toLowerCase().includes('delete'),
      ),
    ).toBe(false);
  });
});
