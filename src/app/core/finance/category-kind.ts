import { Database } from '../supabase/database.types';

export type CategoryKind = Database['public']['Enums']['category_kind'];

export const CATEGORY_KINDS: readonly CategoryKind[] = ['INCOME', 'EXPENSE'];

export const CATEGORY_KIND_LABELS: Readonly<Record<CategoryKind, string>> = {
  INCOME: 'Receita',
  EXPENSE: 'Despesa',
};
