# Plan: Headless Content Manager for Strapi v5

> Handoff document for Claude Code. Start from an empty directory and work through the phases in order. Each phase ends with a checkpoint; do not move on until it passes.

## 1. Vision

Strapi v5 ships its admin panel as bundled packages and exports only a narrow public API. The content manager's edit view is built from many useful hooks and components (document fetching, layout resolution, form state, field renderers, document actions), but they are internal and tightly coupled to the router: the model UID, document ID and locale are read from route params.

This plugin delivers a **headless, prop-driven version of the content manager edit view**.

The dream developer experience:

```tsx
// Easiest: the full edit page, identical to Strapi's, driven by props
<EditPage model="api::article.article" documentId="abc123" locale="en" />

// Deeper: compose your own page from the same pieces
<DocumentProvider model="api::article.article" documentId="abc123">
  <MyCustomToolbar />
  <EditHeader />
  <EditForm
    layout={(layout) => moveFieldToTop(layout, "title")}
    renderField={(field, Default) =>
      field.name === "price" ? <PriceInput {...field} /> : <Default {...field} />
    }
  />
  <DocumentActions include={["save", "publish"]} />
</DocumentProvider>

// Deepest: just the hooks
const { document, isLoading } = useDocument();
const { layout } = useEditLayout();
const form = useEditForm();
```

The plugin will be **published publicly on npm**.

## 2. Design principles

These apply to every file in the project. Treat them as review criteria.

1. **Props, not routes.** No piece below the composition layer may read from the router. Model UID, document ID, locale and status come from props or context.
2. **Controlled or uncontrolled, always.** If the consumer passes data (`document`, `layout`, `schema`), use it. If not, fetch or derive it using Strapi's own mechanisms. Same component either way.
3. **Override without forking.** Every component accepts an optional override prop for each value it would otherwise derive, and a hook exposes that derived value alongside it. Overrides can be a replacement value or a transform function `(defaultValue) => newValue`.
4. **Dependencies point downward.** Composition → Components → Data → Access. Never the reverse.
5. **Prefer supported APIs.** Use Strapi's public exports and official extension points first. Reach into internals only when there is no supported path, and only inside the access layer.
6. **Parity by default.** With no overrides, output should be visually and behaviourally indistinguishable from the stock content manager edit view.
7. **Every internal dependency is recorded.** Any Strapi file, export or structure we depend on is listed in the drift manifest (see Phase 7). If it isn't in the manifest, we don't depend on it.

## 3. Architecture

```
┌──────────────────────────────────────────────┐
│ 4. Composition   <EditPage/>, page presets   │
├──────────────────────────────────────────────┤
│ 3. Components    <EditHeader/>, <EditForm/>, │
│                  <FieldRenderer/>,           │
│                  <DocumentActions/>, ...     │
├──────────────────────────────────────────────┤
│ 2. Data          <DocumentProvider/>,        │
│                  useDocument, useEditLayout, │
│                  useEditForm, useActions     │
├──────────────────────────────────────────────┤
│ 1. Access        Adapters to Strapi internals│
│                  (the only "ugly" layer)     │
└──────────────────────────────────────────────┘
```

### Layer 1: Access

Purpose: reach Strapi's internal code and state, and hide how we do it. Exposes a small, typed internal interface that the data layer consumes. Nothing outside this layer knows *how* internals are reached.

Strategies, in order of preference:

1. **Public exports.** Anything exported from `@strapi/strapi/admin` (and related public entry points). Some useful hooks may already be exported, possibly with an `unstable_` prefix. Verify in Phase 1.
2. **Official extension points.** The content manager exposes plugin APIs for adding document actions, header actions, side panels and similar. Use these where they fit rather than replacing behaviour.
3. **Build-time resolution.** If the installed packages ship source or non-minified modules for internal files, resolve deep imports to them via an alias in the admin build config.
4. **Vendoring.** Copy a minimal internal implementation from the Strapi repository at the exact pinned version, stripped of router coupling. Record its source path and commit in the manifest. Strapi core is MIT licensed, but **never copy from any `ee/` directory** (different license).
5. **Runtime context capture.** Last resort only. Obtaining React context references by walking the fiber tree is fragile across React and Strapi upgrades and hard for users to debug. Use only if a specific need cannot be met any other way, isolate it in one clearly named module, and cover it with contract tests.

### Layer 2: Data

- `<DocumentProvider>`: takes `model`, `documentId`, `locale`, `status` (draft/published), plus optional `document`, `schema`, `layout`, `components`. Builds everything the stock edit view gets from its route, and publishes it through context.
- Hooks (names provisional):
  - `useDocument()`: document data, loading/error state, refetch
  - `useSchema()`: content type schema and component schemas
  - `useEditLayout()`: resolved edit layout (panels, rows, fields), after overrides
  - `useEditForm()`: form values, errors, dirty state, field setters, submit
  - `useDocumentActions()`: save, publish, unpublish, discard, delete, clone, each returning promises and not performing navigation itself
  - `usePermissions()`: what the current admin user can do with this document
  - `useLocales()`: i18n state when the i18n plugin is enabled
