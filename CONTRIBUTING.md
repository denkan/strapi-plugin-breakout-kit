# Contributing

Thanks for your interest! This repo is a monorepo:

- `packages/plugin` — the published plugin
- `apps/playground` — a Strapi v5 app with seed content covering every field type
- `tests/` — unit (vitest) and contract/parity (Playwright) suites
- `drift/` — the internal-dependency manifest and drift tooling
- `docs/` — research, decisions and usage docs

**Read `PLAN.md` and `CLAUDE.md` first** — they define the architecture, the layer rules
and the hard constraints (e.g. never depend on anything not recorded in
`drift/manifest.json`, never weaken contract or parity tests).

## Setup

```bash
npm install
npm run build          # build the plugin
npm run seed           # seed the playground (admin user + sample content)
npm run dev            # plugin watch + playground at http://localhost:1337/admin
```

Seeded admin login: `admin@playground.local` / `Playground123!`.

## Tests

```bash
npm run test:unit      # vitest
npm run test:contract  # Playwright against the playground admin (starts it if needed)
```

Notes:
- Contract tests authenticate once (`tests/contract/auth.setup.ts`); Strapi rate-limits
  admin logins to 5 per 5 minutes.
- After changing plugin admin code: `npm run build`, restart the playground, and clear
  `apps/playground/node_modules/.strapi` if the change doesn't show (dev prebundle cache).

## Changing anything that touches Strapi internals

1. Only the access layer (`packages/plugin/admin/src/access/`) and the Vite runtime shims
   (`packages/plugin/vite/runtime/`) may reference Strapi internals.
2. Add/update the entry in `drift/manifest.json` (`npm run drift:hashes` recomputes hashes
   from a `scratch/strapi` checkout at the pinned tag).
3. The `useDocumentContext`/`useDocument` shims must stay behavior-identical to the
   originals on stock routes — `tests/contract/stock-cm-unaffected.spec.ts` and the parity
   suite guard this.

## Commits / PRs

- Keep commits scoped to one concern; explain *why* in the body.
- PRs must be green on the full suite. Never weaken or delete contract or parity tests to
  make them pass — fix the code or discuss the expectation change explicitly.
