// Thin adapters over the spreadsheet libraries. They are the only place that
// knows a file format exists, and they are loaded on demand so the initial
// bundle never carries them.

import { ModelCell, WorkbookModel } from './workbook-model';

type WriterCell = { value: unknown; type?: unknown; format?: string; fontWeight?: string } | null;

const NUMBER_FORMAT = '#,##0.00';
const DATE_FORMAT = 'dd/mm/yyyy';

function toWriterCell(cell: ModelCell): WriterCell {
  if (cell.value === null || cell.value === '') {
    return null;
  }
  const style = cell.bold ? { fontWeight: 'bold' as const } : {};
  switch (cell.type) {
    case 'money':
      return { value: cell.value, type: Number, format: NUMBER_FORMAT, ...style };
    case 'number':
      return { value: cell.value, type: Number, ...style };
    case 'date':
      return { value: cell.value, type: Date, format: DATE_FORMAT, ...style };
    case 'boolean':
      return { value: cell.value, type: Boolean, ...style };
    default:
      return { value: String(cell.value), type: String, ...style };
  }
}

export interface SheetContent {
  readonly sheet: string;
  readonly data: readonly (readonly unknown[])[];
}

interface WriterResult {
  readonly toBlob: () => Promise<Blob>;
  readonly toFile: (fileName: string) => Promise<void>;
}

async function write(model: WorkbookModel): Promise<WriterResult> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const sheets = model.sheets.map((sheet) => ({
    sheet: sheet.name,
    data: sheet.rows.map((row) => row.map(toWriterCell)),
  }));
  // The library declares several overloads; the multi-sheet one takes the shape
  // built above and answers with the two ways of delivering the file.
  return (writeXlsxFile as unknown as (input: unknown) => WriterResult)(sheets);
}

/** Writes the model and hands the browser a file to save. */
export async function writeWorkbook(model: WorkbookModel, fileName: string): Promise<void> {
  const result = await write(model);
  await result.toFile(fileName);
}

/** Same file, kept in memory. Used by the round-trip test. */
export async function writeWorkbookBlob(model: WorkbookModel): Promise<Blob> {
  const result = await write(model);
  return result.toBlob();
}

/** Reads every sheet of the file in one pass. */
export async function readWorkbook(file: Blob): Promise<readonly SheetContent[]> {
  const { default: readXlsxFile } = await import('read-excel-file/browser');
  const sheets = await readXlsxFile(file as Blob & { name?: string });
  return sheets.map((sheet) => ({ sheet: sheet.sheet, data: sheet.data as unknown[][] }));
}