- Navigation side effects (e.g. redirect after create or delete) become **callbacks** on the provider (`onCreated`, `onDeleted`, ...), never hardcoded redirects.
- Multiple providers must be able to coexist on one page (e.g. two documents side by side).

### Layer 3: Components

Presentational pieces that read from the data layer. Each has override props.

Initial set (refine after Phase 1):

- `<EditHeader>`: title, status badge, back link, header actions
- `<EditForm>`: renders the full layout; props `layout`, `renderField`, `renderPanel`
- `<FieldRenderer>`: renders one field by type, same inputs as stock, including relations, components, dynamic zones, media, rich text (blocks)
- `<DocumentActions>`: action buttons; props `include`, `exclude`, `renderAction`
- `<EditSidePanels>`: the right-hand panels (information, i18n, etc.)
- `<Blocker>`: unsaved changes prompt, optional

### Layer 4: Composition

- `<EditPage>`: one-liner full edit view with parity to stock.
- Optional later presets: `<CreatePage>`, `<SingleTypePage>`, `<EditModal>` (edit a document in a modal from anywhere in the admin).

## 4. Repository layout

A monorepo with the plugin, a playground Strapi app for development and tests, and automation scripts.

```
/
├─ packages/
│  └─ plugin/                  # the published plugin (Plugin SDK)
│     ├─ admin/src/
│     │  ├─ access/            # Layer 1
│     │  ├─ data/              # Layer 2
│     │  ├─ components/        # Layer 3
│     │  ├─ composition/       # Layer 4
│     │  └─ index.ts           # public exports only
│     └─ server/src/           # minimal; only if needed
├─ apps/
│  └─ playground/              # Strapi v5 app used for dev and tests
├─ tests/
│  ├─ unit/
│  └─ contract/                # Playwright tests against real admin
├─ drift/
│  ├─ manifest.json            # every internal dependency + hash
│  └─ scripts/
├─ docs/
│  ├─ research/                # Phase 1 output
│  └─ usage/
├─ .github/workflows/
├─ CLAUDE.md                   # agent instructions (see Phase 8)
└─ PLAN.md                     # this file
```

## 5. Phases

### Phase 0: Bootstrap the workspace

1. Check prerequisites: Node.js version supported by the current Strapi v5 release (check the Strapi docs), a package manager (use npm or yarn unless Plugin SDK docs recommend otherwise), git.
2. Initialise the repository, `.gitignore`, `.editorconfig`, and a README stub.
3. Set up the workspace (npm/yarn workspaces) with `packages/*` and `apps/*`.
4. Create the playground app in `apps/playground` with the latest stable Strapi v5 release (`npx create-strapi@latest`), TypeScript, SQLite. Pin the exact Strapi version in its `package.json`.
5. Scaffold the plugin in `packages/plugin` using the Strapi Plugin SDK (`npx @strapi/sdk-plugin init`). Choose TypeScript. Use a working npm name (placeholder: `strapi-plugin-headless-content-manager`; confirm with the maintainer before first publish).
6. Link the plugin into the playground following the Plugin SDK's documented local development flow (watch + link), and enable it in the playground's plugin config.
7. Seed the playground with content types that exercise every field type: text, rich text (blocks), number, boolean, date, enumeration, media (single and multiple), JSON, relations (all cardinalities), components (single and repeatable), dynamic zones, UID. Enable draft & publish and i18n on at least one type. Add a single type too.
8. Add a seed script that creates sample documents and an admin user for tests.

**Checkpoint:** playground runs, admin loads, plugin appears as enabled, sample content exists.

### Phase 1: Research the content manager

Goal: a precise map of what exists, what's reusable, and what's welded to the route. **No plugin code in this phase.** Output goes in `docs/research/`.

1. Clone the Strapi repository at the tag matching the pinned version into a scratch location outside the repo (or a gitignored folder).
2. Locate the content manager admin source and the admin package's public entry points.
3. Inventory the public API: list everything exported from `@strapi/strapi/admin` and related public entry points that relates to documents, forms, layouts, fields and actions. Note which are `unstable_`.
4. Inventory the official content manager extension APIs available to plugins.
5. Inspect the **installed** packages in `node_modules` to determine what ships: bundled only, or also source / non-minified modules and type declarations. This decides whether build-time resolution is viable.
6. Trace the edit view from its route down: page component → providers → hooks → components. For each hook and component record:
   - file path
   - what it reads from the router (params, query, navigation)
   - what it reads from global state or data-fetching caches
   - what context it provides or consumes
   - whether it contains `ee/` code
   - classification: **public** / **reusable as-is** / **reusable with prop injection** / **must reimplement**
