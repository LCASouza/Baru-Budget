import { Route, Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';
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
    path: 'login',
    title: 'Entrar',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login-page/login-page').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage),
      },
      {
        path: 'transactions',
        title: navItem('/transactions').label,
        loadComponent: () =>
          import('./features/transactions/transactions-page/transactions-page').then(
            (m) => m.TransactionsPage,
          ),
      },
      {
        path: 'cards',
        title: navItem('/cards').label,
        loadComponent: () =>
          import('./features/cards/cards-page/cards-page').then((m) => m.CardsPage),
      },
      {
        path: 'cards/:id',
        title: 'Cartão',
        loadComponent: () =>
          import('./features/cards/card-detail-page/card-detail-page').then(
            (m) => m.CardDetailPage,
          ),
      },
      {
        path: 'installments',
        title: navItem('/installments').label,
        loadComponent: () =>
          import('./features/installments/installments-page/installments-page').then(
            (m) => m.InstallmentsPage,
          ),
      },
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
      {
        path: 'households',
        title: navItem('/households').label,
        loadComponent: () =>
          import('./features/households/households-page/households-page').then(
            (m) => m.HouseholdsPage,
          ),
      },
      {
        path: 'sharing',
        title: navItem('/sharing').label,
        loadComponent: () =>
          import('./features/sharing/sharing-page/sharing-page').then((m) => m.SharingPage),
      },
      {
        path: 'settings',
        title: navItem('/settings').label,
        loadComponent: () =>
          import('./features/settings/settings-page/settings-page').then((m) => m.SettingsPage),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'accounts' },
          {
            path: 'accounts',
            loadComponent: () =>
              import('./features/accounts/accounts-page/accounts-page').then((m) => m.AccountsPage),
          },
          {
            path: 'categories',
            loadComponent: () =>
              import('./features/categories/categories-page/categories-page').then(
                (m) => m.CategoriesPage,
              ),
          },
          {
            path: 'profile',
            loadComponent: () =>
              import('./features/settings/profile-page/profile-page').then((m) => m.ProfilePage),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
