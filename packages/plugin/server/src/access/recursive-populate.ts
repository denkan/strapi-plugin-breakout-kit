/**
 * Recursive dynamic zone support — server side.
 *
 * Strapi's schema-driven populate builders recurse over the component graph with no
 * cycle guard, so a component that (transitively) contains itself — e.g. a component
 * whose dynamic zone lists the component itself — overflows the call stack on every
 * document fetch, publish, draft count and history save. The caches some of them keep
 * are only written AFTER the recursion completes, so they never break a cycle.
 *
 * This module replaces those functions with cycle-safe mirrors. All four dist modules
 * consume them through their CJS namespace objects (`populate.getDeepPopulate(...)`),
 * so replacing the properties on the loaded `module.exports` objects reaches every
 * consumer. Internal recursion inside the originals is closure-local, which is why the
 * functions are reimplemented (drift-tracked mirrors of v5.54.0) rather than wrapped:
 *
 * - @strapi/content-manager dist/server/services/utils/populate.js
 *     getDeepPopulate, getPopulateForValidation, getDeepPopulateDraftCount
 *   (drift: `cm-server-populate-utils`)
 * - @strapi/content-manager dist/server/history/services/utils.js
 *     createServiceUtils — the returned object's private getDeepPopulate
 *   (drift: `cm-server-history-utils`; only runs with an EE content-history license)
 * - @strapi/core dist/services/document-service/utils/populate.js
 *     getDeepPopulate (publish / discard / webhook payloads)
 *   (drift: `core-document-service-populate`)
 *
 * Cycle policy: while building a populate tree, the same schema uid may appear at most
 * `maxDepth` times along one nesting chain (config `recursiveDynamicZones.maxDepth`,
 * default 10); past that the subtree populates as `{}`. On acyclic schemas no uid ever
 * repeats along a chain (a repeat IS a cycle), so with maxDepth >= 2 the output is
 * identical to upstream — the patch is behavior-neutral unless the schema has cycles.
 *
 * Results that involved a cycle cut are depth-dependent, so unlike upstream they are
 * only cached when computed at the top level (empty chain); cycle-free results stay
 * cached exactly like upstream.
 */

import * as path from 'node:path';
import { createRequire } from 'node:module';

import type { Core } from '@strapi/strapi';

type AnyAttribute = any;
type Populate = Record<string, any>;

interface CyclePolicy {
  maxDepth: number;
}

/** Occurrence count of `uid` along the current expansion chain. */
const timesOnPath = (chain: string[], uid: string) =>
  chain.reduce((n, u) => (u === uid ? n + 1 : n), 0);

/**
 * lodash/fp `merge` in upstream getDeepPopulate only ever merges objects with
 * disjoint top-level keys (one attribute name per step), where it degenerates to
 * assignment — mirrored here without the lodash dependency.
 */
const assignDisjoint = (acc: Populate, addition: Populate) => Object.assign(acc, addition);

interface CmPopulateDeps {
  strapi: Core.Strapi;
  /** The @strapi/utils instance from the content-manager's own closure. */
  strapiUtils: any;
  policy: CyclePolicy;
}

/**
 * Cycle-safe mirrors of @strapi/content-manager/dist/server/services/utils/populate.js
 * (v5.54.0): getDeepPopulate, getPopulateForValidation, getDeepPopulateDraftCount.
 * Same signatures, same output on acyclic schemas.
 */
