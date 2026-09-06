import { Database } from '../supabase/database.types';

export type TransactionKind = Database['public']['Enums']['transaction_kind'];

export const TRANSACTION_KINDS: readonly TransactionKind[] = [
  'INCOME',
  'EXPENSE',
  'TRANSFER',
  'SETTLEMENT',
];

export const TRANSACTION_KIND_LABELS: Readonly<Record<TransactionKind, string>> = {
  INCOME: 'Entrada',
  EXPENSE: 'Saída',
  TRANSFER: 'Transferência',
  SETTLEMENT: 'Acerto',
};
