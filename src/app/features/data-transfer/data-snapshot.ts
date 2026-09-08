// One read of everything the format covers, shared by the export and by the
// import preview: both need the same picture of the database.

import { NamedCatalogs, buildCatalogs } from './catalogs';
import { DataTransferRepository } from './data-transfer.repository';
import { ExistingRows } from './import-plan';
import { ExportData } from './workbook-model';
import { DatabaseRow, IMPORTABLE_SHEETS, WORKBOOK_V2, isOwnedTable } from './workbook-schema';

export interface DataSnapshot {
  readonly data: ExportData;
  readonly catalogs: NamedCatalogs;
  readonly existing: ReadonlyMap<string, ExistingRows>;
  readonly transactionCount: number;
}

function byId(rows: readonly DatabaseRow[]): ExistingRows {
  return new Map(rows.map((row) => [String(row['id'] ?? ''), row]));
}

export async function loadSnapshot(
  repository: DataTransferRepository,
  ownerId: string,
): Promise<DataSnapshot> {
  const tables = WORKBOOK_V2.map((sheet) => sheet.table);
  const loaded = await Promise.all(
    tables.map((table) =>
      isOwnedTable(table) ? repository.listOwned(table, ownerId) : repository.listVisible(table),
    ),
  );

  const rowsByTable = new Map<string, DatabaseRow[]>();
  tables.forEach((table, index) => rowsByTable.set(table, loaded[index]));

  // Allocations have no owner column: RLS also returns the ones where the user
  // is the allocated person. A backup carries only the owner's own splits.
  const transactions = rowsByTable.get('transactions') ?? [];
  const transactionIds = new Set(transactions.map((row) => String(row['id'] ?? '')));
  rowsByTable.set(
    'transaction_allocations',
    (rowsByTable.get('transaction_allocations') ?? []).filter((row) =>
      transactionIds.has(String(row['transaction_id'] ?? '')),
    ),
  );

  // Statements have no owner column either: the debt they describe decides, and
  // a grantee sees the statements of debts that are not theirs. A backup carries
  // only the statements of the owner's own debts.
  const debtIds = new Set(
    [...(rowsByTable.get('loans') ?? []), ...(rowsByTable.get('financings') ?? [])].map((row) =>
      String(row['id'] ?? ''),
    ),
  );
  rowsByTable.set(
    'debt_statements',
    (rowsByTable.get('debt_statements') ?? []).filter(
      (row) =>
        debtIds.has(String(row['loan_id'] ?? '')) ||
        debtIds.has(String(row['financing_id'] ?? '')),
    ),
  );

  const data = new Map<string, readonly DatabaseRow[]>();
  const existing = new Map<string, ExistingRows>();
  for (const sheet of WORKBOOK_V2) {
    const rows = rowsByTable.get(sheet.table) ?? [];
    data.set(sheet.name, rows);
    if (IMPORTABLE_SHEETS.includes(sheet)) {
      existing.set(sheet.name, byId(rows));
    }
  }

  return {
    data,
    catalogs: buildCatalogs({
      accounts: rowsByTable.get('accounts') ?? [],
      categories: rowsByTable.get('categories') ?? [],
      cards: rowsByTable.get('credit_cards') ?? [],
      households: rowsByTable.get('households') ?? [],
      people: rowsByTable.get('profiles') ?? [],
    }),
    existing,
    transactionCount: transactions.length,
  };
}
