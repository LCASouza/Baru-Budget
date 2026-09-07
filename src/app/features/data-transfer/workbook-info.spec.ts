import { ABSENCE_NOTICE, buildInfoEntries, buildLegendRows, checkCompatibility } from './workbook-info';

function entries(pairs: Record<string, string>): ReadonlyMap<string, string> {
  return new Map(Object.entries(pairs));
}

describe('workbook-info', () => {
  it('accepts a workbook of this application and this schema version', () => {
    const result = checkCompatibility(entries({ application: 'Baru Budget', schema_version: '1' }));
    expect(result.compatible).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('refuses a file without the Info sheet', () => {
    const result = checkCompatibility(entries({}));
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain('Info');
  });

  it('refuses a file from another application', () => {
    const result = checkCompatibility(entries({ application: 'Outro App', schema_version: '1' }));
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain('Outro App');
  });

  it('refuses another schema version and says which one it read', () => {
    const result = checkCompatibility(entries({ application: 'Baru Budget', schema_version: '2' }));
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain('2');
  });

  it('writes the metadata the format promises, and the absence notice', () => {
    const rows = buildInfoEntries({
      application: 'Baru Budget',
      schemaVersion: 1,
      exportedAt: '2026-09-07T12:00:00.000Z',
      appVersion: '0.12.0',
      ownerUserId: 'u1',
      ownerName: 'Alice',
    });
    const keys = rows.map(([key]) => key);
    expect(keys).toEqual([
      'application',
      'schema_version',
      'exported_at',
      'app_version',
      'owner_user_id',
      'owner_name',
      'aviso',
    ]);
    expect(rows.find(([key]) => key === 'aviso')?.[1]).toBe(ABSENCE_NOTICE);
    expect(keys).not.toContain('email');
  });

  it('documents the accepted values of every enum and the read-only columns', () => {
    const rows = buildLegendRows();
    const kinds = rows.find((row) => row[0] === 'Movimentacoes' && row[1] === 'tipo');
    expect(kinds?.[3]).toBe('INCOME, EXPENSE, TRANSFER, SETTLEMENT');

    const generated = rows.find((row) => row[0] === 'Financiamentos' && row[1] === 'valor_financiado');
    expect(generated?.[2]).toBe('somente leitura');

    expect(rows.some((row) => row[0] === 'Grupos' && row[2] === 'somente leitura')).toBe(true);
  });
});
