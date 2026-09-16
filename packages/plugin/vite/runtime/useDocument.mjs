import * as React from 'react';
import { useQueryParams } from '@strapi/admin/strapi-admin';
import { useParams } from 'react-router-dom';
import { buildValidParams } from '@strapi/content-manager/strapi-admin';
import {
  useDocument,
  useContentManagerContext,
} from '@strapi/content-manager/dist/admin/hooks/useDocument.mjs?hcm-original';
import { SINGLE_TYPES } from '@strapi/content-manager/dist/admin/constants/collections.mjs';
import { getHeadlessDocumentContext } from './headless-document-context.mjs';

/**
 * Wrapper for @strapi/content-manager's hooks/useDocument.mjs (v5.53.0), installed by the
 * headlessContentManager() Vite plugin. `useDocument` and `useContentManagerContext` are
 * re-exported untouched; only `useDoc` (the internal URL adapter, consumed directly by
 * route-coupled internals like the relation modal's RootRelationRenderer) gains one extra
 * source: when the CM route params are absent but a headless <DocumentProvider> is above,
 * it serves the provider's document instead of throwing.
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

export { useDocument, useContentManagerContext, useDoc };
