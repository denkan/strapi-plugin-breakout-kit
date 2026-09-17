import * as React from 'react';

/**
 * Replace the STOCK content-manager edit view with a custom component — the CM route
 * stays (list-view links, redirects and breadcrumbs keep working); only the route's
 * component is swapped. Typed twin of vite/runtime/edit-view-replacement-registry.mjs
 * (same global symbol; the vendored EditViewPage wrapper reads it). Keep in sync.
 */

/** Parsed CM edit-route info — also passed to the replacement component as props. */
export interface EditViewRouteInfo {
  /** 'collection-types' | 'single-types' (CM's URL segment). */
  collectionType: string;
  /** The content-type uid (CM's :slug param). */
  model: string;
  /** Absent in create mode and for single types; the clone origin while cloning. */
  documentId?: string;
  isCreate: boolean;
  /** Clone route (…/clone/:origin). Stock clone semantics are not covered by
   * <EditPage> — return `undefined` for clones unless you handle them yourself. */
  isClone: boolean;
  origin?: string;
  /** From query plugins.i18n.locale, when i18n is in play. */
  locale?: string;
  /** From the query ('draft' | 'published'), when present. */
  status?: string;
}

export type EditViewReplacementResolver = (
  route: EditViewRouteInfo
) => React.ComponentType<EditViewRouteInfo> | undefined;

interface Registry {
  resolver: EditViewReplacementResolver | null;
}

const KEY = Symbol.for('strapi-plugin-breakout-kit/edit-view-replacement@v1');

const getRegistry = (): Registry => {
  const store = globalThis as { [KEY]?: Registry };
  if (!store[KEY]) {
    store[KEY] = { resolver: null };
  }
  return store[KEY];
};

/**
 * Register the edit-view replacement resolver — call it ONCE, from your admin app's
 * `register()` (before anything renders). The resolver runs per CM edit route; return
 * a component (it receives the route info as props) to replace the stock view for
 * that route, or `undefined` to keep stock. Pass `null` to clear.
 *
 * ```tsx
 * setEditViewReplacement((route) =>
 *   route.model === 'api::article.article' && !route.isClone ? MyArticleEditor : undefined
 * );
 * ```
 */
export function setEditViewReplacement(resolver: EditViewReplacementResolver | null): void {
  const registry = getRegistry();
  if (resolver && registry.resolver) {
    // eslint-disable-next-line no-console
    console.warn(
      '[strapi-plugin-breakout-kit] setEditViewReplacement called more than once — the previous resolver is replaced. Compose a single resolver if multiple views need replacing.'
    );
  }
  registry.resolver = resolver;
}
