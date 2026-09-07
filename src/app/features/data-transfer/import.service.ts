import { Injectable, inject } from '@angular/core';
import { DataTransferRepository } from './data-transfer.repository';
import { DataSnapshot } from './data-snapshot';
import { PlannedRow, SheetPlan, WorkbookPlan } from './import-plan';
import {
  ALLOCATIONS_SHEET,
  DatabaseRow,
  FORBIDDEN_FIELDS,
  IMPORTABLE_SHEETS,
} from './workbook-schema';

export interface SheetOutcome {
  readonly sheetName: string;
  readonly written: number;
  readonly failed: number;
  readonly error: string | null;
}

export interface ImportOutcome {
  readonly sheets: readonly SheetOutcome[];
  readonly written: number;
  readonly failed: number;
  readonly ok: boolean;
}

/** Rows the user asked to write; unchanged and invalid ones never leave the browser. */
function writable(plan: SheetPlan): readonly PlannedRow[] {
  return plan.rows.filter((row) => row.status === 'new' || row.status === 'updated');
}

/**
 * Applies a confirmed plan sheet by sheet, in the order the contract declares.
 * Writes go through the same doors the application uses, so row level security
 * and every database invariant stay in charge. The operation is idempotent
 * rather than transactional: running it again finishes what a failure left.
 */
@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly repository = inject(DataTransferRepository);

  async apply(
    plan: WorkbookPlan,
    snapshot: DataSnapshot,
    ownerId: string,
  ): Promise<ImportOutcome> {
    const outcomes: SheetOutcome[] = [];

    for (const sheet of IMPORTABLE_SHEETS) {
      const sheetPlan = plan.sheets.find((candidate) => candidate.sheetName === sheet.name);
      const rows = sheetPlan ? writable(sheetPlan) : [];
      if (rows.length === 0) {
        continue;
      }

      try {
        if (sheet.name === ALLOCATIONS_SHEET.name) {
          await this.applyAllocations(rows, snapshot);
        } else {
          await this.repository.upsertAll(
            sheet.table,
            rows.map((row) => this.toDatabaseRow(row, ownerId)),
          );
        }
        outcomes.push({ sheetName: sheet.name, written: rows.length, failed: 0, error: null });
      } catch (error) {
        outcomes.push({
          sheetName: sheet.name,
          written: 0,
          failed: rows.length,
          error: error instanceof Error ? error.message : 'Erro desconhecido.',
        });
      }
    }

    const written = outcomes.reduce((total, outcome) => total + outcome.written, 0);
    const failed = outcomes.reduce((total, outcome) => total + outcome.failed, 0);
    return { sheets: outcomes, written, failed, ok: failed === 0 };
  }

  /**
   * The owner never comes from the file: it comes from the current context, and
   * the forbidden fields are dropped even if something put them in the plan.
   */
  private toDatabaseRow(row: PlannedRow, ownerId: string): DatabaseRow {
    const values: DatabaseRow = {};
    for (const [field, value] of Object.entries(row.values)) {
      if (!FORBIDDEN_FIELDS.includes(field)) {
        values[field] = value;
      }
    }
    return { ...values, id: row.id, owner_user_id: ownerId };
  }

  /**
   * Allocations are replaced per transaction by the same function the split
   * dialog calls, so the deferred sum invariant holds. The current split is
   * merged with the edited rows instead of replaced, because a person missing
   * from the file must not be dropped.
   */
  private async applyAllocations(
    rows: readonly PlannedRow[],
    snapshot: DataSnapshot,
  ): Promise<void> {
    const current = snapshot.data.get(ALLOCATIONS_SHEET.name) ?? [];
    const merged = new Map<string, Map<string, number>>();

    const touched = new Set(
      rows.map((row) => String(row.values['transaction_id'] ?? '')).filter(Boolean),
    );

    for (const allocation of current) {
      const transactionId = String(allocation['transaction_id'] ?? '');
      if (!touched.has(transactionId)) {
        continue;
      }
      const split = merged.get(transactionId) ?? new Map<string, number>();
      split.set(String(allocation['user_id'] ?? ''), Number(allocation['amount'] ?? 0));
      merged.set(transactionId, split);
    }

    for (const row of rows) {
      const transactionId = String(row.values['transaction_id'] ?? '');
      const userId = String(row.values['user_id'] ?? '');
      if (!transactionId || !userId) {
        continue;
      }
      const split = merged.get(transactionId) ?? new Map<string, number>();
      split.set(userId, Number(row.values['amount'] ?? 0));
      merged.set(transactionId, split);
    }

    for (const [transactionId, split] of merged) {
      await this.repository.setAllocations(
        transactionId,
        [...split.keys()],
        [...split.values()],
      );
    }
  }
}
