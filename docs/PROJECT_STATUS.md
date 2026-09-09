# Baru Budget — Project Status

## Current Version

**v1.1 — Correção Monetária** was delivered on 2026-09-08. An indexed debt now carries the statements the lender reported, and the schedule is reanchored on them instead of projected from the contract alone. The Baru Budget Excel Format rose to schema version 2, which still reads a version 1 workbook.

**v1.0 — Stable** was delivered on 2026-09-08 and tagged `v1.0.0`. Security review: `SECURITY_REVIEW_V1.0.md`. Architecture: `ARCHITECTURE.md`. Its production checks were deferred by the administrator and are tracked below, outside the version.

Production carries real family data since 2026-09-08: 234 transactions, 3 accounts, 2 credit cards and 3 fixed expenses, loaded from four real card statements through the Excel format. That dataset is what the remaining checks for v0.5, v0.6, v0.7 and v0.8 are exercised against.

Production: https://baru-budget.pages.dev (Cloudflare Pages, automatic deploy from `main`) backed by the hosted Supabase project in São Paulo. Delivered so far: visual prototype and v0.1 to v0.13 (`versions/v0.1.md` to `versions/v0.13.md`).

## Roadmap

| Version | Name | Status | Notes |
|---|---|---|---|
| v0.1 | Foundation | DELIVERED | Angular project, feature-based structure, Supabase setup, migrations, base schema (profiles, categories, accounts), financial types, initial layout, initial tests |
| v0.2 | Auth, RLS and Deploy | DELIVERED | Login, logout, session, protected routes, initial RLS policies, Cloudflare Pages automatic deploy, basic mobile validation |
| v0.3 | Transactions | DELIVERED | INCOME, EXPENSE, TRANSFER; accounts, benefits, categories, CRUD, basic filters, balance, status |
| v0.4 | Households and Sharing | DELIVERED | households, household_members, financial_access_grants, VIEW, MANAGE, non-transitivity, created_by/updated_by, complete policies |
| v0.5 | Dashboard | DELIVERED | Incomes, expenses, balance, benefits, periods, person, household, shared view, charts, summary cards |
| v0.6 | Credit Cards and Invoices | DELIVERED | Cards, limit, closing day, due day, purchases, invoices, competence rule, double-counting prevention |
| v0.7 | Installments | DELIVERED | Installment purchases, installment generation, current and future installments, commitment, filters |
| v0.8 | Recurrences | DELIVERED | Fixed expenses, recurring incomes, competence generation, monthly instance editing, recurring templates |
| v0.9 | Allocations and Settlements | DELIVERED | transaction_allocations, payer vs. responsible, amounts owed, settlements, receivables, payables |
| v0.10 | Loans | DELIVERED | Principal, interest, installments, outstanding balance, calculations, math tests |
| v0.11 | Financings | DELIVERED | Asset value, down payment, financed amount, interest, installments, outstanding balance, double-counting prevention |
| v0.12 | Baru Budget Excel Format v1 | DELIVERED | Schema version 1, export, import, standardized workbook, stable IDs, preview, validation, merge by UUID, backup |
| v0.13 | Mobile UX and Hardening | DELIVERED | Full mobile review, responsiveness, empty states, loading, accessibility, errors, performance, permission and RLS review |
| v1.0 | Stable | DELIVERED | Security review, full RLS review, final test suite, documentation, CI, stable deploy, validated backup and import/export |
| v1.1 | Correção Monetária | DELIVERED | Indexed financings and loans: observed statements instead of projected correction, instalment charges, balance with provenance, Excel schema version 2. Starts only after v1.0 is DELIVERED |

## Current Work

