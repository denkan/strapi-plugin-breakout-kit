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
/** This package's root — importer paths land here (not in node_modules) when the
 * plugin is workspace-linked (e.g. the repo playground). */
const PACKAGE_ROOT = path.join(__dirname, '..');

/**
 * True when a module path belongs to the dependency graph rather than app source:
 * anything under a node_modules directory, plus this package itself when linked.
 */
const isDependencyModule = (importer) => {
  const file = importer.split('?')[0];
  return file.includes(`${path.sep}node_modules${path.sep}`) || file.startsWith(PACKAGE_ROOT);
};

const DEEP_ROOTS = ['@strapi/content-manager', '@strapi/admin'];

/** One warning per offending file — the graph re-resolves constantly in dev. */
const warnedDeepImporters = new Set();

/**
 * Tripwires for the dev server serving the CM/admin graph RAW. Pre-bundled code never
 * reaches the rollup resolveId hook (relative imports inside a prebundled dep are
 * resolved by esbuild at optimize time), so seeing (a) an importer that lives inside
 * the @strapi/content-manager or @strapi/admin dist tree, or (b) a prismjs specifier,
 * in resolveId during `vite serve` PROVES the graph escaped the pre-bundle — the
 * downstream crash is misleading (prism "Cannot convert undefined or null to object",
 * react-intl "does not provide an export named 'useIntl'", "setting 'comment'",
 * "useRBAC must be used within Auth"), so name the entry point here instead.
 */
