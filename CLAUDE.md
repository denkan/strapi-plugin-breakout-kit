# Agent instructions

This repo builds `strapi-plugin-headless-content-manager`: a headless, prop-driven version of
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
```

Seeded admin login: `admin@playground.local` / `Playground123!` (override via `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`).

The playground's Strapi version is pinned exactly in `apps/playground/package.json`.
