// Pure classification of a parsed workbook against what the database already
// holds. Nothing here talks to the network: the preview screen renders exactly
// what these functions return, and the import applies exactly the same rows.

import { parseAmountInput } from '../../shared/money/money';
import {
  CatalogName,
  CellType,
  CellValue,
  DatabaseRow,
  ExportableTable,
  IMPORTABLE_SHEETS,
  SheetColumn,
  SheetSpec,
  databaseField,
} from './workbook-schema';

export type RowStatus = 'new' | 'updated' | 'unchanged' | 'invalid';

export interface RowIssue {
  readonly column: string;
  readonly message: string;
}

export interface PlannedRow {
  /** Line number in the sheet as the user sees it, header included. */
  readonly line: number;
  readonly status: RowStatus;
  readonly id: string;
  readonly description: string;
  readonly values: DatabaseRow;
  readonly issues: readonly RowIssue[];
}

export interface SheetPlan {
  readonly sheetName: string;
  readonly table: ExportableTable;
  readonly rows: readonly PlannedRow[];
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly invalid: number;
  /** Records in the database that the file does not mention. They are kept. */
  readonly untouched: number;
}

export interface WorkbookPlan {
  readonly sheets: readonly SheetPlan[];
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly invalid: number;
  readonly untouched: number;
  readonly hasWork: boolean;
}

export interface Catalog {
  /** Ids visible to the owner, so a reference can be checked before writing. */
  readonly ids: ReadonlySet<string>;
  /** Normalized name to the ids carrying it, to resolve a name to one record. */
  readonly byName: ReadonlyMap<string, readonly string[]>;
}

export type Catalogs = Readonly<Record<CatalogName, Catalog>>;

/** Current rows of a sheet, keyed by id. */
export type ExistingRows = ReadonlyMap<string, DatabaseRow>;

export interface PlanInput {
  /** Parsed sheets, keyed by sheet name; a missing sheet is simply not touched. */
  readonly parsed: ReadonlyMap<string, readonly ParsedRow[]>;
  readonly existing: ReadonlyMap<string, ExistingRows>;
  readonly catalogs: Catalogs;
  /** New uuid generator, injected so tests stay deterministic. */
  readonly newId: () => string;
}

export interface ParsedRow {
  readonly line: number;
  readonly cells: ReadonlyMap<string, CellValue>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const BR_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function dateToIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

type CellResult = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly message: string };

/** One cell to one database value, or the reason it cannot be one. */
export function parseCell(column: SheetColumn, raw: CellValue): CellResult {
  const empty = raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '');
  if (empty) {
    return column.required
      ? { ok: false, message: 'Campo obrigatório vazio.' }
      : { ok: true, value: null };
  }

  switch (column.type) {
    case 'text':
      return { ok: true, value: String(raw).trim() };

    case 'uuid': {
      const value = String(raw).trim();
      return UUID_PATTERN.test(value)
        ? { ok: true, value }
        : { ok: false, message: 'Identificador inválido.' };
    }

    case 'enum': {
      const value = String(raw).trim().toUpperCase();
      return column.enumValues?.includes(value)
        ? { ok: true, value }
        : {
            ok: false,
            message: `Valor fora do domínio. Aceitos: ${column.enumValues?.join(', ') ?? ''}.`,
          };
    }

    case 'boolean': {
      if (typeof raw === 'boolean') {
        return { ok: true, value: raw };
      }
      const value = String(raw).trim().toLowerCase();
      if (['verdadeiro', 'true', 'sim', '1'].includes(value)) {
        return { ok: true, value: true };
      }
      if (['falso', 'false', 'nao', 'não', '0'].includes(value)) {
        return { ok: true, value: false };
      }
      return { ok: false, message: 'Use VERDADEIRO ou FALSO.' };
    }

    case 'number':
    case 'money': {
      const value = typeof raw === 'number' ? raw : parseAmountInput(String(raw));
      if (value === null || !Number.isFinite(value)) {
        return { ok: false, message: 'Número inválido.' };
      }
      return { ok: true, value: column.type === 'money' ? Math.round(value * 100) / 100 : value };
    }

    case 'date': {
      if (raw instanceof Date) {
        return { ok: true, value: dateToIso(raw) };
      }
      const value = String(raw).trim();
      if (ISO_DATE_PATTERN.test(value)) {
        return { ok: true, value };
      }
      const brazilian = BR_DATE_PATTERN.exec(value);
      if (brazilian) {
        const [, day, month, year] = brazilian;
        return { ok: true, value: `${year}-${pad(Number(month))}-${pad(Number(day))}` };
      }
      return { ok: false, message: 'Data inválida. Use dd/mm/aaaa.' };
    }

    default:
      return { ok: false, message: 'Tipo de coluna desconhecido.' };
  }
}

