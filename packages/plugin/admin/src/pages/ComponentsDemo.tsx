import * as React from 'react';
import { Box, Flex, Main, Typography } from '@strapi/design-system';

import { useFetchClient } from '../access';
import {
  DocumentActionsBar,
  EditForm,
  EditHeader,
  EditSidePanels,
} from '../components';
import { DocumentProvider } from '../data';

/**
 * Phase 4 checkpoint page: the component layer rendering the seeded Article — every
 * field type through <EditForm>/<FieldRenderer> — plus header and side panels. This is
 * effectively the <EditPage> prototype ahead of the Phase 5 composition layer.
 */
const ComponentsDemo = () => {
  const { get } = useFetchClient();
  const [articleId, setArticleId] = React.useState<string | null>(null);
  const [saveCount, setSaveCount] = React.useState(0);

  React.useEffect(() => {
    get('/content-manager/collection-types/api::article.article', {
      params: { page: 1, pageSize: 1, sort: 'createdAt:ASC' },
    })
      .then((res) => {
        const data = res.data as { results?: Array<{ documentId: string }> };
        setArticleId(data.results?.[0]?.documentId ?? null);
      })
      .catch(() => setArticleId(null));
  }, [get]);

  if (!articleId) {
    return (
      <Main>
        <Box padding={8}>
          <Typography>Resolving article…</Typography>
        </Box>
      </Main>
    );
  }

  return (
    <Main>
      <Box padding={8} data-testid="components-demo">
        <DocumentProvider
          model="api::article.article"
          documentId={articleId}
          fallback={<Typography>Loading…</Typography>}
        >
          <EditHeader />
          <Typography variant="pi" data-testid="components-save-count">
            saves: {saveCount}
          </Typography>
          <Flex gap={6} alignItems="flex-start">
            <Box style={{ flex: 3 }} minWidth={0} data-testid="components-form">
              <EditForm />
            </Box>
            <Box style={{ flex: 1 }} minWidth="240px" data-testid="components-panels">
              <EditSidePanels />
            </Box>
          </Flex>
        </DocumentProvider>
      </Box>
    </Main>
  );
};

export { ComponentsDemo };
