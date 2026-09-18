# Recursive dynamic zones

> Nested / self-referencing dynamic zones — a component whose dynamic zone can contain
> the component itself. Stock Strapi crashes on such schemas; with this plugin installed
> they work end to end: render, edit, save, publish, history.

## What Strapi does today

Strapi's content-type builder never offers a dynamic zone inside a component, but the
server happily *loads* a hand-written schema that has one — and even one that references
itself. What actually breaks is every place that walks the component graph eagerly with
no cycle guard:

| Code path | Crashes when |
| --- | --- |
| `extractContentTypeComponents` (CM admin) | the edit view renders (`RangeError: Maximum call stack size exceeded`) |
| `getDeepPopulate` (CM server) | any document is fetched in the content manager |
| `getPopulateForValidation`, `getDeepPopulateDraftCount` (CM server) | publish / draft counts |
| `getDeepPopulate` (`@strapi/core` document service) | publish, discard, webhook payloads |
| `getNestedPopulateOfNonLocalizedAttributes` (i18n) | any save of a localized entry |
| history service `getDeepPopulate` (CM server, EE) | content-history versions are recorded |

The caches some of these keep are only written *after* the recursion completes, so they
never break a cycle.

## What the plugin does

- **Admin:** the Vite helper alias-replaces `hooks/useContentTypeSchema.mjs` with a
  cycle-safe mirror (each component is expanded once). Everything below it — layouts,
  the dynamic zone field, validation (`yup.lazy`, data-driven) — already handles nested
  data fine.
- **Server:** at the plugin's `register` phase, the functions above are replaced in
  place on the loaded modules (or on the cached service instance, for i18n) with
  cycle-safe mirrors. Consumers all call through CJS namespace objects, so the patch
  reaches every call site.

On **acyclic** schemas every mirror produces byte-identical output to upstream — the
patches are behavior-neutral unless your schema actually has a cycle. All mirrors are
drift-tracked (`cm-server-populate-utils`, `cm-server-history-utils`,
`core-document-service-populate`, `i18n-content-types-service`,
`cm-use-content-type-schema` in `drift/manifest.json`).

## Writing a recursive schema

The content-type builder UI won't create one; edit the component JSON by hand
(`src/components/<category>/<name>.json`):

```jsonc
// src/components/shared/wrapper.json
{
  "collectionName": "components_shared_wrappers",
  "info": { "displayName": "Wrapper", "icon": "blocks" },
  "attributes": {
    "backgroundColor": { "type": "string" },
    "content": {
      "type": "dynamiczone",
      "components": ["shared.link", "shared.quote", "shared.wrapper"]
    }
  }
}
```

…and list the component in a content type's dynamic zone as usual. Restart Strapi after
editing schemas.

## Configuration

`config/plugins.ts`:

```ts
export default {
  'breakout-kit': {
    enabled: true,
    config: {
      recursiveDynamicZones: {
        enabled: true, // set false to skip the server patches entirely
        maxDepth: 10,  // max repetitions of the SAME component along one nesting chain
      },
    },
  },
};
```

`maxDepth` bounds how deep the populate trees follow a cycle: editors can nest a
recursive component up to `maxDepth` levels and have the content fetched, validated and
recorded in history. It exists because a populate tree over a cyclic graph is infinite
in principle and has to be cut somewhere.

## Caveats

- **Content deeper than `maxDepth` is not fetched.** Since the admin sends the full
  document back on save, content nested beyond `maxDepth` would be lost on the next
  save. The default (10) is far deeper than editors realistically nest; raise it if
  your content genuinely goes deeper.
- **Don't open the recursive component in the content-type builder UI** — the CTB has
  its own assumptions about component graphs and is not covered by these patches. Edit
  the JSON by hand.
- The REST/GraphQL content APIs serve nested data normally (REST populate is
  request-driven; GraphQL types reference each other lazily), but exhaustive coverage
  of those plugins is not part of the contract suite.
- The content-history patch only matters on EE licenses with content history enabled;
  on CE it is inert.
