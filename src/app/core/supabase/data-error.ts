import { PostgrestError } from '@supabase/supabase-js';

export const UNIQUE_VIOLATION = '23505';
export const FOREIGN_KEY_VIOLATION = '23503';

// Error raised by repositories. Keeps the PostgreSQL error code so the interface
// can choose a message without parsing text.
export class DataError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'DataError';
  }
}

export function toDataError(error: PostgrestError, context: string): DataError {
  return new DataError(`${context}: ${error.message}`, error.code || null);
}

export interface DataErrorMessages {
  readonly unique?: string;
  readonly inUse?: string;
  readonly fallback: string;
}

export function describeDataError(error: unknown, messages: DataErrorMessages): string {
  if (error instanceof DataError) {
    if (error.code === UNIQUE_VIOLATION && messages.unique) {
      return messages.unique;
    }
    if (error.code === FOREIGN_KEY_VIOLATION && messages.inUse) {
      return messages.inUse;
    }
  }
  return messages.fallback;
}
