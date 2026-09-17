import * as React from 'react';
import { useForm, useQueryParams } from '@strapi/admin/strapi-admin';
import { useParams } from 'react-router-dom';
import { buildValidParams } from '@strapi/content-manager/strapi-admin';
import { useDocument } from '@strapi/content-manager/dist/admin/hooks/useDocument.mjs?hcm-original';
import { useDocumentLayout } from '@strapi/content-manager/dist/admin/hooks/useDocumentLayout.mjs';
import { useContentTypeSchema } from '@strapi/content-manager/dist/admin/hooks/useContentTypeSchema.mjs';
import { SINGLE_TYPES } from '@strapi/content-manager/dist/admin/constants/collections.mjs';
import { getHeadlessDocumentContext } from './headless-document-context.mjs';

/**
 * Wrapper for @strapi/content-manager's hooks/useDocument.mjs (drift entry
 * cm-use-document), installed by the headlessContentManager() Vite plugin.
 * `useDocument` is re-exported untouched. `useDoc` (the internal URL adapter, consumed
 * directly by route-coupled internals like the relation modal's RootRelationRenderer)
 * gains one extra source: when the CM route params are absent but a headless
 * <DocumentProvider> is above, it serves the provider's document instead of throwing.
 * `useContentManagerContext` is REBUILT here (mirroring the upstream body exactly) on
 * top of the extended useDoc — the original calls its own module-local useDoc, which a
 * re-export can't intercept, so it would throw on headless pages.
 *
 * On stock CM routes (URL params present) the behavior is byte-for-byte the original:
 * same hook order, same fetch skip conditions, same thrown errors, URL always wins.
 */
function useDoc(opts) {
  const headless = React.useContext(getHeadlessDocumentContext());
  const { id, slug, collectionType, origin } = useParams();
  const [{ query }] = useQueryParams();
  const params = React.useMemo(() => buildValidParams(query ?? {}), [query]);

  if (!collectionType && !headless) {
    throw new Error('Could not find collectionType in url params');
  }
  if (!slug && !headless) {
    throw new Error('Could not find model in url params');
  }

  const urlDocument = useDocument(
    {
      documentId: origin || id,
      model: slug ?? '',
      collectionType: collectionType ?? '',
      params,
    },
    {
      ...opts,
      skip:
        !collectionType ||
        id === 'create' ||
        (!origin && !id && collectionType !== SINGLE_TYPES) ||
        opts?.skip,
    }
  );

  if (collectionType && slug) {
    const returnId = origin || (id === 'create' ? undefined : id);
    return { collectionType, model: slug, id: returnId, ...urlDocument };
  }

  const meta = headless.currentDocumentMeta;
  return {
    collectionType: meta.collectionType,
    model: meta.model,
    id: meta.documentId,
    ...headless.currentDocument,
  };
}

/**
 * Mirrors upstream useContentManagerContext line for line, except it composes OUR
 * useDoc (headless fallback) and — [breakout-kit] — treats a missing id on a headless
 * collection-type as create mode (stock collection URLs always carry an id or the
 * literal 'create', so the extra clause is unreachable on stock routes).
 */
const useContentManagerContext = () => {
  const {
    collectionType,
    model,
    id,
    components,
    isLoading: isLoadingDoc,
    schema,
    schemas,
  } = useDoc();
  const layout = useDocumentLayout(model);
  const form = useForm('useContentManagerContext', (state) => state);
  const isSingleType = collectionType === SINGLE_TYPES;
  const slug = model;
  const isCreatingEntry = id === 'create' || (!isSingleType && id === undefined);
  useContentTypeSchema();
  const isLoading = isLoadingDoc || layout.isLoading;
  const error = layout.error;
  return {
    error,
    isLoading,
    // Base metadata
    model,
    collectionType,
    id,
    slug,
    isCreatingEntry,
    isSingleType,
    hasDraftAndPublish: schema?.options?.draftAndPublish ?? false,
    // All schema infos
    components,
    contentType: schema,
    contentTypes: schemas,
    // Form state
    form,
    // layout infos
    layout,
  };
};

export { useDocument, useContentManagerContext, useDoc };