export const createCycleSafeCmPopulateUtils = ({ strapi, strapiUtils, policy }: CmPopulateDeps) => {
  const {
    isVisibleAttribute,
    isScalarAttribute,
    getDoesAttributeRequireValidation,
    isPrivateAttribute,
    hasDraftAndPublish,
  } = strapiUtils.contentTypes;
  const { isAnyToMany } = strapiUtils.relations;
  const { PUBLISHED_AT_ATTRIBUTE } = strapiUtils.contentTypes.constants;

  const isLocalizedContentType = (model: any) =>
    model?.pluginOptions?.i18n?.localized === true;

  /* ------------------------------- getDeepPopulate ------------------------------- */

  const getPopulateForRelation = (
    attribute: AnyAttribute,
    model: any,
    attributeName: string,
    { countMany, countOne, initialPopulate }: any
  ) => {
    const isManyRelation = isAnyToMany(attribute);

    // Use initialPopulate when explicitly provided (including `false` to suppress population)
    if (initialPopulate !== undefined) {
      return initialPopulate;
    }

    // If populating localizations attribute, also include validatable fields
    if (attributeName === 'localizations') {
      const validationPopulate = getPopulateForValidation(model.uid);
      return { populate: validationPopulate.populate };
    }

    // always populate createdBy, updatedBy, localizations etc.
    if (!isVisibleAttribute(model, attributeName)) {
      return true;
    }

    if ((isManyRelation && countMany) || (!isManyRelation && countOne)) {
      return { count: true };
    }

    return true;
  };

  const getPopulateForDZ = (attribute: AnyAttribute, options: any, level: number, chain: string[]) => {
    const populatedComponents = (attribute.components || []).reduce(
      (acc: any, componentUID: string) => ({
        ...acc,
        [componentUID]: {
          populate: deepPopulate(componentUID, options, level + 1, chain),
        },
      }),
      {}
    );

    return { on: populatedComponents };
  };

  const getPopulateFor = (
    attributeName: string,
    model: any,
    options: any,
    level: number,
    chain: string[]
  ): Populate => {
    const attribute = model.attributes[attributeName];

    switch (attribute.type) {
      case 'relation':
        return {
          [attributeName]: getPopulateForRelation(attribute, model, attributeName, options),
        };
      case 'component':
        return {
          [attributeName]: {
            populate: deepPopulate(attribute.component, options, level + 1, chain),
          },
        };
      case 'media':
        return {
          [attributeName]: {
            populate: {
              folder: true,
            },
          },
        };
      case 'dynamiczone':
        return {
          [attributeName]: getPopulateForDZ(attribute, options, level, chain),
        };
      default:
        return {};
    }
  };

  const deepPopulate = (
    uid: string,
    {
      initialPopulate = {} as any,
      countMany = false,
      countOne = false,
      maxLevel = Infinity,
    }: any = {},
    level = 1,
    chain: string[] = []
  ): Populate => {
    if (level > maxLevel) {
      return {};
    }

    if (timesOnPath(chain, uid) >= policy.maxDepth) {
      return {};
    }

    const model = strapi.getModel(uid as any);

    if (!model) {
      return {};
    }

    const nextChain = [...chain, uid];

    return Object.keys(model.attributes).reduce(
      (populateAcc: Populate, attributeName: string) =>
        assignDisjoint(
          populateAcc,
          getPopulateFor(
            attributeName,
            model,
            {
              initialPopulate: initialPopulate?.[attributeName],
              countMany,
              countOne,
              maxLevel,
            },
            level,
            nextChain
          )
        ),
      {}
    );
  };

  const getDeepPopulate = (uid: string, options: any = {}, level = 1) =>
    deepPopulate(uid, options, level, []);

  /* --------------------------- getPopulateForValidation --------------------------- */

  const validationPopulateCache = new Map<string, { result: Populate; truncated: boolean }>();

  const populateForValidation = (
    uid: string,
    chain: string[]
  ): { result: Populate; truncated: boolean } => {
    const cached = validationPopulateCache.get(uid);
    if (cached && (!cached.truncated || chain.length === 0)) {
      return cached;
    }

    if (timesOnPath(chain, uid) >= policy.maxDepth) {
      return { result: {}, truncated: true };
    }

    const model = strapi.getModel(uid as any);
    if (!model) {
      return { result: {}, truncated: false };
    }

    const nextChain = [...chain, uid];
    let truncated = false;

    const result = Object.entries(model.attributes as Record<string, AnyAttribute>).reduce(
      (populateAcc: any, [attributeName, attribute]) => {
        if (isScalarAttribute(attribute)) {
          if (
            getDoesAttributeRequireValidation(attribute) &&
            !isPrivateAttribute(model, attributeName)
          ) {
            populateAcc.fields = populateAcc.fields || [];
            populateAcc.fields.push(attributeName);
          }
          return populateAcc;
        }

        if (attribute.type === 'media') {
          if (
            getDoesAttributeRequireValidation(attribute) &&
            !isPrivateAttribute(model, attributeName)
          ) {
            populateAcc.populate = populateAcc.populate || {};
            populateAcc.populate[attributeName] = {
              populate: {
                folder: true,
              },
            };
            return populateAcc;
          }
        }

        if (attribute.type === 'component') {
          const child = populateForValidation(attribute.component, nextChain);
          truncated = truncated || child.truncated;

          if (Object.keys(child.result).length > 0) {
            populateAcc.populate = populateAcc.populate || {};
            populateAcc.populate[attributeName] = child.result;
          }

          return populateAcc;
        }

        if (attribute.type === 'dynamiczone') {
          const componentsResult = (attribute.components || []).reduce(
            (acc: Record<string, any>, componentUID: string) => {
              const child = populateForValidation(componentUID, nextChain);
              truncated = truncated || child.truncated;

              // Only include component if it has fields requiring validation
              if (Object.keys(child.result).length > 0) {
                acc[componentUID] = child.result;
              }

              return acc;
            },
            {}
          );

          if (Object.keys(componentsResult).length > 0) {
            populateAcc.populate = populateAcc.populate || {};
            populateAcc.populate[attributeName] = { on: componentsResult };
          }
        }

        return populateAcc;
      },
      {}
    );

    const entry = { result, truncated };
    // Depth-dependent (truncated) results are only representative at the top level.
    if (!truncated || chain.length === 0) {
      validationPopulateCache.set(uid, entry);
    }
    return entry;
  };

  const getPopulateForValidation = (uid: string): Populate =>
    populateForValidation(uid, []).result;

  /* -------------------------- getDeepPopulateDraftCount --------------------------- */

  const draftCountCache = new Map<
    string,
    { result: { populate: any; hasRelations: boolean }; truncated: boolean }
  >();

  const deepPopulateDraftCount = (
    uid: string,
    chain: string[]
  ): { result: { populate: any; hasRelations: boolean }; truncated: boolean } => {
    const cached = draftCountCache.get(uid);
    if (cached && (!cached.truncated || chain.length === 0)) {
      return cached;
    }

    if (timesOnPath(chain, uid) >= policy.maxDepth) {
      return { result: { populate: {}, hasRelations: false }, truncated: true };
    }

    const model = strapi.getModel(uid as any);
    if (!model) {
      return { result: { populate: {}, hasRelations: false }, truncated: false };
    }

    const nextChain = [...chain, uid];
    let hasRelations = false;
    let truncated = false;

    const populate = Object.keys(model.attributes).reduce((populateAcc: any, attributeName) => {
      const attribute: AnyAttribute = model.attributes[attributeName];

      switch (attribute.type) {
        case 'relation': {
          // TODO (upstream): Support polymorphic relations
          const isMorphRelation = attribute.relation.toLowerCase().startsWith('morph');
          if (isMorphRelation) {
            break;
          }

          // Skip relations to content types without draft & publish
          if (!('target' in attribute)) {
            break;
          }

          const targetModel = strapi.getModel(attribute.target);
          if (!targetModel || !hasDraftAndPublish(targetModel)) {
            break;
          }

          // Self-referential relations are preserved on publish.
          if (attribute.target === uid) {
            break;
          }

          if (isVisibleAttribute(model, attributeName)) {
            const fields: string[] = ['documentId'];
            if (isLocalizedContentType(targetModel)) {
              fields.push('locale');
            }
            populateAcc[attributeName] = {
              fields,
              filters: { [PUBLISHED_AT_ATTRIBUTE]: { $null: true } },
            };
            hasRelations = true;
          }
          break;
        }
        case 'component': {
          const child = deepPopulateDraftCount(attribute.component, nextChain);
          truncated = truncated || child.truncated;
          if (child.result.hasRelations) {
            populateAcc[attributeName] = {
              populate: child.result.populate,
            };
            hasRelations = true;
          }
          break;
        }
        case 'dynamiczone': {
          const dzPopulateFragment = (attribute.components || []).reduce(
            (acc: any, componentUID: string) => {
              const child = deepPopulateDraftCount(componentUID, nextChain);
              truncated = truncated || child.truncated;

              if (child.result.hasRelations) {
                hasRelations = true;
                return { ...acc, [componentUID]: { populate: child.result.populate } };
              }

              return acc;
            },
            {}
          );

          if (Object.keys(dzPopulateFragment).length > 0) {
            populateAcc[attributeName] = { on: dzPopulateFragment };
          }
          break;
        }
        default:
      }

      return populateAcc;
    }, {});

    const entry = { result: { populate, hasRelations }, truncated };
    if (!truncated || chain.length === 0) {
      draftCountCache.set(uid, entry);
    }
    return entry;
  };

  const getDeepPopulateDraftCount = (uid: string) => deepPopulateDraftCount(uid, []).result;

  return { getDeepPopulate, getPopulateForValidation, getDeepPopulateDraftCount };
};

