import * as React from 'react';
import { Badge, Box, Button, Field, Flex, Main, Typography } from '@strapi/design-system';

import { unstable_useContentManagerContext, useFetchClient } from '@strapi/strapi/admin';
import {
  DocumentProvider,
  useDocument,
  useDocumentOperations,
  useEditField,
} from 'strapi-plugin-breakout-kit/strapi-admin';

/**
 * Phase 3 checkpoint page: displays and edits documents using ONLY the data-layer hooks —
 * no router params, no component layer. Two <DocumentProvider>s coexist (a collection-type
 * article and the Global Setting single type), each with its own form state.
 */

const FieldEditor = ({ path, testId }: { path: string; testId: string }) => {
  const field = useEditField(path);
  return (
    <Field.Root name={path} error={field.error}>
      <Field.Label>{path}</Field.Label>
      <Field.Input
        data-testid={testId}
        value={(field.value as string) ?? ''}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          field.onChange(path, e.target.value)
        }
      />
      <Field.Error />
    </Field.Root>
  );
};

const DocumentPanel = ({
  label,
  fieldPath,
  testIdPrefix,
}: {
  label: string;
  fieldPath: string;
  testIdPrefix: string;
}) => {
  const { document, isLoading, status, hasDraftAndPublish } = useDocument();
  const ops = useDocumentOperations();
  const [lastResult, setLastResult] = React.useState('');
  const [mountedAt] = React.useState(() => Date.now());

  const handleSave = async () => {
    const res = await ops.save();
    setLastResult(res.error ? 'save-error' : 'saved');
  };

  if (isLoading) {
    return <Typography>Loading…</Typography>;
  }

  return (
    <Flex direction="column" alignItems="flex-start" gap={3} width="100%">
      <Flex gap={2}>
        <Typography variant="delta" tag="h2" data-testid={`${testIdPrefix}-heading`}>
          {label}
        </Typography>
        {hasDraftAndPublish ? <Badge>{status}</Badge> : null}
        <Badge data-testid={`${testIdPrefix}-modified`}>
          {ops.isModified ? 'modified' : 'clean'}
        </Badge>
      </Flex>
      <Typography variant="pi" textColor="neutral600" data-testid={`${testIdPrefix}-docid`}>
        documentId: {(document as { documentId?: string } | undefined)?.documentId ?? '(single type)'}
      </Typography>
      <FieldEditor path={fieldPath} testId={`${testIdPrefix}-input`} />
      <Flex gap={2}>
        <Button data-testid={`${testIdPrefix}-save`} onClick={handleSave} loading={ops.isLoading}>
          Save
        </Button>
        <Typography data-testid={`${testIdPrefix}-result`} data-mounted-at={mountedAt}>
          {lastResult}
        </Typography>
      </Flex>
    </Flex>
  );
};

/**
 * Proves STOCK Strapi hooks work inside a headless <DocumentProvider>:
 * unstable_useContentManagerContext is route-coupled upstream (its internal useDoc
 * reads URL params) — the plugin's shim rebuilds it with the headless fallback.
 */
const CmContextProbe = () => {
  const cm = unstable_useContentManagerContext();
  if (cm.isLoading) {
    return <Typography>cm-context loading…</Typography>;
  }
  return (
    <Typography variant="pi" textColor="neutral600" data-testid="cm-context-probe">
      unstable_useContentManagerContext → model: {cm.model}, collectionType:{' '}
      {cm.collectionType}, D&P: {String(cm.hasDraftAndPublish)}, creating:{' '}
      {String(cm.isCreatingEntry)}, layout panels:{' '}
      {cm.layout.edit?.layout?.length ?? 0}
    </Typography>
  );
};

const HooksDemo = () => {
  const { get } = useFetchClient();
  const [articleId, setArticleId] = React.useState<string | null>(null);

  // Pick the first seeded article — via the admin API, not route params.
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

  return (
    <Main>
      <Box padding={8}>
        <Flex direction="column" alignItems="flex-start" gap={6}>
          <Typography variant="alpha" tag="h1">
            Hooks-only demo (two coexisting providers)
          </Typography>
          <Flex gap={8} alignItems="flex-start" width="100%" wrap="wrap">
            <Box width="40%" minWidth="320px" data-testid="pane-article">
              {articleId ? (
                <DocumentProvider
                  model="api::article.article"
                  documentId={articleId}
                  fallback={<Typography>Loading article…</Typography>}
                >
                  <DocumentPanel
                    label="Article"
                    fieldPath="title"
                    testIdPrefix="hooks-article"
                  />
                  <CmContextProbe />
                </DocumentProvider>
              ) : (
                <Typography>Resolving article…</Typography>
              )}
            </Box>
            <Box width="40%" minWidth="320px" data-testid="pane-single">
              <DocumentProvider
                model="api::global-setting.global-setting"
                fallback={<Typography>Loading global setting…</Typography>}
              >
                <DocumentPanel
                  label="Global Setting"
                  fieldPath="siteName"
                  testIdPrefix="hooks-single"
                />
              </DocumentProvider>
            </Box>
          </Flex>
        </Flex>
      </Box>
    </Main>
  );
};

export { HooksDemo };
