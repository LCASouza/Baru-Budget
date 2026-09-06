import { Database } from '../supabase/database.types';

export type AccountType = Database['public']['Enums']['account_type'];

export const ACCOUNT_TYPES: readonly AccountType[] = ['BANK', 'CASH', 'BENEFIT', 'OTHER'];

export const ACCOUNT_TYPE_LABELS: Readonly<Record<AccountType, string>> = {
  BANK: 'Conta bancária',
  CASH: 'Dinheiro',
  BENEFIT: 'Benefício',
  OTHER: 'Outra',
};