interface CoreDeps {
  strapi: Core.Strapi;
  policy: CyclePolicy;
}

/**
 * Cycle-safe mirror of @strapi/core/dist/services/document-service/utils/populate.js
 * (v5.54.0) getDeepPopulate — publish / discard / webhook event payload populate.
 */
export const createCycleSafeCoreDeepPopulate = ({ strapi, policy }: CoreDeps) => {
  const deepPopulateCache = new Map<string, { result: Populate; truncated: boolean }>();

  const deepPopulate = (
    uid: string,
    opts: { relationalFields?: string[] } = {},
    chain: string[]
  ): { result: Populate; truncated: boolean } => {
    const cacheKey = `${uid}::${JSON.stringify(opts)}`;
    const cached = deepPopulateCache.get(cacheKey);
    if (cached && (!cached.truncated || chain.length === 0)) {
      return cached;
    }

    if (timesOnPath(chain, uid) >= policy.maxDepth) {
      return { result: {}, truncated: true };
    }

    const model = strapi.getModel(uid as any);
    const attributes = Object.entries(model.attributes as Record<string, AnyAttribute>);
    const nextChain = [...chain, uid];
    let truncated = false;

    const result = attributes.reduce((acc: any, [attributeName, attribute]) => {
      switch (attribute.type) {
        case 'relation': {
          if ('unstable_virtual' in attribute && attribute.unstable_virtual) {
            // skip relations not managed by the DB layer
            break;
          }
          acc[attributeName] = { select: opts.relationalFields };
          break;
        }
        case 'media': {
          acc[attributeName] = { select: ['*'] };
          break;
        }
        case 'component': {
          const child = deepPopulate(attribute.component, opts, nextChain);
          truncated = truncated || child.truncated;
          acc[attributeName] = { populate: child.result };
          break;
        }
        case 'dynamiczone': {
          const populatedComponents = (attribute.components || []).reduce(
            (dzAcc: any, componentUID: string) => {
              const child = deepPopulate(componentUID, opts, nextChain);
              truncated = truncated || child.truncated;
              dzAcc[componentUID] = { populate: child.result };
              return dzAcc;
            },
            {}
          );
          acc[attributeName] = { on: populatedComponents };
          break;
        }
        default:
          break;
      }

      return acc;
    }, {});

    const entry = { result, truncated };
    if (!truncated || chain.length === 0) {
      deepPopulateCache.set(cacheKey, entry);
    }
    return entry;
  };

  return (uid: string, opts: { relationalFields?: string[] } = {}) =>
    deepPopulate(uid, opts, []).result;
};