7. Specifically investigate: document fetching and caching, layout resolution (including configured edit view settings), form state and validation, field input registry (how field types map to inputs, including custom fields), relations handling, dynamic zones and components, the actions layer and its navigation side effects, permissions, i18n integration, the unsaved-changes blocker.
8. Write `docs/research/findings.md` with the inventory table, a dependency diagram, risks, and a recommended access strategy per item.
9. Write `docs/research/api-proposal.md`: concrete provider props, hook signatures and component props, updated from Section 3 based on findings.

**Checkpoint:** stop and present findings and API proposal to the maintainer for approval before Phase 2.

### Phase 2: Access layer

1. Implement adapters per the approved strategy, each in its own module under `access/`.
2. Define a single typed internal interface (`access/index.ts`) the data layer uses.
3. If build-time resolution is used, implement the admin build config alias and document it for plugin consumers (whether they need to add anything to their own config; aim for zero config).
4. Add every internal dependency to `drift/manifest.json` (see Phase 7 format).
5. Unit test adapters where possible; add a first contract test that mounts the playground admin and asserts each adapter resolves.

**Checkpoint:** the data layer could be written against the access interface without touching Strapi internals directly.

### Phase 3: Data layer

1. Implement `<DocumentProvider>` in uncontrolled mode first (fetch everything itself).
2. Add controlled mode per prop (`document`, `schema`, `layout`).
3. Implement hooks listed in Section 3. Each accepts overrides where relevant.
4. Replace navigation side effects with callbacks.
5. Verify two providers can coexist.
6. Unit tests for override merging and controlled/uncontrolled switching.

**Checkpoint:** a test page in the playground uses only hooks to display and edit a document, with no router params involved.

### Phase 4: Component layer

1. Implement components one at a time, starting with `<FieldRenderer>` (highest value, most complex), then `<EditForm>`, `<EditHeader>`, `<DocumentActions>`, `<EditSidePanels>`.
2. Reuse Strapi's design system and stock inputs wherever accessible, for visual parity.
3. Support custom fields registered by other plugins.
4. Each component: override props, a usage example in `docs/usage/`, and a contract test.

**Checkpoint:** every field type from the playground seed renders and saves correctly through `<FieldRenderer>`.

### Phase 5: Composition layer

