# Agent instructions

This repo builds `strapi-plugin-breakout-kit`: a headless, prop-driven version of
the Strapi v5 content manager edit view. **Read PLAN.md first** — it defines the phases,
architecture and checkpoints. Work phase by phase; do not skip checkpoints.

## Design principles (review criteria for every file)

1. **Props, not routes.** Nothing below the composition layer reads from the router.
2. **Controlled or uncontrolled, always.** Use consumer-passed data if given, otherwise fetch it.
3. **Override without forking.** Every derived value has an override prop (value or transform fn).
4. **Dependencies point downward.** Composition → Components → Data → Access. Never the reverse.
5. **Prefer supported APIs.** Reach into internals only inside `packages/plugin/admin/src/access/`.
6. **Parity by default.** No overrides → indistinguishable from the stock edit view.
7. **Every internal dependency is recorded** in `drift/manifest.json`. Not in the manifest → not a dependency.

## Hard rules

- Adapt the access layer first; touch higher layers only if strictly necessary.
- **Never copy code from any `ee/` directory** in the Strapi repo (different license).
- Never weaken, skip or delete contract or parity tests to make them pass.
- **`main` is protected incl. admins — direct pushes are rejected.** Every change goes
  branch → PR → required green `test` check → merge. Releases: see docs/RELEASING.md
  (merge = staged on npm; maintainer approves with 2FA; dist-tag is manual).

## Layout

- `packages/plugin` — the plugin (Plugin SDK). Admin source layers: `access/`, `data/`, `components/`, `composition/`.
- `apps/playground` — Strapi 5 app (SQLite) with seed content types covering every field type.
- `drift/` — internal-dependency manifest + drift check scripts.
- `tests/` — unit and contract (Playwright) tests.

## Commands

```bash
npm install                 # root; npm workspaces
npm run build               # build the plugin
npm run dev                 # plugin watch + playground develop (admin at http://localhost:1337/admin)
npm run seed                # seed admin user + sample content (idempotent)
npm run test:unit           # vitest (tests/unit)
npm run test:contract       # playwright against the playground admin (starts it if needed)
npm run drift:hashes        # recompute drift/manifest.json hashes from scratch/strapi checkout
npm run matrix -- 5.51.0    # full suite against one Strapi version (uniform tree); --window = all minors floor..roof (DESTRUCTIVE to node_modules while running; restores after)
```

## Access-layer specifics (Phase 2)

- Deep imports into `@strapi/content-manager/dist/...` only resolve through the Vite helper
  (`packages/plugin/vite/index.cjs`), which consumers add to `src/admin/vite.config.ts`
  (see docs/usage/installation.md). The playground already has it.
- The helper alias-replaces CM's `hooks/useDocumentContext.mjs` with
  `packages/plugin/vite/runtime/useDocumentContext.mjs`. That shim MUST stay
  behavior-identical to the original on stock CM routes (guarded by
  tests/contract/stock-cm-unaffected.spec.ts) — check drift/manifest.json entry
  `cm-use-document-context` when Strapi changes it.
- The helper file must stay CommonJS (see the comment in it) and dev-mode module identity
  depends on `optimizeDeps.include` pinning the plugin entry — don't "simplify" either.
- After editing plugin admin code: `npm run build` then restart the playground; in dev the
  plugin is inside the Vite dep prebundle, so a stale cache means
  `rm -rf apps/playground/node_modules/.strapi` if changes don't show up.
- TWO modules are alias-replaced by the helper: `hooks/useDocumentContext.mjs` AND
  `hooks/useDocument.mjs` (wrapper extends `useDoc` with the headless-context fallback —
  needed because route-coupled internals like the relation modal's RootRelationRenderer
  call `useDoc` directly). Shims import originals via the `?hcm-original` suffix.
- NEVER import '@strapi/content-manager/...' (entry or deep paths) from PLAYGROUND
  admin source (apps/playground/src/admin) — in dev, app-source imports pull the CM
  graph out of the Vite dep prebundle and split module singletons (symptom: blank
  admin, "Cannot set properties of undefined (setting 'comment')" from a duplicated
  prismjs). Demo/diagnostic pages import ONLY 'strapi-plugin-breakout-kit/strapi-admin'
  (prebundled); internals-probes go through the plugin's `accessDiagnostics` export.
- Contract tests authenticate ONCE via tests/contract/auth.setup.ts (storageState):
  Strapi rate-limits admin logins (5/5min) — never log in per-test, and after several
  manual browser logins expect 429s for a few minutes.

## Automated adaptation (Phase 8)

When adapting to a new Strapi version (the strapi-adapt workflow runs you with a drift
report and failing test output):

1. Read `drift-report.md` first — it lists exactly which tracked internals changed, with
   diffs, and which of our files consume them (`usedBy`).
2. **Adapt the access layer first** (`packages/plugin/admin/src/access/` and the
   `packages/plugin/vite/runtime/` shims). Touch data/components/composition layers only
   if strictly necessary.
3. The two runtime shims (`useDocumentContext.mjs`, `useDocument.mjs`) must remain
   behavior-identical to the new upstream originals on stock routes — read the upstream
   diff and mirror any changed semantics (fallback order, skip logic, error strings).
4. **Never copy code from any `ee/` directory.** Never weaken, skip or delete contract or
   parity tests to make them pass — fix the code.
5. Every internal dependency must stay reflected in `drift/manifest.json`; when green, run
   `node drift/scripts/update-manifest.mjs --version <target>`.
6. Iterate with `npm run test:unit` and `npm run test:contract` until green. Clear
   `apps/playground/node_modules/.strapi` between plugin rebuilds.
7. Changes must hold across the SUPPORT WINDOW (drift/manifest.json strapiFloor..strapiVersion),
   not just the target: run `npm run matrix -- --window` (or let CI's version-matrix run on
   the adaptation branch). If the floor cannot stay green, raise strapiFloor explicitly and
   say so in the PR — never silently.

Seeded admin login: `admin@playground.local` / `Playground123!` (override via `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`).

The playground's Strapi version is pinned exactly in `apps/playground/package.json`.
