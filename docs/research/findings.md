# Phase 1 research: the Strapi v5 content manager edit view

**Strapi version:** 5.53.0 (npm) · **repo tag:** `v5.53.0` · **commit:** `99800b107996c39a68786473792f94103352de2d`
**Inspected:** the *installed* packages under `node_modules/@strapi/{strapi,admin,content-manager,i18n,upload}` (what we actually depend on at runtime), cross-referenced with the cloned source in `scratch/strapi`. Shipped dist and source match 1:1 (formatting-only diffs).

Path conventions in this document:

- `CM:<p>` = `@strapi/content-manager/dist/admin/<p>` (source mirror: `packages/core/content-manager/admin/src/<p>`, `.mjs` ↔ `.ts/.tsx`)
- `ADMIN:<p>` = `@strapi/admin/dist/admin/admin/src/<p>` (source: `packages/core/admin/admin/src/<p>`)

---

## 1. Executive summary

The situation is **substantially better than the plan's worst case**:

1. The core hooks we need are **already public and prop-driven**: `unstable_useDocument({documentId, model, collectionType, params})`, `unstable_useDocumentLayout(model)`, `unstable_useDocumentActions()`, plus `DocumentRBAC`/`useDocumentRBAC` — all exported from `@strapi/content-manager/strapi-admin` (five of them re-exported from `@strapi/strapi/admin`).
2. Both `@strapi/admin` and `@strapi/content-manager` ship **unbundled, readable, per-module dists** with source maps and complete per-file `.d.ts` trees (278 files for CM). Every internal module physically exists as an importable file.
3. All data fetching goes through **RTK Query endpoints injected into the shared `adminApi`** (from `@strapi/admin/strapi-admin`) at bundle load — app-wide, not route-scoped. Any code in the admin app can use them.
4. Nearly all route coupling funnels through **three narrow seams** (§5). Replacing them makes the whole field-rendering tree — `FormLayout` → `InputRenderer` → every input including blocks, relations, dynamic zones, components, UID, media, custom fields — reusable **unmodified**.
5. The extension APIs (document actions, header actions, side panels) are official, typed, and consumed through public patterns (`app.getPlugin('content-manager').apis`, `DescriptionComponentRenderer`).

The two real obstacles:

- **The packages' `exports` maps block deep imports.** Internals exist on disk but only `./strapi-admin` (etc.) is exported. Reaching them needs a resolver alias in the admin build (§7).
- **The default document actions (Publish/Update/Delete) and the page shell (Header, Panels, EditViewPage) are genuinely route-coupled** and must be reimplemented with callback props — but they are the thinnest layer, and the renderer components they use are reusable as-is.

No fiber-walking/runtime context capture is needed. One EE import exists in the tree (§9) — an import of public `/ee` entry hooks, not copied `ee/` code; nothing blocks us.

---

## 2. What ships in the installed packages

| Package | dist layout | types | deep-importable files? | `exports` map |
|---|---|---|---|---|
| `@strapi/strapi` | `dist/admin.{js,mjs,d.ts}` — thin aggregator | yes | n/a | `.`, `./admin`, `./admin/test` |
| `@strapi/admin` | **per-module** under `dist/admin/admin/src/**` (.js+.mjs+maps) | 268 per-file `.d.ts` under `dist/admin/src/**` | physically yes; blocked by exports map | `./strapi-admin`, `/ee`, `/test`, `./_internal`, `./strapi-server` |
| `@strapi/content-manager` | **per-module** under `dist/admin/**` (.js+.mjs+maps) | 278 per-file `.d.ts` under `dist/admin/src/**` | physically yes; blocked by exports map | `./strapi-admin`, `./_internal/shared`, `./strapi-server` |

No package ships its `src/`; the `source` conditions in the exports maps point at files absent from the tarballs. **Build-time resolution is viable** — but only via aliases that bypass the exports map (§7). Vendoring remains the fallback. The plan's fear that "bundling may hide internals entirely" did **not** materialize.

---