| Item | Version | Status | Notes |
|---|---|---|---|
| Visual prototype | pre-v0.1 | DELIVERED | Approved on 2026-09-05; see `VISUAL_PROTOTYPE.md` |
| Architectural analysis | v0.1 | DELIVERED | `ARCHITECTURE_ANALYSIS_V0.1.md`; approved on 2026-09-05 |
| v0.1 implementation | v0.1 | DELIVERED | Schema, RLS, tests, Supabase client and environments; see `versions/v0.1.md` |
| v0.2 architectural analysis | v0.2 | DELIVERED | `ARCHITECTURE_ANALYSIS_V0.2.md` |
| v0.2 implementation | v0.2 | DELIVERED | Authentication, hosted migrations, Cloudflare Pages deploy; production login confirmed |
| v0.3 architectural analysis | v0.3 | DELIVERED | `ARCHITECTURE_ANALYSIS_V0.3.md`; approved on 2026-09-06 |
| v0.3 implementation | v0.3 | DELIVERED | Migrations, screens and tests; hosted `db push` applied and production validated on 2026-09-06 |
| v0.4 architectural analysis | v0.4 | DELIVERED | `ARCHITECTURE_ANALYSIS_V0.4.md`; approved on 2026-09-06 |
| v0.4 implementation | v0.4 | DELIVERED | Households, grants, authorization functions, complete policies, real context selector, Grupos and Compartilhamento pages; hosted `db push` applied on 2026-09-06; production walkthrough with two users deferred |
| v0.5 architectural analysis | v0.5 | DELIVERED | `ARCHITECTURE_ANALYSIS_V0.5.md`; approved on 2026-09-06 |
| v0.5 implementation | v0.5 | DELIVERED | Monthly totals view, dashboard store, real cards, charts and lists by context and period; hosted `db push` applied on 2026-09-06; production check deferred |
| v0.6 architectural analysis | v0.6 | DELIVERED | `ARCHITECTURE_ANALYSIS_V0.6.md`; approved on 2026-09-06 |
| v0.6 implementation | v0.6 | DELIVERED | Credit cards, invoice competence rule, card purchases, invoice payments, cards pages; hosted `db push` applied on 2026-09-06; production check deferred |
| v0.7 architectural analysis | v0.7 | DELIVERED | `ARCHITECTURE_ANALYSIS_V0.7.md`; approved on 2026-09-07 |
| v0.7 implementation | v0.7 | DELIVERED | Installment generation in the database, installments page, commitment, filters; hosted `db push` applied on 2026-09-07; production check deferred |
| v0.8 architectural analysis | v0.8 | DELIVERED | `ARCHITECTURE_ANALYSIS_V0.8.md`; approved on 2026-09-07 |
| v0.8 implementation | v0.8 | DELIVERED | Templates, idempotent generation and recurrences page; hosted `db push` applied on 2026-09-07; production check deferred |
| v0.9 architectural analysis | v0.9 | DELIVERED | `ARCHITECTURE_ANALYSIS_V0.9.md`; approved on 2026-09-07 |
| v0.9 implementation | v0.9 | DELIVERED | Allocations with a backend invariant, settlements and balances; hosted `db push` applied on 2026-09-07; production check deferred |
| v0.10 architectural analysis | v0.10 | DELIVERED | `ARCHITECTURE_ANALYSIS_V0.10.md`; approved on 2026-09-07 |
| v0.10 implementation | v0.10 | DELIVERED | Loans with explicit interest models, schedule generation and derived balances; hosted `db push` applied on 2026-09-07; production check deferred |
| v0.11 architectural analysis | v0.11 | DELIVERED | `ARCHITECTURE_ANALYSIS_V0.11.md`; approved on 2026-09-07 |
| v0.11 implementation | v0.11 | DELIVERED | Financings with Price and SAC, the asset value kept out of the ledger; hosted `db push` applied on 2026-09-07; production check deferred |
| v0.12 architectural analysis | v0.12 | DELIVERED | `ARCHITECTURE_ANALYSIS_V0.12.md`; approved on 2026-09-07 |
| v0.12 implementation | v0.12 | DELIVERED | Declarative workbook contract, export, preview, merge by UUID, backup; no migration; production check deferred |
| v0.13 architectural analysis | v0.13 | DELIVERED | `ARCHITECTURE_ANALYSIS_V0.13.md`; approved on 2026-09-07 |
| v0.13 implementation | v0.13 | DELIVERED | UX audit, mobile lists, shared state contract, keyboard access, pagination, RLS matrix; manual verification deferred |
| v1.0 architectural analysis | v1.0 | DELIVERED | `ARCHITECTURE_ANALYSIS_V1.0.md`; approved on 2026-09-07 |
| v1.0 implementation | v1.0 | DELIVERED | CI, security review, view isolation, documentation, BUG-005 and BUG-006; tagged `v1.0.0` on 2026-09-08 |
| v1.1 architectural analysis | v1.1 | DELIVERED | `ARCHITECTURE_ANALYSIS_V1.1.md`; blocking decisions resolved on 2026-09-08 |
| v1.1 implementation | v1.1 | DELIVERED | Observed statements for financings and loans, instalment charges, schedule by parts, balance with provenance, Excel schema version 2 with its converter |

## Features

