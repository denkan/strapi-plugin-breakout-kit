# Installation

> Applies to Strapi v5 apps using the default Vite-based admin build.

```bash
npm install strapi-plugin-breakout-kit
```

## 1. Enable the plugin

`config/plugins.ts`:

```ts
export default {
  'breakout-kit': { enabled: true },
};
```

## 2. Add the Vite helper (required)

The plugin reuses the content manager's own edit-view internals, which Strapi ships as
individually importable files but does not expose through its package exports. A small Vite
plugin resolves those imports and installs a behavior-identical shim for one internal hook so
the edit view can run outside the content manager's routes.

`src/admin/vite.config.ts`:

```ts
import { mergeConfig, type UserConfig } from 'vite';
import { breakoutKit } from 'strapi-plugin-breakout-kit/vite';

export default (config: UserConfig) =>
  mergeConfig(config, { plugins: [breakoutKit()] });
```

Without this, the admin build fails to resolve the plugin's imports. The stock content
manager is unaffected by the helper (covered by the plugin's contract tests).

> Maintainer note (docs/decisions.md #1): the one-line config is the accepted trade-off for
> now; if it proves to be a friction point for consumers we may revisit vendoring instead.
