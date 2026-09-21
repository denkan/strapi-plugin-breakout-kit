# Adoption playbook (for AI agents and junior developers)

This document is written to be followed **mechanically**. Every step has exact code and
a verification gate. Do not improvise, do not "simplify", do not skip verification.
If a verification fails, consult the Troubleshooting table at the bottom — do not
invent fixes.

**What this plugin is:** `strapi-plugin-breakout-kit` provides the Strapi v5 content-
manager edit view as prop-driven components (`<EditPage model documentId locale />`),
plus override seams for customizing the stock edit view. **The one rule everywhere:**
every override receives the stock default(s) as an argument, and returning `undefined`
keeps stock behavior. Never rebuild something stock already does — pass `undefined`
(or don't set the option) and it stays stock.

**Authoritative references** (read these, in order, when a signature is unclear):
1. The TypeScript types in `node_modules/strapi-plugin-breakout-kit/dist/admin/src/index.d.ts` — the exact contract.
2. `docs/usage/` in the plugin repo: `components.md`, `edit-page.md`, `examples.md`.
3. Working reference implementations: the plugin repo's playground pages
   `apps/playground/src/admin/pages/{DynamicZoneDemo,RepeatableDemo,SingleComponentDemo,LayoutDemo,CustomCategoryEditView}.tsx`
   — copy their patterns, not their content.

---

## Phase 0 — Preconditions (verify before touching anything)

1. Run: `npm ls @strapi/strapi` (or check package.json). The version MUST be
   **>= 5.50.0 and < 5.55.0**. If it is outside this window: STOP and report — do not
   upgrade/downgrade Strapi yourself.
2. Confirm the project uses npm or yarn or pnpm consistently (look for the lockfile).
   Use the same package manager in all commands below.

## Phase 1 — Install and wire (do exactly this)

1. Install, pinned by the project's Strapi minor (e.g. on Strapi 5.54.x):

   ```bash
   npm install strapi-plugin-breakout-kit@strapi-5.54
   ```

   (`strapi-5.x` dist-tags = newest plugin release supporting that Strapi minor.)

2. Enable the plugin — add to `config/plugins.ts` (create the file if missing,
   merge if it exists — do not delete other plugins' entries):

   ```ts
   export default {
     'breakout-kit': { enabled: true },
   };
   ```

3. Add the Vite helper — `src/admin/vite.config.ts` (REQUIRED; without it the admin
   build cannot resolve the plugin's imports). If the file exists, merge the plugin
   into the existing config:

   ```ts
   import { mergeConfig, type UserConfig } from 'vite';
   import { breakoutKit } from 'strapi-plugin-breakout-kit/vite';

   export default (config: UserConfig) =>
     mergeConfig(config, { plugins: [breakoutKit()] });
   ```

4. **Verification gate:** run `npm run develop`, log into the admin, open any entry in
   the stock Content Manager. It must look and behave exactly as before (the plugin
   changes nothing until configured). If the admin is blank or crashes → Troubleshooting.

## Phase 2 — Hard rules (enforce in every change)

- **NEVER** import from `@strapi/content-manager/...` (entry or deep paths) in this
  project's admin code. Import ONLY from `strapi-plugin-breakout-kit/strapi-admin`
  and `@strapi/strapi/admin`.
- **NEVER** edit files inside `node_modules`. If something seems impossible without
  that, STOP and report the limitation.
- After changing admin code, if changes don't appear in the browser:
  `rm -rf node_modules/.strapi src/admin/.strapi .strapi` (whichever exist), restart
  `npm run develop`, hard-refresh.
- Keep every override's `undefined` fallback path. A lookup-map miss returning
  `undefined` is the designed behavior, not a bug.
- Do not wrap overrides in try/catch that swallows errors; let errors surface.

## Phase 3 — Task recipes

Each recipe: where the code goes, a skeleton to adapt, and a verification gate.
`<EditPage form={{ … }}>` and `<EditForm …>` accept the same customization props.

### 3.1 Custom icons on dynamic-zone entries (left of the accordion label)

```tsx
import type { EntryCustomization } from 'strapi-plugin-breakout-kit/strapi-admin';

const ICONS: Record<string, React.ReactNode> = {
  'shared.hero': <MyHeroIcon />,
  // components NOT listed here keep their stock icon automatically
};

const dynamicZone: EntryCustomization = {
  entryIcon: (entry) => ICONS[entry.componentUid], // undefined = stock icon
};
// usage: <EditPage … form={{ dynamicZone }} /> or <EditForm dynamicZone={dynamicZone} />
```

**Verify:** listed components show the new icon; unlisted components show the stock icon.

### 3.2 Customize dynamic-zone entry action buttons (right of the label)

`entryActions(entry, d)` receives the stock buttons as LIVE nodes:
`d = { all, delete, drag, moveUp, moveDown, more }` (`all` = everything in stock order;
`drag` is null on mobile, `moveUp/moveDown` null on desktop; on a disabled field all
are null). Reordering/wrapping them keeps their behavior (drag stays draggable).

```tsx
const dynamicZone: EntryCustomization = {
  entryActions: (entry, d) => (
    <>
      <MyExtraButton entry={entry} />
      {d.all}
    </>
  ), // or compose pieces: <>{d.delete}{d.drag}</> drops the "more" menu
};
```

**Verify:** custom button appears before the stock ones; delete/drag still work.

### 3.3 Replace the "Add a component" button/flow

```tsx
const dynamicZone: EntryCustomization = {
  renderAddButton: (ctx) => <MyAddFlow ctx={ctx} />,
};
// ctx = { componentsByCategory, add(uid, position?), isOpen, toggle,
//         total, min, max, disabled, name, source }
// A custom UI renders its own button + popup and calls ctx.add(uid) —
// the stock inline picker then simply never opens.
// WARNING: ctx.add does NOT enforce max — check ctx.total/ctx.max yourself.
```

**Verify:** custom button replaces the stock one; picking a component inserts an entry.

### 3.4 Repeatable components / single components

Same shapes on sibling props: `form={{ repeatable }}` (same `EntryCustomization`;
note stock repeatables have NO icon — `entryIcon`'s default is null and you can ADD
one) and `form={{ singleComponent: { renderBox } }}` for `"type": "component",
"repeatable": false` fields:

```tsx
const singleComponent = {
  renderBox: (box, DefaultBox) =>
    box.value
      ? <MyCard onClear={box.onClear}>{box.renderFields()}</MyCard> // set state
      : <MyInitCta onClick={box.onInitialize} />,                   // null state
};
```

### 3.5 Group everything outside dynamic zones into a "General" accordion (or tabs)

`renderBody(panels)` receives every rendered panel ("panel" = one white box of the
edit view; each dynamic zone always forms its own): `panels: Array<{ index, fields,
isDynamicZone, node }>` where `node` is the fully-rendered panel.

```tsx
const renderBody = (panels) => (
  <>
    <MyAccordion title="General">
      {panels.filter((p) => !p.isDynamicZone).map((p) => p.node)}
    </MyAccordion>
    {panels.filter((p) => p.isDynamicZone).map((p) => p.node)}
  </>
);
// usage: form={{ renderBody }}   — tabs: compose p.node per tab instead
```

**Verify:** non-DZ fields render inside the accordion and still edit/save; DZ blocks
render below it.

### 3.6 Replace the stock edit view for a content type

Registered ONCE, in `src/admin/app.tsx`'s `register()` — NOT in config/plugins.ts:

```tsx
import { setEditViewReplacement } from 'strapi-plugin-breakout-kit/strapi-admin';

export default {
  register() {
    setEditViewReplacement((route) =>
      route.model === 'api::article.article' && !route.isClone
        ? MyArticleEditor          // receives route info as props
        : undefined                // every other model/mode stays stock
    );
  },
};

const MyArticleEditor = (route) => (
  <EditPage model={route.model} documentId={route.documentId} locale={route.locale}
            form={{ /* any recipes above */ }} />
);
```

Rules: call the setter once (compose one resolver for multiple models); ALWAYS exclude
clones (`!route.isClone`) unless cloning is explicitly implemented; create mode works
(`documentId` is undefined — `<EditPage>` handles it).

**Verify:** clicking an entry of that model in the list view shows the custom page on
the normal CM URL; other models show the stock view; the create button also shows the
custom page.

### 3.7 Stock Strapi hooks inside custom pages

Inside `<EditPage>`/`<DocumentProvider>` children, stock hooks work — including
`unstable_useContentManagerContext` from `@strapi/strapi/admin` (requires plugin
>= 0.6.1). Prefer the plugin's own hooks (`useDocument`, `useEditField`,
`useDocumentOperations`, …) for new code.

## Phase 4 — Order of work

Implement ONE recipe at a time. After each: run its verification gate, then confirm the
stock view of an UNRELATED content type is unchanged. Commit per recipe. Do not batch.

## Troubleshooting (match symptom EXACTLY; apply fix; do not improvise)

| Symptom | Cause | Fix |
|---|---|---|
| Admin build fails resolving `@strapi/content-manager/dist/...` | Vite helper missing | Phase 1 step 3 |
| Blank admin or crash on load; console shows ONE of: `Cannot set properties of undefined (setting 'comment')`, react-intl `does not provide an export named 'useIntl'`, prism `Cannot convert undefined or null to object` (e.g. in `prism-tsx.js`), `useRBAC must be used within Auth` — and/or raw `/node_modules/...` module URLs in the Network tab | Project admin app-source (incl. local plugins) imports `@strapi/content-manager/...` or `@strapi/admin/dist/...` directly — the graph escapes the Vite prebundle and module singletons split (plugin >= 0.8.3 prints a `[breakout-kit]` warning naming the offending file) | `grep -rn "content-manager/dist\|admin/dist" src/`; remove those imports; use `strapi-plugin-breakout-kit/strapi-admin` |
| `useRBAC must be used within Auth` (or similar context error) | Duplicate `@strapi/admin` copies in node_modules | Delete node_modules + lockfile drift for @strapi/*, reinstall so all @strapi/* versions match `@strapi/strapi`'s |
| `Could not find collectionType in url params` | Plugin < 0.6.1, or a CM hook used OUTSIDE a `<DocumentProvider>`/`<EditPage>` on a custom page | Upgrade plugin; ensure the hook call is inside the provider |
| Code changes don't show up in the admin | Stale Vite prebundle cache | Phase 2 cache-clear step |
| npm warns about `@strapi/*` peer ranges at install | Project's Strapi outside the plugin's tested window | STOP and report; do not force |
| Custom override renders but stock behavior (drag/save) broke inside it | Stock nodes/`renderFields()` were re-implemented instead of reused | Use the provided defaults (`d.*`, `entry.renderFields()`, `DefaultEntry`) |
| Typing loses focus after one character; accordions collapse while editing; relation/media fields refetch in a loop | Plugin < 0.8.2: seam `Default*` components got a new identity per render, so any re-render (e.g. a component reading `useEditForm().values`) remounted the subtree | Upgrade plugin to >= 0.8.2 |
| Whole page re-renders on every keystroke (slow typing, no remounts) | A component above the form reads `useEditForm().values` | Use `getValues()` (event-time, stable) or `useEditField(name)` instead; only read `values` where a live per-keystroke update is wanted |
| Server log: `[breakout-kit] failed to install recursive dynamic zone populate guards — … Cannot find module '@strapi/core/package.json'` (or `'@strapi/content-manager/strapi-server'`), then `RangeError: Maximum call stack size exceeded` on save/publish of recursive schemas | Plugin < 0.8.3 resolved Strapi internals from the app root — works under npm's flat hoisting, fails under pnpm's strict layout | Upgrade plugin to >= 0.8.3 |
