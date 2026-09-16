/**
 * Access layer — strategy 3: build-time resolution (deep imports).
 *
 * These modules exist in @strapi/content-manager's unbundled dist but are not in its exports
 * map; the headlessContentManager() Vite plugin (which consumers add to src/admin/vite.config.ts)
 * resolves them to the actual files. Each specifier is drift-tracked in drift/manifest.json.
 *
 * Module identity note: because resolution happens in the app's single admin build, these are
 * the SAME module instances the stock content manager uses — contexts and registries stay
 * singletons (contract-tested).
 */
export { InputRenderer } from '@strapi/content-manager/dist/admin/pages/EditView/components/InputRenderer.mjs';
export type { InputRendererProps } from '@strapi/content-manager/dist/admin/pages/EditView/components/InputRenderer.mjs';
export {
  FormLayout,
  ResponsiveGridRoot,
  ResponsiveGridItem,
} from '@strapi/content-manager/dist/admin/pages/EditView/components/FormLayout.mjs';
export {
  DocumentActions,
  DocumentActionButton,
  DocumentActionsMenu,
} from '@strapi/content-manager/dist/admin/pages/EditView/components/DocumentActions.mjs';
export {
  transformDocument,
  handleInvisibleAttributes,
} from '@strapi/content-manager/dist/admin/pages/EditView/utils/data.mjs';
export { createDefaultForm } from '@strapi/content-manager/dist/admin/pages/EditView/utils/forms.mjs';
export { createYupSchema } from '@strapi/content-manager/dist/admin/utils/validation.mjs';
export { useContentTypeSchema } from '@strapi/content-manager/dist/admin/hooks/useContentTypeSchema.mjs';
export { useLazyComponents } from '@strapi/content-manager/dist/admin/hooks/useLazyComponents.mjs';
export {
  useDocumentContext,
  __headlessShim,
} from '@strapi/content-manager/dist/admin/hooks/useDocumentContext.mjs';
export {
  SINGLE_TYPES,
  COLLECTION_TYPES,
} from '@strapi/content-manager/dist/admin/constants/collections.mjs';

import { useDocumentRBAC as useDocumentRBACViaDeepImport } from '@strapi/content-manager/dist/admin/features/DocumentRBAC.mjs';

/**
 * Contract-test probe: the deep-imported module must be the SAME instance as the public
 * export (single admin build = single resolution per file). Compared against the public
 * `useDocumentRBAC` on the plugin diagnostics page.
 */
export const __singletonProbe = { useDocumentRBACViaDeepImport };
