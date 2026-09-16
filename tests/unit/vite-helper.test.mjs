import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { headlessContentManager } = require('strapi-plugin-headless-content-manager/vite');

const cmRoot = path.dirname(require.resolve('@strapi/content-manager/package.json'));
const shimTarget = path.join(cmRoot, 'dist/admin/hooks/useDocumentContext.mjs');

const makePlugin = () => {
  const plugin = headlessContentManager();
  plugin.configResolved({ root: process.cwd() });
  return plugin;
};

describe('headlessContentManager vite plugin', () => {
  it('resolves deep content-manager specifiers to real files', () => {
    const plugin = makePlugin();
    const resolved = plugin.resolveId(
      '@strapi/content-manager/dist/admin/pages/EditView/components/InputRenderer.mjs',
      undefined
    );
    expect(resolved).toBe(
      path.join(cmRoot, 'dist/admin/pages/EditView/components/InputRenderer.mjs')
    );
  });

  it('redirects the deep specifier for useDocumentContext to the shim', () => {
    const plugin = makePlugin();
    const resolved = plugin.resolveId(
      '@strapi/content-manager/dist/admin/hooks/useDocumentContext.mjs',
      undefined
    );
    expect(resolved).toMatch(/vite[\\/]runtime[\\/]useDocumentContext\.mjs$/);
    expect(resolved).not.toBe(shimTarget);
  });

  it('redirects relative imports of useDocumentContext from inside content-manager', () => {
    const plugin = makePlugin();
    const importer = path.join(
      cmRoot,
      'dist/admin/pages/EditView/components/InputRenderer.mjs'
    );
    const resolved = plugin.resolveId('../../../hooks/useDocumentContext.mjs', importer);
    expect(resolved).toMatch(/vite[\\/]runtime[\\/]useDocumentContext\.mjs$/);
  });

  it('leaves unrelated relative imports alone', () => {
    const plugin = makePlugin();
    const importer = path.join(cmRoot, 'dist/admin/hooks/useDocumentContext.mjs');
    expect(plugin.resolveId('./useDocument.mjs', importer)).toBeNull();
    expect(plugin.resolveId('react', importer)).toBeNull();
  });

  it('keeps the esbuild resolver rules in optimizeDeps and pins the plugin entry', () => {
    const plugin = makePlugin();
    const config = plugin.config();
    expect(config.optimizeDeps.include).toContain(
      'strapi-plugin-headless-content-manager/strapi-admin'
    );
    expect(config.optimizeDeps.esbuildOptions.plugins).toHaveLength(1);
  });
});
