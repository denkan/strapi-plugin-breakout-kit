# strapi-breakout-kit (monorepo)

**[→ Plugin README](./packages/plugin/README.md)** — what it is, installation, usage
([`strapi-plugin-breakout-kit` on npm](https://www.npmjs.com/package/strapi-plugin-breakout-kit)).

**[→ How it works](./docs/how-it-works.md)** — where Strapi's internals come from
(re-exports vs shims vs vendored copies), the drift manifest, and how a new Strapi
release is adapted.

A headless, prop-driven version of the Strapi v5 content manager edit view:

```tsx
<EditPage model="api::article.article" documentId="abc123" locale="en" />
```

## Repository layout

| Path | What |
|---|---|
| [`packages/plugin`](./packages/plugin) | The published plugin (Strapi Plugin SDK) |
| [`apps/playground`](./apps/playground) | Strapi v5 dev/test app — seed content covers every field type |
| [`tests/`](./tests) | Unit (vitest) + contract & parity (Playwright) suites |
| [`drift/`](./drift) | Internal-dependency manifest + drift tooling |
| [`docs/`](./docs) | [How it works](./docs/how-it-works.md), [research](./docs/research), [decisions](./docs/decisions.md), [usage](./docs/usage) |
| [`PLAN.md`](./PLAN.md) | The phase plan this repo is built against |
| [`CLAUDE.md`](./CLAUDE.md) | Agent instructions (architecture rules, hard constraints) |

## Development

```bash
npm install
npm run build            # build the plugin
npm run seed             # seed playground (admin@playground.local / Playground123!)
npm run dev              # plugin watch + playground at http://localhost:1337/admin
npm run test:unit
npm run test:contract    # starts the playground itself if needed
```

Playground demo pages (log in first):
`/admin/plugins/breakout-kit` (access diagnostics) · `…/hooks-demo` ·
`…/components-demo` · `…/edit-page` (full EditPage driven by dropdowns).

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the workflow and the rules around Strapi
internals and the drift manifest.

## License

[MIT](./LICENSE)
