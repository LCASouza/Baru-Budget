# Baru Budget

Personal and family finance management web application.

Current state: v0.8 (Recurrences) — fixed expense and recurring income templates that generate the transactions of a chosen month, on top of the v0.7 installments, the v0.6 cards and invoices, the v0.5 dashboard, transactions, households and sharing, deployed at https://baru-budget.pages.dev. See `docs/PROJECT_STATUS.md` for the roadmap.

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

Local login: `supabase/seed.sql` creates the development users `dev@baru.local` and `dev2@baru.local` (password `baru-dev-123`), sample accounts, transactions and a credit card with invoices, installment purchases, recurring templates with the current month generated, a shared household and a VIEW grant from the second user to the first (local stack only; sign-ups are disabled).

Database workflow:

```bash
npm run db:reset   # reapply all migrations and supabase/seed.sql
npm run db:types   # regenerate src/app/core/supabase/database.types.ts
npm run db:stop
```

Hosted project: `npx supabase db push` applies pending migrations before the frontend is deployed.

## Documentation

Project documentation lives exclusively in `docs/*.md`:

- `docs/MASTER_PROMPT.md` — product specification and rules
- `docs/DOCUMENTATION_POLICY.md` — documentation governance
- `docs/PROJECT_STATUS.md` — roadmap, features, bugs and technical debt
- `docs/ARCHITECTURE_ANALYSIS_V0.1.md` to `V0.8.md` — approved architecture per version
- `docs/versions/` — one file per version
