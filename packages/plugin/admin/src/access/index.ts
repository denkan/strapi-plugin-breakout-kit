/**
 * Layer 1: Access — the single interface the data layer consumes.
 *
 * This is the only layer allowed to reach Strapi internals. Split by strategy:
 * - `public`: Strapi's public/typed exports (preferred; includes the `unstable_` hooks
 *   renamed to stable local names)
 * - `internal`: deep imports into the unbundled dist, resolved by the Vite helper
 * - `headless-document-context`: the bridge context shared with the useDocumentContext shim
 *
 * Every dependency in `internal` (plus the shim's source contract) is recorded in
 * drift/manifest.json. Nothing outside this directory may import from `@strapi/*` internals.
 */
export * from './public';
export * from './internal';
export * from './headless-document-context';
