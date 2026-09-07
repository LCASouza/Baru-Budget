import { NamedCatalogs } from './catalogs';
import {
  ABSENCE_NOTICE,
  INFO_SHEET_NAME,
  LEGEND_SHEET_NAME,
  WorkbookInfo,
  buildInfoEntries,
  buildLegendRows,
} from './workbook-info';
import {
  CellType,
  CellValue,
  DatabaseRow,
  SheetColumn,
  SheetSpec,
  WORKBOOK_V1,
  databaseField,
} from './workbook-schema';

export interface ModelCell {
  readonly value: CellValue;
  readonly type: CellType;
  readonly bold?: boolean;
}

export interface ModelSheet {
  readonly name: string;
  readonly rows: readonly (readonly ModelCell[])[];
}

export interface WorkbookModel {
  readonly sheets: readonly ModelSheet[];
}

/** Rows of every table, keyed by sheet name. */
export type ExportData = ReadonlyMap<string, readonly DatabaseRow[]>;

function text(value: string, bold = false): ModelCell {
  return { value, type: 'text', bold };
}

function isoToDate(value: string): Date | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!parts) {
    return null;
  }
  return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
}

function cellFor(column: SheetColumn, row: DatabaseRow, catalogs: NamedCatalogs): ModelCell {
  if (column.role === 'lookup' && column.fills) {
    const id = row[column.fills.field];
    const name = typeof id === 'string' ? (catalogs[column.fills.catalog].names.get(id) ?? '') : '';
    return { value: name || null, type: 'text' };
  }

  const raw = row[databaseField(column)];
  if (raw === null || raw === undefined) {
    return { value: null, type: column.type };
  }
  if (column.type === 'date') {
    return { value: isoToDate(String(raw)), type: 'date' };
  }
  if (column.type === 'money' || column.type === 'number') {
    return { value: Number(raw), type: column.type };
  }
  if (column.type === 'boolean') {
    return { value: Boolean(raw), type: 'boolean' };
  }
  return { value: String(raw), type: column.type };
}

function dataSheet(
  spec: SheetSpec,
  rows: readonly DatabaseRow[],
  catalogs: NamedCatalogs,
): ModelSheet {
  const header = spec.columns.map((column) => text(column.key, true));
  const body = rows.map((row) => spec.columns.map((column) => cellFor(column, row, catalogs)));
  return { name: spec.name, rows: [header, ...body] };
}

/**
 * Builds the whole workbook from the contract. Pure on purpose: the round-trip
 * test writes this model to a file, reads it back and expects no change.
 */
export function buildWorkbook(
  info: WorkbookInfo,
  data: ExportData,
  catalogs: NamedCatalogs,
): WorkbookModel {
  const infoSheet: ModelSheet = {
    name: INFO_SHEET_NAME,
    rows: [
      [text('chave', true), text('valor', true)],
      ...buildInfoEntries(info).map(([key, value]) => [text(key), text(value)]),
    ],
  };

  const legendSheet: ModelSheet = {
    name: LEGEND_SHEET_NAME,
    rows: [
      [text('aba', true), text('coluna', true), text('regra', true), text('detalhe', true)],
      [text(''), text(''), text('aviso'), text(ABSENCE_NOTICE)],
      ...buildLegendRows().map((row) => row.map((value) => text(value))),
    ],
  };

  return {
    sheets: [
      infoSheet,
      legendSheet,
      ...WORKBOOK_V1.map((spec) => dataSheet(spec, data.get(spec.name) ?? [], catalogs)),
    ],
  };
}

export function backupFileName(today: Date): string {
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `baru-budget-backup-${today.getFullYear()}-${month}-${day}.xlsx`;
}
