import { Database } from '../supabase/database.types';

export type AccessPermission = Database['public']['Enums']['access_permission'];

export const ACCESS_PERMISSIONS: readonly AccessPermission[] = ['VIEW', 'MANAGE'];

export const ACCESS_PERMISSION_LABELS: Readonly<Record<AccessPermission, string>> = {
  VIEW: 'Visualizar',
  MANAGE: 'Administrar',
};

export const ACCESS_PERMISSION_DESCRIPTIONS: Readonly<Record<AccessPermission, string>> = {
  VIEW: 'Vê movimentações, contas, saldos e categorias. Não altera nada.',
  MANAGE: 'Registra e edita movimentações, contas e categorias. Não compartilha nem altera acessos.',
};
