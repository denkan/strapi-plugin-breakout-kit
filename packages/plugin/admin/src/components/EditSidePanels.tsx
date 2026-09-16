import * as React from 'react';
import { Flex, Typography } from '@strapi/design-system';
import { useIntl } from 'react-intl';

import { DocumentActionsBar } from './DocumentActionsBar';

/**
 * Panel card replicating CM's internal (unexported) Panel from
 * pages/EditView/components/Panels.tsx — an aside card with a sigma title.
 */
const PanelCard = React.forwardRef<
  HTMLElement,
  { title: string; children: React.ReactNode }
>(({ title, children }, ref) => (
  <Flex
    ref={ref}
    tag="aside"
    aria-labelledby="additional-information"
    background="neutral0"
    borderColor="neutral150"
    hasRadius
    padding={4}
    shadow="tableShadow"
    gap={3}
    direction="column"
    justifyContent="stretch"
    alignItems="flex-start"
    width="100%"
  >
    <Typography tag="h2" variant="sigma" textTransform="uppercase" textColor="neutral600">
      {title}
    </Typography>
    {children}
  </Flex>
));
PanelCard.displayName = 'PanelCard';

export interface EditSidePanelsProps {
  /** Replace or wrap the default "Entry" actions panel. */
  renderPanel?: (
    panel: { title: string; children: React.ReactNode },
    Default: typeof PanelCard
  ) => React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Layer 3: the right-hand side panels. v0 renders the "Entry" actions panel (stock
 * ActionsPanel equivalent, backed by DocumentActionsBar) plus any children panels.
 * Third-party panels registered via the CM extension API are not rendered yet —
 * route-coupled ones (preview) are excluded by decision #4; the rest land with Phase 5.
 */
export const EditSidePanels = ({ renderPanel, children }: EditSidePanelsProps) => {
  const { formatMessage } = useIntl();
  const title = formatMessage({
    id: 'content-manager.containers.edit.panels.default.title',
    defaultMessage: 'Entry',
  });

  const content = <DocumentActionsBar />;

  return (
    <Flex direction="column" alignItems="stretch" gap={2}>
      {renderPanel ? (
        renderPanel({ title, children: content }, PanelCard)
      ) : (
        <PanelCard title={title}>{content}</PanelCard>
      )}
      {children}
    </Flex>
  );
};
