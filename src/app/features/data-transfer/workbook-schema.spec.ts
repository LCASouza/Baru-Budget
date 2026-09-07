import {
  FORBIDDEN_FIELDS,
  IMPORTABLE_SHEETS,
  WORKBOOK_V1,
  databaseField,
  isOwnedTable,
  sheetByName,
} from './workbook-schema';

/**
 * Version 1 is frozen: this list is the contract. Changing it means schema
 * version 2 with a converter, never an edit here.
 */
const FROZEN_SHEETS: readonly string[] = [
  'Contas',
  'Categorias',
  'Cartoes',
  'Emprestimos',
  'Financiamentos',
  'GastosFixos',
  'ReceitasRecorrentes',
  'Movimentacoes',
  'Divisoes',
  'Grupos',
  'Pessoas',
];

const FROZEN_ACCOUNT_COLUMNS: readonly string[] = [
  'id',
  'nome',
  'tipo',
  'instituicao',
  'saldo_inicial',
  'cor',
  'ativo',
];

const FROZEN_ALLOCATION_COLUMNS: readonly string[] = [
  'id',
  'transaction_id',
  'pessoa',
  'user_id',
  'valor',
];

describe('workbook-schema version 1', () => {
  it('keeps the frozen sheet names and their order', () => {
    expect(WORKBOOK_V1.map((sheet) => sheet.name)).toEqual(FROZEN_SHEETS);
  });

  it('keeps the frozen columns of a simple sheet and of the allocations sheet', () => {
    expect(sheetByName('Contas')?.columns.map((column) => column.key)).toEqual(
      FROZEN_ACCOUNT_COLUMNS,
    );
    expect(sheetByName('Divisoes')?.columns.map((column) => column.key)).toEqual(
      FROZEN_ALLOCATION_COLUMNS,
    );
  });

  it('gives every importable sheet an id column', () => {
    for (const sheet of IMPORTABLE_SHEETS) {
      const id = sheet.columns.find((column) => column.key === 'id');
      expect(id, sheet.name).toBeDefined();
      expect(id?.role).toBe('key');
    }
  });

  it('never carries ownership or audit columns', () => {
    for (const sheet of WORKBOOK_V1) {
      for (const column of sheet.columns) {
        expect(FORBIDDEN_FIELDS, `${sheet.name}.${column.key}`).not.toContain(
          databaseField(column),
        );
      }
    }
  });

  it('gives every lookup column a catalog and an id column beside it', () => {
    for (const sheet of WORKBOOK_V1) {
      const keys = new Set(sheet.columns.map((column) => column.key));
      for (const column of sheet.columns) {
        if (column.role !== 'lookup') {
          continue;
        }
        expect(column.fills, `${sheet.name}.${column.key}`).toBeDefined();
        expect(keys, `${sheet.name}.${column.key}`).toContain(column.fills!.field);
      }
    }
  });

  it('gives every enum column its accepted values', () => {
    for (const sheet of WORKBOOK_V1) {
      for (const column of sheet.columns) {
        if (column.type === 'enum') {
          expect(column.enumValues?.length, `${sheet.name}.${column.key}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('never repeats a column key inside a sheet', () => {
    for (const sheet of WORKBOOK_V1) {
      const keys = sheet.columns.map((column) => column.key);
      expect(new Set(keys).size, sheet.name).toBe(keys.length);
    }
  });

  it('orders sheets so a reference is always created before it is used', () => {
    const order = WORKBOOK_V1.map((sheet) => sheet.name);
    expect(order.indexOf('Contas')).toBeLessThan(order.indexOf('Movimentacoes'));
    expect(order.indexOf('Categorias')).toBeLessThan(order.indexOf('Movimentacoes'));
    expect(order.indexOf('Cartoes')).toBeLessThan(order.indexOf('Movimentacoes'));
    expect(order.indexOf('Emprestimos')).toBeLessThan(order.indexOf('Movimentacoes'));
    expect(order.indexOf('Financiamentos')).toBeLessThan(order.indexOf('Movimentacoes'));
    expect(order.indexOf('Movimentacoes')).toBeLessThan(order.indexOf('Divisoes'));
  });

  it('marks groups and people as read-only', () => {
    expect(sheetByName('Grupos')?.importable).toBe(false);
    expect(sheetByName('Pessoas')?.importable).toBe(false);
    expect(IMPORTABLE_SHEETS.map((sheet) => sheet.name)).not.toContain('Grupos');
  });

  it('separates owned tables from the ones row level security filters alone', () => {
    expect(isOwnedTable('transactions')).toBe(true);
    expect(isOwnedTable('profiles')).toBe(false);
    expect(isOwnedTable('transaction_allocations')).toBe(false);
  });
});
