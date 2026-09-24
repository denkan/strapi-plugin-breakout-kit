# How it works

The plugin's goal is to expose the components, hooks and utilities Strapi's admin uses
internally — with thin option layers for overriding — while copying as little of
Strapi's code as possible. The guiding principle: **the copied surface is the risk
surface.** Everything is organized into three tiers, from cheapest to most invasive,
and every borrowed piece is tracked so a Strapi release can never silently rot it.

Related reading: [decisions.md](./decisions.md) (why each call was made),
[research/findings.md](./research/findings.md) (the Phase 1 internals survey),
[CONTRIBUTING.md](../CONTRIBUTING.md) (rules when touching internals),
[RELEASING.md](./RELEASING.md) (release mechanics).

## Tier 1 — re-exports of the real, installed code (most of the plugin)

There is no copy-paste for the bulk of the plugin, because there doesn't need to be:
Strapi's packages ship **unbundled, per-module dist output**. Every internal source
file of `@strapi/content-manager` compiles 1:1 to a file like
`dist/admin/pages/EditView/components/InputRenderer.mjs`, sitting in the consumer's
own `node_modules`. The code isn't missing — it's just unreachable, because the
package's `exports` map only exposes `./strapi-admin`.

The `breakoutKit()` Vite helper ([`packages/plugin/vite/index.cjs`](../packages/plugin/vite/index.cjs))
removes that barrier, and does one more thing that is just as important:

1. **Deep-import resolution** — specifiers like
   `@strapi/content-manager/dist/admin/...` resolve to the actual files, bypassing the
   exports map.
2. **Single-instance guarantee** — the plugin's admin bundle is registered as a
   dep-optimize entry so its deep-imported modules land in the **same pre-bundled
   chunks as the stock admin**. One module instance means one React context, one
   registry, one prismjs. (Most of the cryptic historical bugs — `useRBAC must be
   used within Auth`, duplicated-prism crashes — were violations of this invariant;
   the helper now ships tripwires that name the offending file when it happens.)

Everything the plugin re-exports this way — `InputRenderer`, `DocumentActions`,
`createYupSchema`, layout/document hooks, … — is *literally the code running in the
consumer's installed Strapi version*. That is why parity is exact by construction, and
why most of the plugin tracks Strapi updates for free.

Only one file is allowed to deep-import:
[`packages/plugin/admin/src/access/internal.ts`](../packages/plugin/admin/src/access/internal.ts).
Higher layers import from the access layer, never from Strapi directly.

