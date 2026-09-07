// Turns the sheets of a workbook into rows keyed by the contract, without
// deciding anything: validation and classification live in `import-plan.ts`.

import { SheetContent } from './excel-io';
import { ParsedRow } from './import-plan';
import { INFO_SHEET_NAME, LEGEND_SHEET_NAME } from './workbook-info';
import { CellValue, sheetByName } from './workbook-schema';

export interface ParsedWorkbook {
  readonly info: ReadonlyMap<string, string>;
  readonly sheets: ReadonlyMap<string, readonly ParsedRow[]>;
  /** Sheet names found in the file that the contract does not know. */
  readonly unknownSheets: readonly string[];
}

function toCellValue(raw: unknown): CellValue {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (raw instanceof Date || typeof raw === 'number' || typeof raw === 'boolean') {
    return raw;
  }
  const value = String(raw).trim();
  return value === '' ? null : value;
}

function readInfo(content: SheetContent | undefined): ReadonlyMap<string, string> {
  const entries = new Map<string, string>();
  if (!content) {
    return entries;
  }
  for (const row of content.data) {
    const key = toCellValue(row[0]);
    if (typeof key !== 'string' || key === 'chave') {
      continue;
    }
    const value = toCellValue(row[1]);
    entries.set(key, value === null ? '' : String(value));
  }
  return entries;
}

function readSheet(content: SheetContent): readonly ParsedRow[] {
  const [header, ...body] = content.data;
  if (!header) {
    return [];
  }
  const indexByKey = new Map<string, number>();
  header.forEach((cell, index) => {
    const key = toCellValue(cell);
    if (typeof key === 'string') {
      indexByKey.set(key, index);
    }
  });

  const rows: ParsedRow[] = [];
  body.forEach((row, offset) => {
    const cells = new Map<string, CellValue>();
    let empty = true;
    for (const [key, index] of indexByKey) {
      const value = toCellValue(row[index]);
      cells.set(key, value);
      if (value !== null) {
        empty = false;
      }
    }
    if (!empty) {
      // Line as the user sees it: the header is line 1.
      rows.push({ line: offset + 2, cells });
    }
  });
  return rows;
}

export function parseWorkbook(contents: readonly SheetContent[]): ParsedWorkbook {
  const info = readInfo(contents.find((content) => content.sheet === INFO_SHEET_NAME));
  const sheets = new Map<string, readonly ParsedRow[]>();
  const unknownSheets: string[] = [];

  for (const content of contents) {
    const spec = sheetByName(content.sheet);
    if (!spec) {
      if (content.sheet !== INFO_SHEET_NAME && content.sheet !== LEGEND_SHEET_NAME) {
        unknownSheets.push(content.sheet);
      }
      continue;
    }
    if (spec.importable) {
      sheets.set(spec.name, readSheet(content));
    }
  }

  return { info, sheets, unknownSheets };
}