function comparable(value: unknown, numeric: boolean): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (numeric) {
    const parsed = typeof value === 'number' ? value : Number(String(value).trim());
    return Number.isFinite(parsed) ? parsed.toFixed(4) : String(value).trim();
  }
  return String(value).trim();
}

/**
 * Field types of a sheet, so a numeric column compares by value while a text
 * column compares literally. The driver may hand a numeric back as a string.
 */
export function fieldTypes(sheet: SheetSpec): ReadonlyMap<string, CellType> {
  const types = new Map<string, CellType>();
  for (const column of sheet.columns) {
    if (column.role === 'editable') {
      types.set(databaseField(column), column.type);
    } else if (column.role === 'lookup' && column.fills) {
      types.set(column.fills.field, 'uuid');
    }
  }
  return types;
}

/** True when every field the sheet writes already holds this value. */
export function isUnchanged(
  values: DatabaseRow,
  current: DatabaseRow,
  types: ReadonlyMap<string, CellType> = new Map(),
): boolean {
  return Object.keys(values).every((field) => {
    const numeric = types.get(field) === 'money' || types.get(field) === 'number';
    return comparable(values[field], numeric) === comparable(current[field], numeric);
  });
}

function describeRow(sheet: SheetSpec, cells: ReadonlyMap<string, CellValue>): string {
  for (const key of ['descricao', 'nome']) {
    const value = cells.get(key);
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return sheet.name;
}

function planRow(
  sheet: SheetSpec,
  parsed: ParsedRow,
  existing: ExistingRows,
  catalogs: Catalogs,
  newId: () => string,
  types: ReadonlyMap<string, CellType>,
): PlannedRow {
  const issues: RowIssue[] = [];
  const values: DatabaseRow = {};

  // Identity first: an empty id creates, a filled one addresses a record.
  const rawId = parsed.cells.get('id');
  const idResult = parseCell({ key: 'id', label: 'ID', type: 'uuid', role: 'key' }, rawId ?? null);
  let id = '';
  if (!idResult.ok) {
    issues.push({ column: 'id', message: idResult.message });
  } else {
    id = (idResult.value as string | null) ?? '';
  }

  for (const column of sheet.columns) {
    if (column.role === 'key' || column.role === 'readonly') {
      continue;
    }
    if (column.role === 'lookup') {
      continue; // resolved below, after the paired id column is known
    }
    const result = parseCell(column, parsed.cells.get(column.key) ?? null);
    if (!result.ok) {
      issues.push({ column: column.key, message: result.message });
      continue;
    }
    values[databaseField(column)] = result.value;
  }

  // A name only resolves what the id cell left empty, and never creates anything.
  for (const column of sheet.columns) {
    if (column.role !== 'lookup' || !column.fills) {
      continue;
    }
    const field = column.fills.field;
    if (values[field]) {
      continue;
    }
    const raw = parsed.cells.get(column.key);
    const name = typeof raw === 'string' ? raw.trim() : raw === null || raw === undefined ? '' : String(raw).trim();
    if (!name) {
      continue;
    }
    const matches = catalogs[column.fills.catalog].byName.get(normalizeName(name)) ?? [];
    if (matches.length === 1) {
      values[field] = matches[0];
    } else if (matches.length === 0) {
      issues.push({ column: column.key, message: `"${name}" não existe. Crie o registro na aba correspondente ou preencha ${field}.` });
    } else {
      issues.push({ column: column.key, message: `"${name}" corresponde a mais de um registro. Preencha ${field}.` });
    }
  }

  // Every reference has to point at something the owner can actually use.
  for (const column of sheet.columns) {
    if (column.role !== 'lookup' || !column.fills) {
      continue;
    }
    const field = column.fills.field;
    const value = values[field];
    if (typeof value === 'string' && value && !catalogs[column.fills.catalog].ids.has(value)) {
      issues.push({ column: field, message: 'O registro referenciado não pertence a este proprietário.' });
    }
    if (column.requiredRef && !value) {
      issues.push({ column: column.key, message: 'Campo obrigatório vazio.' });
    }
  }

  const description = describeRow(sheet, parsed.cells);
  if (issues.length > 0) {
    return { line: parsed.line, status: 'invalid', id, description, values, issues };
  }

  if (!id) {
    return { line: parsed.line, status: 'new', id: newId(), description, values, issues };
  }
  const current = existing.get(id);
  if (!current) {
    return { line: parsed.line, status: 'new', id, description, values, issues };
  }
  return {
    line: parsed.line,
    status: isUnchanged(values, current, types) ? 'unchanged' : 'updated',
    id,
    description,
    values,
    issues,
  };
}

function summarize(sheet: SheetSpec, rows: readonly PlannedRow[], existingCount: number): SheetPlan {
  const mentioned = new Set(rows.filter((row) => row.status !== 'new').map((row) => row.id));
  return {
    sheetName: sheet.name,
    table: sheet.table,
    rows,
    created: rows.filter((row) => row.status === 'new').length,
    updated: rows.filter((row) => row.status === 'updated').length,
    unchanged: rows.filter((row) => row.status === 'unchanged').length,
    invalid: rows.filter((row) => row.status === 'invalid').length,
    untouched: Math.max(existingCount - mentioned.size, 0),
  };
}

function extendCatalog(catalog: Catalog, ids: readonly string[]): Catalog {
  if (ids.length === 0) {
    return catalog;
  }
  const next = new Set(catalog.ids);
  for (const id of ids) {
    next.add(id);
  }
  return { ids: next, byName: catalog.byName };
}

const SHEET_CATALOGS: Readonly<Record<string, CatalogName>> = {
  accounts: 'accounts',
  categories: 'categories',
  credit_cards: 'cards',
};

/**
 * Classifies every sheet in workbook order. Sheets are planned in the order
 * they are applied, so a record created earlier in the same file can already be
 * referenced by a later sheet.
 */
export function planWorkbook(input: PlanInput): WorkbookPlan {
  let catalogs = input.catalogs;
  const sheets: SheetPlan[] = [];

  for (const sheet of IMPORTABLE_SHEETS) {
    const parsedRows = input.parsed.get(sheet.name) ?? [];
    const existing = input.existing.get(sheet.name) ?? new Map<string, DatabaseRow>();
    const types = fieldTypes(sheet);
    const rows = parsedRows.map((row) =>
      planRow(sheet, row, existing, catalogs, input.newId, types),
    );
    sheets.push(summarize(sheet, rows, existing.size));

    const catalogName = SHEET_CATALOGS[sheet.table];
    if (catalogName) {
      const ids = rows.filter((row) => row.status !== 'invalid').map((row) => row.id);
      catalogs = { ...catalogs, [catalogName]: extendCatalog(catalogs[catalogName], ids) };
    }
  }

  const created = sheets.reduce((total, sheet) => total + sheet.created, 0);
  const updated = sheets.reduce((total, sheet) => total + sheet.updated, 0);
  return {
    sheets,
    created,
    updated,
    unchanged: sheets.reduce((total, sheet) => total + sheet.unchanged, 0),
    invalid: sheets.reduce((total, sheet) => total + sheet.invalid, 0),
    untouched: sheets.reduce((total, sheet) => total + sheet.untouched, 0),
    hasWork: created + updated > 0,
  };
}
