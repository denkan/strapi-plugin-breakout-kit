# Changelog

All notable changes to this package will be documented in this file.

## Unreleased

Initial development against Strapi 5.53.0:

- `<EditPage>` — full prop-driven edit view with parity to the stock content manager
  (structural label parity for all seeded types; visual parity < 0.5% pixel diff)
- `<DocumentProvider>` + hooks (`useDocument`, `useEditLayout`, `useEditForm`,
  `useEditField`, `usePermissions`, `useLocales`, `useDocumentOperations`)
- Components: `<EditForm>`, `<FieldRenderer>`, `<EditHeader>`, `<DocumentActionsBar>`,
  `<EditSidePanels>` — each with override props
- `headlessContentManager()` Vite helper (`./vite` export) for the consumer admin build
- Navigation-free operations with provider callbacks (`onCreated`, `onDeleted`, …)
