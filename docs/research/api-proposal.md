# Phase 1 output: API proposal

Concrete provider props, hook signatures and component props, updated from PLAN.md §3 based on
[findings.md](./findings.md). Everything here is designed so that the **uncontrolled path is a
thin composition of Strapi's own public hooks** (`unstable_useDocument`, `unstable_useDocumentLayout`,
`unstable_useDocumentActions`, `DocumentRBAC`) plus the aliased internal input tree — we re-derive
as little as possible.

Naming: public package exports use no prefix. Types are exported alongside.

---

## 1. Core types

```ts
type CollectionType = 'collection-types' | 'single-types';
type DocumentStatus = 'draft' | 'published';

/** Identity of the document being edited. Mirrors CM's internal DocumentMeta. */
interface DocumentMeta {
  model: string;                 // e.g. "api::article.article"
  collectionType: CollectionType; // derived from schema when omitted at the provider
  documentId?: string;           // absent => create mode (or single type)
  params?: {                     // API params, replaces query-string plumbing
    locale?: string;
    status?: DocumentStatus;
    [key: string]: unknown;
  };
}

/** Every derived value can be overridden by a replacement or a transform. */
type Override<T> = T | ((defaultValue: T) => T);
```

---

## 2. Layer 2 — Data

### `<DocumentProvider>`

```tsx
interface DocumentProviderProps {
  /* identity (uncontrolled inputs) */
  model: string;
  documentId?: string;            // omit for create mode and single types
  locale?: string;
  status?: DocumentStatus;        // default 'draft'
  params?: DocumentMeta['params']; // escape hatch, merged over {locale, status}

  /* controlled-mode overrides (per PLAN principle 2/3) */
  document?: Override<Document>;         // skip fetching if a value is given
  schema?: Override<Schema>;
  components?: Override<ComponentsDictionary>;
  layout?: Override<EditLayout>;         // applied after CM's layout resolution + hook waterfall
  initialValues?: Override<FormValues>;  // else getInitialFormValues() from useDocument

  /* permissions */
  permissions?: Permission[];     // else fetched via shell useRBAC for
                                  // plugin::content-manager.explorer.* × model

  /* navigation side effects as callbacks — never hardcoded redirects */
  onCreated?: (doc: { documentId: string }) => void;   // stock: navigate to edit URL
  onCloned?: (doc: { documentId: string }) => void;
  onDeleted?: () => void;                              // stock: navigate to list
  onPublished?: (doc: { documentId: string }) => void;
  onError?: (error: unknown) => void;

  children: React.ReactNode;
}
```

Responsibilities (uncontrolled mode):
1. Build `DocumentMeta` from props and publish it through **`HeadlessDocumentContext`** — the
   context our `useDocumentContext` shim reads *first* (before relation-modal, before URL).
   This single mechanism is what un-couples the whole stock input tree.
2. Call `unstable_useDocument(meta)` / `unstable_useDocumentLayout(model)`; apply `Override`s.
3. Mount `DocumentRBAC` with `model` + resolved permissions.
4. Mount the shell `<Form>` with `initialValues`, `validate` (invisible-attribute stripping +
   `createYupSchema`), keyed by `model:documentId:locale` so provider remounts reset cleanly.
5. Expose the action callbacks to `useDocumentOperations` (below).

Multiple providers can coexist: all state lives in this context + the shared RTK cache (keyed by
args), none in module singletons. (Contract test in Phase 3.)

### Hooks

```ts
/** Document + schema + loading state. Thin wrapper over unstable_useDocument fed by context. */
function useDocument(overrides?: { meta?: Partial<DocumentMeta> }): {
  document: Document | undefined;
  meta: DocumentMeta;
  schema: Schema | undefined;
  components: ComponentsDictionary;
  isLoading: boolean;
  hasError: boolean;
  refetch: () => void;
  validate: (values: FormValues) => FormErrors | null;
  getTitle: (mainField: string) => string;
};

/** Resolved edit layout after configuration + MUTATE_EDIT_VIEW_LAYOUT waterfall + overrides. */
function useEditLayout(override?: Override<EditLayout>): {
  layout: EditLayout; components: Record<string, ComponentEditLayout>; isLoading: boolean;
};

/** Form state — re-exported selectors over the shell Form context (useForm/useField). */
function useEditForm(): {
  values: FormValues; errors: FormErrors; modified: boolean; isSubmitting: boolean;
  setValue: (path: string, value: unknown) => void;
  onSubmit: (handler: SubmitHandler) => void;   // wraps Form submit
  resetForm: () => void;
};
const useEditField: typeof useField; // direct re-export, path-based

/** CRUD, promise-returning, no navigation. Wraps unstable_useDocumentActions;
 *  fires the provider's callbacks; `clone` reimplemented without navigate. */
function useDocumentOperations(): {
  save: (opts?) => Promise<Result>;      // create-or-update depending on meta
  publish: (opts?) => Promise<Result>;
  unpublish: (opts?: { discardDraft?: boolean }) => Promise<Result>;
  discard: () => Promise<Result>;
  delete: () => Promise<Result>;
  clone: () => Promise<Result>;
  isLoading: boolean;
};

function usePermissions(): DocumentRBACContextValue; // re-export of useDocumentRBAC
function useLocales(): {                              // i18n plugin present ⇒ real data, else stub
  locales: Locale[]; currentLocale?: string; setLocale: (code: string) => void; isEnabled: boolean;
};
```

Renamed from PLAN §3: `useDocumentActions` → **`useDocumentOperations`** (avoids clashing with
Strapi's `unstable_useDocumentActions` and with the "document action descriptions" concept used by
the extension API). `useSchema` folds into `useDocument` (Strapi returns them together).

