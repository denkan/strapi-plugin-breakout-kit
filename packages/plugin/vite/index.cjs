'use strict';

/**
 * Vite plugin for the Strapi admin build. Add it to your app's `src/admin/vite.config.ts`:
 *
 * ```ts
 * import { mergeConfig, type UserConfig } from 'vite';
 * import { headlessContentManager } from 'strapi-plugin-headless-content-manager/vite';
 *
 * export default (config: UserConfig) =>
 *   mergeConfig(config, { plugins: [headlessContentManager()] });
 * ```
 *
 * It does two things:
 * 1. Resolves `@strapi/content-manager/dist/...` / `@strapi/admin/dist/...` deep imports to the
 *    actual files (the packages ship unbundled per-module dists, but their exports maps would
 *    otherwise reject deep specifiers).
 * 2. Replaces @strapi/content-manager's internal `hooks/useDocumentContext.mjs` module with a
 *    shim that reads the headless <DocumentProvider> context first and otherwise behaves
 *    identically (same fallback order, same errors) — this is what lets the stock edit-view
 *    input tree run outside the content manager's routes.
 *
 * Note: this file is intentionally CommonJS. Strapi loads `src/admin/vite.config.ts` through
 * esbuild-register in a CJS require chain; ESM files on that path get mangled by the
 * register hook + Node's native require(esm) (evaluated in ES-module scope after a CJS
 * transform). Plain CJS sidesteps that entirely and still `import`s fine from ESM configs.
 */

const path = require('node:path');

const RUNTIME_DIR = path.join(__dirname, 'runtime');

const DEEP_ROOTS = ['@strapi/content-manager', '@strapi/admin'];

const packageRoot = (name, from) =>
  path.dirname(
    require.resolve(`${name}/package.json`, from ? { paths: [from] } : undefined)
  );

/**
 * Suffix that lets a shim import the module it replaces without recursing into itself.
 */
const ORIGINAL_SUFFIX = '?hcm-original';

function headlessContentManager() {
  /** @type {string | undefined} */ let cmRoot;
  /** Map of real CM file path -> replacement shim path. */
  /** @type {Map<string, string>} */ let redirects = new Map();

  const resolveRoots = (rootDir) => {
    cmRoot = packageRoot('@strapi/content-manager', rootDir);
    const hooksDir = path.join(cmRoot, 'dist', 'admin', 'hooks');
    redirects = new Map([
      // Seam 2 (docs/research/findings.md §5): context-first document resolution.
      [path.join(hooksDir, 'useDocumentContext.mjs'), path.join(RUNTIME_DIR, 'useDocumentContext.mjs')],
      // Seam 1: useDoc gains the headless context as fallback for URL params
      // (consumed directly by e.g. the relation modal's RootRelationRenderer).
      [path.join(hooksDir, 'useDocument.mjs'), path.join(RUNTIME_DIR, 'useDocument.mjs')],
    ]);
  };

  /**
   * Dev-mode twin of the resolveId hook below. Vite prebundles node_modules deps
   * (including @strapi/content-manager and this plugin's admin bundle) with esbuild,
   * which bypasses Vite plugins — so the same two resolution rules are injected into
   * the dep optimizer. Excluding the package from the prebundle instead is not viable:
   * its raw-served graph then hits alias-resolved CJS deps (e.g. react-redux →
   * hoist-non-react-statics) that break as native ESM.
   */
  const esbuildResolver = {
    name: 'headless-content-manager',
    setup(build) {
      build.onResolve({ filter: /^@strapi\/(content-manager|admin)\/dist\// }, (args) => {
        if (!cmRoot) resolveRoots(process.cwd());
        const isOriginal = args.path.endsWith(ORIGINAL_SUFFIX);
        const spec = isOriginal ? args.path.slice(0, -ORIGINAL_SUFFIX.length) : args.path;
        const root = spec.startsWith('@strapi/content-manager')
          ? '@strapi/content-manager'
          : '@strapi/admin';
        const abs = path.join(packageRoot(root, args.resolveDir), spec.slice(root.length + 1));
        if (isOriginal) return { path: abs };
        return { path: redirects.get(abs) ?? abs };
      });
      build.onResolve({ filter: /useDocument(Context)?\.mjs$/ }, (args) => {
        if (!args.path.startsWith('.')) return null;
        if (!cmRoot) resolveRoots(process.cwd());
        const abs = path.resolve(args.resolveDir, args.path);
        const shim = redirects.get(abs);
        return shim ? { path: shim } : null;
      });
    },
  };

  return {
    name: 'headless-content-manager',
    enforce: 'pre',
    config() {
      return {
        optimizeDeps: {
          // Make this plugin's admin bundle a dep-optimize ENTRY (like Strapi does for
          // node_modules plugins such as @strapi/plugin-cloud). All entries share one
          // esbuild run with code splitting, so our deep-imported content-manager
          // modules land in the same shared chunks as the stock admin's copy — one
          // module instance for contexts/registries. Serving our graph as source
          // instead would create parallel CM module copies and trigger runtime dep
          // re-discovery (observed: duplicated prismjs core crashing the admin).
          include: ['strapi-plugin-headless-content-manager/strapi-admin'],
          esbuildOptions: {
            plugins: [esbuildResolver],
          },
        },
      };
    },
    configResolved(config) {
      resolveRoots(config.root);
    },
    resolveId(source, importer) {
      if (!cmRoot) resolveRoots(process.cwd());

      // 1. Deep specifiers past the exports map: @scope/name/dist/... -> <pkg root>/dist/...
      //    A trailing ?hcm-original suffix resolves to the real file (used by the shims).
      for (const root of DEEP_ROOTS) {
        if (source.startsWith(`${root}/dist/`)) {
          const isOriginal = source.endsWith(ORIGINAL_SUFFIX);
          const spec = isOriginal ? source.slice(0, -ORIGINAL_SUFFIX.length) : source;
          const abs = path.join(
            packageRoot(root, importer ? path.dirname(importer.split('?')[0]) : undefined),
            spec.slice(root.length + 1)
          );
          if (isOriginal) return abs;
          return redirects.get(abs) ?? abs;
        }
      }

      // 2. Relative imports inside @strapi/content-manager that resolve to a module we
      //    replace — every internal consumer gets the shim, keeping one module instance.
      if (
        importer &&
        (source.startsWith('./') || source.startsWith('../')) &&
        (source.endsWith('useDocumentContext.mjs') || source.endsWith('useDocument.mjs'))
      ) {
        const abs = path.resolve(path.dirname(importer.split('?')[0]), source);
        const shim = redirects.get(abs);
        if (shim) return shim;
      }

      return null;
    },
  };
}

module.exports = { headlessContentManager, default: headlessContentManager };
