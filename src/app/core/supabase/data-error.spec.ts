import { PostgrestError } from '@supabase/supabase-js';
import { DataError, describeDataError, toDataError } from './data-error';

function postgrestError(code: string, message = 'boom'): PostgrestError {
  return { code, message, details: '', hint: '', name: 'PostgrestError' } as PostgrestError;
}

describe('data-error', () => {
  it('keeps the database error code', () => {
    const error = toDataError(postgrestError('23505', 'duplicate key'), 'Failed to create account');
    expect(error).toBeInstanceOf(DataError);
    expect(error.code).toBe('23505');
    expect(error.message).toBe('Failed to create account: duplicate key');
  });

  it('maps unique and foreign key violations to specific messages', () => {
    const messages = { unique: 'Nome duplicado.', inUse: 'Em uso.', fallback: 'Falhou.' };
    expect(describeDataError(new DataError('x', '23505'), messages)).toBe('Nome duplicado.');
    expect(describeDataError(new DataError('x', '23503'), messages)).toBe('Em uso.');
    expect(describeDataError(new DataError('x', '42501'), messages)).toBe('Falhou.');
  });

  it('falls back for unknown errors and missing messages', () => {
    expect(describeDataError(new Error('x'), { fallback: 'Falhou.' })).toBe('Falhou.');
    expect(describeDataError(new DataError('x', '23505'), { fallback: 'Falhou.' })).toBe('Falhou.');
    expect(describeDataError(undefined, { fallback: 'Falhou.' })).toBe('Falhou.');
  });
});