interface HistoryDeps {
  strapi: Core.Strapi;
  strapiUtils: any;
  policy: CyclePolicy;
}

/**
 * Cycle-safe mirror of the private getDeepPopulate inside
 * @strapi/content-manager/dist/server/history/services/utils.js (v5.54.0)
 * createServiceUtils. Only reachable with an EE content-history license.
 */
export const createCycleSafeHistoryDeepPopulate = ({ strapi, strapiUtils, policy }: HistoryDeps) => {
  const { isVisibleAttribute } = strapiUtils.contentTypes;

  // Mirror of the closure-local getComponentFields: all scalar fields of a component
  // (IDs and populated fields excluded so restore re-creates component rows).
  const getComponentFields = (componentUID: string): string[] => {
    return Object.entries(
      strapi.getModel(componentUID as any).attributes as Record<string, AnyAttribute>
    ).reduce<string[]>((fieldsAcc, [key, attribute]) => {
      if (!['relation', 'media', 'component', 'dynamiczone'].includes(attribute.type)) {
        fieldsAcc.push(key);
      }
      return fieldsAcc;
    }, []);
  };

  const deepPopulate = (uid: string, useDatabaseSyntax: boolean, chain: string[]): Populate => {
    if (timesOnPath(chain, uid) >= policy.maxDepth) {
      return {};
    }

    const model = strapi.getModel(uid as any);
    const attributes = Object.entries(model.attributes as Record<string, AnyAttribute>);
    const fieldSelector = useDatabaseSyntax ? 'select' : 'fields';
    const nextChain = [...chain, uid];

    return attributes.reduce((acc: any, [attributeName, attribute]) => {
      switch (attribute.type) {
        case 'relation': {
          // TODO (upstream): Support polymorphic relations
          const isMorphRelation = attribute.relation.toLowerCase().startsWith('morph');
          if (isMorphRelation) {
            break;
          }

          const isVisible = isVisibleAttribute(model, attributeName);
          if (isVisible) {
            acc[attributeName] = { [fieldSelector]: ['documentId', 'locale', 'publishedAt'] };
          }
          break;
        }

        case 'media': {
          acc[attributeName] = { [fieldSelector]: ['id'] };
          break;
        }

        case 'component': {
          const populate = deepPopulate(attribute.component, false, nextChain);
          acc[attributeName] = {
            populate,
            [fieldSelector]: getComponentFields(attribute.component),
          };
          break;
        }

        case 'dynamiczone': {
          const populatedComponents = (attribute.components || []).reduce(
            (dzAcc: any, componentUID: string) => {
              dzAcc[componentUID] = {
                populate: deepPopulate(componentUID, false, nextChain),
                [fieldSelector]: getComponentFields(componentUID),
              };
              return dzAcc;
            },
            {}
          );

          acc[attributeName] = { on: populatedComponents };
          break;
        }
        default:
          break;
      }

      return acc;
    }, {});
  };

  return (uid: string, useDatabaseSyntax = false) => deepPopulate(uid, useDatabaseSyntax, []);
};

