import type * as React from 'react';
import {
  DescriptionComponentRenderer,
  DocumentRBAC,
  DocumentStatus,
  Form,
  adminApi,
  buildValidParams,
  useDocumentRBAC,
  useStrapiDocument,
  useStrapiDocumentActions,
  useStrapiDocumentLayout,
} from './public';
import {
  DocumentActionButton,
  DocumentActions,
  FormLayout,
  InputRenderer,
  __headlessShim,
  createDefaultForm,
  createYupSchema,
  transformDocument,
  useContentTypeSchema,
  useLazyComponents,
} from './internal';
import { useDocumentRBAC as useDocumentRBACViaDeepImport } from '@strapi/content-manager/dist/admin/features/DocumentRBAC.mjs';

/**
 * Programmatic access-layer self-check, exported from the public entry. Lets a consumer
 * (and the playground diagnostics page / contract tests) verify that the Vite helper is
 * wired correctly WITHOUT importing Strapi internals from app source — in dev mode,
 * source-level deep imports would pull the content-manager graph out of the dep prebundle
 * and split module singletons (the plugin entry itself is prebundled, so routing every
 * probe through here keeps one module graph).
 */
export interface AccessDiagnostics {
  /** Raw references to every adapter, for existence/render checks. */
  refs: Record<string, unknown> & {
    useContentTypeSchema: (model?: string) => {
      components: Record<string, unknown>;
      schema: unknown;
      isLoading: boolean;
    };
    DocumentStatus: React.ComponentType<Record<string, unknown>>;
  };
  headlessShimActive: boolean;
  singletonOk: boolean;
}

export const accessDiagnostics: AccessDiagnostics = {
  refs: {
    useStrapiDocument,
    useStrapiDocumentActions,
    useStrapiDocumentLayout,
    DocumentRBAC,
    useDocumentRBAC,
    buildValidParams,
    DocumentStatus: DocumentStatus as unknown as React.ComponentType<Record<string, unknown>>,
    Form,
    adminApi,
    DescriptionComponentRenderer,
    InputRenderer,
    FormLayout,
    DocumentActions,
    DocumentActionButton,
    transformDocument,
    createDefaultForm,
    createYupSchema,
    useContentTypeSchema,
    useLazyComponents,
  },
  /** True when the Vite helper's useDocumentContext shim replaced the stock module. */
  headlessShimActive: __headlessShim === true,
  /** True when deep imports and public exports resolve to the same module instances. */
  singletonOk: useDocumentRBACViaDeepImport === useDocumentRBAC,
};
