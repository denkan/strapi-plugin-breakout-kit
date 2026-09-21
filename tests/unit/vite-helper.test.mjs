import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { breakoutKit } = require('strapi-plugin-breakout-kit/vite');

const cmRoot = path.dirname(require.resolve('@strapi/content-manager/package.json'));
const shimTarget = path.join(cmRoot, 'dist/admin/hooks/useDocumentContext.mjs');

const makePlugin = () => {
  const plugin = breakoutKit();
  plugin.configResolved({ root: process.cwd() });
  return plugin;
};

describe('breakoutKit vite plugin', () => {
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

  it('redirects useDocument.mjs (useDoc wrapper) and honours the ?bk-original escape', () => {
    const plugin = makePlugin();
    const importer = path.join(cmRoot, 'dist/admin/pages/EditView/EditViewPage.mjs');
    expect(plugin.resolveId('../../hooks/useDocument.mjs', importer)).toMatch(
      /vite[\\/]runtime[\\/]useDocument\.mjs$/
    );
    expect(
      plugin.resolveId(
        '@strapi/content-manager/dist/admin/hooks/useDocument.mjs?bk-original',
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
    // ?bk-original escape still reaches the upstream module
    expect(
      plugin.resolveId(
        '@strapi/content-manager/dist/admin/pages/EditView/components/FormInputs/DynamicZone/Field.mjs?bk-original',
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
    expect(plugin.resolveId(`${repeatable}?bk-original`, undefined)).toBe(
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
    expect(plugin.resolveId(`${input}?bk-original`, undefined)).toBe(
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
    expect(plugin.resolveId(`${editView}?bk-original`, undefined)).toBe(
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
    // The shim itself reaches the original through the ?bk-original suffix.
    expect(
      plugin.resolveId(
        '@strapi/content-manager/dist/admin/hooks/useContentTypeSchema.mjs?bk-original',
        undefined
      )
    ).toBe(path.join(cmRoot, 'dist/admin/hooks/useContentTypeSchema.mjs'));
  });

  it('applies singleton entry pins only for dependency-graph importers', () => {
    const plugin = makePlugin();
    const adminRoot = path.dirname(require.resolve('@strapi/admin/package.json'));
    const nodeModulesImporter = path.join(adminRoot, 'dist/admin/index.mjs');
    const pluginImporter = require.resolve('strapi-plugin-breakout-kit/vite');
    const appSourceImporter = path.join(process.cwd(), 'apps/playground/src/admin/app.tsx');

    for (const source of ['@strapi/admin/strapi-admin', 'react-intl']) {
      // Importers inside the dependency graph get the pinned singleton…
      expect(plugin.resolveId(source, nodeModulesImporter)).toEqual(expect.any(String));
      // …including this package itself when workspace-linked (no node_modules in path).
      expect(plugin.resolveId(source, pluginImporter)).toEqual(expect.any(String));
      // APP-SOURCE importers must fall through to Vite's resolver + dep optimizer:
      // pinning here serves the whole admin shell as raw modules and breaks CJS deps
      // (react-intl "does not provide an export named 'useIntl'").
      expect(plugin.resolveId(source, appSourceImporter)).toBeNull();
      expect(plugin.resolveId(source, undefined)).toBeNull();
    }
  });

  it('declaration files declare exactly the runtime exports (both .d.ts and .d.cts)', async () => {
    // Regression: the 0.8.0 rename missed index.d.cts — the declaration TypeScript
    // pairs with the CJS index.cjs under moduleResolution bundler/node16 — so
    // consumers were still typed against headlessContentManager.
    const { readFile } = await import('node:fs/promises');
    const viteDir = path.dirname(require.resolve('strapi-plugin-breakout-kit/vite'));
    const runtimeExports = Object.keys(require('strapi-plugin-breakout-kit/vite')).filter(
      (name) => name !== 'default'
    );
    expect(runtimeExports).toContain('breakoutKit');

    for (const declarationFile of ['index.d.ts', 'index.d.cts']) {
      const source = await readFile(path.join(viteDir, declarationFile), 'utf8');
      for (const name of runtimeExports) {
        expect(source, `${declarationFile} must declare ${name}`).toContain(
          `export declare function ${name}`
        );
      }
      expect(source, `${declarationFile} must not keep pre-rename names`).not.toContain(
        'headlessContentManager'
      );
    }
  });

  it('keeps the esbuild resolver rules in optimizeDeps and pins the plugin entry', () => {
    const plugin = makePlugin();
    const config = plugin.config();
    expect(config.optimizeDeps.include).toContain(
      'strapi-plugin-breakout-kit/strapi-admin'
    );
    expect(config.optimizeDeps.esbuildOptions.plugins).toHaveLength(1);
  });

  it('warns on a consumer optimizeDeps.entries override and stays quiet otherwise', () => {
    // A user-set `entries` REPLACES Vite's default scan (Strapi sets none) and is a
    // reproduced cause of the raw-served-graph prism crashes in `strapi develop`.
    // The helper cannot repair it (appending the generated admin entry does not
    // restore the scan), so it must warn — and never emit entries of its own.
    const plugin = makePlugin();
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (msg) => warnings.push(String(msg));
    try {
      const config = plugin.config({
        optimizeDeps: { entries: ['src/plugins/**/client/**/*.tsx'] },
      });
      expect(config.optimizeDeps).not.toHaveProperty('entries');
      expect(warnings.join('\n')).toContain('optimizeDeps.entries');

      warnings.length = 0;
      for (const userConfig of [undefined, {}, { optimizeDeps: {} }]) {
        expect(plugin.config(userConfig).optimizeDeps).not.toHaveProperty('entries');
      }
      expect(warnings).toEqual([]);
    } finally {
      console.warn = originalWarn;
    }
  });
});
