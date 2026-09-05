export interface MockUser {
  readonly displayName: string;
  readonly email: string;
  readonly initials: string;
}

export type FinancialContextKind = 'personal' | 'household' | 'shared';

export interface FinancialContextOption {
  readonly id: string;
  readonly label: string;
  readonly kind: FinancialContextKind;
  readonly icon: string;
}

export const MOCK_USER: MockUser = {
  displayName: 'Lucas',
  email: 'lucas@exemplo.com',
  initials: 'L',
};

export const MOCK_CONTEXTS: readonly FinancialContextOption[] = [
  { id: 'me', label: 'Minhas finanças', kind: 'personal', icon: 'person' },
  { id: 'family', label: 'Família', kind: 'household', icon: 'groups' },
  { id: 'dad', label: 'Finanças de Pai', kind: 'shared', icon: 'share' },
  { id: 'wife', label: 'Finanças de Esposa', kind: 'shared', icon: 'share' },
];
