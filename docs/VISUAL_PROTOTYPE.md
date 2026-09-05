# Baru Budget — Visual Prototype (pre-v0.1)

## Status

DELIVERED — visually approved on 2026-09-05. The interface serves as the base for the functional implementation of v0.1.

The prototype is a validation step that precedes v0.1. It is not a roadmap version and does not deliver any financial feature. Approval of this prototype defines the visual base for the functional implementation of v0.1.

## Objective

Allow the interface of Baru Budget to be executed in a browser and evaluated for appearance, layout and navigation on desktop, tablet and mobile before functional implementation starts.

## Scope

- Angular 22 workspace: standalone components, zoneless change detection, strict TypeScript, SCSS, Vitest.
- Angular Material 22 with a Material 3 theme generated from seed colors (primary `#1F7A5C`, tertiary `#C0692B`) and the Inter typeface.
- Desktop shell (≥ 1024px): sidebar + header + content.
- Tablet shell (768–1023px): icon rail sidebar with tooltips.
- Mobile shell (< 768px): bottom navigation with Início, Movimentações, Cartões and Mais; the remaining areas open in a bottom sheet.
- Header: page title, period selector, financial context selector (Minhas finanças, Família, shared finances) and current user menu.
- Dashboard with mock data: summary cards (Receitas, Despesas, Saldo, Benefícios, A receber, A pagar), Receitas × Despesas chart, Gastos por categoria, Próximos vencimentos, Transações recentes and Acertos.
- "Nova movimentação" form: centered dialog on desktop, full-screen dialog on mobile. Fields: tipo (Entrada/Saída), descrição, valor, data, categoria, conta, tipo/origem (only for Saída: À vista, Cartão, Gasto fixo, Empréstimo, Financiamento), status and observações. Saving closes the dialog and shows a notice that nothing was persisted.
- Placeholder pages for every menu area, showing the feature name, a short description and the roadmap version in which the feature is planned.

## Out of Scope

Supabase, PostgreSQL, migrations, authentication, Row Level Security, repositories, persistence, financial rules and calculations, Excel import/export, API integration, dark theme, automated UI tests.

## Technical Behavior

- Breakpoints are resolved by `ViewportService` (CDK `BreakpointObserver`): mobile < 768px, tablet 768–1023px, desktop ≥ 1024px.
- Navigation entries are declared once in `src/app/core/navigation/nav-items.ts` and consumed by the sidebar, the bottom navigation, the bottom sheet and the route table.
- Route `title` feeds both the header title and the document title (`<page> · Baru Budget`).
- Locale is `pt-BR`: currency is rendered as `R$ 1.234,56` and dates as `dd/MM/yyyy`.
- All mock data lives in `*.mock.ts` files (`dashboard.mock.ts`, `transaction-form.mock.ts`, `shell.mock.ts`). Templates contain no fictitious numbers.
- Charts are inline SVG/HTML without a chart library. Series colors (income `#20895f`, expense `#8a5cd6`) were validated for color-vision deficiency and contrast; a legend and hover tooltips complement color.
- The transaction form is loaded on demand so that form, datepicker, select and chips code stays out of the initial bundle.

## Structure

```text
src/app/
├── app.config.ts            locale, router, Material date adapter, icon font set
├── app.routes.ts            shell + dashboard + placeholder routes
├── core/
│   ├── layout/
│   │   ├── shell/           sidenav container, header, main outlet, mobile FAB and bottom nav
│   │   ├── sidebar/         desktop sidebar and tablet rail
│   │   ├── header/          title, period filter, context selector, user menu
│   │   ├── bottom-nav/      mobile bottom navigation
│   │   ├── more-menu-sheet/ bottom sheet with secondary areas
│   │   ├── viewport.service.ts
│   │   └── shell.mock.ts
│   └── navigation/
│       ├── nav-items.ts
│       ├── navigation.service.ts
│       └── app-title.strategy.ts
├── shared/components/
│   ├── summary-card/
│   ├── period-filter/
│   └── feature-placeholder/
└── features/
    ├── dashboard/
    │   ├── dashboard-page.*
    │   ├── dashboard.mock.ts
    │   ├── dashboard.models.ts
    │   └── components/
    │       ├── income-expense-chart/
    │       ├── category-chart/
    │       ├── upcoming-payments/
    │       ├── transaction-list/
    │       └── settlement-summary/
    └── transactions/
        ├── transaction-form-dialog/
        └── transaction-form.mock.ts
```

## UI Library

Angular Material 22 (`@angular/material`, `@angular/cdk`). It is maintained by the Angular team, integrates with the CLI, supports Material 3 theming from seed colors and provides every component the prototype needs (sidenav, dialog, bottom sheet, menu, form fields, select, datepicker, button toggle, chips, snackbar, tooltip). No chart library is installed.

## Dependencies Added

| Package | Purpose |
|---|---|
| `@angular/material` | UI components and Material 3 theme |
| `@angular/cdk` | Layout breakpoints, overlays (dependency of Material) |

## Verification

- `ng build`: succeeds. The initial bundle exceeds the default 500 kB warning budget (Material shell components); the build still completes.
- `ng test`: 1 smoke test passes.
- Viewports reviewed: approximately 1440px, 768px and 390px.

## Known Limitations

- Period selector, context selector and the form are visual only; the dashboard does not react to them.
- Inter and Material Icons Outlined are loaded from Google Fonts; without network access the browser shows fallback fonts and icon names.
- The initial bundle budget warning remains; the budget is to be revisited in v0.1 (see DEBT-001 in PROJECT_STATUS.md).
- No dark theme.

## Completion Criteria

- `npm install` followed by `ng serve` opens the application in the browser.
- Sidebar, header, dashboard cards, charts, lists and the new transaction form can be evaluated on desktop and mobile.
- Visual approval is recorded in `PROJECT_STATUS.md` (approved on 2026-09-05).
