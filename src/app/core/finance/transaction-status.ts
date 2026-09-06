import { Database } from '../supabase/database.types';

export type TransactionStatus = Database['public']['Enums']['transaction_status'];

export const TRANSACTION_STATUSES: readonly TransactionStatus[] = ['PENDING', 'PAID', 'CANCELLED'];

export const TRANSACTION_STATUS_LABELS: Readonly<Record<TransactionStatus, string>> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  CANCELLED: 'Cancelado',
};

// OVERDUE is never stored: it is a PENDING transaction whose due date has passed.
export type DisplayStatus = TransactionStatus | 'OVERDUE';

export const DISPLAY_STATUSES: readonly DisplayStatus[] = ['PENDING', 'OVERDUE', 'PAID', 'CANCELLED'];

export const DISPLAY_STATUS_LABELS: Readonly<Record<DisplayStatus, string>> = {
  ...TRANSACTION_STATUS_LABELS,
  OVERDUE: 'Vencido',
};
