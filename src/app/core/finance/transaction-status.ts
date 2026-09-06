import { Database } from '../supabase/database.types';
import { TransactionKind } from './transaction-kind';

export type TransactionStatus = Database['public']['Enums']['transaction_status'];

export const TRANSACTION_STATUSES: readonly TransactionStatus[] = ['PENDING', 'PAID', 'CANCELLED'];

// OVERDUE is never stored: it is a PENDING transaction whose due date has passed.
export type DisplayStatus = TransactionStatus | 'OVERDUE';

export const DISPLAY_STATUSES: readonly DisplayStatus[] = ['PENDING', 'OVERDUE', 'PAID', 'CANCELLED'];

const EXPENSE_LABELS: Readonly<Record<DisplayStatus, string>> = {
  PENDING: 'Pendente',
  OVERDUE: 'Vencido',
  PAID: 'Pago',
  CANCELLED: 'Cancelado',
};

const INCOME_LABELS: Readonly<Record<DisplayStatus, string>> = {
  PENDING: 'Pendente',
  OVERDUE: 'Atrasado',
  PAID: 'Recebido',
  CANCELLED: 'Cancelado',
};

const TRANSFER_LABELS: Readonly<Record<DisplayStatus, string>> = {
  PENDING: 'Pendente',
  OVERDUE: 'Atrasada',
  PAID: 'Efetuada',
  CANCELLED: 'Cancelada',
};

// Labels used when the list mixes every kind.
const GENERIC_LABELS: Readonly<Record<DisplayStatus, string>> = {
  PENDING: 'Pendente',
  OVERDUE: 'Vencido',
  PAID: 'Pago / Recebido',
  CANCELLED: 'Cancelado',
};

export function transactionStatusLabel(
  status: DisplayStatus,
  kind: TransactionKind | null = null,
): string {
  switch (kind) {
    case 'INCOME':
      return INCOME_LABELS[status];
    case 'TRANSFER':
      return TRANSFER_LABELS[status];
    case 'EXPENSE':
    case 'SETTLEMENT':
      return EXPENSE_LABELS[status];
    default:
      return GENERIC_LABELS[status];
  }
}
