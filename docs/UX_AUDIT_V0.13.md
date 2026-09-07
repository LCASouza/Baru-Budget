# UX Audit — Baru Budget v0.13

Date: 2026-09-07. This audit is the scope of v0.13: what is not listed here is not done in this version. Every cell is either OK, meaning the screen already satisfies the rule, or an item of work with the reason.

Columns:

- **Mobile**: usable at 360 px with no horizontal scrolling and no table as the only interface (MASTER_PROMPT section 51).
- **States**: answers loading, error and empty.
- **A11y**: everything clickable is reachable by keyboard, labels present, no meaning carried by colour alone.
- **Error**: a failure is shown in words, never as a database code, and never silently.
- **Perf**: loads only what it shows, and never truncates silently.

## Screens

| # | Screen | Mobile | States | A11y | Error | Perf |
|---|---|---|---|---|---|---|
| 1 | Login | OK | OK, form only | OK, password toggle labelled | OK, `role="alert"` | OK |
| 2 | Dashboard | OK | OK | Chart label does not describe the data | OK | Opens seven stores at once |
| 3 | Movimentações | OK | OK | OK | OK | Month truncated at 1000 rows (DEBT-002) |
| 4 | Cartões | OK | OK | OK | OK | OK |
| 5 | Detalhe do cartão | OK | No error branch | OK | Failure shows nothing | OK |
| 6 | Parcelas | OK | OK | OK | OK | OK |
| 7 | Gastos Fixos (abas) | OK | Shell only | OK | OK | OK |
| 8 | Gastos Fixos (lista) | OK | OK | OK | OK | OK |
| 9 | Empréstimos | OK | OK | OK | OK | OK |
| 10 | Detalhe do empréstimo | Table is the only interface | No error branch | Rows clickable by mouse only | Failure shows nothing | OK |
| 11 | Financiamentos | OK | OK | OK | OK | OK |
| 12 | Detalhe do financiamento | Table is the only interface | No error branch | Rows clickable by mouse only | Failure shows nothing | OK |
| 13 | Acertos | OK | OK | OK | OK | OK |
| 14 | Grupos | OK | OK | OK | OK | OK |
| 15 | Compartilhamento | OK | OK | OK | OK | OK |
| 16 | Configurações (abas) | OK | Shell only | OK | OK | OK |
| 17 | Contas | OK | OK | OK | OK | OK |
| 18 | Categorias | OK | OK | OK | OK | OK |
| 19 | Perfil | OK | OK, form only | OK | OK | OK |
| 20 | Dados | Table per sheet at 360 px | Error only for the file | OK | OK | OK |

## Work items

| ID | Item | Screens | Why | Status |
|---|---|---|---|---|
| A-01 | Table becomes a list below 768 px | 10, 12, 20 | Section 51 forbids a table as the only interface on a phone | DELIVERED — `shared/components/data-rows`, table on the desktop and cards on a phone |
| A-02 | One shared contract for loading, error and empty | 5, 10, 12 | Three detail screens show nothing when a load fails | DELIVERED — `shared/components/async-state`, used by the three detail screens |
| A-03 | Keyboard on clickable rows | 10, 12 | An action reachable only by mouse is unusable by keyboard and by screen reader | DELIVERED — `role="button"`, `tabindex` and Enter/Space in `data-rows` |
| A-04 | Visible focus ring across the app | all | Focus is inherited from the theme and disappears on custom surfaces | DELIVERED — `:focus-visible` in `styles.scss` |
| A-05 | Reduced motion respected | all | No `prefers-reduced-motion` rule exists | DELIVERED — `prefers-reduced-motion` in `styles.scss` |
| A-06 | Chart label describes the data | 2 | A chart without text is invisible to a screen reader | DELIVERED — the label lists every month with its two amounts |
| A-07 | Live region on counters that change without navigation | 20 | The import preview updates in place | DELIVERED — `aria-live="polite"` on the preview totals |
| A-08 | Paginated reads close DEBT-002 | 3 | A month above 1000 rows is truncated with no warning, so the totals are wrong in silence | DELIVERED — `shared/supabase/paginate.ts`, used by transactions and by the export |
| A-09 | Commitment cards load on demand | 2 | The home opens about nine queries, most of them for cards it may not show | DELIVERED — the commitment stores load only when a consumer activates them |
| A-10 | Row level security matrix over every table | — | Coverage grew per version and is uneven; a new table without a policy would pass unnoticed | DELIVERED — `supabase/tests/rls_matrix.test.sql`, no gap found |

## Stylesheets without a media query

Twenty-one of forty-three. Reviewed one by one:

- **Correct as they are** (dialogs, small components and shells that inherit their layout): empty-state, period-filter, profile-page, settings-page, member-form-dialog, household-form-dialog, grant-form-dialog, account-form-dialog, category-form-dialog, login-page, header, shell, bottom-nav, more-menu-sheet, sidebar, category-chart, transaction-list, income-expense-chart, pending-payments.
- **Need work**: loan-detail-page and financing-detail-page (A-01), data-page (A-01). All three now delegate their table to `data-rows`, which carries the breakpoint, so none of them needs a media query of its own.

## Manual verification

Still pending. Automated coverage proves the structure: the keyboard contract, the breakpoint switch and the chart label are asserted by test, and no screen keeps a table as its only interface. What a test cannot honestly replace is a person looking and listening.

To be recorded here when performed, with the date and the result:

- [ ] Screen reader on one list screen and one form.
- [ ] Full keyboard navigation across the twenty screens.
- [ ] The twenty screens at 360 px, 768 px and 1280 px.
- [ ] Contrast of `--bb-chart-income` and `--bb-chart-expense` against their backgrounds.
