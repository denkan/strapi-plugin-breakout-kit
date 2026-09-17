import * as React from 'react';
import {
  Box,
  Button,
  Flex,
  Main,
  SingleSelect,
  SingleSelectOption,
  Typography,
} from '@strapi/design-system';
import { PlusCircle, Trash } from '@strapi/icons';
import { styled } from 'styled-components';

import { useFetchClient } from '@strapi/strapi/admin';
import { EditPage } from 'strapi-plugin-breakout-kit/strapi-admin';
import type {
  ComponentBox,
  SingleComponentCustomization,
} from 'strapi-plugin-breakout-kit/strapi-admin';

/**
 * Single-component renderBox demo, on the seeded Article's `seo` field (shared.seo,
 * non-repeatable). ONE state-aware seam: `box.value` is null while uninitialized
 * (stock shows the "click to add" box) and the component data once set (stock shows
 * the boxed fields). Return `undefined` for any state you want to keep stock.
 */
const SeoCard = styled(Box)`
  border: 2px solid ${({ theme }) => theme.colors.success500};
`;

const InitializerButton = styled(Box)`
  width: 100%;
  border: 2px dashed ${({ theme }) => theme.colors.success500};
  cursor: pointer;
`;

const customConfig: SingleComponentCustomization = {
  renderBox: (box: ComponentBox) => {
    if (!box.value) {
      // Null state: replace the stock "No entry yet" box with our own CTA.
      return (
        <InitializerButton
          tag="button"
          type="button"
          hasRadius
          background="success100"
          paddingTop={6}
          paddingBottom={6}
          onClick={() => box.onInitialize()}
          disabled={box.disabled}
          data-testid="sc-custom-init"
        >
          <Flex direction="column" gap={2} alignItems="center">
            <PlusCircle width="2.4rem" height="2.4rem" />
            <Typography fontWeight="bold" textColor="success600">
              Set up {box.schema?.displayName} — custom initializer
            </Typography>
          </Flex>
        </InitializerButton>
      );
    }
    // Value state: our own chrome around the stock fields grid, with a clear action
    // wired through box.onClear (same as the stock "Reset Entry" trash).
    return (
      <SeoCard hasRadius background="neutral0" padding={6} data-testid="sc-custom-box">
        <Flex justifyContent="space-between" paddingBottom={4}>
          <Typography variant="delta" tag="h3">
            {box.schema?.displayName} — custom box
          </Typography>
          <Button
            variant="danger-light"
            size="S"
            startIcon={<Trash />}
            onClick={() => box.onClear()}
            data-testid="sc-custom-clear"
          >
            Clear
          </Button>
        </Flex>
        {box.renderFields()}
      </SeoCard>
    );
  },
};

const MODES = [
  { value: 'stock', label: 'Stock (no config)' },
  { value: 'custom', label: 'renderBox: custom initializer + custom box' },
] as const;

type Mode = (typeof MODES)[number]['value'];

const CONFIGS: Record<Mode, SingleComponentCustomization | undefined> = {
  stock: undefined,
  custom: customConfig,
};

const SingleComponentDemo = () => {
  const { get } = useFetchClient();
  const [articleId, setArticleId] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<Mode>('custom');

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
      <Box padding={8}>
        <Flex gap={4} paddingBottom={6} data-testid="sc-demo-controls">
          <Box data-testid="sc-demo-mode">
            <SingleSelect
              aria-label="Customization mode"
              value={mode}
              onChange={(value: string | number) => setMode(value as Mode)}
            >
              {MODES.map((entry) => (
                <SingleSelectOption key={entry.value} value={entry.value}>
                  {entry.label}
                </SingleSelectOption>
              ))}
            </SingleSelect>
          </Box>
        </Flex>
        <Box data-testid="sc-demo-root">
          <EditPage
            key={mode}
            model="api::article.article"
            documentId={articleId}
            locale="en"
            form={{ singleComponent: CONFIGS[mode] }}
          />
        </Box>
      </Box>
    </Main>
  );
};

export { SingleComponentDemo };
