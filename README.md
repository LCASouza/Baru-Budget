# Baru Budget

Personal and family finance management web application.

Current state: v1.0 (Stable), deployed at https://baru-budget.pages.dev.

Transactions, accounts and categories; households and sharing with VIEW and MANAGE; a dashboard; credit cards with derived invoices; instalments; fixed expenses and recurring incomes; expense splitting and settlements between people; loans and financings with explicit interest models; and the Baru Budget Excel Format for backup, editing and re-import.

Read `docs/ARCHITECTURE.md` for how it works and `docs/PROJECT_STATUS.md` for the roadmap.

## Stack

- Angular 22 (standalone components, zoneless, strict TypeScript)
- Angular Material 22 (Material 3 theme)
- Supabase (PostgreSQL 17, Auth, Row Level Security) via `@supabase/supabase-js`
- Cloudflare Pages (automatic deploy from `main`)

## Requirements

- Node.js 24.15 or newer (`.node-version` pins 24.18.0) and npm 11
- Docker (for the local Supabase stack)

## Commands

```bash
npm install
npm run db:start   # local Supabase (API http://127.0.0.1:54321, Studio http://127.0.0.1:54323)
npm start          # ng serve → http://localhost:4200
npm test           # unit tests (Vitest)
npm run test:db    # database tests (pgTAP)
npm run lint       # ESLint
npm run build      # production build in dist/baru-budget
```

Local login: `supabase/seed.sql` creates the development users `dev@baru.local` and `dev2@baru.local` (password `baru-dev-123`), sample accounts, transactions and a credit card with invoices, installment purchases, recurring templates with the current month generated, a split expense with a partial settlement, a Price loan with its schedule, a shared household and a VIEW grant from the second user to the first (local stack only; sign-ups are disabled).

Database workflow:

```bash
npm run db:reset   # reapply all migrations and supabase/seed.sql
npm run db:types   # regenerate src/app/core/supabase/database.types.ts
npm run db:stop
```

Hosted project: `npx supabase db push` applies pending migrations before the frontend is deployed.

## Continuous integration

`.github/workflows/ci.yml` runs lint, build, unit tests and database tests on every push and pull request to `main`. It does not publish: Cloudflare Pages builds from `main` on its own, and the workflow is the signal that the branch is sound.

## Security

The Angular interface is not a security authority. Every read and write goes through PostgREST with the user's session, and row level security decides each row. The keys in `src/environments/` are publishable keys, public by design; no private key or service role key is versioned. See `docs/SECURITY_REVIEW_V1.0.md`.

## Documentation

Project documentation lives exclusively in `docs/*.md`:

- `docs/MASTER_PROMPT.md` — product specification and rules
- `docs/DOCUMENTATION_POLICY.md` — documentation governance
- `docs/PROJECT_STATUS.md` — roadmap, features, bugs and technical debt
- `docs/ARCHITECTURE.md` — how the system works
- `docs/ARCHITECTURE_ANALYSIS_V0.1.md` to `V1.0.md` — the approved architecture of each version, kept as the history of the decisions
- `docs/SECURITY_REVIEW_V1.0.md` — the v1.0 security review
- `docs/UX_AUDIT_V0.13.md` — the screen audit that scoped v0.13
- `docs/versions/` — one file per version
