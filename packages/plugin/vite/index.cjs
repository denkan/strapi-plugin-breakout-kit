'use strict';

/**
 * Vite plugin for the Strapi admin build. Add it to your app's `src/admin/vite.config.ts`:
 *
 * ```ts
 * import { mergeConfig, type UserConfig } from 'vite';
 * import { breakoutKit } from 'strapi-plugin-breakout-kit/vite';
 *
 * export default (config: UserConfig) =>
 *   mergeConfig(config, { plugins: [breakoutKit()] });
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
const ORIGINAL_SUFFIX = '?bk-original';

/** Resolves a package's exports-map subpath ('.' or './sub') to an absolute file. */
const resolveExportFile = (pkgRoot, subpath) => {
  const pkg = require(path.join(pkgRoot, 'package.json'));
  const entry = pkg.exports?.[subpath];
  const rel =
    typeof entry === 'string' ? entry : (entry?.import ?? entry?.default ?? entry?.require);
  return rel ? path.join(pkgRoot, rel) : undefined;
};

function breakoutKit() {
  /** @type {string | undefined} */ let cmRoot;
  /** @type {string | undefined} */ let adminRoot;
  /** Map of real CM file path -> replacement shim path. */
  /** @type {Map<string, string>} */ let redirects = new Map();
  /**
   * Exact bare specifiers pinned to the copies in @strapi/strapi's OWN dependency
   * closure. npm can install duplicate copies of these next to the app (e.g. a newer
   * @strapi/admin satisfying peer ranges); if the plugin's imports resolved there while
   * the admin shell bundles the nested copy, React contexts and registries would split
   * into two instances ("useRBAC must be used within Auth" and friends).
   * @type {Map<string, string>}
   */ let entryAliases = new Map();

  const resolveRoots = (rootDir) => {
    // Anchor everything in the same closure the admin shell is built from.
    const strapiRoot = packageRoot('@strapi/strapi', rootDir);
    adminRoot = packageRoot('@strapi/admin', strapiRoot);
    cmRoot = packageRoot('@strapi/content-manager', strapiRoot);

    const hooksDir = path.join(cmRoot, 'dist', 'admin', 'hooks');
    redirects = new Map([
      // Seam 2 (docs/research/findings.md §5): context-first document resolution.
      [path.join(hooksDir, 'useDocumentContext.mjs'), path.join(RUNTIME_DIR, 'useDocumentContext.mjs')],
      // Seam 1: useDoc gains the headless context as fallback for URL params
      // (consumed directly by e.g. the relation modal's RootRelationRenderer).
      [path.join(hooksDir, 'useDocument.mjs'), path.join(RUNTIME_DIR, 'useDocument.mjs')],
      // Recursive dynamic zones: cycle-safe extractContentTypeComponents (the stock
      // walk overflows the stack when a component graph contains a cycle).
      [path.join(hooksDir, 'useContentTypeSchema.mjs'), path.join(RUNTIME_DIR, 'useContentTypeSchema.mjs')],
      // Issue #4: vendored dynamic zone with entry render slots (entry-customization context).
      [
        path.join(cmRoot, 'dist', 'admin', 'pages', 'EditView', 'components', 'FormInputs', 'DynamicZone', 'Field.mjs'),
        path.join(RUNTIME_DIR, 'DynamicZone', 'Field.mjs'),
      ],
      // Issue #10: vendored repeatable component with the same entry render slots.
      [
        path.join(cmRoot, 'dist', 'admin', 'pages', 'EditView', 'components', 'FormInputs', 'Component', 'Repeatable.mjs'),
        path.join(RUNTIME_DIR, 'Component', 'Repeatable.mjs'),
      ],
      // Single-component renderBox seam: vendored ComponentInput (which itself loads the
      // vendored NonRepeatable — its only upstream importer is this module).
      [
        path.join(cmRoot, 'dist', 'admin', 'pages', 'EditView', 'components', 'FormInputs', 'Component', 'Input.mjs'),
        path.join(RUNTIME_DIR, 'Component', 'Input.mjs'),
      ],
      // Edit-view replacement: thin wrapper around the CM route component consulting
      // the consumer-registered resolver (setEditViewReplacement).
      [
        path.join(cmRoot, 'dist', 'admin', 'pages', 'EditView', 'EditViewPage.mjs'),
        path.join(RUNTIME_DIR, 'EditViewPage.mjs'),
      ],
    ]);

    entryAliases = new Map();
    const adminEntry = resolveExportFile(adminRoot, './strapi-admin');
    if (adminEntry) entryAliases.set('@strapi/admin/strapi-admin', adminEntry);
    const adminEe = resolveExportFile(adminRoot, './strapi-admin/ee');
    if (adminEe) entryAliases.set('@strapi/admin/strapi-admin/ee', adminEe);
    const cmEntry = resolveExportFile(cmRoot, './strapi-admin');
    if (cmEntry) entryAliases.set('@strapi/content-manager/strapi-admin', cmEntry);
    try {
      // react-intl is not in Strapi's own singleton alias list; pin it to the admin
      // shell's copy so IntlProvider context stays a single instance.
      entryAliases.set(
        'react-intl',
        require.resolve('react-intl', { paths: [adminRoot] })
      );
    } catch {
      /* react-intl not resolvable from the admin closure — leave default resolution */
    }
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
    name: 'breakout-kit',
    setup(build) {
      build.onResolve({ filter: /^@strapi\/(content-manager|admin)\/dist\// }, (args) => {
        if (!cmRoot) resolveRoots(process.cwd());
        const isOriginal = args.path.endsWith(ORIGINAL_SUFFIX);
        const spec = isOriginal ? args.path.slice(0, -ORIGINAL_SUFFIX.length) : args.path;
        const root = spec.startsWith('@strapi/content-manager')
          ? '@strapi/content-manager'
          : '@strapi/admin';
        const rootDir = root === '@strapi/content-manager' ? cmRoot : adminRoot;
        const abs = path.join(rootDir, spec.slice(root.length + 1));
        if (isOriginal) return { path: abs };
        return { path: redirects.get(abs) ?? abs };
      });
      build.onResolve({ filter: /(useDocument(Context)?|useContentTypeSchema|Field|Repeatable|Input|EditViewPage)\.mjs$/ }, (args) => {
        if (!args.path.startsWith('.')) return null;
        if (!cmRoot) resolveRoots(process.cwd());
        const abs = path.resolve(args.resolveDir, args.path);
        const shim = redirects.get(abs);
        return shim ? { path: shim } : null;
      });
      build.onResolve(
        { filter: /^(@strapi\/(admin|content-manager)\/strapi-admin(\/ee)?|react-intl)$/ },
        (args) => {
          if (!cmRoot) resolveRoots(process.cwd());
          const pinned = entryAliases.get(args.path);
          return pinned ? { path: pinned } : null;
        }
      );
    },
  };

  return {
    name: 'breakout-kit',
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
          include: ['strapi-plugin-breakout-kit/strapi-admin'],
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

      // 0. Singleton entry pins (see entryAliases above).
      const pinned = entryAliases.get(source);
      if (pinned) return pinned;

      // 1. Deep specifiers past the exports map: @scope/name/dist/... -> <pkg root>/dist/...
      //    A trailing ?bk-original suffix resolves to the real file (used by the shims).
      for (const root of DEEP_ROOTS) {
        if (source.startsWith(`${root}/dist/`)) {
          const isOriginal = source.endsWith(ORIGINAL_SUFFIX);
          const spec = isOriginal ? source.slice(0, -ORIGINAL_SUFFIX.length) : source;
          const rootDir = root === '@strapi/content-manager' ? cmRoot : adminRoot;
          const abs = path.join(rootDir, spec.slice(root.length + 1));
          if (isOriginal) return abs;
          return redirects.get(abs) ?? abs;
        }
      }

      // 2. Relative imports inside @strapi/content-manager that resolve to a module we
      //    replace — every internal consumer gets the shim, keeping one module instance.
      if (
        importer &&
        (source.startsWith('./') || source.startsWith('../')) &&
        (source.endsWith('useDocumentContext.mjs') || source.endsWith('useDocument.mjs') || source.endsWith('useContentTypeSchema.mjs') || source.endsWith('Field.mjs') || source.endsWith('Repeatable.mjs') || source.endsWith('Input.mjs') || source.endsWith('EditViewPage.mjs'))
      ) {
        const abs = path.resolve(path.dirname(importer.split('?')[0]), source);
        const shim = redirects.get(abs);
        if (shim) return shim;
      }

      return null;
    },
  };
}

module.exports = { breakoutKit, default: breakoutKit };
