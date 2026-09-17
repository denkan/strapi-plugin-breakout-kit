# `<EditPage>` — the one-liner edit view

```tsx
import { EditPage } from 'strapi-plugin-breakout-kit/strapi-admin';

<EditPage model="api::article.article" documentId="abc123" locale="en" />
```

Renders the full content-manager edit view — header with title + status badge, draft/published
tabs, the complete form (all field types, stock inputs), and the "Entry" actions panel —
driven entirely by props. No route params are read anywhere.

## Props

Everything from `<DocumentProvider>` (identity, controlled-mode overrides, permissions,
callbacks, fallbacks) plus:

| Prop | Type | Notes |
|---|---|---|
| `status` / `defaultStatus` / `onStatusChange` | `'draft' \| 'published'` | Controlled or uncontrolled draft/published tab. |
| `header` | `false \| EditHeaderProps` | `false` hides the header. |
| `sidePanels` | `false \| EditSidePanelsProps` | `false` hides the right column. |
| `form` | `EditFormProps` | `layout` transform, `renderField`, `renderPanel`, `renderBody` (rearrange all panels: accordions/tabs), `dynamicZone`/`repeatable`/`singleComponent` (entry & box customization — see [components.md](components.md)). |

## Examples

```tsx
// Edit-in-place inside your own admin page, no side panels, custom save handling
<EditPage
  model="api::article.article"
  documentId={selectedId}
  sidePanels={false}
  header={{ showStatus: false, title: (t) => `Editing: ${t}` }}
  onDeleted={() => setSelectedId(null)}
/>

// Create mode: omit documentId; get the new id from the callback
<EditPage
  model="api::article.article"
  onCreated={({ documentId }) => setSelectedId(documentId)}
/>

// Replace one input, keep everything else stock
<EditPage
  model="api::article.article"
  documentId={id}
  form={{
    renderField: (field, Default) =>
      field.name === 'price' ? <PriceInput {...field} /> : <Default {...field} />,
  }}
/>
```

## Replacing the stock edit view

Beyond rendering `<EditPage>` on your own pages, you can replace the STOCK
content-manager edit view itself — the CM route stays (list-view links, redirects and
breadcrumbs keep working); only the route's component is swapped. Register a resolver
once, from your admin app's `register()`:

```tsx
// src/admin/app.tsx
import { setEditViewReplacement } from 'strapi-plugin-breakout-kit/strapi-admin';

export default {
  register() {
    setEditViewReplacement((route) =>
      route.model === 'api::article.article' && !route.isClone ? MyArticleEditor : undefined
    );
  },
};

// The component receives the parsed route info as props:
const MyArticleEditor = (route: EditViewRouteInfo) => (
  <EditPage model={route.model} documentId={route.documentId} locale={route.locale} />
);
```

Semantics: the resolver runs per edit route with
`{ collectionType, model, documentId?, isCreate, isClone, origin?, locale?, status? }`;
returning `undefined` keeps the stock view (per route — so per model, per mode, or
per anything). Create routes (`isCreate`) work with `<EditPage>` by omitting
`documentId`; clone routes (`isClone`) are NOT covered by `<EditPage>` — return
`undefined` for them unless you implement cloning yourself. Call the setter once;
compose a single resolver if several views need replacing (a second call warns and
replaces the first). Implementation-wise this swaps the route's component via the
Vite helper — no route overriding, no router hacks.

Worked example: the playground replaces the category edit view
(`apps/playground/src/admin/{app.tsx,pages/CustomCategoryEditView.tsx}`).

## Parity

The form area is pixel-compared against the stock edit view in the contract suite
(tests/contract/parity.spec.ts), and the label structure must match exactly for every
seeded content type. Known v0 deltas are limited to header chrome and plugin-registered
extras — see docs/usage/components.md "Known gaps".
