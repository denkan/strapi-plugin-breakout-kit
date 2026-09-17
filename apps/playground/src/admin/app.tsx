import { Magic } from '@strapi/icons';
import type { StrapiApp } from '@strapi/strapi/admin';
import { setEditViewReplacement } from 'strapi-plugin-breakout-kit/strapi-admin';

import { CustomCategoryEditView } from './pages/CustomCategoryEditView';

/**
 * Playground-only admin surface: registers the demo/diagnostics pages for the
 * breakout-kit plugin. These pages are dev/test tooling — they consume the plugin
 * exactly like a real consumer (public exports + the Vite helper) and serve as the
 * Playwright contract-test targets. The published plugin ships NO admin UI.
 */
export default {
  config: {
    locales: [],
  },
  register(app: StrapiApp) {
    // Replace the stock CM edit view for categories only (clones excluded — <EditPage>
    // doesn't cover stock clone semantics); every other model keeps the stock view.
    // The __BK_PARITY_STOCK__ escape exists for the parity contract tests, which need
    // the TRUE stock view as their comparison target (test-environment concern only).
    setEditViewReplacement((route) =>
      route.model === 'api::category.category' &&
      !route.isClone &&
      !(window as unknown as { __BK_PARITY_STOCK__?: boolean }).__BK_PARITY_STOCK__
        ? CustomCategoryEditView
        : undefined
    );
    app.addMenuLink({
      to: 'breakout-playground',
      icon: Magic,
      intlLabel: {
        id: 'breakout-playground.label',
        defaultMessage: 'Breakout Playground',
      },
      Component: async () => {
        const { App } = await import('./pages/App');
        return { default: App };
      },
      permissions: [],
    });
  },
};
