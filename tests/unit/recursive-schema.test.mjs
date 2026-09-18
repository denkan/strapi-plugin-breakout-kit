import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The shim's hook imports are irrelevant to extractContentTypeComponents — stub them
// so the module loads outside a browser/Vite context.
vi.mock('@strapi/admin/strapi-admin', () => ({
  useNotification: () => ({ toggleNotification: () => {} }),
  useAPIErrorHandler: () => ({ _unstableFormatAPIError: () => '' }),
}));
vi.mock('@strapi/content-manager/dist/admin/services/init.mjs', () => ({
  useGetInitialDataQuery: () => ({}),
}));

const { extractContentTypeComponents } = await import(
  '../../packages/plugin/vite/runtime/useContentTypeSchema.mjs'
);

const require = createRequire(import.meta.url);

/* ------------------------------------ fixtures ------------------------------------ */

const component = (uid, attributes) => ({ uid, attributes, category: 'shared' });

/** Acyclic component set: wrapper has a dynamic zone but does not include itself. */
const makeComponents = ({ recursive }) => {
  const wrapperDz = ['shared.quote', 'shared.link'];
  if (recursive) wrapperDz.push('shared.wrapper');

  return {
    'shared.quote': component('shared.quote', {
      body: { type: 'string', required: true },
      attribution: { type: 'string' },
    }),
    'shared.link': component('shared.link', {
      url: { type: 'string', required: true },
      label: { type: 'string' },
      seo: { type: 'component', repeatable: false, component: 'shared.seo' },
    }),
    'shared.seo': component('shared.seo', {
      metaTitle: { type: 'string' },
    }),
    'shared.wrapper': component('shared.wrapper', {
      backgroundColor: { type: 'string' },
      content: { type: 'dynamiczone', components: wrapperDz },
    }),
  };
};

const makeArticleAttributes = () => ({
  title: { type: 'string', required: true },
  seo: { type: 'component', repeatable: false, component: 'shared.seo' },
  sections: { type: 'dynamiczone', components: ['shared.quote', 'shared.wrapper'] },
});

/**
 * The upstream (v5.54.0) extractContentTypeComponents walk, verbatim: the reference
 * implementation for acyclic equivalence (it stack-overflows on cycles).
 */
const upstreamExtract = (attributes = {}, allComponents = {}) => {
  const getComponents = (attrs) =>
    attrs.reduce((acc, attribute) => {
      if (attribute.type === 'component') {
        const componentAttributes = Object.values(
          allComponents[attribute.component]?.attributes ?? {}
        );
        acc.push(attribute.component, ...getComponents(componentAttributes));
      } else if (attribute.type === 'dynamiczone') {
        acc.push(
          ...attribute.components,
          ...attribute.components.flatMap((componentUid) =>
            getComponents(Object.values(allComponents[componentUid]?.attributes ?? {}))
          )
        );
      }
      return acc;
    }, []);

  const uniqueComponentUids = [...new Set(getComponents(Object.values(attributes)))];
  return uniqueComponentUids.reduce((acc, uid) => {
    if (allComponents[uid]) acc[uid] = allComponents[uid];
    return acc;
  }, {});
};

describe('shim extractContentTypeComponents', () => {
  it('matches the upstream walk exactly on acyclic schemas (values and key order)', () => {
    const allComponents = makeComponents({ recursive: false });
    const attributes = makeArticleAttributes();

    const ours = extractContentTypeComponents(attributes, allComponents);
    const upstream = upstreamExtract(attributes, allComponents);

    expect(ours).toEqual(upstream);
    expect(Object.keys(ours)).toEqual(Object.keys(upstream));
  });

  it('terminates on recursive dynamic zones and returns every reachable component once', () => {
    const allComponents = makeComponents({ recursive: true });
    const attributes = makeArticleAttributes();

    const ours = extractContentTypeComponents(attributes, allComponents);

    expect(Object.keys(ours).sort()).toEqual([
      'shared.link',
      'shared.quote',
      'shared.seo',
      'shared.wrapper',
    ]);
    expect(ours['shared.wrapper']).toBe(allComponents['shared.wrapper']);
  });

  it('terminates on a direct self-referencing component attribute', () => {
    const allComponents = {
      'shared.node': component('shared.node', {
        label: { type: 'string' },
        child: { type: 'component', repeatable: false, component: 'shared.node' },
      }),
    };
    const ours = extractContentTypeComponents(
      { tree: { type: 'component', repeatable: false, component: 'shared.node' } },
      allComponents
    );
    expect(Object.keys(ours)).toEqual(['shared.node']);
  });
});