interface I18nDeps {
  strapi: Core.Strapi;
  strapiUtils: any;
  policy: CyclePolicy;
  /** The i18n content-types service's own (flat, non-recursive) helper. */
  getNonLocalizedAttributes: (model: any) => string[];
}

/**
 * Cycle-safe mirror of @strapi/i18n/dist/server/services/content-types.js
 * (v5.54.0) getNestedPopulateOfNonLocalizedAttributes — builds the dotted populate
 * paths used to sync non-localized attributes across locales on every save of a
 * localized content type.
 */
export const createCycleSafeI18nNestedPopulate = ({
  strapi,
  strapiUtils,
  policy,
  getNonLocalizedAttributes,
}: I18nDeps) => {
  const { getScalarAttributes, getRelationalAttributes } = strapiUtils.contentTypes;

  const nestedPopulate = (modelUID: string, chain: string[]): string[] => {
    if (timesOnPath(chain, modelUID) >= policy.maxDepth) {
      return [];
    }

    const schema = strapi.getModel(modelUID as any);
    const scalarAttributes = getScalarAttributes(schema);
    const nonLocalizedAttributes = getNonLocalizedAttributes(schema);
    const allAttributes = [...scalarAttributes, ...nonLocalizedAttributes];

    if ((schema as any).modelType === 'component') {
      // When called recursively on a non localized component we
      // need to explicitly populate that components relations
      allAttributes.push(...getRelationalAttributes(schema));
    }

    const currentAttributesToPopulate = allAttributes.filter((value, index, self) => {
      return self.indexOf(value) === index && self.lastIndexOf(value) === index;
    });

    const nextChain = [...chain, modelUID];
    const attributesToPopulate = [...currentAttributesToPopulate];
    for (const attrName of currentAttributesToPopulate) {
      const attr: AnyAttribute = (schema.attributes as any)[attrName];
      if (attr.type === 'component') {
        attributesToPopulate.push(
          ...nestedPopulate(attr.component, nextChain).map(
            (nestedAttr) => `${attrName}.${nestedAttr}`
          )
        );
      } else if (attr.type === 'dynamiczone') {
        (attr.components || []).forEach((componentName: string) => {
          attributesToPopulate.push(
            ...nestedPopulate(componentName, nextChain).map(
              (nestedAttr) => `${attrName}.${nestedAttr}`
            )
          );
        });
      }
    }

    return attributesToPopulate;
  };

  return (modelUID: string) => nestedPopulate(modelUID, []);
};

/* ---------------------------------- installer ---------------------------------- */

const replaceExports = (
  moduleExports: Record<string, unknown>,
  replacements: Record<string, AnyFnLike>,
  { strapi, label }: { strapi: Core.Strapi; label: string }
) => {
  for (const [name, replacement] of Object.entries(replacements)) {
    if (typeof moduleExports[name] !== 'function') {
      strapi.log.warn(
        `[breakout-kit] recursive dynamic zones: expected ${label} to export function "${name}"; skipping this patch — recursive schemas may crash this code path.`
      );
      continue;
    }
    moduleExports[name] = replacement;
  }
};

type AnyFnLike = (...args: any[]) => any;

