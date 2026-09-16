import * as React from 'react';

import type { useStrapiDocument } from './public';

/**
 * Typed twin of vite/runtime/headless-document-context.mjs. Both modules get-or-create the
 * context through the same global symbol, so the plugin bundle and the Vite-injected
 * useDocumentContext shim share one React context instance regardless of module identity
 * or evaluation order. Keep the symbol and value shape in sync with the runtime file.
 */
export type CollectionType = 'collection-types' | 'single-types';

export interface DocumentMeta {
  model: string;
  collectionType: CollectionType;
  documentId?: string;
  params?: {
    locale?: string;
    status?: 'draft' | 'published';
    [key: string]: unknown;
  };
}

export type UseDocumentReturn = ReturnType<typeof useStrapiDocument>;

export interface HeadlessDocumentContextValue {
  currentDocumentMeta: DocumentMeta;
  currentDocument: UseDocumentReturn;
}

const KEY = Symbol.for('strapi-plugin-headless-content-manager/document-context@v1');

type HeadlessContext = React.Context<HeadlessDocumentContextValue | null>;

export function getHeadlessDocumentContext(): HeadlessContext {
  const store = globalThis as { [KEY]?: HeadlessContext };
  if (!store[KEY]) {
    store[KEY] = React.createContext<HeadlessDocumentContextValue | null>(null);
  }
  return store[KEY];
}

/** Reads the headless document context; null when no <DocumentProvider> is above. */
export function useHeadlessDocument(): HeadlessDocumentContextValue | null {
  return React.useContext(getHeadlessDocumentContext());
}
