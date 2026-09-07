import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { CurrentProfileService } from '../../core/profile/current-profile.service';
import { DataTransferRepository } from './data-transfer.repository';
import { DataTransferStore } from './data-transfer.store';
import { ExportService } from './export.service';
import { ImportService } from './import.service';
import { WorkbookFileService } from './workbook-file.service';

const OWNER = '11111111-1111-4111-8111-111111111111';

function infoSheet(application = 'Baru Budget', version = '1') {
  return {
    sheet: 'Info',
    data: [
      ['chave', 'valor'],
      ['application', application],
      ['schema_version', version],
    ],
  };
}

const accountRow = [
  '22222222-2222-4222-8222-222222222222',
  'Conta corrente',
  'BANK',
  null,
  100,
  null,
  true,
];

function accountsSheet() {
  return {
    sheet: 'Contas',
    data: [['id', 'nome', 'tipo', 'instituicao', 'saldo_inicial', 'cor', 'ativo'], accountRow],
  };
}

describe('DataTransferStore', () => {
  let store: DataTransferStore;
  let exportService: { exportWorkbook: ReturnType<typeof vi.fn> };
  let importService: { apply: ReturnType<typeof vi.fn> };
  let repository: { listOwned: ReturnType<typeof vi.fn>; listVisible: ReturnType<typeof vi.fn> };
  let files: { read: ReturnType<typeof vi.fn>; write: ReturnType<typeof vi.fn> };
  const canManage = signal(true);

  function setup(contextKind: 'personal' | 'shared' = 'personal'): void {
    canManage.set(contextKind === 'personal');
    exportService = { exportWorkbook: vi.fn().mockResolvedValue({ fileName: 'b.xlsx', rows: 3 }) };
    importService = {
      apply: vi.fn().mockResolvedValue({ sheets: [], written: 1, failed: 0, ok: true }),
    };
    repository = {
      listOwned: vi.fn().mockResolvedValue([]),
      listVisible: vi.fn().mockResolvedValue([]),
    };
    files = { read: vi.fn().mockResolvedValue([]), write: vi.fn().mockResolvedValue(undefined) };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: FinancialContextService,
          useValue: {
            dataOwnerId: signal(OWNER),
            canManage,
            context: signal(
              contextKind === 'shared'
                ? { kind: 'shared', ownerId: OWNER, ownerName: 'Alice', permission: 'VIEW' }
                : { kind: 'personal' },
            ),
          },
        },
        { provide: CurrentProfileService, useValue: { profile: signal({ display_name: 'Bob' }) } },
        { provide: DataTransferRepository, useValue: repository },
        { provide: ExportService, useValue: exportService },
        { provide: ImportService, useValue: importService },
        { provide: WorkbookFileService, useValue: files },
      ],
    });
    store = TestBed.inject(DataTransferStore);
  }

  afterEach(() => vi.restoreAllMocks());

  it('exports with the owner of the current context', async () => {
    setup();
    await store.exportWorkbook();
    expect(exportService.exportWorkbook).toHaveBeenCalledWith(OWNER, 'Bob');
    expect(store.exportResult()?.fileName).toBe('b.xlsx');
  });

  it('names the shared owner in the file it exports', async () => {
    setup('shared');
    await store.exportWorkbook();
    expect(exportService.exportWorkbook).toHaveBeenCalledWith(OWNER, 'Alice');
  });

  it('builds a plan without writing anything', async () => {
    setup();
    files.read.mockResolvedValue([infoSheet(), accountsSheet()]);

    await store.prepareImport(new File([], 'backup.xlsx'));

    expect(store.plan()?.created).toBe(1);
    expect(store.compatibility()?.compatible).toBe(true);
    expect(importService.apply).not.toHaveBeenCalled();
    expect(store.canConfirm()).toBe(true);
  });

  it('refuses an incompatible file and builds no plan', async () => {
    setup();
    files.read.mockResolvedValue([infoSheet('Outro App'), accountsSheet()]);

    await store.prepareImport(new File([], 'outro.xlsx'));

    expect(store.compatibility()?.compatible).toBe(false);
    expect(store.plan()).toBeNull();
    expect(store.canConfirm()).toBe(false);
  });

  it('applies only after an explicit confirmation', async () => {
    setup();
    files.read.mockResolvedValue([infoSheet(), accountsSheet()]);
    await store.prepareImport(new File([], 'backup.xlsx'));

    await store.confirmImport();

    expect(importService.apply).toHaveBeenCalledTimes(1);
    expect(store.outcome()?.written).toBe(1);
    expect(store.plan()).toBeNull();
  });

  it('does not let a read-only context confirm an import', async () => {
    setup('shared');
    files.read.mockResolvedValue([infoSheet(), accountsSheet()]);
    await store.prepareImport(new File([], 'backup.xlsx'));

    expect(store.canManage()).toBe(false);
    expect(store.canConfirm()).toBe(false);
  });

  it('reports a file it cannot read', async () => {
    setup();
    files.read.mockRejectedValue(new Error('Arquivo corrompido'));

    await store.prepareImport(new File([], 'quebrado.xlsx'));

    expect(store.importError()).toBe('Arquivo corrompido');
    expect(store.plan()).toBeNull();
  });
});
