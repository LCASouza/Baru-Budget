# Baru Budget

Personal and family finance management web application.

Current state: visual prototype (pre-v0.1) with mock data. See `docs/PROJECT_STATUS.md` for the roadmap and `docs/VISUAL_PROTOTYPE.md` for the prototype scope.

## Stack

- Angular 22 (standalone components, zoneless, strict TypeScript)
- Angular Material 22 (Material 3 theme)
- Supabase (planned from v0.1; not integrated in the prototype)
- Cloudflare Pages (planned from v0.2)

## Requirements

- Node.js 24
- npm 11

## Commands

```bash
npm install
npm start        # ng serve → http://localhost:4200
npm run build    # production build in dist/baru-budget
npm test         # unit tests (Vitest)
```

## Documentation

Project documentation lives exclusively in `docs/*.md`:

- `docs/MASTER_PROMPT.md` — product specification and rules
- `docs/DOCUMENTATION_POLICY.md` — documentation governance
- `docs/PROJECT_STATUS.md` — roadmap, features, bugs and technical debt
- `docs/versions/` — one file per delivered version