| ID | Feature | Version | Status | Notes |
|---|---|---|---|---|
| FEAT-001 | Angular project foundation | v0.1 | DELIVERED | Delivered by the approved visual prototype (Angular 22, standalone, strict, feature-based) |
| FEAT-002 | Supabase project and migrations | v0.1 | DELIVERED | Local project via CLI, six migrations, pgTAP tests, generated types |
| FEAT-003 | Profiles | v0.1 | DELIVERED | Table, RLS, creation trigger on auth.users |
| FEAT-004 | Categories | v0.1 | DELIVERED | Table, RLS, default categories seeded per user; management screen delivered in v0.3 (`/settings/categories`) |
| FEAT-005 | Accounts | v0.1 | DELIVERED | Table with opening_balance, RLS; management screen with derived balances delivered in v0.3 (`/settings/accounts`) |
| FEAT-006 | Financial types | v0.1 | DELIVERED | PostgreSQL enums and TypeScript unions with pt-BR labels |
| FEAT-007 | Application shell | v0.1 | DELIVERED | Delivered by the approved visual prototype (sidebar, rail, bottom navigation, theme, mock dashboard) |
| FEAT-008 | Authentication | v0.2 | DELIVERED | Email and password login, logout, persistent session, protected routes, real profile in header |
| FEAT-009 | Row Level Security | v0.2 | DELIVERED | v0.1 policies applied to the hosted project and verified through the API |
| FEAT-010 | Cloudflare Pages deploy | v0.2 | DELIVERED | Automatic deploy of `main` to https://baru-budget.pages.dev with security headers and SPA fallback |
| FEAT-011 | Transactions | v0.3 | DELIVERED | INCOME, EXPENSE, TRANSFER; CRUD, month filters, derived balances, derived OVERDUE, kind-aware status labels |
| FEAT-012 | Households | v0.4 | DELIVERED | households, household_members, ADMIN/MEMBER roles, household-tagged transactions, household context |
| FEAT-013 | Financial access grants | v0.4 | DELIVERED | VIEW and MANAGE permissions, non-transitive, owner-only management, shared context |
| FEAT-014 | Dashboard | v0.5 | DELIVERED | Real summary cards, six-month chart with adaptive scale, expenses by category and by person, pending and recent lists, by context and period |
| FEAT-015 | Credit cards and invoices | v0.6 | DELIVERED | Cards with limit, closing and due days; invoice competence rule stored per purchase; invoices derived with status; payment as transfer |
| FEAT-016 | Installments | v0.7 | DELIVERED | Generation in the database, one instalment per invoice or month, progress, commitment and filters |
| FEAT-017 | Fixed expenses | v0.8 | DELIVERED | Templates on account or card, idempotent monthly generation, editable instances |
| FEAT-018 | Recurring incomes | v0.8 | DELIVERED | Templates in their own table, generated as pending on the receipt day |
| FEAT-019 | Transaction allocations | v0.9 | DELIVERED | Payer vs. responsible, sum invariant in the database, counterparty visibility |
| FEAT-020 | Settlements | v0.9 | DELIVERED | Settlement as a transaction kind with direction, derived balances, receivables and payables |
| FEAT-021 | Loans | v0.10 | DELIVERED | Simple interest and Price with documented conversions, idempotent schedule, derived outstanding balance, disbursement out of income |
| FEAT-022 | Financings | v0.11 | DELIVERED | Price and SAC with documented conversions, generated financed amount, idempotent schedule, derived outstanding balance, asset value never recorded |
| FEAT-026 | Monetary correction | v1.1 | DELIVERED | Observed statements for loans and financings, instalment charges, schedule reanchored on each statement, balance with provenance, Excel schema version 2 |
| FEAT-025 | Stable release | v1.0 | DELIVERED | CI, security review, view isolation and function surface tests, architecture documentation, validated backup and import/export against production |
| FEAT-024 | Mobile UX and Hardening | v0.13 | DELIVERED | Screen audit, mobile lists, shared loading/error/empty contract, keyboard access, focus and reduced motion, pagination, RLS matrix |
| FEAT-023 | Baru Budget Excel Format | v0.12 | DELIVERED | Schema version 1 in v0.12, raised to version 2 in v1.1; paginated export, mandatory preview, merge by UUID, absence never deletes, backup |

## Bugs

