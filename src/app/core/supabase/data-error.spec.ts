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

  it('never leaks a database code into what the user reads', () => {
    const codes = ['23505', '23503', '23514', '42501', '22P02', 'PGRST205'];
    for (const code of codes) {
      const shown = describeDataError(new DataError(`Failed: ${code} detail`, code), {
        unique: 'Já existe um registro com esse nome.',
        inUse: 'Este registro está em uso.',
        fallback: 'Não foi possível concluir a operação.',
      });
      expect(shown, code).not.toContain(code);
      expect(shown, code).not.toContain('Failed');
    }
  });

  it('gives a message for anything thrown, including a non-error', () => {
    const messages = { fallback: 'Não foi possível concluir a operação.' };
    expect(describeDataError('texto solto', messages)).toBe(messages.fallback);
    expect(describeDataError(null, messages)).toBe(messages.fallback);
    expect(describeDataError({ code: '23505' }, messages)).toBe(messages.fallback);
  });
});
