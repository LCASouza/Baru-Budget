export type PaymentMethod = 'ACCOUNT' | 'CARD';

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['ACCOUNT', 'CARD'];

export const PAYMENT_METHOD_LABELS: Readonly<Record<PaymentMethod, string>> = {
  ACCOUNT: 'Conta',
  CARD: 'Cartão',
};

export const TRANSFER_TARGET_LABELS: Readonly<Record<PaymentMethod, string>> = {
  ACCOUNT: 'Outra conta',
  CARD: 'Fatura de cartão',
};
