import { Route, Routes } from '@angular/router';
import { Shell } from './core/layout/shell/shell';
import { NAV_ITEMS, NavItem } from './core/navigation/nav-items';

function navItem(path: string): NavItem {
  const item = NAV_ITEMS.find((candidate) => candidate.path === path);
  if (!item) {
    throw new Error(`Unknown navigation path: ${path}`);
  }
  return item;
}

function placeholderRoute(path: string, description: string, plannedVersion: string): Route {
  const item = navItem(path);
  return {
    path: path.slice(1),
    title: item.label,
    data: { title: item.label, icon: item.icon, description, plannedVersion },
    loadComponent: () =>
      import('./shared/components/feature-placeholder/feature-placeholder').then(
        (m) => m.FeaturePlaceholder,
      ),
  };
}

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage),
      },
      placeholderRoute(
        '/transactions',
        'Entradas, saídas e transferências com filtros por período, categoria, conta e status.',
        'v0.3',
      ),
      placeholderRoute(
        '/cards',
        'Cartões de crédito com limite, fechamento, vencimento e faturas por competência.',
        'v0.6',
      ),
      placeholderRoute(
        '/installments',
        'Compras parceladas com parcela atual, parcelas restantes e comprometimento futuro.',
        'v0.7',
      ),
      placeholderRoute(
        '/fixed-expenses',
        'Gastos recorrentes com competência mensal editável sem alterar o modelo original.',
        'v0.8',
      ),
      placeholderRoute(
        '/loans',
        'Empréstimos com principal, juros, parcelas e saldo devedor.',
        'v0.10',
      ),
      placeholderRoute(
        '/financings',
        'Financiamentos com valor do bem, entrada, parcelas e saldo devedor.',
        'v0.11',
      ),
      placeholderRoute(
        '/settlements',
        'Divisão de despesas e acertos com valores a receber e a pagar entre pessoas.',
        'v0.9',
      ),
      placeholderRoute('/households', 'Grupos financeiros compartilhados, como a família.', 'v0.4'),
      placeholderRoute(
        '/sharing',
        'Acesso às suas finanças concedido a outras pessoas com permissão VIEW ou MANAGE.',
        'v0.4',
      ),
      placeholderRoute('/settings', 'Perfil, contas, categorias e preferências.', 'v0.1'),
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
