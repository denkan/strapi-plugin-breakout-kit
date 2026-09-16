import * as React from 'react';
import {
  Box,
  Flex,
  Main,
  SingleSelect,
  SingleSelectOption,
  Typography,
} from '@strapi/design-system';

import { useFetchClient } from '../access';
import { EditPage } from '../composition';

/**
 * Phase 5 checkpoint page: renders <EditPage> for any model/document/locale chosen via
 * INPUTS (never route params). Also the parity-test target.
 */

const MODELS = [
  { uid: 'api::article.article', label: 'Article (D&P + i18n)', kind: 'collectionType' },
  { uid: 'api::author.author', label: 'Author', kind: 'collectionType' },
  { uid: 'api::category.category', label: 'Category', kind: 'collectionType' },
  { uid: 'api::global-setting.global-setting', label: 'Global Setting (single)', kind: 'singleType' },
] as const;

const EditPageDemo = () => {
  const { get } = useFetchClient();
  const [model, setModel] = React.useState<(typeof MODELS)[number]['uid']>(MODELS[0].uid);
  const [documents, setDocuments] = React.useState<Array<{ documentId: string; label: string }>>([]);
  const [documentId, setDocumentId] = React.useState<string | undefined>(undefined);
  const [locale, setLocale] = React.useState<string | undefined>(undefined);

  const kind = MODELS.find((entry) => entry.uid === model)?.kind ?? 'collectionType';

  React.useEffect(() => {
    setDocumentId(undefined);
    setDocuments([]);
    if (kind === 'singleType') return;
    get(`/content-manager/collection-types/${model}`, {
      params: { page: 1, pageSize: 20, sort: 'createdAt:ASC' },
    })
      .then((res) => {
        const data = res.data as {
          results?: Array<Record<string, unknown> & { documentId: string }>;
        };
        const docs = (data.results ?? []).map((doc) => ({
          documentId: doc.documentId,
          label: String(doc.title ?? doc.name ?? doc.siteName ?? doc.documentId),
        }));
        setDocuments(docs);
        setDocumentId(docs[0]?.documentId);
      })
      .catch(() => undefined);
  }, [get, model, kind]);

  const ready = kind === 'singleType' || documentId;

  return (
    <Main>
      <Box padding={8}>
        <Flex gap={4} paddingBottom={6} data-testid="editpage-controls" wrap="wrap">
          <Box data-testid="editpage-model">
          <SingleSelect
            aria-label="Model"
            value={model}
            onChange={(value: string | number) => setModel(value as (typeof MODELS)[number]['uid'])}
          >
            {MODELS.map((entry) => (
              <SingleSelectOption key={entry.uid} value={entry.uid}>
                {entry.label}
              </SingleSelectOption>
            ))}
          </SingleSelect>
          </Box>
          {kind === 'collectionType' ? (
            <Box data-testid="editpage-document">
            <SingleSelect
              aria-label="Document"
              value={documentId ?? ''}
              onChange={(value: string | number) => setDocumentId(String(value))}
            >
              {documents.map((doc) => (
                <SingleSelectOption key={doc.documentId} value={doc.documentId}>
                  {doc.label}
                </SingleSelectOption>
              ))}
            </SingleSelect>
            </Box>
          ) : null}
          {model === 'api::article.article' ? (
            <Box data-testid="editpage-locale">
            <SingleSelect
              aria-label="Locale"
              value={locale ?? 'en'}
              onChange={(value: string | number) => setLocale(String(value))}
            >
              <SingleSelectOption value="en">en</SingleSelectOption>
              <SingleSelectOption value="sv">sv</SingleSelectOption>
            </SingleSelect>
            </Box>
          ) : null}
        </Flex>
        {ready ? (
          <Box data-testid="editpage-root">
            <EditPage
              key={`${model}:${documentId ?? 'single'}:${locale ?? 'default'}`}
              model={model}
              documentId={kind === 'singleType' ? undefined : documentId}
              locale={model === 'api::article.article' ? (locale ?? 'en') : undefined}
              header={{ showStatus: true }}
            />
          </Box>
        ) : (
          <Typography>Loading documents…</Typography>
        )}
      </Box>
    </Main>
  );
};

export { EditPageDemo };
