import path from 'node:path';
import { createRequire } from 'node:module';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);
const cmRoot = path.dirname(require.resolve('@strapi/content-manager/package.json'));
const adminRoot = path.dirname(require.resolve('@strapi/admin/package.json'));

export default defineConfig({
  resolve: {
    // Same deep-specifier resolution the plugin's Vite helper provides in the admin
    // build: @strapi packages ship unbundled per-module dists whose exports maps
    // reject deep paths.
    alias: [
      { find: /^@strapi\/content-manager\/dist\//, replacement: `${cmRoot}/dist/` },
      { find: /^@strapi\/admin\/dist\//, replacement: `${adminRoot}/dist/` },
    ],
  },
});