---

## 3. Layer 3 — Components

All components read from the data layer and accept overrides. `renderX` props follow the pattern
`(props, Default) => ReactNode`.

```tsx
<EditForm
  layout={Override<EditLayout>}                 // additional per-instance transform
  renderField={(field: EditFieldLayout, Default) => ReactNode}
  renderPanel={(panel: PanelLayout, Default) => ReactNode}   // visual panel groups of the layout
  disabled={boolean}
/>
// Renders CM's FormLayout → InputRenderer (aliased) — stock inputs, custom fields, media,
// per-field RBAC all work unmodified. renderField wraps the memoized InputRenderer.

<FieldRenderer field={EditFieldLayout} document={Document?} />  // one field, escape hatch; thin
// wrapper over CM InputRenderer (which already accepts a `document` override prop).

<EditHeader
  title={Override<string>}            // default: getTitle(mainField) / "Create an entry"
  showStatus showLocaleSelect showBackLink={false}
  backHref={string?}                  // no default navigation in headless mode
  renderAction={(action, Default) => ReactNode}
/>
// Reuses HeaderActions/HeaderActionDialog/Information/DocumentStatus; renders header-action
// descriptions registered by plugins (i18n locale picker) via DescriptionComponentRenderer,
// feeding them props from our context instead of the URL.

<DocumentActionsBar
  include={ActionType[]} exclude={ActionType[]}     // 'save' | 'publish' | 'unpublish' | 'discard' | 'delete' | 'clone' | plugin types
  renderAction={(description, Default) => ReactNode}
  withPluginActions={boolean}         // default true: include actions registered via CM extension APIs
/>
// Uses stock DocumentActions/Button/Menu renderers with OUR action descriptions
// (reimplemented Publish/Save/Delete backed by useDocumentOperations + provider callbacks;
// keyboard shortcuts preserved; no navigate calls).

<EditSidePanels include exclude renderPanel={(panel, Default) => ReactNode} />
// Renders panel descriptions from getEditViewSidePanels() (extension API) through the stock
// Panel card — third-party panels keep working; route-coupled ones (preview) filtered by default.

<UnsavedChangesBlocker fallback={'beforeunload' | 'none'} />
// Shell Blocker when a data router is present (always true inside Strapi admin); beforeunload fallback otherwise.
```

---

## 4. Layer 4 — Composition

```tsx
<EditPage
  model documentId locale status          // = DocumentProviderProps identity subset
  onCreated onDeleted onPublished ...     // callbacks forwarded to the provider
  header={false | EditHeaderProps}
  sidePanels={false | EditSidePanelsProps}
  form={EditFormProps}
/>
// = DocumentProvider + EditHeader + draft/published Tabs + EditForm + EditSidePanels +
//   UnsavedChangesBlocker, arranged in the stock grid (Layouts). Parity target of Phase 5.
```

`status` tab switching is internal state in `EditPage` (controlled via `status`/`onStatusChange`
props), not a query param.

---

## 5. Usage levels (unchanged from the vision)

```tsx
// 1. Full page
<EditPage model="api::article.article" documentId="abc123" locale="en"
          onDeleted={() => setSelected(null)} />

// 2. Composed
<DocumentProvider model="api::article.article" documentId="abc123"
                  onCreated={({documentId}) => select(documentId)}>
  <MyToolbar />
  <EditHeader showBackLink={false} />
  <EditForm renderField={(f, Default) =>
    f.name === 'price' ? <PriceInput {...f} /> : <Default {...f} />} />
  <DocumentActionsBar include={['save', 'publish']} />
</DocumentProvider>

// 3. Hooks only
const { document, isLoading } = useDocument();
const { layout } = useEditLayout();
const { save, publish } = useDocumentOperations();
```

---

## 6. What each piece maps to (access strategy per item)

| Our API | Built on | Strategy |
|---|---|---|
| `DocumentProvider` | `unstable_useDocument`, `unstable_useDocumentLayout`, `DocumentRBAC`, shell `Form`, our `HeadlessDocumentContext` | public + original code |
| `useDocumentContext` shim | replaces `CM:hooks/useDocumentContext.mjs` | alias-replace (drift-tracked) |
| `EditForm`/`FieldRenderer` | `CM:…/FormLayout.mjs`, `CM:…/InputRenderer.mjs`, `FormInputs/**` | deep-import alias (drift-tracked) |
| `useDocumentOperations` | `unstable_useDocumentActions` (minus `clone`) + provider callbacks | public + original code |
| `DocumentActionsBar` | stock `DocumentActions` renderers + our action descriptions | alias + reimplementation |
| `EditHeader` | `HeaderActions`/`Information`/`DocumentStatus` + `DescriptionComponentRenderer` | alias + public |
| `EditSidePanels` | `getEditViewSidePanels()` extension API + stock `Panel` | public ext. API + alias |
| `UnsavedChangesBlocker` | shell `Blocker` / beforeunload fallback | public + original code |
| `useLocales` | `@strapi/i18n` `useGetLocalesQuery` via shared `adminApi` | public pattern |
| validation/defaults | `createYupSchema`, `createDefaultForm`, `transformDocument` | deep-import alias (pure fns) |

## 7. Decisions this proposal assumes (→ maintainer, from findings §11)

1. One-line consumer Vite config helper is acceptable (else: vendoring variant of rows 2–3, 5–6 above).
2. `useDocumentContext` shim is aliased globally but behavior-identical on stock routes.
3. Reimplemented actions skip guided-tour/telemetry wiring.
4. Relation edit-modal deferred (read-only relation links in v0); history/preview actions filtered out in headless mode.