let warnedRawGraph = false;
const warnRawGraphTraversal = (importer, source, cmRoot, adminRoot) => {
  if (warnedRawGraph) return;
  warnedRawGraph = true;
  const file = importer.split('?')[0];
  const which = cmRoot && file.startsWith(cmRoot) ? '@strapi/content-manager' : '@strapi/admin';
  // eslint-disable-next-line no-console
  console.warn(
    `\n[breakout-kit] RAW GRAPH: the ${which} module graph is being served by the Vite ` +
      `dev server OUTSIDE the dependency pre-bundle.\n` +
      `  First seen: ${file}\n` +
      `  importing:  "${source}"\n` +
      `  Pre-bundled code never reaches the dev resolver, so something pulled this graph ` +
      `out of the pre-bundle. Module singletons split and the admin crashes downstream ` +
      `with a misleading error (prism "Cannot convert undefined or null to object", ` +
      `react-intl "does not provide an export named 'useIntl'", "setting 'comment'", ` +
      `"useRBAC must be used within Auth").\n` +
      `  Common causes: an \`optimizeDeps.entries\` override in src/admin/vite.config.ts ` +
      `replacing Vite's default scan; a dependency listed in \`optimizeDeps.exclude\` that ` +
      `imports @strapi internals; app source deep-importing dist paths.\n`
  );
};
let warnedRawPrism = false;
const warnRawPrism = (importer, source) => {
  if (warnedRawPrism) return;
  warnedRawPrism = true;
  const file = importer ? importer.split('?')[0] : '(unknown importer)';
  // eslint-disable-next-line no-console
  console.warn(
    `\n[breakout-kit] RAW PRISM: "${source}" is being resolved by the Vite dev server, ` +
      `so it will be served raw, outside the pre-bundle.\n` +
      `  Importer: ${file}\n` +
      `  A raw prismjs copy lacks the languages registered on the pre-bundled copy — ` +
      `expect "Cannot convert undefined or null to object" in prism-*.js. The importer ` +
      `named above is itself being served raw; fix why IT escaped the pre-bundle.\n`
  );
};
const warnAppSourceDeepImport = (importer, source) => {
  const file = importer.split('?')[0];
  if (warnedDeepImporters.has(file)) return;
  warnedDeepImporters.add(file);
  // eslint-disable-next-line no-console
  console.warn(
    `\n[breakout-kit] ${file}\n` +
      `  deep-imports "${source}" from APP SOURCE. Deep @strapi/content-manager / ` +
      `@strapi/admin dist imports cannot join the admin's pre-bundled dependency graph ` +
      `when they come from app source — the graph is served raw and module singletons ` +
      `split, crashing the admin with misleading downstream errors (react-intl ` +
      `"does not provide an export named 'useIntl'", prism-tsx "Cannot convert ` +
      `undefined or null to object", "Cannot set properties of undefined (setting 'comment')", ` +
      `"useRBAC must be used within Auth").\n` +
      `  Fix: import what you need from "strapi-plugin-breakout-kit/strapi-admin" instead.\n`
  );
};

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
  /** True during `vite serve` — the raw-graph tripwires only apply to the dev server. */
  let devServe = false;
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
    config(userConfig) {
      // A user-set `optimizeDeps.entries` REPLACES Vite's default entry scan (Strapi's
      // own config sets no entries), de-syncing the dep optimizer from the admin graph:
      // parts of the CM graph then miss the pre-bundle in dev and get served raw.
      // Reproduced deterministically (pnpm workspace + local plugin): with an entries
      // override the admin dies in prism language components ("Cannot convert undefined
      // or null to object", "setting 'triple-quoted-string'"); removing it fixes it.
      // Appending the generated admin entry (.strapi/client/index.html) does NOT help —
      // so warn instead of pretending to fix.
      if (userConfig?.optimizeDeps?.entries) {
        // eslint-disable-next-line no-console
        console.warn(
          '\n[breakout-kit] src/admin vite config sets `optimizeDeps.entries`. This ' +
            'REPLACES Vite’s default entry scan and is known to break the admin in ' +
            '`strapi develop` (raw-served @strapi graph; prism "Cannot convert undefined ' +
            'or null to object" and similar crashes). Remove the `entries` override; to ' +
            'pre-bundle heavy lazy-loaded deps, list the packages in ' +
            '`optimizeDeps.include` instead.\n'
        );
      }
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
      devServe = config.command === 'serve';
      resolveRoots(config.root);
    },
    resolveId(source, importer) {
      if (!cmRoot) resolveRoots(process.cwd());

      // Raw-graph tripwires (dev server only; see warnRawGraphTraversal/warnRawPrism).
      if (devServe && importer) {
        const importerFile = importer.split('?')[0];
        if (
          (cmRoot && importerFile.startsWith(cmRoot)) ||
          (adminRoot && importerFile.startsWith(adminRoot))
        ) {
          warnRawGraphTraversal(importer, source, cmRoot, adminRoot);
        }
        if (source === 'prismjs' || source.startsWith('prismjs/')) {
          warnRawPrism(importer, source);
        }
      }

      // 0. Singleton entry pins (see entryAliases above) — but ONLY for importers
      //    inside the dependency graph (node_modules, or this package when linked).
      //    APP-SOURCE importers must fall through to Vite's own resolver: a local
      //    plugin's `import { useNotification } from '@strapi/admin/strapi-admin'`
      //    is project source, and returning an absolute path here bypasses the dep
      //    optimizer, serving the entire admin shell as raw transformed modules —
      //    where CJS deps break (react-intl: "does not provide an export named
      //    'useIntl'"). Vite's optimizer already routes bare imports from source to
      //    the pre-bundled instance, so identity is preserved without the pin.
      const pinned = entryAliases.get(source);
      if (pinned && importer && isDependencyModule(importer)) return pinned;

      // 1. Deep specifiers past the exports map: @scope/name/dist/... -> <pkg root>/dist/...
      //    A trailing ?bk-original suffix resolves to the real file (used by the shims).
      for (const root of DEEP_ROOTS) {
        if (source.startsWith(`${root}/dist/`)) {
          // Deep dist imports are only safe from inside the dependency graph, where the
          // dep optimizer bundles them into the same chunks as the stock admin. From APP
          // SOURCE they are served raw and drag the whole CM/admin graph out of the
          // prebundle — module singletons split and the admin dies somewhere downstream
          // with a cryptic error (react-intl "does not provide an export named 'useIntl'",
          // prism-tsx "Cannot convert undefined or null to object", "setting 'comment'",
          // "useRBAC must be used within Auth"). Resolve it anyway (don't break builds),
          // but say what is actually wrong and where.
          if (importer && !isDependencyModule(importer)) {
            warnAppSourceDeepImport(importer, source);
          }
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