| ID | Description | Found In | Status | Fixed In | Notes |
|---|---|---|---|---|---|
| BUG-001 | Cloudflare Pages build failed: `.node-version` set to `24` resolved to Node 24.13.1, below the Angular CLI minimum of 24.15.0 | v0.2 | FIXED | v0.2 | `.node-version` pinned to 24.18.0; `engines.node` added to package.json |
| BUG-002 | Form field hints and errors overlapped the next field (fixed one-line subscript area) and the account and category dialogs opened too narrow | v0.3 | FIXED | v0.3 | Global `subscriptSizing: 'dynamic'`, shorter hints, 16px form gap, grid rows aligned to the top, explicit dialog widths |
| BUG-003 | Six trigger functions kept the default execute grant; a direct call already failed, so nothing was exposed | v1.0 | FIXED | v1.0 | Found by the security review; `20260907230100_function_grants.sql` revokes them and `security_surface.test.sql` guards it |
| BUG-004 | Creating a household failed from the application with a row level security error: the client reads the new row back in the same call, and the trigger that makes the creator a member runs after that read | v0.4 | FIXED | v1.0 | Found by end-to-end testing against production; creation goes through `create_household`, guarded by `households.test.sql` and `household.repository.spec.ts` |
| BUG-005 | A card purchase is accepted with a date later than its own invoice due date, which the competence rule makes impossible | v0.6 | FIXED | v1.0 | Found by the v0.12 production check, when an import carried 37 instalments dated past their invoice and nothing refused them; `20260908150100_card_purchase_before_invoice.sql` adds the constraint, guarded by `card_transactions.test.sql` |
| BUG-006 | Editing a loan or a financing left the instalments already generated on the old amounts and dates: generating only inserts what is missing, so the screen showed an outstanding balance from the new record next to a total to pay from the old transactions | v0.10 | FIXED | v1.0 | Found by the v0.10 production check; `realign_loan_schedule` and `realign_financing_schedule` update pending instalments only, the views report the drift and the pages offer the action |
| BUG-008 | Insurance and the operational fee had columns and a workbook column but no field in either debt form, so a charge could only be set through Excel | v1.1 | FIXED | v1.1 | Found in production while registering the Caixa financing |
| BUG-007 | The interest rate field refused more than two decimals and rounded an existing rate to two on edit, while `interest_rate` is `numeric(9, 6)`; a real 6,6971% contract could not be registered | v0.10 | FIXED | v1.1 | Found in production while registering the Caixa financing; `shared/finance/rate.ts` parses and formats a rate with six decimals, instead of reusing the money helpers |

## Deferred Production Checks

Manual checks against the hosted project, carried by the administrator. They were deferred from their own versions, then deferred again when v1.0 closed on 2026-09-08, so they follow the project instead of blocking a version. The pass that did run found BUG-004, BUG-005 and BUG-006.

| Version | Check | Status |
|---|---|---|
| v0.4 | Two users, a household and a grant: VIEW reads and cannot write, MANAGE writes | PENDING |
| v0.5 | Dashboard cards and charts matching the transactions of the period | PENDING |
| v0.6 | A purchase landing on the right invoice, and paying it debiting the account without becoming an expense | PENDING |
| v0.7 | An instalment purchase generating the rows, on a card and on an account | PENDING |
| v0.8 | Generating a month twice and confirming nothing is duplicated | PENDING |
| v0.9 | Splitting an expense, seeing the balance between people and settling it | PENDING |
| v0.10 | Instalment against a calculator, schedule generated, money in without inflating income | IN_PROGRESS |
| v0.11 | First and last instalment against a calculator, acquisition recording the down payment | PENDING |
| v0.12 | Export, edit, re-import, and re-import untouched expecting no change | DELIVERED |
| v0.13 | Screen reader, keyboard, twenty screens at three widths, chart colour contrast | PENDING |

Also open: protecting `main` with the continuous integration check, a GitHub setting deferred on 2026-09-08 because requiring it blocks direct pushes to `main`.

## Technical Debt

| ID | Description | Version | Status | Notes |
|---|---|---|---|---|
| DEBT-001 | Initial bundle exceeded the default 500 kB warning budget | pre-v0.1 | DELIVERED | v0.1: transaction dialog lazy-loaded; budget set to 1 MB warning / 1.5 MB error (~860 kB raw, ~197 kB transferred) |
| DEBT-002 | Transactions are loaded per month with a fixed limit of 1000 rows (PostgREST cap); months above that are truncated | v0.3 | DELIVERED | Closed in v0.13 by `shared/supabase/paginate.ts`, shared with the export |

## Excluded Items

Items not implemented without an explicit requirement (MASTER_PROMPT.md, section 65).

| Item | Status | Notes |
|---|---|---|
| Open Banking and automatic bank integration | EXCLUDED | Includes bank scraping |
| Pix API, boleto issuing and real payments | EXCLUDED | Payments are recorded, never executed |
| Investments, stock market and cryptocurrencies | EXCLUDED | — |
| OCR and artificial intelligence features | EXCLUDED | — |
| Native Android and iOS apps | EXCLUDED | Responsive web only |
| Push notifications | EXCLUDED | — |
| Multi-currency | EXCLUDED | BRL only |
| Fiscal issuing and corporate accounting | EXCLUDED | — |
| Social login and external OAuth | EXCLUDED | Email and password only |

## Last Update

2026-09-08 — v1.1 Correção Monetária delivered: `debt_statements`, instalment charges, the schedule as a function by parts mirrored between SQL and TypeScript, the outstanding balance with its provenance, and Excel schema version 2 with a converter proved against the real version 1 backup. Earlier the same day, v1.0 Stable was delivered and tagged `v1.0.0`. The v0.12 production check closed against the hosted project with real family data, and production now carries 234 transactions loaded from four real card statements. The pass found BUG-005 and BUG-006, both fixed and deployed. The remaining production checks were deferred by the administrator and moved out of the version, into their own section above. v1.1 Correção Monetária started, with its architectural analysis approved.
