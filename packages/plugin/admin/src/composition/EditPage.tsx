import * as React from 'react';
import { Box, Grid, Tabs, Typography } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { styled } from 'styled-components';

import { Layouts } from '../access';
import {
  DocumentActionsBar,
  EditForm,
  EditHeader,
  EditSidePanels,
  type DocumentActionsBarProps,
  type EditFormProps,
  type EditHeaderProps,
  type EditSidePanelsProps,
} from '../components';
import { DocumentProvider, type DocumentProviderProps } from '../data';
import { useHeadlessData } from '../data/context';

/** Same visual treatment as the stock status tabs. */
const StatusTab = styled(Tabs.Trigger)`
  text-transform: uppercase;
`;

export interface EditPageProps
  extends Omit<DocumentProviderProps, 'children' | 'status'> {
  /** Controlled draft/published tab; omit for internal state (default 'draft'). */
  status?: 'draft' | 'published';
  defaultStatus?: 'draft' | 'published';
  onStatusChange?: (status: 'draft' | 'published') => void;
  /** false hides the section; object forwards props. */
  header?: false | EditHeaderProps;
  sidePanels?: false | EditSidePanelsProps;
  form?: EditFormProps;
  actions?: DocumentActionsBarProps;
}

interface EditPageContentProps {
  status: 'draft' | 'published';
  onStatusChange: (status: 'draft' | 'published') => void;
  header: false | EditHeaderProps;
  sidePanels: false | EditSidePanelsProps;
  form: EditFormProps;
}

/**
 * Inside the provider: header + status tabs + form grid + side panels, arranged like the
 * stock EditViewPage (Grid.Root gap 4 → col 9 tabs/form + col 3 panels; per-status
 * Tabs.Content both rendering the form; guided tour omitted per docs/decisions.md #3).
 */
const EditPageContent = ({
  status,
  onStatusChange,
  header,
  sidePanels,
  form,
}: EditPageContentProps) => {
  const { hasDraftAndPublish, currentDocument } = useHeadlessData('EditPage');
  const { formatMessage } = useIntl();

  const meta = (currentDocument as { meta?: { availableStatus?: unknown[] } }).meta;

  return (
    <>
      {header === false ? null : <EditHeader {...header} />}
      {/* Layouts.Content = the stock page's content container (same paddings/geometry). */}
      <Layouts.Content>
      <Tabs.Root
        variant="simple"
        value={status}
        onValueChange={(value: string) => onStatusChange(value as 'draft' | 'published')}
      >
        <Tabs.List
          aria-label={formatMessage({
            id: 'content-manager.containers.edit.tabs.label',
            defaultMessage: 'Document status',
          })}
        >
          {hasDraftAndPublish ? (
            <>
              <StatusTab value="draft">
                {formatMessage({
                  id: 'content-manager.containers.edit.tabs.draft',
                  defaultMessage: 'draft',
                })}
              </StatusTab>
              <StatusTab
                value="published"
                disabled={!meta || (meta.availableStatus ?? []).length === 0}
              >
                {formatMessage({
                  id: 'content-manager.containers.edit.tabs.published',
                  defaultMessage: 'published',
                })}
              </StatusTab>
            </>
          ) : null}
        </Tabs.List>
        <Grid.Root paddingTop={{ initial: 6, medium: 4, large: 8 }} gap={4}>
          <Grid.Item col={9} xs={12} direction="column" alignItems="stretch">
            <Tabs.Content value="draft">
              <EditForm {...form} />
            </Tabs.Content>
            <Tabs.Content value="published">
              <EditForm {...form} />
            </Tabs.Content>
          </Grid.Item>
          {sidePanels === false ? null : (
            <Grid.Item col={3} direction="column" alignItems="stretch">
              <EditSidePanels {...sidePanels} />
            </Grid.Item>
          )}
        </Grid.Root>
      </Tabs.Root>
      </Layouts.Content>
    </>
  );
};

/**
 * Layer 4: the one-liner full edit view — parity with the stock content manager edit
 * view, driven entirely by props.
 *
 * ```tsx
 * <EditPage model="api::article.article" documentId="abc123" locale="en" />
 * ```
 */
export const EditPage = ({
  status: statusProp,
  defaultStatus = 'draft',
  onStatusChange,
  header = {},
  sidePanels = {},
  form = {},
  actions: _actions,
  ...providerProps
}: EditPageProps) => {
  const [internalStatus, setInternalStatus] = React.useState<'draft' | 'published'>(
    defaultStatus
  );
  const status = statusProp ?? internalStatus;

  const handleStatusChange = (next: 'draft' | 'published') => {
    onStatusChange?.(next);
    if (statusProp === undefined) {
      setInternalStatus(next);
    }
  };

  return (
    <DocumentProvider
      {...providerProps}
      status={status}
      fallback={
        providerProps.fallback ?? (
          <Box padding={8}>
            <Typography textColor="neutral600">…</Typography>
          </Box>
        )
      }
    >
      <EditPageContent
        status={status}
        onStatusChange={handleStatusChange}
        header={header}
        sidePanels={sidePanels}
        form={form}
      />
    </DocumentProvider>
  );
};
