import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ViewportService } from '../../../core/layout/viewport.service';

export interface DataColumn {
  readonly key: string;
  readonly label: string;
  /** Right aligned and tabular on the desktop table. */
  readonly numeric?: boolean;
  /** Hidden on the phone, where space is the scarce resource. */
  readonly secondary?: boolean;
}

export interface DataCell {
  readonly key: string;
  readonly text: string;
  /** Optional second line, shown under the value. */
  readonly note?: string;
}

export interface DataRow {
  readonly id: string;
  readonly cells: readonly DataCell[];
  /** Marks the row as done, so it can be dimmed. */
  readonly muted?: boolean;
  /** When true the row behaves like a button: clickable and keyboard operable. */
  readonly actionable?: boolean;
}

/**
 * A table on the desktop and a list of cards on a phone, from one declaration.
 * MASTER_PROMPT section 51 forbids a wide table as the only interface on a
 * phone, and three screens needed exactly the same answer.
 */
@Component({
  selector: 'app-data-rows',
  templateUrl: './data-rows.html',
  styleUrl: './data-rows.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataRows {
  private readonly viewport = inject(ViewportService);

  readonly columns = input.required<readonly DataColumn[]>();
  readonly rows = input.required<readonly DataRow[]>();
  readonly caption = input<string>();

  readonly activate = output<string>();

  protected readonly isMobile = this.viewport.isMobile;

  /** On a phone the secondary columns are dropped instead of being scrolled to. */
  protected readonly mobileColumns = computed(() =>
    this.columns().filter((column) => !column.secondary),
  );

  protected labelOf(key: string): string {
    return this.columns().find((column) => column.key === key)?.label ?? '';
  }

  protected isNumeric(key: string): boolean {
    return this.columns().find((column) => column.key === key)?.numeric ?? false;
  }

  protected cellsFor(row: DataRow, columns: readonly DataColumn[]): readonly DataCell[] {
    const keys = new Set(columns.map((column) => column.key));
    return row.cells.filter((cell) => keys.has(cell.key));
  }

  protected onActivate(row: DataRow): void {
    if (row.actionable) {
      this.activate.emit(row.id);
    }
  }
}
