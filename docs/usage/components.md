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

STOCK Strapi hooks also work inside a `<DocumentProvider>` on custom pages — including
route-coupled ones: `unstable_useContentManagerContext` (from `@strapi/strapi/admin`)
and the internal `useDoc` fall back to the surrounding provider when no CM route params
are present (on stock CM routes the URL always wins). Context-based hooks
(`useForm`/`useField`, `useDocumentRBAC`, …) and explicit-args hooks
(`unstable_useDocument`, `unstable_useDocumentLayout`) need no special handling.

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

### Rearrange the form body (`renderBody`)

"Panels" are Strapi's term for the white boxes the edit view stacks vertically
(`layout.map(panel => panel.map(row => row.map(field => …)))`); every dynamic zone
forms its own full-width panel. `renderPanel` wraps one panel at a time — `renderBody`
receives **every rendered panel at once**, so cross-panel layouts are plain composition
of `panel.node` (`undefined` keeps the stock stack):

```tsx
<EditForm
  renderBody={(panels, DefaultBody) => (
    <>
      {/* everything NOT in a dynamic zone into one "General" accordion */}
      <MyAccordion title="General">
        {panels.filter((p) => !p.isDynamicZone).map((p) => p.node)}
      </MyAccordion>
      {panels.filter((p) => p.isDynamicZone).map((p) => p.node)}
    </>
  )}
/>
// …or tabs: <MyTabs tabs={panels.map(p => ({ label: labelFor(p), content: p.node }))} />
```

`PanelInfo` = `{ index, fields (rows of the panel), isDynamicZone, node }` — `node` has
`renderPanel`/`renderField` already applied. Combine with the `layout` transform to
regroup fields into different panels first. Worked examples: the playground's "Layout"
page (`apps/playground/src/admin/pages/LayoutDemo.tsx`).

### Entry customization (`dynamicZone` / `repeatable` props)

Customize each dynamic-zone or repeatable-component entry's chrome without replacing the
whole field. Both props take the same `EntryCustomization` shape (`entry.source`
discriminates); `repeatable` applies to every repeatable, including ones nested inside
dynamic-zone entries — target specific fields via `entry.name`. All tiers are "override
with the default(s) in hand" — return `undefined` anywhere to keep stock, so lookup-map
misses fall through naturally:

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
    // 2. Replace the "Add a component" affordance. ctx carries componentsByCategory,
    // add(uid, position?), the stock isOpen/toggle, and total/min/max/disabled —
    // enough for a fully custom picker (the stock inline picker stays closed).
    renderAddButton: (ctx, DefaultAddButton) => <MyAddFlow ctx={ctx} />,
    // 3. Full chrome control. DefaultEntry = the stock accordion with all behavior
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
zone-agnostic and exported from the package root.

Repeatable-specific quirks (all mirroring stock): entries have **no stock icon**
(`defaultIcon` is null — `entryIcon` can add one); the default label is the raw
mainField value (often empty — `entryLabel` fixes that); `defaults.more` is always null
(no category menu); disabled fields render the action buttons disabled rather than
hiding them; and there's no picker — `ctx.toggle` performs the stock add (max-enforced),
`ctx.add` appends/inserts raw and ignores the uid argument, and `DefaultAddButton` is
the "Add an entry" footer button (or the empty-state initializer when there are no
entries yet).

**Single (non-repeatable) components** get a third prop, `singleComponent`, with ONE
state-aware seam replacing the whole box — the null-state "click to add" box and the
boxed fields alike. Branch on `box.value`; `undefined` keeps stock for that state:

```tsx
<EditForm
  singleComponent={{
    renderBox: (box, DefaultBox) =>
      box.value ? (
        <MyCard onClear={box.onClear}>{box.renderFields()}</MyCard>
      ) : (
        <MyInitCta onClick={box.onInitialize} />
      ),
  }}
/>
```

`box` = `{ source: 'singleComponent', componentUid, name, schema, disabled, value,
onInitialize, onClear, renderFields }`; `renderFields()` carries its own component
context so nested inputs work inside custom chrome. The field label row (and its stock
"Reset Entry" trash) stays either way.

Worked examples: the playground's "Dynamic zone", "Repeatable" and "Component" pages
(`apps/playground/src/admin/pages/{DynamicZoneDemo,RepeatableDemo,SingleComponentDemo}.tsx`)
— including "no accordion at all" modes where every entry is a styled always-open card.

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
