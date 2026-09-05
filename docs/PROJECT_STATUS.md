# Baru Budget — Project Status

## Current Version

No version has been started. The next version is **v0.1 — Foundation**.

## Roadmap

| Version | Name | Status | Notes |
|---|---|---|---|
| v0.1 | Foundation | PENDING | Angular project, feature-based structure, Supabase setup, migrations, base schema (profiles, categories, accounts), financial types, initial layout, initial tests |
| v0.2 | Auth, RLS and Deploy | PENDING | Login, logout, session, protected routes, initial RLS policies, Cloudflare Pages automatic deploy, basic mobile validation |
| v0.3 | Transactions | PENDING | INCOME, EXPENSE, TRANSFER; accounts, benefits, categories, CRUD, basic filters, balance, status |
| v0.4 | Households and Sharing | PENDING | households, household_members, financial_access_grants, VIEW, MANAGE, non-transitivity, created_by/updated_by, complete policies |
| v0.5 | Dashboard | PENDING | Incomes, expenses, balance, benefits, periods, person, household, shared view, charts, summary cards |
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
| Architectural analysis | v0.1 | PENDING | Required before any implementation (MASTER_PROMPT.md, section 67) |

## Features

| ID | Feature | Version | Status | Notes |
|---|---|---|---|---|
| FEAT-001 | Angular project foundation | v0.1 | PENDING | Standalone components, strict TypeScript, feature-based structure |
| FEAT-002 | Supabase project and migrations | v0.1 | PENDING | PostgreSQL, migration strategy, base schema |
| FEAT-003 | Profiles | v0.1 | PENDING | Table linked to Supabase Auth users |
| FEAT-004 | Categories | v0.1 | PENDING | Income and expense categories, customizable |
| FEAT-005 | Accounts | v0.1 | PENDING | Types BANK, CASH, BENEFIT, OTHER |
| FEAT-006 | Financial types | v0.1 | PENDING | INCOME, EXPENSE, TRANSFER, SETTLEMENT |
| FEAT-007 | Application shell | v0.1 | PENDING | Sidebar on desktop, adaptive navigation on mobile, theme, temporary home page |
| FEAT-008 | Authentication | v0.2 | PENDING | Email and password, login, logout, session, protected routes |
| FEAT-009 | Row Level Security | v0.2 | PENDING | Initial policies on every financial table |
| FEAT-010 | Cloudflare Pages deploy | v0.2 | PENDING | Automatic deploy from the main branch |
| FEAT-011 | Transactions | v0.3 | PENDING | INCOME, EXPENSE, TRANSFER; CRUD, filters, balance, status |
| FEAT-012 | Households | v0.4 | PENDING | households, household_members |
| FEAT-013 | Financial access grants | v0.4 | PENDING | VIEW and MANAGE permissions, non-transitive |
| FEAT-014 | Dashboard | v0.5 | PENDING | Summary cards, charts, context switching |
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
| — | No bugs registered | — | — | — | — |

## Technical Debt

| ID | Description | Version | Status | Notes |
|---|---|---|---|---|
| — | No technical debt registered | — | — | — |

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

2026-09-05 — Initial document. No version started.
