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

Still open (from PLAN §8): final npm package name (before Phase 9), exact versioning scheme
(before Phase 7), auto-merge policy for agent PRs (after Phase 8 trial), scope beyond the edit
view (after Phase 5).