The server side follows the same idea at runtime: the recursive-populate guards
resolve Strapi's internal modules with `createRequire` anchored on
`@strapi/strapi`'s closure — the loader that actually required those instances — so
they patch the very objects the running app uses (and it works under both npm's flat
hoisting and pnpm's strict layout).

## Tier 2 — shims: replaced modules that stay behavior-identical

Some internals can't be wrapped from the outside because Strapi's own code calls them
internally by relative import. Example: the stock inputs call `useDocumentContext()`,
which reads route params — meaningless on a headless page. Re-exporting a patched
version wouldn't help; CM's internal consumers would still load the original.

So the helper **alias-replaces** a handful of modules for *every* consumer — stock CM
routes included — with shims in
[`packages/plugin/vite/runtime/`](../packages/plugin/vite/runtime/):
`useDocumentContext.mjs`, `useDocument.mjs`, `useContentTypeSchema.mjs`. Each shim
mirrors the upstream body exactly and adds one thing: a fallback to the headless
`<DocumentProvider>` context when no route params are present. On stock routes they
must be indistinguishable from the originals —
`tests/contract/stock-cm-unaffected.spec.ts` guards that. A shim that needs to
delegate imports its own original via the `?bk-original` suffix.

One hard-won rule: a re-export **cannot** intercept module-local calls. Any upstream
hook that composes `useDoc` (or similar) inside the same module must be *rebuilt* in
the shim, mirroring the upstream body — not re-exported.

## Tier 3 — vendored copies: only where seams must live inside the component

The entry-customization seams (`renderEntry`, `renderAddButton`, `renderBox`,
`body`/`renderFields` slots) need hooks *in the middle of* Strapi's render logic — no
wrapper can inject them. For these, the plugin carries actual copies, redirected by
the helper so both stock and headless pages run them:

- `DynamicZone/Field.mjs` + `DynamicZone/DynamicComponent.mjs`
- `Component/Repeatable.mjs`, `Component/Input.mjs`, `Component/NonRepeatable.mjs`
- `EditViewPage.mjs` (the edit-view replacement redirect)

They are vendored from the **published dist output** (the compiled `.mjs`, not the
repo's TypeScript source), and every deviation is marked with a `// [breakout-kit]`
comment. With no customization config present they render byte-identically to stock —
asserted by the parity suite. Two absolute rules: nothing is ever copied from
Strapi's `ee/` directories (different license), and seam `Default*` components handed
to consumer callbacks must keep render-stable identities (`stable-seam.mjs`), or
React remounts the subtree on every keystroke.

## The layer model

```
composition/  EditPage — one-liner presets                (props, no routes)
components/   EditForm, EditHeader, DocumentActionsBar, …  (render + seams)
data/         DocumentProvider, hooks, operations          (rebuilds what the stock
                                                            route derives from its URL)
access/       the ONLY layer touching Strapi internals     (re-exports + shims)
```

Dependencies point strictly downward. Every derived value has an override prop
(a value = controlled, a function = transform of the fetched default), so consumers
fork behavior without forking code.

## The drift manifest — every borrowed piece is a tripwire

Every internal the plugin touches is an entry in
[`drift/manifest.json`](../drift/manifest.json):

```jsonc
{
  "id": "cm-form-layout",
  "path": "packages/core/content-manager/admin/src/pages/EditView/components/FormLayout.tsx",
  "distPath": "dist/admin/pages/EditView/components/FormLayout.mjs",
  "symbol": "FormLayout",
  "hash": "sha256 of the NORMALIZED upstream source",
  "usedBy": ["…our files that depend on it…"]
}
```

The rule is absolute: **not in the manifest → not a dependency.** The manifest also
declares the support window (`strapiFloor`..`strapiVersion`).

## Tackling a new Strapi release

1. **Watch** — a scheduled workflow (*Strapi release watch*) polls for new Strapi
   releases.
2. **Diff** — the pipeline checks out the new version's source and re-hashes every
   manifest entry (`npm run drift:hashes` / `drift:check`), producing a drift report:
   exactly which tracked internals changed, with diffs, and which of our files consume
   them (`usedBy`). Most releases touch none of them — then adaptation is just a
   window bump.
3. **Adapt** — the *strapi-adapt* workflow runs an agent against the drift report and
   failing test output, following the playbook in [CLAUDE.md](../CLAUDE.md): access
   layer first; shims mirror the upstream diff (fallback order, skip logic, error
   strings); vendored files are re-vendored from the new dist and the `[breakout-kit]`
   seams re-applied. Contract and parity tests are never weakened to pass.
4. **Verify across the window** — `npm run matrix -- --window` runs the full suite
   (unit + contract + pixel/behavior parity against a live playground) on **every
   Strapi minor in the window**. A change must stay green across all of them, or the
   floor rises explicitly in the PR — never silently.
5. **Record + release** — `drift:update` writes the new hashes and `strapiVersion`;
   peers declare `>=floor <roof+1minor`; the README window is rewritten. The
   bot-authored PR goes through protected `main` → staged npm publish → maintainer
   2FA approval, and each Strapi minor's dist-tag (`strapi-5.54`, …) points at the
   newest plugin release supporting it.

## Why this design

Re-export wherever possible (drift risk ≈ zero — it's the consumer's own Strapi
code). Shim only when interception semantics force it (risk = behavior divergence,
caught by stock-route tests). Vendor only when seams force it (highest risk — marked
deviations + parity tests). The manifest makes every borrowed piece explicit and
hash-tripwired: the worst a Strapi release can do is turn a drift check red and point
at the exact file to look at.