/* --------------------------- server populate mirrors --------------------------- */

const { createCycleSafeCmPopulateUtils, createCycleSafeCoreDeepPopulate } = await import(
  '../../packages/plugin/server/src/access/recursive-populate'
);

const strapiUtils = require('@strapi/utils');

const contentType = (uid, attributes, options = {}) => ({
  uid,
  modelType: 'contentType',
  kind: 'collectionType',
  options: { draftAndPublish: true, ...options },
  attributes: {
    ...attributes,
    createdBy: {
      type: 'relation',
      relation: 'oneToOne',
      target: 'admin::user',
      configurable: false,
      writable: false,
      visible: false,
      private: true,
    },
  },
});

const serverComponent = (uid, attributes) => ({
  uid,
  modelType: 'component',
  attributes,
});

const makeModels = ({ recursive }) => {
  const wrapperDz = ['shared.quote'];
  if (recursive) wrapperDz.push('shared.wrapper');

  const models = {
    'api::article.article': contentType('api::article.article', {
      title: { type: 'string', required: true },
      cover: { type: 'media', multiple: false },
      author: { type: 'relation', relation: 'manyToOne', target: 'api::author.author' },
      seo: { type: 'component', repeatable: false, component: 'shared.seo' },
      sections: { type: 'dynamiczone', components: ['shared.quote', 'shared.wrapper'] },
    }),
    'api::author.author': contentType('api::author.author', {
      name: { type: 'string', required: true },
    }),
    'admin::user': {
      uid: 'admin::user',
      modelType: 'contentType',
      kind: 'collectionType',
      options: {},
      attributes: { firstname: { type: 'string' } },
    },
    'shared.seo': serverComponent('shared.seo', {
      metaTitle: { type: 'string', maxLength: 60 },
    }),
    'shared.quote': serverComponent('shared.quote', {
      body: { type: 'string', required: true },
      citedAuthor: { type: 'relation', relation: 'oneToOne', target: 'api::author.author' },
    }),
    'shared.wrapper': serverComponent('shared.wrapper', {
      backgroundColor: { type: 'string' },
      content: { type: 'dynamiczone', components: wrapperDz },
    }),
  };
  return models;
};

const makeStrapiStub = (models) => ({
  getModel: (uid) => models[uid],
});

const cmDistPopulatePath = path.join(
  path.dirname(require.resolve('@strapi/content-manager/package.json')),
  'dist/server/services/utils/populate.js'
);
const coreDistPopulatePath = path.join(
  path.dirname(require.resolve('@strapi/core/package.json')),
  'dist/services/document-service/utils/populate.js'
);

// The upstream dist modules read the `strapi` global at call time.
const withGlobalStrapi = (stub, fn) => {
  const previous = globalThis.strapi;
  globalThis.strapi = stub;
  try {
    return fn();
  } finally {
    globalThis.strapi = previous;
  }
};

