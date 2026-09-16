/**
 * Ambient typings for deep imports into @strapi/content-manager's unbundled dist.
 * These specifiers are resolved by the headlessContentManager() Vite plugin (the packages'
 * exports maps would otherwise reject them); every module listed here is drift-tracked in
 * drift/manifest.json. Types are intentionally minimal — refined as layers above need more.
 */

declare module '@strapi/content-manager/dist/admin/pages/EditView/components/InputRenderer.mjs' {
  import type * as React from 'react';
  import type { EditFieldLayout } from '@strapi/content-manager/strapi-admin';

  export type InputRendererProps = EditFieldLayout & {
    /** Override for the document read from useDocumentContext. */
    document?: unknown;
    visible?: boolean;
  };
  export const InputRenderer: React.NamedExoticComponent<InputRendererProps>;
}

declare module '@strapi/content-manager/dist/admin/pages/EditView/components/FormLayout.mjs' {
  import type * as React from 'react';
  import type { EditFieldLayout } from '@strapi/content-manager/strapi-admin';

  export interface FormLayoutProps {
    layout: EditFieldLayout[][][];
    document: unknown;
    hasBackground?: boolean;
  }
  export const FormLayout: React.ComponentType<FormLayoutProps>;
}

declare module '@strapi/content-manager/dist/admin/pages/EditView/components/DocumentActions.mjs' {
  import type * as React from 'react';
  import type {
    DocumentActionComponent,
    DocumentActionDescription,
  } from '@strapi/content-manager/strapi-admin';

  export interface DocumentActionsProps {
    actions: Array<DocumentActionDescription & { id: string }>;
  }
  export const DocumentActions: React.ComponentType<DocumentActionsProps>;
  export const DocumentActionButton: React.ComponentType<
    DocumentActionDescription & { id?: string }
  >;
  export const DocumentActionsMenu: React.ComponentType<{
    actions: Array<DocumentActionDescription & { id: string }>;
    children?: React.ReactNode;
    label?: string;
    variant?: string;
  }>;
  export const DEFAULT_ACTIONS: DocumentActionComponent[];
}

declare module '@strapi/content-manager/dist/admin/pages/EditView/utils/data.mjs' {
  export function transformDocument(
    schema: unknown,
    components: Record<string, unknown>
  ): (document: Record<string, unknown>) => Record<string, unknown>;
  export function handleInvisibleAttributes(
    data: Record<string, unknown>,
    ctx: {
      schema?: unknown;
      initialValues?: Record<string, unknown>;
      components?: Record<string, unknown>;
    }
  ): { data: Record<string, unknown>; removedAttributes: string[] };
}

declare module '@strapi/content-manager/dist/admin/pages/EditView/utils/forms.mjs' {
  export function createDefaultForm(
    contentType: unknown,
    components?: Record<string, unknown>
  ): Record<string, unknown>;
}

declare module '@strapi/content-manager/dist/admin/utils/validation.mjs' {
  import type * as yup from 'yup';

  export function createYupSchema(
    attributes?: Record<string, unknown>,
    components?: Record<string, unknown>,
    options?: { status?: 'draft' | 'published' | null; removedAttributes?: string[] }
  ): yup.ObjectSchema<Record<string, unknown>>;
}

declare module '@strapi/content-manager/dist/admin/hooks/useContentTypeSchema.mjs' {
  export function useContentTypeSchema(model?: string): {
    components: Record<string, unknown>;
    schema: unknown;
    schemas: unknown[];
    isLoading: boolean;
  };
}

declare module '@strapi/content-manager/dist/admin/hooks/useLazyComponents.mjs' {
  import type * as React from 'react';

  export function useLazyComponents(componentUids?: string[]): {
    isLazyLoading: boolean;
    lazyComponentStore: Record<string, React.ComponentType<unknown> | undefined>;
    cleanup: () => void;
  };
}

declare module '@strapi/content-manager/dist/admin/hooks/useDocumentContext.mjs' {
  export function useDocumentContext(consumerName: string): {
    currentDocumentMeta: {
      collectionType: string;
      model: string;
      documentId?: string;
      params?: Record<string, unknown>;
    };
    currentDocument: unknown;
  };
  /** Present only when the headlessContentManager() Vite shim replaced the module. */
  export const __headlessShim: boolean | undefined;
}

declare module '@strapi/content-manager/dist/admin/features/DocumentRBAC.mjs' {
  export { DocumentRBAC, useDocumentRBAC } from '@strapi/content-manager/strapi-admin';
}

declare module '@strapi/content-manager/dist/admin/constants/collections.mjs' {
  export const SINGLE_TYPES: 'single-types';
  export const COLLECTION_TYPES: 'collection-types';
}
