import * as React from 'react';
import { Badge, Box, Flex, Typography } from '@strapi/design-system';
import { useNavigate } from 'react-router-dom';

import { EditPage } from 'strapi-plugin-breakout-kit/strapi-admin';
import type { EditViewRouteInfo } from 'strapi-plugin-breakout-kit/strapi-admin';

/**
 * The replacement component registered via setEditViewReplacement (see ../app.tsx):
 * mounted by the STOCK content-manager route for api::category.category, receiving the
 * parsed route info as props. Renders a visible banner (so tests/humans can tell it
 * apart) around a prop-driven <EditPage> — but it could be anything.
 */
const CustomCategoryEditView = (route: EditViewRouteInfo) => {
  const navigate = useNavigate();
  return (
    <Box padding={8} data-testid="custom-edit-view">
      <Flex gap={2} paddingBottom={4}>
        <Typography variant="delta" tag="h2">
          Custom category editor (replaces the stock edit view)
        </Typography>
        <Badge>{route.isCreate ? 'create' : route.documentId}</Badge>
      </Flex>
      <EditPage
        model={route.model}
        documentId={route.documentId}
        locale={route.locale}
        header={{ showStatus: true }}
        // Mirror the stock create flow: swap /create for the new document's edit route.
        onCreated={({ documentId }) => navigate(`../${documentId}`, { relative: 'path' })}
      />
    </Box>
  );
};

export { CustomCategoryEditView };
