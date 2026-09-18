/**
 * WRAPPER for @strapi/content-manager dist/admin/pages/EditView/EditViewPage.mjs,
 * installed by the breakoutKit() Vite plugin via a redirect (like the
 * useDocument shim — thin wrapper, not a vendored body). `EditViewPage` and
 * `getDocumentStatus` are re-exported untouched; `ProtectedEditViewPage` (the
 * component every CM edit route mounts: :collectionType/:slug[/:id|/clone/:origin])
 * first consults the consumer-registered replacement resolver. No resolver, or a
 * resolver returning `undefined`, renders the untouched original — stock routes are
 * byte-identical (stock-cm-unaffected + parity tests).
 *
 * Route-info parsing mirrors the stock page/router semantics (drift entries
 * cm-edit-view-page, cm-router): params collectionType/slug/id/origin, locale from
 * query.plugins.i18n.locale, status from query.status.
 */
import { jsx } from 'react/jsx-runtime';
import { useQueryParams } from '@strapi/admin/strapi-admin';
import { useParams } from 'react-router-dom';
import {
  EditViewPage,
  ProtectedEditViewPage as OriginalProtectedEditViewPage,
  getDocumentStatus,
} from '@strapi/content-manager/dist/admin/pages/EditView/EditViewPage.mjs?bk-original';
import { getEditViewReplacementRegistry } from './edit-view-replacement-registry.mjs';

const ProtectedEditViewPage = () => {
  const { collectionType, slug, id, origin } = useParams();
  const [{ query }] = useQueryParams();
  const { resolver } = getEditViewReplacementRegistry();
  if (resolver) {
    const isCreate = id === 'create';
    const route = {
      collectionType,
      model: slug,
      documentId: origin || (isCreate ? undefined : id),
      isCreate,
      isClone: Boolean(origin),
      origin,
      locale: query?.plugins?.i18n?.locale,
      status: query?.status,
    };
    const Replacement = resolver(route);
    if (Replacement !== undefined && Replacement !== null) {
      return jsx(Replacement, route);
    }
  }
  return jsx(OriginalProtectedEditViewPage, {});
};

export { EditViewPage, ProtectedEditViewPage, getDocumentStatus };
