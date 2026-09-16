import * as React from 'react';

import type { DocumentMeta, UseDocumentReturn } from '../access';
import type { EditLayout } from '../access';

export interface DocumentCallbacks {
  onCreated?: (doc: { documentId: string }) => void;
  onCloned?: (doc: { documentId: string }) => void;
  onDeleted?: () => void;
  onPublished?: (doc: { documentId?: string }) => void;
  onUnpublished?: () => void;
  onDiscarded?: () => void;
  onError?: (error: unknown) => void;
}

export interface HeadlessDataContextValue {
  meta: DocumentMeta;
  /** useDocument-shaped object, with controlled-mode overrides already applied. */
  currentDocument: UseDocumentReturn;
  isCreating: boolean;
  hasDraftAndPublish: boolean;
  status: 'draft' | 'published';
  editLayout: EditLayout;
  isLayoutLoading: boolean;
  initialValues: Record<string, unknown> | undefined;
  callbacks: DocumentCallbacks;
}

const HeadlessDataContext = React.createContext<HeadlessDataContextValue | null>(null);

export const HeadlessDataProvider = HeadlessDataContext.Provider;

export function useHeadlessData(consumerName: string): HeadlessDataContextValue {
  const value = React.useContext(HeadlessDataContext);
  if (!value) {
    throw new Error(
      `${consumerName} must be used inside a <DocumentProvider> from strapi-plugin-breakout-kit`
    );
  }
  return value;
}
