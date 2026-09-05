export type TransactionKindOption = 'INCOME' | 'EXPENSE';

export interface SelectOption {
  readonly id: string;
  readonly label: string;
}

export interface CategoryOption extends SelectOption {
  readonly kind: TransactionKindOption;
}

export const MOCK_CATEGORIES: readonly CategoryOption[] = [
  { id: 'salary', label: 'Salário', kind: 'INCOME' },
  { id: 'benefit', label: 'Benefício', kind: 'INCOME' },
  { id: 'extra-work', label: 'Trabalho extra', kind: 'INCOME' },
  { id: 'gift', label: 'Presente', kind: 'INCOME' },
  { id: 'refund', label: 'Reembolso', kind: 'INCOME' },
  { id: 'yield', label: 'Rendimentos', kind: 'INCOME' },
  { id: 'income-other', label: 'Outros', kind: 'INCOME' },
  { id: 'housing', label: 'Moradia', kind: 'EXPENSE' },
  { id: 'food', label: 'Alimentação', kind: 'EXPENSE' },
  { id: 'transport', label: 'Transporte', kind: 'EXPENSE' },
  { id: 'health', label: 'Saúde', kind: 'EXPENSE' },
  { id: 'education', label: 'Educação', kind: 'EXPENSE' },
  { id: 'leisure', label: 'Lazer', kind: 'EXPENSE' },
  { id: 'subscriptions', label: 'Assinaturas', kind: 'EXPENSE' },
  { id: 'shopping', label: 'Compras', kind: 'EXPENSE' },
  { id: 'expense-other', label: 'Outros', kind: 'EXPENSE' },
];

export const MOCK_ACCOUNTS: readonly SelectOption[] = [
  { id: 'checking', label: 'Conta corrente' },
  { id: 'cash', label: 'Dinheiro' },
  { id: 'savings', label: 'Poupança' },
  { id: 'wallet', label: 'Carteira digital' },
  { id: 'food-voucher', label: 'Vale alimentação' },
  { id: 'meal-voucher', label: 'Vale refeição' },
];

export const MOCK_ORIGINS: readonly SelectOption[] = [
  { id: 'CASH', label: 'À vista' },
  { id: 'CREDIT_CARD', label: 'Cartão' },
  { id: 'FIXED_EXPENSE', label: 'Gasto fixo' },
  { id: 'LOAN', label: 'Empréstimo' },
  { id: 'FINANCING', label: 'Financiamento' },
];

export const MOCK_STATUSES: readonly SelectOption[] = [
  { id: 'PENDING', label: 'Pendente' },
  { id: 'PAID', label: 'Pago' },
];
