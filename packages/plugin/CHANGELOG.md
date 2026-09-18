# Changelog

All notable changes to this package will be documented in this file.

## 0.8.0 — 2026-09-18

- Recursive dynamic zones: a component's dynamic zone may include the component itself.
  Cycle-safe schema walks in the admin (useContentTypeSchema shim) and server
  (register-phase populate patches; `recursiveDynamicZones` config, `maxDepth` default 10).
- **Breaking:** the Vite helper is renamed `headlessContentManager()` → `breakoutKit()`,
  matching the package name (update `src/admin/vite.config.ts`); the internal
  original-module suffix changed from `?hcm-original` to `?bk-original`.
- Fix: the Vite helper no longer pins singleton entries (`@strapi/admin/strapi-admin`,
  `react-intl`, …) for APP-SOURCE importers — pinning there bypassed Vite's dep
  optimizer and served the admin shell as raw modules, white-screening the admin with
  `The requested module … does not provide an export named 'useIntl'` in any app whose
  local plugin or admin customization imports `@strapi/admin/strapi-admin` (i.e. every
  real app). Dependency-graph importers keep the pins.

## 0.1.0 — 2026-09-17

First public release (experimental). Tested against Strapi 5.50 – 5.53 (every minor
suite-verified).

Renamed to `strapi-plugin-breakout-kit` (plugin id `breakout-kit`) before first publish;
the plugin no longer ships any admin UI (demos moved to the repo playground) and exports
`accessDiagnostics` for programmatic setup verification.

Initial development against Strapi 5.53.0:

- `<EditPage>` — full prop-driven edit view with parity to the stock content manager
  (structural label parity for all seeded types; visual parity < 0.5% pixel diff)
- `<DocumentProvider>` + hooks (`useDocument`, `useEditLayout`, `useEditForm`,
  `useEditField`, `usePermissions`, `useLocales`, `useDocumentOperations`)
- Components: `<EditForm>`, `<FieldRenderer>`, `<EditHeader>`, `<DocumentActionsBar>`,
  `<EditSidePanels>` — each with override props
- `headlessContentManager()` Vite helper (`./vite` export) for the consumer admin build
- Navigation-free operations with provider callbacks (`onCreated`, `onDeleted`, …)