/**
 * Installs the cycle-safe populate mirrors over the running Strapi's own module
 * instances. Runs in the plugin's `register` phase so it lands before any other
 * plugin's bootstrap captures the originals (content history's createServiceUtils
 * is called during the content-manager bootstrap).
 */
export const installRecursiveDynamicZonePatches = ({ strapi }: { strapi: Core.Strapi }) => {
  const config = (strapi
    .plugin('breakout-kit')
    .config('recursiveDynamicZones') ?? {}) as { enabled?: boolean; maxDepth?: number };

  if (config.enabled === false) {
    return;
  }

  const policy: CyclePolicy = { maxDepth: Math.max(2, config.maxDepth ?? 10) };

  // Resolve the exact module instances the running app loaded: anchor on the app
  // root, then on the content-manager server entry (its closure also gives us the
  // same @strapi/utils instance the originals use).
  const appRequire = createRequire(path.join(strapi.dirs.app.root, 'package.json'));

  const cmServerEntry = appRequire.resolve('@strapi/content-manager/strapi-server');
  const cmServerDir = path.dirname(cmServerEntry); // .../dist/server
  const cmRequire = createRequire(cmServerEntry);
  const strapiUtils = cmRequire('@strapi/utils');

  // 1. Content-manager populate utils (document fetch, publish validation, draft counts).
  const cmPopulate = cmRequire(path.join(cmServerDir, 'services', 'utils', 'populate.js'));
  replaceExports(cmPopulate, createCycleSafeCmPopulateUtils({ strapi, strapiUtils, policy }), {
    strapi,
    label: '@strapi/content-manager services/utils/populate.js',
  });

  // 2. Content history (EE): wrap createServiceUtils so the returned object carries a
  //    cycle-safe getDeepPopulate. Everything else on the object is untouched.
  const historyUtils = cmRequire(path.join(cmServerDir, 'history', 'services', 'utils.js'));
  const originalCreateServiceUtils = historyUtils.createServiceUtils;
  if (typeof originalCreateServiceUtils === 'function') {
    historyUtils.createServiceUtils = (args: { strapi: Core.Strapi }) => {
      const serviceUtils = originalCreateServiceUtils(args);
      return {
        ...serviceUtils,
        getDeepPopulate: createCycleSafeHistoryDeepPopulate({
          strapi: args.strapi,
          strapiUtils,
          policy,
        }),
      };
    };
  } else {
    strapi.log.warn(
      '[breakout-kit] recursive dynamic zones: could not patch content history utils; history saves may crash on recursive schemas.'
    );
  }

  // 3. @strapi/core document-service populate (publish, discard, webhook payloads).
  const corePkg = appRequire.resolve('@strapi/core/package.json');
  const corePopulate = appRequire(
    path.join(path.dirname(corePkg), 'dist', 'services', 'document-service', 'utils', 'populate.js')
  );
  replaceExports(
    corePopulate,
    { getDeepPopulate: createCycleSafeCoreDeepPopulate({ strapi, policy }) },
    { strapi, label: '@strapi/core services/document-service/utils/populate.js' }
  );

  // 4. i18n: locale sync builds a nested populate path list from the schema on every
  //    save of a localized content type. Plugin service instances are singletons
  //    (created once, cached), and every consumer destructures from the instance per
  //    request, so replacing the method on the instance reaches them all.
  const i18nPlugin = (() => {
    try {
      return strapi.plugin('i18n');
    } catch {
      return undefined; // i18n not installed
    }
  })();
  if (i18nPlugin) {
    const i18nContentTypes = i18nPlugin.service('content-types') as any;
    if (
      i18nContentTypes &&
      typeof i18nContentTypes.getNestedPopulateOfNonLocalizedAttributes === 'function' &&
      typeof i18nContentTypes.getNonLocalizedAttributes === 'function'
    ) {
      i18nContentTypes.getNestedPopulateOfNonLocalizedAttributes = createCycleSafeI18nNestedPopulate({
        strapi,
        strapiUtils,
        policy,
        getNonLocalizedAttributes: i18nContentTypes.getNonLocalizedAttributes,
      });
    } else {
      strapi.log.warn(
        '[breakout-kit] recursive dynamic zones: could not patch i18n content-types service; saving localized entries may crash on recursive schemas.'
      );
    }
  }

  strapi.log.debug(
    `[breakout-kit] recursive dynamic zone populate guards installed (maxDepth=${policy.maxDepth}).`
  );
};
