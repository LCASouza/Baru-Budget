import { CategoryKind } from '../../core/finance/category-kind';
import { Tables } from '../../core/supabase/database.types';
import { normalizeText } from '../../shared/text/normalize';

export type Category = Tables<'categories'>;

export interface CategoryInput {
  readonly kind: CategoryKind;
  readonly name: string;
}

const DEFAULT_CATEGORY_ICONS: Readonly<Record<CategoryKind, Readonly<Record<string, string>>>> = {
  INCOME: {
    salario: 'payments',
    beneficio: 'restaurant',
    'trabalho extra': 'work',
    presente: 'card_giftcard',
    reembolso: 'receipt_long',
    rendimentos: 'trending_up',
    outros: 'more_horiz',
  },
  EXPENSE: {
    moradia: 'home',
    alimentacao: 'restaurant',
    transporte: 'directions_car',
    saude: 'medical_services',
    educacao: 'school',
    lazer: 'sports_esports',
    assinaturas: 'subscriptions',
    compras: 'shopping_bag',
    outros: 'category',
  },
};

/** Material icon for a predefined category, with a safe fallback for custom ones. */
export function categoryIconByName(
  kind: CategoryKind,
  name: string,
  storedIcon: string | null = null,
): string {
  return (
    storedIcon?.trim() ||
    DEFAULT_CATEGORY_ICONS[kind][normalizeText(name)] ||
    (kind === 'INCOME' ? 'add_circle' : 'label')
  );
}

export function categoryIcon(
  category: Pick<Category, 'kind' | 'name' | 'icon'>,
): string {
  return categoryIconByName(category.kind, category.name, category.icon);
}
