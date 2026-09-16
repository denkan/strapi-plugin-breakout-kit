/**
 * Layer 1: Access.
 *
 * Adapters to Strapi internals. This is the only layer allowed to reach into
 * Strapi's internal code and state; it exposes a small, typed interface that
 * the data layer consumes. Every internal dependency used here must be
 * recorded in drift/manifest.json.
 *
 * Implemented in Phase 2, after the Phase 1 research is approved.
 */
export {};
