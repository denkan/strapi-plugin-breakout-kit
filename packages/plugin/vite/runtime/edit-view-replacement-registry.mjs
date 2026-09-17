/**
 * Registry for the edit-view replacement resolver: set by the plugin bundle
 * (setEditViewReplacement, typically from a consumer's src/admin/app.tsx register())
 * and read by the vendored EditViewPage wrapper living in @strapi/content-manager's
 * module graph. Same global-symbol get-or-create pattern as the bridge contexts — one
 * store regardless of module identity. Shape: { resolver: fn|null } where
 * resolver(routeInfo) -> ComponentType | undefined (undefined = stock edit view).
 * Typed twin: admin/src/composition/edit-view-replacement.ts — keep in sync.
 */
const KEY = Symbol.for('strapi-plugin-breakout-kit/edit-view-replacement@v1');

export function getEditViewReplacementRegistry() {
  if (!globalThis[KEY]) {
    globalThis[KEY] = { resolver: null };
  }
  return globalThis[KEY];
}
