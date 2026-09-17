# Maintainer decisions

Decisions resolved with the maintainer, per PLAN.md §8 and docs/research/findings.md §11.

## 2026-09-16 — after Phase 1 (research)

1. **Deep-import strategy: one-line consumer Vite config.** The plugin ships a Vite helper that
   consumers add to their app's `src/admin/vite.config.ts`. **Revisit note:** this trades
   zero-config for a small drift surface; if it causes consumer friction, re-evaluate vendoring
   the input tree instead (larger drift surface, zero config). Track friction reports after release.
2. **`useDocumentContext` shim is aliased globally** — approved *on the condition that stock CM
   routes behave identically*. Enforced by design (the shim adds one context source in front of
   the original fallback order and throws in exactly the same conditions) and by parity tests.
3. **Reimplemented default actions skip guided-tour and telemetry wiring.** Approved.
4. **Deferred scope.** Relation edit-modal: read-only relation links in v0. History/preview
   actions: hidden in headless mode. Approved.

5. **Scope beyond the edit view (PLAN §8 #5, resolved after Phase 5):** the plugin will
   *probably* expand to further parts of Strapi (list view, create page, edit-in-modal,
   possibly other admin surfaces) — but **not now**. Structures must anticipate it:
   - the four layers are surface-agnostic (`access/` adapters, `data/` providers, etc.);
     a future list view adds e.g. `ListProvider`/`useListLayout` beside the existing pieces,
     never inside them
   - public exports use surface-prefixed names (`EditPage`, `EditForm`, …) leaving room for
     `ListPage`, `CreatePage`, `EditModal`
   - drift/manifest.json grows per surface; keep `usedBy` accurate so unused entries can be
     dropped if a surface is removed

6. **Package name (PLAN §8 #1, resolved):** `strapi-plugin-breakout-kit` — "break out of
   Strapi's locked-in admin tools". Plugin id `breakout-kit`, display name "Breakout Kit",
   repo `strapi-plugin-breakout-kit`. Chosen over "headless-*" names to avoid the headless-CMS
   ambiguity and over the narrower `-content-manager` scope given decision #5.
7. **Versioning scheme (PLAN §8 #2, resolved):** plugin-own semver starting `0.1.0`
   (experimental); tight Strapi peerDependencies ranges per release; README compatibility
   table; npm dist-tags per Strapi minor (`strapi-5.54`); patch = our fixes, minor = Strapi
   adaptation/features; on stabilization jump to `5.0.0` so plugin major tracks Strapi major.
8. **No shipped admin UI:** the plugin registers no menu link or pages — demos and the
   access diagnostics page live in the playground's admin extension. The plugin exposes a
   programmatic `accessDiagnostics` export instead (also required technically: dev-mode
   source imports of CM internals from app code would split the dep-prebundle singletons).
9. **Media picker customization** will be handled as a custom field / `app.addFields`
   replacement in consumer apps, NOT via tweakable seams in this plugin. Next seam
   milestone instead: dynamic-zone render slots (custom accordion icons, add-component
   button) — driven by the maintainer's concrete needs.

10. **Supported Strapi window: floor 5.50, roof = drift-manifest target** (revised after
    empirical probing: the full suite is green on uniform 5.50–5.53 installs; drift in
    tracked files across that span is TypeScript-cosmetic only). The window is declared in
    drift/manifest.json (`strapiFloor`..`strapiVersion`), enforced by peer ranges
    (`>=floor <roof-next-minor`), and MUST be suite-verified per minor by the version
    matrix before any published claim. When a change cannot stay green across the window,
    the floor rises (explicit, changelog'd; older users are served by dist-tags).
    Mirrored/vendored surfaces (shims, EditForm markup, action flows) track the ROOF.
10b. **Version matrix is script-first:** drift/scripts/version-matrix.mjs runs locally
    (`npm run matrix -- 5.51.0` or `--window`) and CI's version-matrix.yml merely
    parallelizes the same script (one job per minor; triggered on adaptation branches and
    manually). Uniform trees per version via npm overrides — mixed hoisted trees break
    Strapi's own singleton aliasing (duplicate @codemirror/state).
11. **Publishing: CI-only, "merge = release".** The publish workflow triggers on pushes to
    main where the plugin version differs from npm (plus manual dispatch as the
    first-release path and fallback). First publish is manual; after it, consider npm
    Trusted Publishing (OIDC) and dropping NPM_TOKEN.

12. **npm publishing: trusted publishing + staged releases** (adopting npm's post-2026
    direction immediately rather than at the Jan 2027 token cutoff). NPM_TOKEN is
    bootstrap-only for the first publish of the not-yet-existing package. Then: configure
    a Trusted Publisher (GitHub Actions, this repo, publish.yml) with "require 2FA and
    disallow tokens" + staged publishing; swap the publish step to OIDC and revoke the
    token. Release semantics become "merge = staged, promote (2FA) = live"; the human act
    moves from PR-merge to npm-promote, which also makes enabling auto-merge safer later.
    dist-tag + GitHub release are decoupled into post-release.yml (idempotent: runs after
    Publish, on dispatch after promoting, and on a daily self-heal cron) since staged
    versions aren't tag-able until promoted.
    STATUS 2026-09-17: 0.1.0 published (from the maintainer's machine with OTP — the
    account's strict 2FA made CI token publish impossible, which validated the decision);
    trusted publisher configured (STAGE-publish only — the post-Sept-2026 default; direct
    `npm publish` is refused by the registry and surfaces as CLI ENEEDAUTH);
    publish.yml runs `npm stage publish` from the package dir (workspace `-w` publish
    skips the OIDC exchange); maintainer approves via `npm stage approve <id> --otp`.
    NPM_TOKEN secret deleted.
    The strapi-5.x dist-tag is a manual one-liner after each 2FA promote (CI cannot
    perform 2FA-gated writes) — post-release.yml surfaces it in the run summary when
    pending.

Still open (from PLAN §8): auto-merge policy for agent PRs (after Phase 8 trial).
