import { Injectable } from '@angular/core';
import { SheetContent, readWorkbook, writeWorkbook } from './excel-io';
import { WorkbookModel } from './workbook-model';

/**
 * Injectable seam over the spreadsheet libraries. Keeping it behind a service
 * means the stores and services never import a file format directly, and tests
 * can replace it without touching module internals.
 */
@Injectable({ providedIn: 'root' })
export class WorkbookFileService {
  read(file: Blob): Promise<readonly SheetContent[]> {
    return readWorkbook(file);
  }

  write(model: WorkbookModel, fileName: string): Promise<void> {
    return writeWorkbook(model, fileName);
  }
}
