# Baru Budget — Project Status

## Current Version

**v0.5 — Dashboard** (IN_PROGRESS). Architectural analysis approved on 2026-09-06 (`ARCHITECTURE_ANALYSIS_V0.5.md`); implementation complete locally, hosted migration and production check pending. Version file: `versions/v0.5.md`. The v0.4 production walkthrough with two users remains deferred (see `versions/v0.4.md`).

Production: https://baru-budget.pages.dev (Cloudflare Pages, automatic deploy from `main`) backed by the hosted Supabase project in São Paulo. Delivered so far: visual prototype, v0.1 Foundation (`versions/v0.1.md`), v0.2 Auth, RLS and Deploy (`versions/v0.2.md`), v0.3 Transactions (`versions/v0.3.md`), v0.4 Households and Sharing (`versions/v0.4.md`).

## Roadmap

| Version | Name | Status | Notes |
|---|---|---|---|
| v0.1 | Foundation | DELIVERED | Angular project, feature-based structure, Supabase setup, migrations, base schema (profiles, categories, accounts), financial types, initial layout, initial tests |
| v0.2 | Auth, RLS and Deploy | DELIVERED | Login, logout, session, protected routes, initial RLS policies, Cloudflare Pages automatic deploy, basic mobile validation |
| v0.3 | Transactions | DELIVERED | INCOME, EXPENSE, TRANSFER; accounts, benefits, categories, CRUD, basic filters, balance, status |
| v0.4 | Households and Sharing | DELIVERED | households, household_members, financial_access_grants, VIEW, MANAGE, non-transitivity, created_by/updated_by, complete policies |
| v0.5 | Dashboard | IN_PROGRESS | Incomes, expenses, balance, benefits, periods, person, household, shared view, charts, summary cards |
| v0.6 | Credit Cards and Invoices | PENDING | Cards, limit, closing day, due day, purchases, invoices, competence rule, double-counting prevention |
| v0.7 | Installments | PENDING | Installment purchases, installment generation, current and future installments, commitment, filters |
| v0.8 | Recurrences | PENDING | Fixed expenses, recurring incomes, competence generation, monthly instance editing, recurring templates |
| v0.9 | Allocations and Settlements | PENDING | transaction_allocations, payer vs. responsible, amounts owed, settlements, receivables, payables |
| v0.10 | Loans | PENDING | Principal, interest, installments, outstanding balance, calculations, math tests |
| v0.11 | Financings | PENDING | Asset value, down payment, financed amount, interest, installments, outstanding balance, double-counting prevention |
| v0.12 | Baru Budget Excel Format v1 | PENDING | Schema version 1, export, import, standardized workbook, stable IDs, preview, validation, merge by UUID, backup |
| v0.13 | Mobile UX and Hardening | PENDING | Full mobile review, responsiveness, empty states, loading, accessibility, errors, performance, permission and RLS review |
| v1.0 | Stable | PENDING | Security review, full RLS review, final test suite, documentation, CI, stable deploy, validated backup and import/export |

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
| v0.5 implementation | v0.5 | IN_PROGRESS | Monthly totals view, dashboard store, real cards, charts and lists by context and period done locally; hosted `db push` and production check pending |

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
| FEAT-014 | Dashboard | v0.5 | IN_PROGRESS | Real summary cards, six-month chart with adaptive scale, expenses by category and by person, pending and recent lists, by context and period; implemented locally |
| FEAT-015 | Credit cards and invoices | v0.6 | PENDING | Closing and due day rules, invoice payment as transfer |
| FEAT-016 | Installments | v0.7 | PENDING | Installment generation and tracking |
| FEAT-017 | Fixed expenses | v0.8 | PENDING | Recurring expense templates with editable monthly instances |
| FEAT-018 | Recurring incomes | v0.8 | PENDING | Recurring income templates |
| FEAT-019 | Transaction allocations | v0.9 | PENDING | Payer vs. responsible, amounts owed |
| FEAT-020 | Settlements | v0.9 | PENDING | Payments between users, receivables and payables |
| FEAT-021 | Loans | v0.10 | PENDING | Explicit interest models, outstanding balance |
| FEAT-022 | Financings | v0.11 | PENDING | Asset value, down payment, financed amount, outstanding balance |
| FEAT-023 | Baru Budget Excel Format v1 | v0.12 | PENDING | Export, import, preview, merge by UUID, backup |

## Bugs

| ID | Description | Found In | Status | Fixed In | Notes |
|---|---|---|---|---|---|
| BUG-001 | Cloudflare Pages build failed: `.node-version` set to `24` resolved to Node 24.13.1, below the Angular CLI minimum of 24.15.0 | v0.2 | FIXED | v0.2 | `.node-version` pinned to 24.18.0; `engines.node` added to package.json |
| BUG-002 | Form field hints and errors overlapped the next field (fixed one-line subscript area) and the account and category dialogs opened too narrow | v0.3 | FIXED | v0.3 | Global `subscriptSizing: 'dynamic'`, shorter hints, 16px form gap, grid rows aligned to the top, explicit dialog widths |

## Technical Debt

| ID | Description | Version | Status | Notes |
|---|---|---|---|---|
| DEBT-001 | Initial bundle exceeded the default 500 kB warning budget | pre-v0.1 | DELIVERED | v0.1: transaction dialog lazy-loaded; budget set to 1 MB warning / 1.5 MB error (~860 kB raw, ~197 kB transferred) |
| DEBT-002 | Transactions are loaded per month with a fixed limit of 1000 rows (PostgREST cap); months above that are truncated | v0.3 | PENDING | Add pagination when a real month approaches the limit |

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

2026-09-06 — v0.5 Dashboard implemented locally (monthly totals view, real dashboard, 374 pgTAP assertions, 157 Vitest tests); hosted migration and production check pending.
