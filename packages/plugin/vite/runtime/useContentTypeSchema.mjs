import * as React from 'react';
import { useNotification, useAPIErrorHandler } from '@strapi/admin/strapi-admin';
import { useGetInitialDataQuery } from '@strapi/content-manager/dist/admin/services/init.mjs';

/**
 * Drop-in replacement for @strapi/content-manager's hooks/useContentTypeSchema.mjs
 * (v5.54.0), installed by the breakoutKit() Vite plugin.
 *
 * Source contract (drift-tracked, `cm-use-content-type-schema`): identical module —
 * same exports, same WeakMap/Map schema-info caching, same hook order and results —
 * except that `extractContentTypeComponents`' internal `getComponents` walk carries a
 * visited set, so a component graph with cycles (recursive dynamic zones, e.g. a
 * component whose dynamic zone lists the component itself) terminates instead of
 * blowing the call stack.
 *
 * Equivalence on acyclic schemas: the original re-expands a component every time it
 * is encountered; every uid such a re-expansion emits was already emitted by the
 * first expansion, and the result is deduplicated through a Set, so skipping
 * re-expansions changes neither the membership nor the first-occurrence order of
 * `uniqueComponentUids`. On cyclic schemas the skip is exactly what cuts the cycle.
 */

const EMPTY_COMPONENTS = {};

// Module-level cache preserves schema derivation identities across hook instances;
// `useMemo` would only stabilize values inside a single component tree.
const schemaInfoCache = new WeakMap();

const getSchemaInfo = (data, model) => {
  if (!data) {
    return {
      components: undefined,
      contentType: undefined,
      contentTypes: [],
    };
  }
  let cachedByModel = schemaInfoCache.get(data);
  if (!cachedByModel) {
    cachedByModel = new Map();
    schemaInfoCache.set(data, cachedByModel);
  }
  const cached = cachedByModel.get(model);
  if (cached) {
    return cached;
  }
  const contentType = data.contentTypes.find((ct) => ct.uid === model);
  const componentsByKey = data.components.reduce((acc, component) => {
    acc[component.uid] = component;
    return acc;
  }, {});
  const components = extractContentTypeComponents(contentType?.attributes, componentsByKey);
  const schemaInfo = {
    components: Object.keys(components).length === 0 ? undefined : components,
    contentType,
    contentTypes: data.contentTypes,
  };
  cachedByModel.set(model, schemaInfo);
  return schemaInfo;
};

/**
 * @internal
 * @description Given a model UID, return the schema and the schemas
 * of the associated components within said model's schema. A wrapper
 * implementation around the `useGetInitialDataQuery` with a unique
 * `selectFromResult` function to memoize the calculation.
 *
 * If no model is provided, the hook will return all the schemas.
 */
const useContentTypeSchema = (model) => {
  const { toggleNotification } = useNotification();
  const { _unstableFormatAPIError: formatAPIError } = useAPIErrorHandler();
  const { data, error, isLoading, isFetching } = useGetInitialDataQuery(undefined);
  const { components, contentType, contentTypes } = React.useMemo(
    () => getSchemaInfo(data, model),
    [model, data]
  );
  React.useEffect(() => {
    if (error) {
      toggleNotification({
        type: 'danger',
        message: formatAPIError(error),
      });
    }
  }, [toggleNotification, error, formatAPIError]);
  return {
    components: components ?? EMPTY_COMPONENTS,
    schema: contentType,
    schemas: contentTypes,
    isLoading: isLoading || isFetching,
  };
};

/**
 * @internal
 * @description Extracts the components used in a content type's attributes recursively.
 * Cycle-safe: each component is expanded at most once (see module comment).
 */
const extractContentTypeComponents = (attributes = {}, allComponents = {}) => {
  const expanded = new Set();

  const expandComponent = (componentUid) => {
    if (expanded.has(componentUid)) {
      return [];
    }
    expanded.add(componentUid);
    return getComponents(Object.values(allComponents[componentUid]?.attributes ?? {}));
  };

  const getComponents = (attributes) => {
    return attributes.reduce((acc, attribute) => {
      /**
       * If the attribute is a component or dynamiczone, we need to recursively
       * extract the component UIDs from its attributes.
       */
      if (attribute.type === 'component') {
        acc.push(attribute.component, ...expandComponent(attribute.component));
      } else if (attribute.type === 'dynamiczone') {
        acc.push(
          ...attribute.components,
          /**
           * Dynamic zones have an array of components, so we flatMap over them
           * performing the same search as above.
           */
          ...attribute.components.flatMap((componentUid) => expandComponent(componentUid))
        );
      }
      return acc;
    }, []);
  };

  const componentUids = getComponents(Object.values(attributes));
  const uniqueComponentUids = [...new Set(componentUids)];
  const componentsByKey = uniqueComponentUids.reduce((acc, uid) => {
    const component = allComponents[uid];
    if (component) {
      acc[uid] = component;
    }
    return acc;
  }, {});
  return componentsByKey;
};

/** Marker used by contract tests to assert the alias is active. */
const __headlessShim = true;

export { extractContentTypeComponents, useContentTypeSchema, __headlessShim };
