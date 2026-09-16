import * as React from 'react';
import { useQueryParams } from '@strapi/admin/strapi-admin';
import { useParams } from 'react-router-dom';
import { buildValidParams } from '@strapi/content-manager/strapi-admin';
import { useDocument } from '@strapi/content-manager/dist/admin/hooks/useDocument.mjs';
import { useRelationModal } from '@strapi/content-manager/dist/admin/pages/EditView/components/FormInputs/Relations/RelationModal.mjs';
import { getHeadlessDocumentContext } from './headless-document-context.mjs';

/**
 * Drop-in replacement for @strapi/content-manager's hooks/useDocumentContext.mjs
 * (v5.53.0), installed by the headlessContentManager() Vite plugin.
 *
 * Source contract (drift-tracked): the original returns
 *   { currentDocumentMeta: relationModalMeta ?? urlMeta, currentDocument: relationModalDoc ?? urlDoc }
 * where the URL branch goes through useDoc(), which throws when the CM route params are absent.
 *
 * This shim adds exactly one source in FRONT of the URL fallback — the headless
 * <DocumentProvider> context — and keeps everything else identical:
 * - priority: relation modal (innermost) → headless provider → URL
 * - on stock CM routes without a headless provider the hook order, fetches, priorities and
 *   thrown errors are byte-for-byte the original behavior
 * - outside CM routes it only throws when NO source can supply the document (which is when
 *   the original would have thrown too)
 */
function useDocumentContext(consumerName) {
  const headless = React.useContext(getHeadlessDocumentContext());

  // Relation modal context wins (most specific), same as the original.
  const currentRelationDocumentMeta = useRelationModal(
    consumerName,
    (state) => state.currentDocumentMeta,
    false
  );
  const currentRelationDocument = useRelationModal(
    consumerName,
    (state) => state.currentDocument,
    false
  );

  // URL branch — inlined useDoc() with the throw deferred until we know no other
  // source exists. All hooks are called unconditionally (rules of hooks).
  const { id, slug, collectionType, origin } = useParams();
  const [{ query }] = useQueryParams();
  const params = React.useMemo(() => buildValidParams(query ?? {}), [query]);

  const hasContextSource = currentRelationDocumentMeta !== undefined || headless != null;
  if (!collectionType && !hasContextSource) {
    throw new Error('Could not find collectionType in url params');
  }
  if (!slug && !hasContextSource) {
    throw new Error('Could not find model in url params');
  }

  const urlDocumentMeta = {
    collectionType: collectionType ?? '',
    model: slug ?? '',
    documentId: origin || (id === 'create' ? undefined : id),
    params,
  };
  // Mirrors the original's `useDocument(urlDocumentMeta)` call: with the normalized
  // documentId, useDocument's own internal skip logic (no documentId on a collection
  // type => skip) covers the create/clone cases; we only add the off-route skip.
  const urlDocument = useDocument(urlDocumentMeta, { skip: !collectionType });

  return {
    currentDocumentMeta:
      currentRelationDocumentMeta ?? headless?.currentDocumentMeta ?? urlDocumentMeta,
    currentDocument:
      currentRelationDocument ?? headless?.currentDocument ?? urlDocument,
  };
}

/** Marker used by contract tests to assert the alias is active. */
const __headlessShim = true;

export { useDocumentContext, __headlessShim };