1. Build `<EditPage>` from the components.
2. Add a playground admin page (registered by a local test plugin or in the playground's admin extension) that renders `<EditPage>` for any model and document chosen via inputs, not route params.
3. Parity tests: for each seeded content type, compare stock edit view and `<EditPage>` using Playwright (DOM structure checks plus visual snapshot comparison with a tolerance), and perform the same edit/save/publish flow through both.

**Checkpoint:** parity tests pass for all seeded types.

### Phase 6: Documentation and release prep

1. README: problem, install, quick start, the three levels of usage (page, pieces, hooks), compatibility table, stability notice (this plugin depends on Strapi internals; see compatibility policy).
2. API reference generated from TypeScript types or written by hand in `docs/usage/`.
3. Examples: custom field placement, replacing one input, controlled mode with external data, edit-in-modal.
4. `CONTRIBUTING.md`, `LICENSE` (MIT recommended), `CHANGELOG.md`, issue templates.
5. Verify the package builds with the Plugin SDK's build and verify commands, and that the published tarball contains only what it should.

**Checkpoint:** a fresh Strapi v5 app can install the packed tarball and render `<EditPage>` by following the README alone.

### Phase 7: Drift detection

The plugin tracks Strapi releases. When Strapi changes code we depend on, we must notice and adapt.

1. **Manifest format** (`drift/manifest.json`):
   ```json
   {
     "strapiVersion": "5.x.y",
     "strapiCommit": "<sha>",
     "dependencies": [
       {
         "id": "cm-use-document",
         "kind": "file | export | structure",
         "path": "<path in strapi repo or node_modules>",
         "symbol": "<optional export or function name>",
         "hash": "<sha256 of normalised content>",
         "usedBy": ["access/document.ts"]
       }
     ]
   }
   ```
   Normalise before hashing (strip comments and whitespace) to avoid noise.
2. `drift/scripts/check.ts`: given a Strapi version, fetch the source at that tag, recompute hashes, and output a report listing changed, removed and unchanged dependencies, with diffs for changed ones.
3. `drift/scripts/update-manifest.ts`: rewrite the manifest for a new version once adaptation is done.
4. Also check the public export list, so renamed or removed `unstable_` exports are caught.

**Checkpoint:** running the check against a deliberately older or newer Strapi tag produces a correct, readable report.

### Phase 8: Automated adaptation with Claude Code

Goal: new Strapi release → adapted plugin → green PR, with as little human involvement as possible.

1. **Release watcher** (GitHub Actions, scheduled, e.g. daily): compare the latest published `@strapi/strapi` version on npm to `drift/manifest.json`. If newer, start the adaptation workflow for that version. Only handle v5 releases; a new major is out of scope and should open an issue instead.
2. **Adaptation workflow:**
   1. Create a branch `strapi-<version>`.
   2. Bump the playground's Strapi version and reinstall.
   3. Run the drift check.
   4. **If nothing changed:** run the full test suite. If green, update the manifest, bump the plugin version, and open a PR marked safe to auto-merge.
   5. **If something changed, or tests fail:** run Claude Code headlessly (either the official Claude Code GitHub Action or `claude -p` in non-interactive mode; check current docs for setup and required secrets) with a prompt containing the drift report, diffs, failing test output, and an instruction to follow `CLAUDE.md`. The agent adapts the access layer (and above only if strictly necessary), updates the manifest, and iterates until tests pass or a retry/budget limit is reached.
   6. Open a PR with: drift summary, what the agent changed and why, test results. Label `automated`.
   7. If the agent could not reach green, open the PR as draft with label `needs-human` and a summary of what failed.
3. **Merge policy:** no-drift PRs auto-merge when green. Agent-adapted PRs auto-merge when green if the maintainer enables that; default to requiring one approving review until the automation has proven itself.
4. **Publish workflow:** on merge to `main`, build, run the full suite once more, publish to npm with provenance, create a GitHub release with the changelog entry.
5. **`CLAUDE.md`** at the repo root, containing: the design principles from Section 2, the layer rules, "adapt the access layer first", "never copy from `ee/`", "every internal dependency must be in the manifest", "do not weaken or delete contract or parity tests to make them pass", and how to run the playground and tests.
6. **Safety:** the agent's workflow has no npm publish credentials; publishing only happens from `main` after merge. Limit the workflow's token permissions to what's needed to push a branch and open a PR.

**Checkpoint:** simulate a release by pinning an older Strapi version in the manifest and running the workflow manually; it should produce a sensible PR.

### Phase 9: First public release

1. Confirm the package name with the maintainer.
2. Publish `0.x` or a version per the policy below, marked experimental.
3. Announce with the compatibility table and stability notice.

## 6. Testing strategy

| Level | Tool | What it proves |
|---|---|---|
| Unit | Vitest (or what the Plugin SDK template sets up) | Override merging, controlled/uncontrolled logic, pure helpers |
| Contract | Playwright against the playground admin | Access adapters resolve; components render and behave against the real, current Strapi |
| Parity | Playwright, stock view vs `<EditPage>` | No regressions from stock behaviour and appearance |
| Drift | `drift/scripts/check.ts` | We know exactly what moved upstream |

Contract and parity tests are the agent's safety net in Phase 8. Be generous with them: cover every field type, draft & publish, i18n, relations, and permission-restricted users.

## 7. Versioning and compatibility policy

Goal from the maintainer: the plugin follows Strapi's versions.

Constraint: npm versions can't be republished, and the plugin will need its own bug fixes between Strapi releases.

Recommended approach (confirm with the maintainer):

- Plugin **major** matches Strapi major (v5 → plugin 5.x).
- Each plugin release declares a tight `peerDependencies` range for `@strapi/strapi` covering the versions it was tested against.
- Maintain a compatibility table in the README (plugin version → tested Strapi versions), updated by the publish workflow.
- Publish npm dist-tags per Strapi minor (e.g. `strapi-5.12`) so users on an older Strapi can install the right plugin with one command.

Alternative the maintainer may prefer: mirror Strapi's exact version and use a build-metadata or fix suffix. Evaluate against npm's semver ordering rules before choosing.

## 8. Open decisions

Resolve these with the maintainer at the noted checkpoint:

1. Final npm package name. *(before Phase 9)*
2. Exact versioning scheme. *(before Phase 7)*
3. Which access strategies are acceptable for public release, especially runtime context capture. *(after Phase 1)*
4. Whether agent-adapted PRs may auto-merge. *(after Phase 8 trial)*
5. Scope beyond the edit view (list view, create page, single types, modal). *(after Phase 5)*

## 9. Risks

- **Internals may be more coupled than expected**, pushing more code into "must reimplement" and increasing maintenance. Phase 1 exists to size this before committing.
- **Bundling may hide internals entirely**, ruling out build-time resolution and forcing vendoring.
- **Runtime context capture can break silently** on React or Strapi upgrades. Keep it isolated or avoid it.
- **Enterprise features** live under a different license and must not be copied.
- **Automated adaptation can produce plausible but wrong fixes.** Mitigated by strong contract and parity tests and the rule that tests are never weakened.
- **Strapi may expose more public API over time**, which is good: prefer switching to it and shrinking the access layer.
