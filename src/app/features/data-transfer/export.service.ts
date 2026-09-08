import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { DataTransferRepository } from './data-transfer.repository';
import { loadSnapshot } from './data-snapshot';
import { WorkbookFileService } from './workbook-file.service';
import { APPLICATION_NAME, SCHEMA_VERSION, WORKBOOK_V2 } from './workbook-schema';
import { WorkbookInfo } from './workbook-info';
import { backupFileName, buildWorkbook } from './workbook-model';

export interface ExportResult {
  readonly fileName: string;
  readonly rows: number;
}

/**
 * Reads everything the owner has, page by page, and hands the browser the
 * backup file. The export ignores the selected period on purpose: a backup that
 * only covers one month is not a backup.
 */
@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly repository = inject(DataTransferRepository);
  private readonly files = inject(WorkbookFileService);

  async exportWorkbook(
    ownerId: string,
    ownerName: string,
    now: Date = new Date(),
  ): Promise<ExportResult> {
    const snapshot = await loadSnapshot(this.repository, ownerId);
    const info: WorkbookInfo = {
      application: APPLICATION_NAME,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: now.toISOString(),
      appVersion: environment.appVersion,
      ownerUserId: ownerId,
      ownerName,
    };

    const model = buildWorkbook(info, snapshot.data, snapshot.catalogs);
    const fileName = backupFileName(now);
    await this.files.write(model, fileName);

    const rows = WORKBOOK_V2.reduce(
      (total, sheet) => total + (snapshot.data.get(sheet.name)?.length ?? 0),
      0,
    );
    return { fileName, rows };
  }
}