## 3. Public API inventory (relevant subset)

### 3.1 `@strapi/strapi/admin` (7-line aggregator)

`renderAdmin` + `export * from '@strapi/admin/strapi-admin'` + exactly five CM re-exports: `unstable_useDocument`, `unstable_useDocumentActions`, `unstable_useDocumentLayout`, `unstable_useContentManagerContext`, `useDocumentRBAC`. Everything else CM-related (incl. the `DocumentRBAC` **provider**, `buildValidParams`, all CM types) requires importing `@strapi/content-manager/strapi-admin` directly — which is the canonical pattern; `@strapi/i18n`'s admin does exactly that.

### 3.2 `@strapi/admin/strapi-admin` (the shell)

No `unstable_` prefixes here. The pieces we build on:

| Area | Exports |
|---|---|
| Forms | `Form`, `useForm(consumerName, selector)`, `useField(path)`, `Blocker`, `getYupValidationErrors`, `InputRenderer` (generic primitive-type renderer only), `useFocusInputField`, `translatedErrors`, form types |
| Pages/layout | `Page` (`.Protect .Main .Title .Error .Loading .NoPermissions`), `Layouts`, `BackButton`, `ConfirmDialog` |
| RBAC/auth | `useRBAC(permissionsToCheck?, passedPermissions?, rawQueryContext?)`, `useAuth`, type `Permission` |
| Data | `adminApi` (the shared RTK Query instance), `useFetchClient`, `getFetchClient`, `useQueryParams`, `useAPIErrorHandler`, `fetchBaseQuery`, `isBaseQueryError` |
| Registries | `useStrapiApp` (→ `plugins`, `fields`, `components`, `customFields`, `runHookWaterfall`), `DescriptionComponentRenderer`, `createContext`, `useInjectReducer`, `createRulesEngine` |
| Misc | `useNotification`, `NotificationsProvider`, `useTracking`, `useClipboard`, responsive hooks |

Notable **not** exported from the shell (present in dist, blocked by exports map): `CustomFields` class (reachable via `app.customFields` instance anyway), `StrapiApp` class, various internal hooks/services.

### 3.3 `@strapi/content-manager/strapi-admin`

Runtime and `.d.ts` agree exactly. Values: `buildValidParams`, `RelativeTime`, `DocumentStatus`, `unstable_useDocument` (`@alpha @public`), `unstable_useContentManagerContext` (`@public @experimental`), `unstable_useDocumentActions` (`@alpha @public`), `unstable_useDocumentLayout` (`@alpha`), `DocumentRBAC` (JSDoc says `@internal` but it *is* exported), `useDocumentRBAC`. Types: `EditFieldLayout`, `EditLayout`, `DocumentActionComponent/Description/Props`, `HeaderActionComponent/…`, `PanelComponent/…`, `ContentManagerPlugin`, `DescriptionComponent/Reducer`, blocks types, `DocumentRBACProps`.

**High-value internals NOT exported** (exist as files; prime deep-import/vendor candidates):

