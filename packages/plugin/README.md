# strapi-plugin-breakout-kit

> ⚠️ **Experimental.** This plugin reuses Strapi's internal content-manager code and is
> tested against specific Strapi versions — see [Compatibility](#compatibility) and
> [Stability](#stability).

A **headless, prop-driven version of the Strapi v5 content manager edit view**. Render the
full edit page — or compose your own from the same hooks and components — anywhere in the
admin panel, driven by props instead of route params.

```tsx
import { EditPage } from 'strapi-plugin-breakout-kit/strapi-admin';

<EditPage model="api::article.article" documentId="abc123" locale="en" />
```

## Why

Strapi's edit view is excellent, but it is welded to its routes: the model UID, document id
and locale come from URL params, and saving/deleting navigates away. If you're building your
own admin pages — dashboards, review queues, side-by-side editors, custom workflows — you
can't reuse it. This plugin unlocks the same components and behavior as props:

- **Props, not routes.** Identity comes from `model` / `documentId` / `locale` / `status`.
- **Callbacks, not redirects.** `onCreated`, `onDeleted`, `onPublished`, … fire instead of
  navigation.
- **Parity by default.** The form is the *stock* edit form — same inputs for every field
  type (blocks, relations, components, dynamic zones, media, UID, custom fields), same RBAC,
  pixel-level visual parity (asserted by the test suite at &lt;0.5% pixel difference).
- **Override without forking.** Every derived value takes a replacement or a transform
  function; every component has render seams.
- **Recursive dynamic zones.** A component's dynamic zone may include the component
  itself — stock Strapi crashes on such schemas; with the plugin installed they render,
  save, publish and version like any other content
  ([docs](../../docs/usage/recursive-dynamic-zones.md)).

## Installation

```bash
npm install strapi-plugin-breakout-kit
```

**1. Enable the plugin** — `config/plugins.ts`:

```ts
export default {
  'breakout-kit': { enabled: true },
};
```

**2. Add the Vite helper (required)** — `src/admin/vite.config.ts`:

```ts
import { mergeConfig, type UserConfig } from 'vite';
import { breakoutKit } from 'strapi-plugin-breakout-kit/vite';

export default (config: UserConfig) =>
  mergeConfig(config, { plugins: [breakoutKit()] });
```

The helper resolves the plugin's imports into Strapi's per-module content-manager build and
installs a behavior-identical shim for one internal hook. Without it, the admin build fails
to resolve the plugin's imports. The stock content manager is unaffected (contract-tested).

## Quick start

Render the edit page from your own admin customization (`src/admin/app.tsx`) or from your
own plugin's pages:

```tsx
// src/admin/app.tsx
import type { StrapiApp } from '@strapi/strapi/admin';

export default {
  register(app: StrapiApp) {
    app.addMenuLink({
      to: 'plugins/my-editor',
      icon: () => null,
      intlLabel: { id: 'my-editor', defaultMessage: 'My editor' },
      Component: async () => {
        const { EditPage } = await import(
          'strapi-plugin-breakout-kit/strapi-admin'
        );
        const MyEditorPage = () => (
          <EditPage model="api::article.article" documentId="abc123" />
        );
        return { default: MyEditorPage };
      },
    });
  },
};
```

(Omit `documentId` to render the create form. In your own plugin, render `<EditPage>`
from any admin page component the same way.)

## Three levels of usage

**1. The full page:**

```tsx
<EditPage
  model="api::article.article"
  documentId={selectedId}
  onDeleted={() => setSelectedId(null)}
/>
```

**2. Compose your own page from the same pieces:**

```tsx
<DocumentProvider model="api::article.article" documentId={id}
                  onCreated={({ documentId }) => select(documentId)}>
  <MyCustomToolbar />
  <EditHeader />
  <EditForm
    renderField={(field, Default) =>
      field.name === 'price' ? <PriceInput {...field} /> : <Default {...field} />}
  />
  <DocumentActionsBar include={['save', 'publish']} />
</DocumentProvider>
```

**3. Just the hooks:**

```tsx
const { document, isLoading } = useDocument();
const { layout } = useEditLayout();
const field = useEditField('title');
const { save, publish } = useDocumentOperations();
```

Full reference: [docs/usage](https://github.com/denkan/strapi-plugin-breakout-kit/tree/main/docs/usage).

## Customize dynamic zones

The `dynamicZone` prop (on `<EditForm>`, or `<EditPage form={{ dynamicZone }}>`) opens up
each entry's chrome and the add flow. Every seam receives the stock default(s) and treats
`undefined` as "keep stock":

```tsx
<EditForm
  dynamicZone={{
    // Icon left of the label; label itself.
    entryIcon: (entry, defaultIcon) => ICONS[entry.componentUid],
    entryLabel: (entry, defaultLabel) => `${entry.index + 1}. ${defaultLabel}`,

    // Action buttons right of the label — MULTIPLE named defaults, all live nodes
    // (the drag handle keeps its wiring wherever you put it):
    entryActions: (entry, d) => <>{myButton}{d.all}</>,          // add one, keep stock
    // …or compose pieces: <>{d.delete}{d.drag}</> drops the "more" menu.

    // Full chrome control per entry — or no accordion at all:
    renderEntry: (entry, DefaultEntry) =>
      entry.componentUid === 'shared.hero'
        ? <MyCard onRemove={entry.onRemove}>{entry.renderFields()}</MyCard>
        : <DefaultEntry icon={<Star />} />,

    // Replace the "Add a component" button/flow — ctx has componentsByCategory
    // and add(uid, position?), so a fully custom picker needs nothing else:
    renderAddButton: (ctx) => <MyAddFlow ctx={ctx} />,
  }}
/>
```

Repeatable components get the same treatment via a `repeatable` prop — same
`EntryCustomization` shape, `entry.source` discriminates, and it also applies to
repeatables nested inside dynamic-zone entries. Single (non-repeatable) components use
a `singleComponent` prop with one state-aware `renderBox(box, Default)` seam covering
both the null-state "click to add" box and the boxed fields (`box.value` discriminates,
`box.onInitialize`/`box.onClear`/`box.renderFields()` do the wiring).

And the form body itself can be rearranged with `renderBody` — it receives every
rendered panel (the white boxes; dynamic zones always form their own) at once, so
"group everything outside dynamic zones into a General accordion" or "one tab per
panel" are plain compositions of `panel.node`.

Details and semantics: [docs/usage/components.md](https://github.com/denkan/strapi-plugin-breakout-kit/blob/main/docs/usage/components.md).
Live, switchable examples of every mode: the playground's "Dynamic zone" and
"Repeatable" pages (`apps/playground/src/admin/pages/{DynamicZoneDemo,RepeatableDemo}.tsx`).

## Replace the stock edit view

The CM route stays — its component is swapped, so list-view links and redirects keep
working:

```tsx
// src/admin/app.tsx
import { setEditViewReplacement } from 'strapi-plugin-breakout-kit/strapi-admin';

setEditViewReplacement((route) =>
  route.model === 'api::article.article' && !route.isClone ? MyArticleEditor : undefined
); // undefined = stock view; the component receives { model, documentId, locale, … } as props
```

See [docs/usage/edit-page.md](https://github.com/denkan/strapi-plugin-breakout-kit/blob/main/docs/usage/edit-page.md) for semantics (create/clone modes, per-model targeting).

## Compatibility

| Plugin version | Tested against Strapi |
|---|---|
| 0.x | 5.50 – 5.55 (every minor suite-verified) |

Every Strapi minor in the tested window also gets a dist-tag pointing at the **newest
release that supports it**, so you can install by your Strapi version:
`npm install strapi-plugin-breakout-kit@strapi-5.55`. When the window's floor moves past
a minor, that minor's tag stays frozen at the last release that supported it.

The supported window is declared by the package's peerDependencies and verified by a
version-matrix test run (full contract + parity suite against every minor in the window).
Below the floor, npm warns at install time — upgrade Strapi first
(`npx @strapi/upgrade latest` within v5 is routine). The window's roof moves forward
automatically with Strapi releases via the adaptation pipeline.

Each release declares a tight `peerDependencies` range for the Strapi packages it was
tested against. An automated pipeline tracks new Strapi releases, re-runs the full contract
and parity suites, and adapts the plugin when internals move (see the repository's
`drift/` directory).

## Stability

This plugin depends on Strapi internals — including hooks Strapi itself marks `unstable_`
and modules resolved past the packages' export maps. Every such dependency is pinned and
hash-tracked in a drift manifest, and guarded by contract tests against a real admin, but a
Strapi upgrade outside the tested range can break it. Pin your Strapi version to the tested
range, or wait for the matching plugin release.

Current known gaps (deliberate, v0): in-place editing of relations in a modal, plugin-
registered header actions (e.g. the i18n locale picker — pass `locale` as a prop instead),
third-party side panels, history/preview actions.

## Roadmap

The plugin will likely expand to more of Strapi's admin over time (list view, create page,
edit-in-modal). The architecture is surface-agnostic; new surfaces arrive as new providers
and `<XxxPage>` presets beside the existing ones.

## License

[MIT](./LICENSE)
