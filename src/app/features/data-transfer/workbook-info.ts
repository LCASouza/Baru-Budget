import {
  APPLICATION_NAME,
  READABLE_SCHEMA_VERSIONS,
  WORKBOOK_V2,
} from './workbook-schema';

export const INFO_SHEET_NAME = 'Info';
export const LEGEND_SHEET_NAME = 'Legenda';

/** Sentence repeated in the file so it explains itself months later. */
export const ABSENCE_NOTICE =
  'Remover uma linha deste arquivo não apaga nada no Baru Budget. A exclusão só acontece dentro do aplicativo.';

export interface WorkbookInfo {
  readonly application: string;
  readonly schemaVersion: number;
  readonly exportedAt: string;
  readonly appVersion: string;
  readonly ownerUserId: string;
  readonly ownerName: string;
}

export type InfoEntry = readonly [string, string];

export function buildInfoEntries(info: WorkbookInfo): readonly InfoEntry[] {
  return [
    ['application', info.application],
    ['schema_version', String(info.schemaVersion)],
    ['exported_at', info.exportedAt],
    ['app_version', info.appVersion],
    ['owner_user_id', info.ownerUserId],
    ['owner_name', info.ownerName],
    ['aviso', ABSENCE_NOTICE],
  ];
}

export interface CompatibilityResult {
  readonly compatible: boolean;
  readonly reason: string | null;
  readonly info: Partial<WorkbookInfo>;
}

/**
 * A workbook is only read after this passes. Refusing the whole file with a
 * specific message beats classifying rows of a format nobody promised.
 */
export function checkCompatibility(entries: ReadonlyMap<string, string>): CompatibilityResult {
  const application = entries.get('application') ?? '';
  const rawVersion = entries.get('schema_version') ?? '';
  const info: Partial<WorkbookInfo> = {
    application,
    schemaVersion: Number(rawVersion),
    exportedAt: entries.get('exported_at'),
    appVersion: entries.get('app_version'),
    ownerUserId: entries.get('owner_user_id'),
    ownerName: entries.get('owner_name'),
  };

  if (!application && !rawVersion) {
    return {
      compatible: false,
      reason: 'A aba Info não foi encontrada. Este arquivo não é um Baru Budget Excel.',
      info,
    };
  }
  if (application !== APPLICATION_NAME) {
    return {
      compatible: false,
      reason: `O arquivo é de outra aplicação: "${application || 'desconhecida'}".`,
      info,
    };
  }
  const version = Number(rawVersion);
  // Version 2 only adds to version 1, so an older workbook is read as it is: the
  // columns it does not carry are left untouched instead of being cleared.
  if (!Number.isInteger(version) || !READABLE_SCHEMA_VERSIONS.includes(version)) {
    return {
      compatible: false,
      reason: `O arquivo usa o schema version ${rawVersion || 'desconhecido'} e esta versão lê ${READABLE_SCHEMA_VERSIONS.join(' e ')}.`,
      info,
    };
  }
  return { compatible: true, reason: null, info };
}

export type LegendRow = readonly [string, string, string, string];

/** Accepted values and read-only columns, so the file can be edited without guessing. */
export function buildLegendRows(): readonly LegendRow[] {
  const rows: LegendRow[] = [];
  for (const sheet of WORKBOOK_V2) {
    if (!sheet.importable) {
      rows.push([sheet.name, '(toda a aba)', 'somente leitura', 'Exportada para leitura; não é importada.']);
      continue;
    }
    for (const column of sheet.columns) {
      if (column.role === 'readonly') {
        rows.push([sheet.name, column.key, 'somente leitura', 'Calculada pelo sistema; alterações são ignoradas.']);
      } else if (column.enumValues) {
        rows.push([sheet.name, column.key, 'valores aceitos', column.enumValues.join(', ')]);
      } else if (column.role === 'lookup') {
        rows.push([
          sheet.name,
          column.key,
          'nome',
          `Preenche ${column.fills?.field} quando a coluna de ID está vazia. Nome duplicado ou inexistente invalida a linha.`,
        ]);
      } else if (column.type === 'boolean') {
        rows.push([sheet.name, column.key, 'valores aceitos', 'VERDADEIRO, FALSO']);
      }
    }
  }
  return rows;
}
