import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { headlessContentManager } = require('strapi-plugin-breakout-kit/vite');

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

  it('redirects useDocument.mjs (useDoc wrapper) and honours the ?hcm-original escape', () => {
    const plugin = makePlugin();
    const importer = path.join(cmRoot, 'dist/admin/pages/EditView/EditViewPage.mjs');
    expect(plugin.resolveId('../../hooks/useDocument.mjs', importer)).toMatch(
      /vite[\\/]runtime[\\/]useDocument\.mjs$/
    );
    expect(
      plugin.resolveId(
        '@strapi/content-manager/dist/admin/hooks/useDocument.mjs?hcm-original',
        undefined
      )
    ).toBe(path.join(cmRoot, 'dist/admin/hooks/useDocument.mjs'));
  });

  it('redirects the dynamic-zone Field.mjs to the vendored module (issue #4)', () => {
    const plugin = makePlugin();
    const dzDir = path.join(
      cmRoot,
      'dist/admin/pages/EditView/components/FormInputs/DynamicZone'
    );
    // Deep specifier
    expect(
      plugin.resolveId(
        '@strapi/content-manager/dist/admin/pages/EditView/components/FormInputs/DynamicZone/Field.mjs',
        undefined
      )
    ).toMatch(/vite[\\/]runtime[\\/]DynamicZone[\\/]Field\.mjs$/);
    // Relative import from inside content-manager (how the stock CM loads it)
    const importer = path.join(
      cmRoot,
      'dist/admin/pages/EditView/components/InputRenderer.mjs'
    );
    expect(plugin.resolveId('./FormInputs/DynamicZone/Field.mjs', importer)).toMatch(
      /vite[\\/]runtime[\\/]DynamicZone[\\/]Field\.mjs$/
    );
    // ?hcm-original escape still reaches the upstream module
    expect(
      plugin.resolveId(
        '@strapi/content-manager/dist/admin/pages/EditView/components/FormInputs/DynamicZone/Field.mjs?hcm-original',
        undefined
      )
    ).toBe(path.join(dzDir, 'Field.mjs'));
  });

  it('redirects Component/Repeatable.mjs to the vendored module (issue #10)', () => {
    const plugin = makePlugin();
    const repeatable =
      '@strapi/content-manager/dist/admin/pages/EditView/components/FormInputs/Component/Repeatable.mjs';
    expect(plugin.resolveId(repeatable, undefined)).toMatch(
      /vite[\\/]runtime[\\/]Component[\\/]Repeatable\.mjs$/
    );
    const importer = path.join(
      cmRoot,
      'dist/admin/pages/EditView/components/FormInputs/InputRenderer.mjs'
    );
    expect(plugin.resolveId('./Component/Repeatable.mjs', importer)).toMatch(
      /vite[\\/]runtime[\\/]Component[\\/]Repeatable\.mjs$/
    );
    expect(plugin.resolveId(`${repeatable}?hcm-original`, undefined)).toBe(
      path.join(cmRoot, 'dist/admin/pages/EditView/components/FormInputs/Component/Repeatable.mjs')
    );
  });

  it('redirects Component/Input.mjs to the vendored module (single-component renderBox)', () => {
    const plugin = makePlugin();
    const input =
      '@strapi/content-manager/dist/admin/pages/EditView/components/FormInputs/Component/Input.mjs';
    expect(plugin.resolveId(input, undefined)).toMatch(
      /vite[\\/]runtime[\\/]Component[\\/]Input\.mjs$/
    );
    // Relative import from InputRenderer (the stock consumer)
    const importer = path.join(cmRoot, 'dist/admin/pages/EditView/components/InputRenderer.mjs');
    expect(plugin.resolveId('./FormInputs/Component/Input.mjs', importer)).toMatch(
      /vite[\\/]runtime[\\/]Component[\\/]Input\.mjs$/
    );
    expect(plugin.resolveId(`${input}?hcm-original`, undefined)).toBe(
      path.join(cmRoot, 'dist/admin/pages/EditView/components/FormInputs/Component/Input.mjs')
    );
    // BlocksInput.mjs also ends with "Input.mjs" — must stay untouched.
    expect(
      plugin.resolveId(
        '@strapi/content-manager/dist/admin/pages/EditView/components/FormInputs/BlocksInput/BlocksInput.mjs',
        undefined
      )
    ).toBe(
      path.join(cmRoot, 'dist/admin/pages/EditView/components/FormInputs/BlocksInput/BlocksInput.mjs')
    );
    expect(plugin.resolveId('./FormInputs/BlocksInput/BlocksInput.mjs', importer)).toBeNull();
  });

  it('redirects EditViewPage.mjs to the replacement wrapper', () => {
    const plugin = makePlugin();
    const editView =
      '@strapi/content-manager/dist/admin/pages/EditView/EditViewPage.mjs';
    expect(plugin.resolveId(editView, undefined)).toMatch(
      /vite[\\/]runtime[\\/]EditViewPage\.mjs$/
    );
    // The router lazy-imports it relatively.
    const importer = path.join(cmRoot, 'dist/admin/router.mjs');
    expect(plugin.resolveId('./pages/EditView/EditViewPage.mjs', importer)).toMatch(
      /vite[\\/]runtime[\\/]EditViewPage\.mjs$/
    );
    expect(plugin.resolveId(`${editView}?hcm-original`, undefined)).toBe(
      path.join(cmRoot, 'dist/admin/pages/EditView/EditViewPage.mjs')
    );
  });

  it('does NOT redirect NonRepeatable.mjs despite the suffix collision', () => {
    const plugin = makePlugin();
    const nonRepeatable = path.join(
      cmRoot,
      'dist/admin/pages/EditView/components/FormInputs/Component/NonRepeatable.mjs'
    );
    expect(
      plugin.resolveId(
        '@strapi/content-manager/dist/admin/pages/EditView/components/FormInputs/Component/NonRepeatable.mjs',
        undefined
      )
    ).toBe(nonRepeatable);
    const importer = path.join(
      cmRoot,
      'dist/admin/pages/EditView/components/FormInputs/InputRenderer.mjs'
    );
    expect(plugin.resolveId('./Component/NonRepeatable.mjs', importer)).toBeNull();
  });

  it('does NOT redirect other modules named Field.mjs (e.g. Wysiwyg)', () => {
    const plugin = makePlugin();
    const wysiwygField = path.join(
      cmRoot,
      'dist/admin/pages/EditView/components/FormInputs/Wysiwyg/Field.mjs'
    );
    expect(
      plugin.resolveId(
        '@strapi/content-manager/dist/admin/pages/EditView/components/FormInputs/Wysiwyg/Field.mjs',
        undefined
      )
    ).toBe(wysiwygField);
    const importer = path.join(
      cmRoot,
      'dist/admin/pages/EditView/components/InputRenderer.mjs'
    );
    expect(plugin.resolveId('./FormInputs/Wysiwyg/Field.mjs', importer)).toBeNull();
  });

  it('leaves unrelated relative imports alone', () => {
    const plugin = makePlugin();
    const importer = path.join(cmRoot, 'dist/admin/hooks/useDocumentContext.mjs');
    expect(plugin.resolveId('./useDebounce.mjs', importer)).toBeNull();
    expect(plugin.resolveId('react', importer)).toBeNull();
  });

  it('redirects useContentTypeSchema (deep and relative) to the cycle-safe shim', () => {
    const plugin = makePlugin();
    const shim = /vite[\\/]runtime[\\/]useContentTypeSchema\.mjs$/;
    expect(
      plugin.resolveId('@strapi/content-manager/dist/admin/hooks/useContentTypeSchema.mjs', undefined)
    ).toMatch(shim);
    const importer = path.join(cmRoot, 'dist/admin/pages/ComponentConfigurationPage.mjs');
    expect(plugin.resolveId('../hooks/useContentTypeSchema.mjs', importer)).toMatch(shim);
    // The shim itself reaches the original through the ?hcm-original suffix.
    expect(
      plugin.resolveId(
        '@strapi/content-manager/dist/admin/hooks/useContentTypeSchema.mjs?hcm-original',
        undefined
      )
    ).toBe(path.join(cmRoot, 'dist/admin/hooks/useContentTypeSchema.mjs'));
  });

  it('keeps the esbuild resolver rules in optimizeDeps and pins the plugin entry', () => {
    const plugin = makePlugin();
    const config = plugin.config();
    expect(config.optimizeDeps.include).toContain(
      'strapi-plugin-breakout-kit/strapi-admin'
    );
    expect(config.optimizeDeps.esbuildOptions.plugins).toHaveLength(1);
  });
});