| Module | Why we need it |
|---|---|
| `CM:pages/EditView/components/InputRenderer.mjs` | The attribute-aware field dispatcher (blocks/relations/DZ/component/UID/wysiwyg/custom fields/RBAC-per-field). The exported shell `InputRenderer` only handles primitives. |
| `CM:pages/EditView/components/FormLayout.mjs` | Pure `layout → grid of InputRenderer` mapper. Router-free. |
| `CM:pages/EditView/components/DocumentActions.mjs` | `DocumentActions`/`DocumentActionButton`/`DocumentActionsMenu`/dialog+modal renderers (router-free) + the default action hooks (router-coupled). |
| `CM:pages/EditView/components/FormInputs/**` | All the concrete inputs (BlocksInput, Relations, DynamicZone, Component, UID, Wysiwyg, NotAllowed). Router-free except shallow reads (§6 table). |
| `CM:pages/EditView/utils/{data,forms}.mjs`, `CM:utils/validation.mjs` | `transformDocument`, `createDefaultForm`, `createYupSchema`, `handleInvisibleAttributes` — pure functions, the document→form-values pipeline. |
| `CM:hooks/useDocumentContext.mjs` | The seam to replace (§5). |
| `CM:hooks/{useContentTypeSchema,useContentManagerInitData,useLazyComponents}.mjs` | Schema access, init-data population, custom-field loading. Router-free. |
| `CM:services/*.mjs` | RTK endpoints (usable indirectly through the public hooks; deep import only if we need an endpoint the hooks don't wrap, e.g. relations infinite scroll). |

---

## 4. Edit view architecture (trace)

```
router.mjs (LIST_PATH, CLONE_PATH)
└─ ProtectedEditViewPage                    CM:pages/EditView/EditViewPage.mjs
   ├─ useRBAC(PERMISSIONS × slug) → Page.Protect
   ├─ DocumentRBAC provider                 CM:features/DocumentRBAC.mjs      [public export]
   └─ EditViewPage
      ├─ useDoc → useDocument(args) → useGetDocumentQuery + useContentTypeSchema
      ├─ useDocumentLayout(model) → useGetContentTypeConfigurationQuery + MUTATE_EDIT_VIEW_LAYOUT waterfall
      ├─ Form (from @strapi/admin — OWNS all form state; initialValues, validate)
      │  ├─ Header → HeaderToolbar → DescriptionComponentRenderer(header actions)   [route-coupled]
      │  ├─ Tabs draft/published (?status=)
      │  │  └─ FormLayout → InputRenderer per field                        [router-free]
      │  │     ├─ custom fields (useLazyComponents ← app.customFields)
      │  │     ├─ app.fields[type]   ← media = upload plugin's addFields({type:'media'})
      │  │     ├─ BlocksInput / Wysiwyg / UIDInput / RelationsInput / ComponentInput / DynamicZone
      │  │     └─ default → generic InputRenderer (shell)
      │  ├─ Panels → ActionsPanelContent → DocumentActions(Publish/Update/Unpublish/Discard) [actions route-coupled]
      │  └─ Blocker (shell Blocker via react-router useBlocker + Form.modified)
      └─ utils: transformDocument · createDefaultForm · createYupSchema
```

**Form state ownership:** the shell `Form` component. EditViewPage computes `initialValues = getInitialFormValues()` (from `useDocument`, = `transformDocument(schema, components)(document)` or `createDefaultForm` for creation) and `validate` (= strip invisible attributes via rules engine, then `createYupSchema(...).validate`). Every input reads/writes exclusively through `useForm`/`useField`. Relations are represented as `{connect: [], disconnect: []}` arrays; repeatables get `__temp_key__` fractional-index keys.

**Data:** all endpoints (documents CRUD + publish/unpublish/discard/clone, init `/content-manager/init`, content-type configuration, relations, UID) are injected into the shared `adminApi` **at CM bundle load** → available app-wide from any admin page, with shared cache tags (`Document`, `InitialData`, `Relations`, …). The `content-manager` redux slice is likewise registered at app boot (`app.addReducers`), **but only populated** by `useContentManagerInitData()` which mounts solely in the CM `Layout` route. `useContentTypeSchema` does not need the slice (reads RTK cache only).

---

## 5. The three coupling seams

Nearly all route coupling funnels through three places. This is the architectural finding the whole plugin design rests on.

### Seam 1 — `useDoc()` (`CM:hooks/useDocument.mjs`)
```js
const { id, slug, collectionType, origin } = useParams();
if (!collectionType) throw new Error('Could not find collectionType in url params');
```
Thin adapter: URL → `useDocument(args)`. Everything below consumes the already-public prop-driven `useDocument`. Our `<DocumentProvider>` replaces exactly this.

### Seam 2 — `useDocumentContext(consumerName)` (`CM:hooks/useDocumentContext.mjs`, 35 lines)
Consumed by `InputRenderer`, `UIDInput`, `RelationsInput`, `DynamicZone`, `ComponentInput`, publish/update actions. It checks the relation-modal context first, **but unconditionally calls `useDoc()` as URL fallback** — so outside CM routes it throws even when a context would supply the data. **This one 35-line file is the crux: replace it (module alias or vendored copy) with a version that reads our own `HeadlessDocumentContext` → relation-modal context → URL (safe), and the entire input tree becomes headless with zero further changes.**

### Seam 3 — query-param reads (`useQueryParams`)
`?status=` (draft/published tab), `?plugins[i18n][locale]=` (locale), `rawQuery` context for RBAC. All shallow: `buildValidParams(query)` (public) converts them to API `params`. Headless version passes `status`/`locale`/`params` as props instead. Files with only this class of coupling: `UnpublishAction`, `DiscardAction`, `UIDInput` (+`useMatch(CLONE_PATH)`), `Repeatable` (error-scroll deep-link via `useLocation().search`), `useDocumentLayout` (query → layout waterfall), `DocumentRBAC` (rawQuery).

Plus two singletons:

- **Blocker:** CM's is a 10-line wrapper over the shell `Blocker`, which uses react-router's `useBlocker` (needs the admin's data router — present in every Strapi admin) + `Form.modified`. Inside the admin it works as-is on our pages; a non-router fallback (beforeunload + confirm) is a small optional reimplementation.
- **`DocumentRBAC`:** already accepts a `model` prop *specifically* to avoid the URL (`'Cannot find the slug param in the URL or the model prop is not provided.'`). Unwrapped consumers get safe all-false defaults.

---

## 6. Classification inventory

Classifications: **P** = public export · **A** = reusable as-is (router-free) · **I** = reusable with prop injection (shallow route reads to replace/feed) · **R** = must reimplement.

| Item | File (CM: unless noted) | Router reads | Class |
|---|---|---|---|
| `useDocument(args)` | `hooks/useDocument.mjs` | none | **P/A** |
| `useDoc()` | `hooks/useDocument.mjs` | `useParams` (throws) | **R** (replaced by DocumentProvider) |
| `useDocumentLayout(model)` | `hooks/useDocumentLayout.mjs` | `useQueryParams` → hook waterfall only | **P/I** |
| `useDocumentActions()` | `hooks/useDocumentActions.mjs` | `useNavigate` (used only in `clone`, l.561-564) | **P/I** |
| `useDocumentContext()` | `hooks/useDocumentContext.mjs` | `useDoc` fallback (throws) | **R** — the crux seam |
| `useContentTypeSchema(model)` | `hooks/useContentTypeSchema.mjs` | none | **A** |
| `useContentManagerInitData()` | `hooks/useContentManagerInitData.mjs` | none (mount-location-bound) | **I** |
| `useLazyComponents(uids)` | `hooks/useLazyComponents.mjs` | none | **A** |
| `DocumentRBAC` / `useDocumentRBAC` | `features/DocumentRBAC.mjs` | `useParams` (bypassed by `model` prop), `rawQuery` | **P/I** |
| RTK services | `services/*.mjs` | none | **A** (shared `adminApi`) |
| `transformDocument`, `createDefaultForm`, `createYupSchema`, `handleInvisibleAttributes` | `pages/EditView/utils/{data,forms}.mjs`, `utils/validation.mjs` | none (pure) | **A** |
| `FormLayout` | `pages/EditView/components/FormLayout.mjs` | none | **A** |
| `InputRenderer` (CM) | `pages/EditView/components/InputRenderer.mjs` | none direct (via useDocumentContext) | **I** |
| `BlocksInput` subtree | `…/FormInputs/BlocksInput/**` | none | **A** |
| `Wysiwyg` subtree | `…/FormInputs/Wysiwyg/**` | none | **A** |
| `NotAllowedInput` | `…/FormInputs/NotAllowed.mjs` | none | **A** |
| `ComponentInput`/`NonRepeatable`/`Initializer` | `…/FormInputs/Component/*` | none (useDocumentContext) | **I** |
| `Repeatable` | `…/FormInputs/Component/Repeatable.mjs` | `useLocation().search` (error scroll only) | **I** |
| `DynamicZone` subtree | `…/FormInputs/DynamicZone/**` | none (useDocumentContext) | **I** |
| `RelationsInput` | `…/FormInputs/Relations/Relations.mjs` | none (useDocumentContext + ComponentContext) | **I** |
| `RelationModal` | `…/FormInputs/Relations/RelationModal.mjs` | `useNavigate`, `useLocation`, `useDoc` | **R** (context contract well-defined; chrome reusable with injected meta) |
| `UIDInput` | `…/FormInputs/UID.mjs` | `useMatch(CLONE_PATH)`, query→params | **I** |
| `DocumentActions`/`Button`/`Menu`/dialog/modal renderers | `…/components/DocumentActions.mjs` | none | **A** |
| `PublishAction`, `UpdateAction` | same file | `useNavigate`, `useMatch`×2, `useParams`, `rawQuery`; navigate-after-create/publish | **R** |
| `UnpublishAction`, `DiscardAction` | same file | query→params only | **I** |
| `DeleteAction`, `EditTheModelAction`, `ConfigureTheViewAction` | `…/components/Header.mjs` | `useNavigate`, `useMatch(LIST_PATH)` | **R** (Delete needs `onDeleted`; other two are CTB/config links — omit or keep as navigate) |
| `Header` shell | `…/components/Header.mjs` | `useParams`, `useMatch(CLONE_PATH)`, `?status` | **R** (`HeaderActions`, `Information`, `CopyDocumentIdMenuItem`, `HeaderActionDialog` pieces: **I**) |
| `Panels`/`ActionsPanelContent` | `…/components/Panels.mjs` | `useMatch(CLONE_PATH)`, `?status`, `useDoc` | **R** (`Panel` card: **A**) |
| `EditViewPage`/`ProtectedEditViewPage` | `pages/EditView/EditViewPage.mjs` | `useParams`, `useLocation`, `?status`, `location.state` | **R** (this *is* our composition layer) |
| CM `Blocker` wrapper | `…/components/Blocker.mjs` | none (shell Blocker: router `useBlocker`) | **A** inside admin; **R** for non-router fallback |
| `DocumentStatus`, `RelativeTime` | exported components | none | **P/A** |
| Extension registry (`ContentManagerPlugin`, apis) | `content-manager.mjs` | none | **P/A** (via `app.getPlugin('content-manager').apis`) |
| `InjectionZone` | `components/InjectionZone.mjs` | none (StrapiApp only) | **I** |
| Shell `Form`/`useForm`/`useField` | ADMIN:`components/Form.tsx` | none (Blocker aside) | **P/A** |
| Shell generic `InputRenderer` | ADMIN:`components/FormInputs/Renderer.tsx` | none | **P/A** |
| `Page`, `Layouts`, `useRBAC`, `adminApi`, `useStrapiApp`, `DescriptionComponentRenderer`, `createRulesEngine` | ADMIN (various) | none | **P/A** |

### Subsystem notes

- **Custom fields:** resolved by CM `InputRenderer` via `attribute.customField` UID → `useLazyComponents` → `app.customFields.get(uid).components.Input()` (dynamic import, module-level cache). Fully registry-driven; works headless once `useDocumentContext` is replaced.
- **Media:** CM has **no** media input. `@strapi/upload` registers `app.addFields({type:'media', Component: MediaLibraryInput})` (picked up by `InputRenderer` step 3) and `app.addComponents([{name:'media-library', …}])` (dialog used by Wysiwyg + Blocks image). Registry-driven → works headless.
- **Relations:** `RelationsInput` gets document identity from `useDocumentContext` + `ComponentContext` (nested component/DZ id/uid for correct fetch paths), data via `useGetRelationsQuery` (infinite-scroll cache with `__temp_key__` ordering). Router-free. The in-place edit modal (`RelationModal`) is route-coupled at its root renderer but its context contract (`currentDocumentMeta`/`currentDocument`) is exactly the shape our provider supplies.
- **i18n:** locale is a query param (`plugins[i18n][locale]`) flattened by public `buildValidParams` into `params.locale`. The locale picker is **not CM code** — `@strapi/i18n` injects `LocalePickerAction` etc. via `addDocumentHeaderAction`. Headless: pass `params.locale` directly; provide our own picker fed by the i18n plugin's `useGetLocalesQuery` (shared `adminApi`), or render the registered header-action descriptions.
- **Permissions:** `ProtectedEditViewPage` = shell `useRBAC` over `plugin::content-manager.explorer.{create,read,update,delete,publish}` × `subject: model` → `Page.Protect` → `DocumentRBAC`. All pieces public; fully replicable with props.
- **Actions navigation inventory (to become callbacks):** create→edit redirect (UpdateAction), publish-after-create redirect (PublishAction), delete→list redirect (DeleteAction), clone redirect (`useDocumentActions().clone` — the only navigation *inside* the public hook), CTB/configure links, history/preview links.
- **History & preview:** wired through the official extension APIs (proof the extension surface is sufficient); their action/panel components are route-coupled and would be excluded or wrapped in headless mode.

---

## 7. Access strategies (recommendation per plan §3 strategies 1–5)

| Strategy | Verdict | Used for |
|---|---|---|
| 1. Public exports | **Primary.** | `unstable_useDocument/Layout/Actions`, `DocumentRBAC`, `buildValidParams`, `DocumentStatus`, and the entire shell surface (`Form`, `useForm`, `useField`, `Page`, `useRBAC`, `adminApi`, `useStrapiApp`, `DescriptionComponentRenderer`, `Blocker`, `createRulesEngine`, `translatedErrors`). |
| 2. Official extension points | **Yes**, for interop: render third-party document actions/panels/header actions registered via `app.getPlugin('content-manager').apis` inside our components, so plugins like i18n keep working. |
| 3. Build-time resolution (deep-import aliases) | **Primary for internals.** Files exist per-module; only the `exports` map blocks them. Alias in the admin (Vite) build resolves specifiers to absolute file paths. Needed for: CM `InputRenderer`, `FormLayout`, `FormInputs/**`, `DocumentActions` renderers, utils (`transformDocument` etc.), `useContentTypeSchema`, `useLazyComponents` — **plus one alias that *replaces* `hooks/useDocumentContext.mjs` with our shim** so every internal consumer (stock CM pages excluded — see open question 3) resolves to the headless-aware version. Module identity is preserved automatically: within one admin build all graphs resolve to the same files, so contexts/registries stay singletons. |
| 4. Vendoring | **Fallback + targeted.** Vendor (from the pinned tag, never `ee/`) only: our `useDocumentContext` replacement (a ~40-line rewrite, arguably original code), reimplemented default actions (Publish/Update/Delete with callbacks — these are rewrites, not copies), and Header/Panels shells. If the alias approach proves unacceptable (open question 2), escalate vendoring to the whole input tree. |
| 5. Runtime context capture | **Not needed.** Nothing requires fiber walking. |

**The zero-config question:** our plugin's build externalizes `@strapi/*` imports, so deep-import specifiers are resolved by the *consumer's* admin build — the alias must live there. Strapi v5 has no documented hook for a plugin to mutate the app's Vite config. Options: (a) ship a one-line helper for the app's `src/admin/vite.config.ts` (`mergeConfig(config, headlessCM())`); (b) vendor everything instead (zero-config but heavier drift surface). Recommended: (a), documented prominently. → **Open question for maintainer.**

An empirical spike (Phase 2, first task) must confirm: alias-bypass of the exports map works in the app admin build; our aliased graph shares singletons with the stock CM bundle; `useDocumentContext` replacement doesn't disturb stock CM routes (scope the replacement to our import graph only, or make the shim URL-safe and behavior-identical under CM routes — the safer default).

---

## 8. Drift surface (preview of `drift/manifest.json`)

Internal (non-public) files we would depend on, by mechanism — each gets a manifest entry with normalized-content hash at `v5.53.0` / `99800b1`:

- **alias-import:** `CM:pages/EditView/components/{InputRenderer,FormLayout,DocumentActions}.mjs`, `CM:pages/EditView/components/FormInputs/**` (BlocksInput, Wysiwyg, Relations, Component, DynamicZone, UID, NotAllowed), `CM:pages/EditView/utils/{data,forms}.mjs`, `CM:utils/validation.mjs`, `CM:hooks/{useContentTypeSchema,useLazyComponents,useContentManagerInitData}.mjs`, `CM:services/*.mjs` (if used directly)
- **alias-replace:** `CM:hooks/useDocumentContext.mjs` (structure contract: return shape `{currentDocumentMeta, currentDocument}`)
- **structure/contract:** relation-modal context shape; `EditFieldLayout` type; `app.fields` / `app.customFields` / `components['media-library']` registry keys; `plugin::content-manager.explorer.*` permission actions; `?status` / `plugins[i18n][locale]` query conventions; document-service HTTP routes under `/content-manager/*`
- **export-list watch:** the `unstable_*` exports and everything in §3 (renames/removals must be caught by the drift check)

Public exports also go in the manifest (kind: `export`) since `unstable_` names may churn.

---

## 9. EE / licensing

- **No `ee/` directory code** is needed or copied. The CM edit-view tree contains exactly one EE touchpoint: `hooks/useDocumentActions.ts:10` imports `useGetAiFeatureConfigQuery`/`useAIAvailability` from the *public* `@strapi/admin/strapi-admin/ee` entry (AI/tracking metadata only, no license gating of CRUD). We consume `useDocumentActions` via its public export, so this is Strapi's own dependency, not ours.
- The `import '@strapi/admin/strapi-admin/ee'` side effect in dist `RelationModal.mjs` is a build-chunk artifact, verified against source.

---

## 10. Risks (updated from PLAN §9)

1. **`unstable_` churn** — the names literally promise instability. Mitigation: drift manifest watches the export lists; contract tests exercise each hook.
2. **Deep-import aliases are inherently version-coupled** — file moves/renames upstream break resolution at build time (loud, at least). Mitigation: drift check compares file hashes *and* existence; peerDependency ranges stay tight.
3. **Module-identity assumptions** — aliasing must not duplicate context-bearing modules. Verified in principle (single build = single resolution per file); must be contract-tested (e.g. assert our `useDocumentRBAC` sees the stock provider).
4. **The `useDocumentContext` replacement touches stock CM behavior** if aliased globally. Mitigation: make the shim try our context → relation-modal → URL (identical fallback order plus one), behavior-identical when our context is absent; parity tests on stock routes.
5. **Consumer-side config (one-liner) breaks the zero-config goal** — maintainer decision pending; vendoring is the zero-config alternative at the cost of a much larger drift surface.
6. **Default actions reimplementation drift** — our Publish/Update/Delete rewrites can drift from stock behavior (draft-relations dialog, keyboard shortcuts, guided-tour hooks). Mitigation: parity tests per action; keep rewrites minimal by reusing `useDocumentActions` + the action-renderer shells.
7. ~~Internals more coupled than expected~~ / ~~bundling hides internals~~ — **did not materialize**; sized in this document.

---

## 11. Open questions for the maintainer

1. **Accept the one-line consumer Vite config** (`src/admin/vite.config.ts` helper) for deep-import aliasing, or require zero-config and pay the vendoring drift cost? (Recommended: one-liner.)
2. **Scope of the `useDocumentContext` alias:** global-but-behavior-identical shim (recommended; parity-tested) vs. import-graph-scoped replacement (more build complexity).
3. **Ship reimplemented default actions without guided-tour/tracking wiring?** (They're admin-internal niceties; parity tests would ignore them.) 
4. Confirmed non-goals for now: relation edit-modal in headless mode renders read-only links until Phase 5+ (its root renderer is route-coupled); history/preview actions hidden in headless mode.
