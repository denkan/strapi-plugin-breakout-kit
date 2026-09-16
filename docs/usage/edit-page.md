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
| `form` | `EditFormProps` | `layout` transform, `renderField`, `renderPanel`. |

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

## Parity

The form area is pixel-compared against the stock edit view in the contract suite
(tests/contract/parity.spec.ts), and the label structure must match exactly for every
seeded content type. Known v0 deltas are limited to header chrome and plugin-registered
extras — see docs/usage/components.md "Known gaps".
