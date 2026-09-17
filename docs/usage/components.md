# Components and hooks

All pieces must live inside a `<DocumentProvider>`; the provider owns data fetching, RBAC,
and form state. Everything below is importable from `strapi-plugin-breakout-kit/strapi-admin`.

## `<DocumentProvider>` (data layer)

```tsx
<DocumentProvider
  model="api::article.article"
  documentId="abc123"          // omit for create mode and single types
  locale="en"                  // i18n locale (optional)
  status="draft"               // 'draft' | 'published' (D&P types only)
  onCreated={({ documentId }) => select(documentId)}  // replaces stock redirects
  onDeleted={() => closePane()}
  fallback={<Loader />}        // rendered during the initial load only
>
  {children}
</DocumentProvider>
```

Controlled mode per prop (`document`, `schema`, `components`, `layout`, `initialValues`):
pass a **value** to skip fetching, or a **transform function** `(fetched) => next` to derive
from the fetched default:

```tsx
<DocumentProvider
  model="api::article.article"
  documentId={id}
  layout={(layout) => ({ ...layout, layout: moveFieldFirst(layout.layout, 'title') })}
/>
```

## Hooks

```tsx
const { document, schema, isLoading, status } = useDocument();
const { layout } = useEditLayout();
const { values, modified, setValue } = useEditForm();
const field = useEditField('title');            // { value, onChange, error }
const { save, publish, delete: del } = useDocumentOperations(); // promises, no navigation
const { canUpdate, canPublish } = usePermissions();
const { isEnabled, locales } = useLocales();
```

## `<EditForm>`

Renders the full resolved layout with the stock content-manager inputs (blocks, relations,
components, dynamic zones, media, UID, custom fields) — visually identical to the stock
edit view.

```tsx
<EditForm
  layout={(layout) => layout.filter(panelHasNoPrivateFields)}
  renderField={(field, Default) =>
    field.name === 'price' ? <PriceInput {...field} /> : <Default {...field} />}
  renderPanel={({ children }, DefaultBox) => <DefaultBox>{children}</DefaultBox>}
/>
```

### Dynamic-zone entry customization (`dynamicZone` prop)

Customize each dynamic-zone entry's chrome without replacing the whole field. Three
tiers, all "override with the default(s) in hand" — return `undefined` anywhere to keep
stock, so lookup-map misses fall through naturally:

```tsx
<EditForm
  dynamicZone={{
    // 1. Sugars: icon (left of label), label, and the action buttons (right of label).
    entryIcon: (entry, defaultIcon) => ICONS[entry.componentUid], // undefined => stock
    entryLabel: (entry, defaultLabel) => `${entry.index + 1}. ${defaultLabel}`,
    entryActions: (entry, d) => (
      // d = { all, delete, drag, moveUp, moveDown, more } — LIVE nodes (the drag
      // handle keeps its wiring wherever you put it), breakpoint-aware (drag is null
      // on mobile, moveUp/moveDown on desktop), all null when the field is disabled.
      <>
        <MyDuplicateButton entry={entry} />
        {d.all /* or compose pieces: {d.delete}{d.drag} drops the "more" menu */}
      </>
    ),
    // 2. Full chrome control. DefaultEntry = the stock accordion with all behavior
    // pre-bound; accepts icon/label/actions overrides. Or skip it and build your own
    // container around entry.renderFields() (reorder/a11y is then yours to provide).
    renderEntry: (entry, DefaultEntry) =>
      entry.componentUid === 'shared.hero' ? (
        <MyCard onRemove={entry.onRemove}>{entry.renderFields()}</MyCard>
      ) : (
        <DefaultEntry />
      ),
  }}
/>
```

Types (`EntryCustomization`, `ComponentEntryMeta`, `EntryActionDefaults`, …) are
zone-agnostic and exported from the package root; repeatable components get the same
treatment via a `repeatable` prop later (issue #10). Worked examples: the playground's
"Dynamic zone" page (`apps/playground/src/admin/pages/DynamicZoneDemo.tsx`) — including
a "no accordion at all" mode where every entry is a styled always-open card.

## `<FieldRenderer>`

One field, stock input for its type, per-field RBAC applied:

```tsx
<FieldRenderer {...fieldLayout} />
```

## `<EditHeader>`

```tsx
<EditHeader
  title={(derived) => `✏️ ${derived}`}
  showStatus
  backHref="/admin/plugins/my-plugin"   // no default navigation in headless mode
>
  <MyToolbarButton />
</EditHeader>
```

## `<DocumentActionsBar>`

Stock-styled Publish/Save/… buttons backed by the headless operations (no navigation;
the provider callbacks fire instead). Enablement mirrors the stock rules (RBAC, dirty
state, active status).

```tsx
<DocumentActionsBar include={['save', 'publish']} />
<DocumentActionsBar exclude={['delete']} />
```

## `<EditSidePanels>`

The right-hand "Entry" panel with the actions bar; add your own panels as children.
Third-party panels from the CM extension API are not rendered yet (Phase 5).

```tsx
<EditSidePanels>
  <MyPanel />
</EditSidePanels>
```

## Known gaps (v0, by design — docs/decisions.md #4)

- Relation edit-modal: relations render and connect/disconnect, but in-place editing of
  the related document is deferred.
- Plugin-registered header actions (i18n locale picker) are not rendered; pass `locale`
  to the provider and build your own picker with `useLocales()`.
- History/preview actions are hidden in headless mode.
