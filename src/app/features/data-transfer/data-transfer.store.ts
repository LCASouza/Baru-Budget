import { Injectable, computed, inject, signal } from '@angular/core';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { CurrentProfileService } from '../../core/profile/current-profile.service';
import { DataTransferRepository } from './data-transfer.repository';
import { DataSnapshot, loadSnapshot } from './data-snapshot';
import { ExportService, ExportResult } from './export.service';
import { WorkbookFileService } from './workbook-file.service';
import { ImportOutcome, ImportService } from './import.service';
import { WorkbookPlan, planWorkbook } from './import-plan';
import { parseWorkbook } from './import-parser';
import { CompatibilityResult, checkCompatibility } from './workbook-info';

function newUuid(): string {
  return crypto.randomUUID();
}

/**
 * Drives the two operations of the Excel format. The import is deliberately
 * split in two steps: reading and classifying produce a plan, and only an
 * explicit confirmation applies it.
 */
@Injectable({ providedIn: 'root' })
export class DataTransferStore {
  private readonly context = inject(FinancialContextService);
  private readonly profile = inject(CurrentProfileService);
  private readonly repository = inject(DataTransferRepository);
  private readonly exportService = inject(ExportService);
  private readonly importService = inject(ImportService);
  private readonly files = inject(WorkbookFileService);

  private readonly snapshot = signal<DataSnapshot | null>(null);

  readonly exporting = signal(false);
  readonly exportResult = signal<ExportResult | null>(null);
  readonly exportError = signal<string | null>(null);

  readonly fileName = signal<string | null>(null);
  readonly reading = signal(false);
  readonly compatibility = signal<CompatibilityResult | null>(null);
  readonly plan = signal<WorkbookPlan | null>(null);
  readonly unknownSheets = signal<readonly string[]>([]);
  readonly applying = signal(false);
  readonly outcome = signal<ImportOutcome | null>(null);
  readonly importError = signal<string | null>(null);

  readonly canManage = this.context.canManage;
  readonly ownerLabel = computed(() => {
    const context = this.context.context();
    return context.kind === 'shared' ? context.ownerName : this.ownName();
  });
  readonly hasPlan = computed(() => this.plan() !== null);
  readonly canConfirm = computed(
    () => this.canManage() && (this.plan()?.hasWork ?? false) && !this.applying(),
  );

  async exportWorkbook(): Promise<void> {
    const ownerId = this.context.dataOwnerId();
    if (!ownerId || this.exporting()) {
      return;
    }
    this.exporting.set(true);
    this.exportError.set(null);
    this.exportResult.set(null);
    try {
      this.exportResult.set(
        await this.exportService.exportWorkbook(ownerId, this.ownerLabel()),
      );
    } catch (error) {
      this.exportError.set(describe(error, 'Não foi possível exportar os dados.'));
    } finally {
      this.exporting.set(false);
    }
  }

  /** Reads the file and builds the plan. Nothing is written by this step. */
  async prepareImport(file: File): Promise<void> {
    const ownerId = this.context.dataOwnerId();
    if (!ownerId || this.reading()) {
      return;
    }
    this.resetImport();
    this.fileName.set(file.name);
    this.reading.set(true);
    try {
      const contents = await this.files.read(file);
      const parsed = parseWorkbook(contents);
      const compatibility = checkCompatibility(parsed.info);
      this.compatibility.set(compatibility);
      this.unknownSheets.set(parsed.unknownSheets);
      if (!compatibility.compatible) {
        return;
      }

      const snapshot = await loadSnapshot(this.repository, ownerId);
      this.snapshot.set(snapshot);
      this.plan.set(
        planWorkbook({
          parsed: parsed.sheets,
          existing: snapshot.existing,
          catalogs: snapshot.catalogs,
          newId: newUuid,
        }),
      );
    } catch (error) {
      this.importError.set(describe(error, 'Não foi possível ler o arquivo.'));
    } finally {
      this.reading.set(false);
    }
  }

  /** Applies the plan the user has just seen and confirmed. */
  async confirmImport(): Promise<void> {
    const plan = this.plan();
    const snapshot = this.snapshot();
    const ownerId = this.context.dataOwnerId();
    if (!plan || !snapshot || !ownerId || this.applying()) {
      return;
    }
    this.applying.set(true);
    this.importError.set(null);
    try {
      this.outcome.set(await this.importService.apply(plan, snapshot, ownerId));
      this.plan.set(null);
    } catch (error) {
      this.importError.set(describe(error, 'Não foi possível importar os dados.'));
    } finally {
      this.applying.set(false);
    }
  }

  resetImport(): void {
    this.fileName.set(null);
    this.compatibility.set(null);
    this.plan.set(null);
    this.unknownSheets.set([]);
    this.outcome.set(null);
    this.importError.set(null);
    this.snapshot.set(null);
  }

  private ownName(): string {
    return this.profile.profile()?.display_name ?? 'Proprietário';
  }
}

function describe(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