// Upstream dist modules keep module-level caches — reload them per test so acyclic
// fixtures never see entries cached from another test's registry.
const freshRequire = (modulePath) => {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('cycle-safe CM server populate mirrors', () => {
  const policy = { maxDepth: 3 };

  it('getDeepPopulate matches upstream exactly on acyclic schemas', () => {
    const models = makeModels({ recursive: false });
    const stub = makeStrapiStub(models);
    const upstream = freshRequire(cmDistPopulatePath);
    const ours = createCycleSafeCmPopulateUtils({ strapi: stub, strapiUtils, policy });

    for (const options of [
      {},
      { countMany: true, countOne: false },
      { countMany: true, countOne: true, maxLevel: 2 },
      { initialPopulate: { author: false } },
    ]) {
      const expected = withGlobalStrapi(stub, () =>
        upstream.getDeepPopulate('api::article.article', options)
      );
      expect(ours.getDeepPopulate('api::article.article', options)).toEqual(expected);
    }
  });

  it('getPopulateForValidation matches upstream exactly on acyclic schemas', () => {
    const models = makeModels({ recursive: false });
    const stub = makeStrapiStub(models);
    const upstream = freshRequire(cmDistPopulatePath);
    const ours = createCycleSafeCmPopulateUtils({ strapi: stub, strapiUtils, policy });

    const expected = withGlobalStrapi(stub, () =>
      upstream.getPopulateForValidation('api::article.article')
    );
    expect(ours.getPopulateForValidation('api::article.article')).toEqual(expected);
  });

  it('getDeepPopulateDraftCount matches upstream exactly on acyclic schemas', () => {
    const models = makeModels({ recursive: false });
    const stub = makeStrapiStub(models);
    const upstream = freshRequire(cmDistPopulatePath);
    const ours = createCycleSafeCmPopulateUtils({ strapi: stub, strapiUtils, policy });

    const expected = withGlobalStrapi(stub, () =>
      upstream.getDeepPopulateDraftCount('api::article.article')
    );
    expect(ours.getDeepPopulateDraftCount('api::article.article')).toEqual(expected);
  });

  it('upstream getDeepPopulate blows the stack on a recursive schema (the bug being fixed)', () => {
    const models = makeModels({ recursive: true });
    const stub = makeStrapiStub(models);
    const upstream = freshRequire(cmDistPopulatePath);

    expect(() =>
      withGlobalStrapi(stub, () => upstream.getDeepPopulate('api::article.article'))
    ).toThrow(RangeError);
  });

  it('getDeepPopulate terminates on a recursive schema and nests maxDepth times', () => {
    const models = makeModels({ recursive: true });
    const stub = makeStrapiStub(models);
    const ours = createCycleSafeCmPopulateUtils({ strapi: stub, strapiUtils, policy });

    const populate = ours.getDeepPopulate('api::article.article');

    // Walk down the wrapper -> content -> wrapper chain.
    let node = populate.sections.on['shared.wrapper'].populate;
    let depth = 1;
    while (node.content?.on?.['shared.wrapper']?.populate?.content) {
      node = node.content.on['shared.wrapper'].populate;
      depth += 1;
    }
    expect(depth).toBe(policy.maxDepth);
    // The cut point populates nothing further.
    expect(node.content.on['shared.wrapper']).toEqual({ populate: {} });
    // Non-recursive branches at the deepest level are still populated.
    expect(node.content.on['shared.quote'].populate.citedAuthor).toBeDefined();
  });

  it('getPopulateForValidation and getDeepPopulateDraftCount terminate on recursive schemas', () => {
    const models = makeModels({ recursive: true });
    const stub = makeStrapiStub(models);
    const ours = createCycleSafeCmPopulateUtils({ strapi: stub, strapiUtils, policy });

    const validation = ours.getPopulateForValidation('api::article.article');
    expect(validation.populate.sections.on['shared.quote']).toBeDefined();

    const draftCount = ours.getDeepPopulateDraftCount('api::article.article');
    expect(draftCount.hasRelations).toBe(true);
    // Recomputing (truncated results are not cached) stays stable.
    expect(ours.getDeepPopulateDraftCount('api::article.article')).toEqual(draftCount);
  });
});

describe('cycle-safe core document-service getDeepPopulate mirror', () => {
  const policy = { maxDepth: 3 };

  it('matches upstream exactly on acyclic schemas', () => {
    const models = makeModels({ recursive: false });
    const stub = makeStrapiStub(models);
    const upstream = freshRequire(coreDistPopulatePath);
    const ours = createCycleSafeCoreDeepPopulate({ strapi: stub, policy });

    for (const opts of [{}, { relationalFields: ['id'] }, { relationalFields: ['documentId', 'locale'] }]) {
      const expected = withGlobalStrapi(stub, () =>
        upstream.getDeepPopulate('api::article.article', opts)
      );
      expect(ours('api::article.article', opts)).toEqual(expected);
    }
  });

  it('terminates on a recursive schema where upstream blows the stack', () => {
    const models = makeModels({ recursive: true });
    const stub = makeStrapiStub(models);
    const upstream = freshRequire(coreDistPopulatePath);

    expect(() =>
      withGlobalStrapi(stub, () => upstream.getDeepPopulate('api::article.article', {}))
    ).toThrow(RangeError);

    const ours = createCycleSafeCoreDeepPopulate({ strapi: stub, policy });
    const populate = ours('api::article.article', { relationalFields: ['id'] });

    let node = populate.sections.on['shared.wrapper'].populate;
    let depth = 1;
    while (Object.keys(node.content.on['shared.wrapper'].populate).length > 0) {
      node = node.content.on['shared.wrapper'].populate;
      depth += 1;
    }
    expect(depth).toBe(policy.maxDepth);
  });
});
