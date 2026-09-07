import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DataColumn, DataRow, DataRows } from '../../../shared/components/data-rows/data-rows';
import { DataTransferStore } from '../data-transfer.store';
import { PlannedRow, SheetPlan } from '../import-plan';
import { ABSENCE_NOTICE } from '../workbook-info';
import { SCHEMA_VERSION } from '../workbook-schema';

interface InvalidLine {
  readonly sheetName: string;
  readonly row: PlannedRow;
}

@Component({
  selector: 'app-data-page',
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatProgressBarModule, DataRows],
  templateUrl: './data-page.html',
  styleUrl: './data-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataPage {
  protected readonly store = inject(DataTransferStore);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly schemaVersion = SCHEMA_VERSION;
  protected readonly previewColumns: readonly DataColumn[] = [
    { key: 'sheet', label: 'Aba' },
    { key: 'created', label: 'Novos', numeric: true },
    { key: 'updated', label: 'Atualizados', numeric: true },
    { key: 'unchanged', label: 'Sem alteração', numeric: true },
    { key: 'invalid', label: 'Inválidos', numeric: true },
  ];
  protected readonly absenceNotice = ABSENCE_NOTICE;

  /** Sheets worth showing: the ones the file actually mentions. */
  protected readonly sheets = computed<readonly SheetPlan[]>(
    () => this.store.plan()?.sheets.filter((sheet) => sheet.rows.length > 0) ?? [],
  );

  protected readonly previewRows = computed<readonly DataRow[]>(() =>
    this.sheets().map((sheet) => ({
      id: sheet.sheetName,
      cells: [
        { key: 'sheet', text: sheet.sheetName },
        { key: 'created', text: String(sheet.created) },
        { key: 'updated', text: String(sheet.updated) },
        { key: 'unchanged', text: String(sheet.unchanged) },
        { key: 'invalid', text: String(sheet.invalid) },
      ],
    })),
  );

  protected readonly invalidLines = computed<readonly InvalidLine[]>(() =>
    (this.store.plan()?.sheets ?? []).flatMap((sheet) =>
      sheet.rows
        .filter((row) => row.status === 'invalid')
        .map((row) => ({ sheetName: sheet.sheetName, row })),
    ),
  );

  protected async exportWorkbook(): Promise<void> {
    await this.store.exportWorkbook();
    const result = this.store.exportResult();
    if (result) {
      this.snackBar.open(`${result.fileName} gerado.`, undefined, { duration: 4000 });
    }
  }

  protected async choose(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      await this.store.prepareImport(file);
    }
  }

  protected async confirm(): Promise<void> {
    await this.store.confirmImport();
    const outcome = this.store.outcome();
    if (outcome) {
      this.snackBar.open(
        outcome.ok
          ? `${outcome.written} ${outcome.written === 1 ? 'registro gravado' : 'registros gravados'}.`
          : 'A importação terminou com erros. Veja o resultado abaixo.',
        undefined,
        { duration: 5000 },
      );
    }
  }
}
