import { CategoryKind } from '../../core/finance/category-kind';
import { Tables } from '../../core/supabase/database.types';

export type Category = Tables<'categories'>;

export interface CategoryInput {
  readonly kind: CategoryKind;
  readonly name: string;
}
