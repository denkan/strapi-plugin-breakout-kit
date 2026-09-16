import * as React from 'react';
import { Flex, Link, Typography } from '@strapi/design-system';
import { ArrowLeft } from '@strapi/icons';
import { useIntl } from 'react-intl';

import { DocumentStatus } from '../access';
import { useHeadlessData } from '../data/context';
import { resolveOverride, type Override } from '../data/override';

/**
 * Mirrors CM's getDocumentStatus (pages/EditView/EditViewPage.tsx, ~10 lines; the file's
 * exports are drift-watched via the public export list): the displayed status is the
 * document's own status, except a draft that has a published version shows "published".
 */
const getDocumentStatus = (
  document: { status?: string } | undefined,
  meta: { availableStatus?: Array<{ publishedAt: string | null }> } | undefined
): string => {
  const docStatus = document?.status;
  const statuses = meta?.availableStatus ?? [];
  if (!docStatus) return 'draft';
  if (docStatus === 'draft' && statuses.find((doc) => doc.publishedAt !== null)) {
    return 'published';
  }
  return docStatus;
};

export interface EditHeaderProps {
  /** Replacement or transform of the derived document title. */
  title?: Override<string>;
  showStatus?: boolean;
  /** Renders a back link when set; there is NO default navigation in headless mode. */
  backHref?: string;
  backLabel?: string;
  /** Custom toolbar content rendered to the right of the title (e.g. your own actions). */
  children?: React.ReactNode;
}

/**
 * Layer 3: document title + status badge + optional back link. Plugin-registered header
 * actions (e.g. the i18n locale picker) are intentionally not rendered here yet — they
 * mutate route query params the headless provider does not read (see PLAN §5 Phase 4/5).
 */
export const EditHeader = ({
  title: titleOverride,
  showStatus = true,
  backHref,
  backLabel,
  children,
}: EditHeaderProps) => {
  const { currentDocument, editLayout, isCreating, hasDraftAndPublish } =
    useHeadlessData('EditHeader');
  const { formatMessage } = useIntl();

  const mainField =
    (editLayout as { settings?: { mainField?: string } } | undefined)?.settings?.mainField ??
    'id';
  const doc = currentDocument as unknown as {
    document?: { status?: string };
    meta?: { availableStatus?: Array<{ publishedAt: string | null }> };
    getTitle?: (mainField: string) => string;
  };

  const defaultTitle = isCreating
    ? formatMessage({
        id: 'content-manager.containers.edit.title.new',
        defaultMessage: 'Create an entry',
      })
    : (doc.getTitle?.(mainField) ?? '');
  const title = resolveOverride(titleOverride, defaultTitle);

  const status =
    showStatus && hasDraftAndPublish && !isCreating
      ? getDocumentStatus(doc.document, doc.meta)
      : undefined;

  return (
    <Flex direction="column" alignItems="flex-start" gap={2} paddingBottom={4}>
      {backHref ? (
        <Link startIcon={<ArrowLeft />} href={backHref}>
          {backLabel ??
            formatMessage({ id: 'global.back', defaultMessage: 'Back' })}
        </Link>
      ) : null}
      <Flex width="100%" justifyContent="space-between" gap={2}>
        <Flex gap={2} alignItems="center">
          <Typography variant="alpha" tag="h1">
            {title}
          </Typography>
          {status ? <DocumentStatus status={status} size="M" /> : null}
        </Flex>
        {children ? <Flex gap={2}>{children}</Flex> : null}
      </Flex>
    </Flex>
  );
};
