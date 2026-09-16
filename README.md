# strapi-plugin-headless-content-manager

> ⚠️ Work in progress — not yet published. Package name is a placeholder pending confirmation.

A headless, prop-driven version of the Strapi v5 content manager edit view. Render the full
edit page — or compose your own from the same hooks and components — anywhere in the admin,
driven by props instead of route params.

```tsx
<EditPage model="api::article.article" documentId="abc123" locale="en" />
```

See [PLAN.md](./PLAN.md) for the project plan and architecture.

## Repository layout

- `packages/plugin` — the published plugin (Strapi Plugin SDK)
- `apps/playground` — Strapi v5 app used for development and tests
- `tests/` — unit and contract (Playwright) tests
- `drift/` — internal-dependency manifest and drift-check scripts
- `docs/` — research findings and usage docs

## Development

```bash
npm install
npm run dev          # plugin watch + playground develop
```

## Stability notice

This plugin depends on Strapi internals. Each release is tested against a specific range of
Strapi v5 versions; see the compatibility table (coming with the first release).
