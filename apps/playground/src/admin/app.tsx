import { Magic } from '@strapi/icons';
import type { StrapiApp } from '@strapi/strapi/admin';

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
