import * as React from 'react';

import { InputRenderer } from '../access';
import type { EditFieldLayout } from '../access';
import { useHeadlessData } from '../data/context';

export type FieldRendererProps = Omit<EditFieldLayout, 'size'> & {
  /** Override the document fed to the input (defaults to the provider's document). */
  document?: unknown;
};

/**
 * Layer 3: renders ONE field with the stock content-manager input for its type —
 * including blocks, relations, components, dynamic zones, media, UID and custom
 * fields — with per-field RBAC applied. Must be used inside <DocumentProvider>.
 */
export const FieldRenderer = ({ document, ...field }: FieldRendererProps) => {
  const { currentDocument } = useHeadlessData('FieldRenderer');
  return <InputRenderer {...(field as EditFieldLayout)} document={document ?? currentDocument} />;
};
