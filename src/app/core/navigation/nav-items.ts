export interface NavItem {
  readonly label: string;
  readonly mobileLabel?: string;
  readonly icon: string;
  readonly path: string;
  readonly mobilePrimary?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: 'Dashboard',
    mobileLabel: 'Início',
    icon: 'space_dashboard',
    path: '/dashboard',
    mobilePrimary: true,
  },
  { label: 'Movimentações', icon: 'swap_vert', path: '/transactions', mobilePrimary: true },
  { label: 'Cartões', icon: 'credit_card', path: '/cards', mobilePrimary: true },
  { label: 'Parcelas', icon: 'date_range', path: '/installments' },
  { label: 'Gastos Fixos', icon: 'event_repeat', path: '/fixed-expenses' },
  { label: 'Empréstimos', icon: 'handshake', path: '/loans' },
  { label: 'Financiamentos', icon: 'house', path: '/financings' },
  { label: 'Acertos', icon: 'sync_alt', path: '/settlements' },
  { label: 'Grupos', icon: 'groups', path: '/households' },
  { label: 'Compartilhamento', icon: 'share', path: '/sharing' },
  { label: 'Configurações', icon: 'settings', path: '/settings' },
];

export const PRIMARY_NAV_ITEMS: readonly NavItem[] = NAV_ITEMS.filter((item) => item.mobilePrimary);

export const SECONDARY_NAV_ITEMS: readonly NavItem[] = NAV_ITEMS.filter(
  (item) => !item.mobilePrimary,
);
