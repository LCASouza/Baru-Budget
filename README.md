# Baru Budget

Personal and family finance management web application.

Current state: v0.1 (Foundation) — local Supabase schema with RLS, Supabase client and environments on top of the approved visual prototype. The interface still shows mock data until authentication (v0.2) and transactions (v0.3) are implemented. See `docs/PROJECT_STATUS.md` for the roadmap.

## Stack

- Angular 22 (standalone components, zoneless, strict TypeScript)
- Angular Material 22 (Material 3 theme)
- Supabase (PostgreSQL 17, Auth, Row Level Security) via `@supabase/supabase-js`
- Cloudflare Pages (planned from v0.2)

## Requirements

- Node.js 24 and npm 11
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

Database workflow:

```bash
npm run db:reset   # reapply all migrations and supabase/seed.sql
npm run db:types   # regenerate src/app/core/supabase/database.types.ts
npm run db:stop
```

## Documentation

Project documentation lives exclusively in `docs/*.md`:

- `docs/MASTER_PROMPT.md` — product specification and rules
- `docs/DOCUMENTATION_POLICY.md` — documentation governance
- `docs/PROJECT_STATUS.md` — roadmap, features, bugs and technical debt
- `docs/ARCHITECTURE_ANALYSIS_V0.1.md` — approved architecture for v0.1
- `docs/versions/` — one file per version
