import * as React from 'react';
import {
  Box,
  Button,
  Flex,
  IconButton,
  Main,
  SingleSelect,
  SingleSelectOption,
  Typography,
} from '@strapi/design-system';
import { ArrowDown, ArrowUp, Information, Plus, Quotes, Trash } from '@strapi/icons';
import { styled } from 'styled-components';

import { useFetchClient } from '@strapi/strapi/admin';
import { EditPage } from 'strapi-plugin-breakout-kit/strapi-admin';
import type {
  AddButtonContext,
  ComponentEntry,
  EntryCustomization,
} from 'strapi-plugin-breakout-kit/strapi-admin';

/**
 * Issue #10 demo page: the SAME EntryCustomization shape as the dynamic-zone demo,
 * applied to repeatable components via the `repeatable` prop — here the seeded
 * Article's `quotes` field (shared.quote × 2). Notable repeatable quirks on display:
 * stock entries have NO icon (entryIcon can add one) and the default label is the raw
 * mainField value, often empty — entryLabel fixes a real annoyance.
 */
const sugarsConfig: EntryCustomization = {
  // Stock repeatables render no icon at all — this ADDS one.
  entryIcon: () => <Quotes data-testid="rep-custom-icon" />,

  // Default label = the entry's mainField value (may be '' when mainField is unset) —
  // decorate it with the position, fall back to the component name for empty entries.
  entryLabel: (entry, defaultLabel) =>
    `${entry.index + 1}. ${defaultLabel || entry.schema?.displayName}`,

  // Same multi-defaults contract as dynamic zones; `more` is always null here.
  entryActions: (entry, d) => (
    <>
      <IconButton
        variant="ghost"
        label="Entry info"
        data-testid="rep-custom-action"
        onClick={() =>
          window.alert(`${entry.schema?.displayName} ${entry.index + 1}/${entry.total}`)
        }
      >
        <Information />
      </IconButton>
      {d.all}
    </>
  ),
};

/**
 * Mode "custom" — full replacement: cards instead of the accordion, and a custom add
 * button (repeatables have no picker, so `ctx.add()` simply appends an entry).
 */
const QuoteCard = styled(Box)`
  border-left: 4px solid ${({ theme }) => theme.colors.secondary600};
`;

const CustomAddButton = ({ ctx }: { ctx: AddButtonContext }) => (
  <Button
    variant="secondary"
    startIcon={<Plus />}
    fullWidth
    disabled={ctx.disabled || (ctx.max !== undefined && ctx.total >= ctx.max)}
    onClick={() =>
      ctx.add(ctx.componentsByCategory[Object.keys(ctx.componentsByCategory)[0]][0].uid)
    }
    data-testid="rep-custom-add"
  >
    Add quote #{ctx.total + 1} — custom button
  </Button>
);

const customConfig: EntryCustomization = {
  renderEntry: (entry: ComponentEntry) => (
    <QuoteCard
      hasRadius
      background="neutral0"
      shadow="tableShadow"
      padding={4}
      marginBottom={2}
      data-testid="rep-box-entry"
    >
      <Flex justifyContent="space-between" paddingBottom={2}>
        <Typography fontWeight="bold">
          {entry.schema?.displayName} #{entry.index + 1}
        </Typography>
        <Flex gap={1}>
          <IconButton
            variant="ghost"
            label="Move up"
            disabled={entry.index === 0}
            onClick={() => entry.onMove(entry.index - 1)}
          >
            <ArrowUp />
          </IconButton>
          <IconButton
            variant="ghost"
            label="Move down"
            disabled={entry.index === entry.total - 1}
            onClick={() => entry.onMove(entry.index + 1)}
          >
            <ArrowDown />
          </IconButton>
          <IconButton variant="ghost" label="Remove" onClick={() => entry.onRemove()}>
            <Trash />
          </IconButton>
        </Flex>
      </Flex>
      {entry.renderFields()}
    </QuoteCard>
  ),
  renderAddButton: (ctx) => <CustomAddButton ctx={ctx} />,
};

/**
 * Mode "body" — stock accordion chrome, custom body: only the `text` field, rendered
 * through `entry.renderFields({ fields })` inside `<DefaultEntry body>`.
 */
const bodyConfig: EntryCustomization = {
  renderEntry: (entry: ComponentEntry, DefaultEntry) => (
    <DefaultEntry
      body={
        <Box padding={2} data-testid="rep-body">
          {entry.renderFields({ fields: ['text'] })}
        </Box>
      }
    />
  ),
};

const MODES = [
  { value: 'stock', label: 'Stock (no config)' },
  { value: 'sugars', label: 'Sugars: added icon, fixed labels, extra action' },
  { value: 'custom', label: 'Custom: cards + custom add button' },
  { value: 'body', label: 'Body slot: DefaultEntry body with a field subset' },
] as const;

type Mode = (typeof MODES)[number]['value'];

const CONFIGS: Record<Mode, EntryCustomization | undefined> = {
  stock: undefined,
  sugars: sugarsConfig,
  custom: customConfig,
  body: bodyConfig,
};

const RepeatableDemo = () => {
  const { get } = useFetchClient();
  const [articleId, setArticleId] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<Mode>('sugars');

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
        <Flex gap={4} paddingBottom={6} data-testid="rep-demo-controls">
          <Box data-testid="rep-demo-mode">
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
        <Box data-testid="rep-demo-root">
          <EditPage
            key={mode}
            model="api::article.article"
            documentId={articleId}
            locale="en"
            form={{ repeatable: CONFIGS[mode] }}
          />
        </Box>
      </Box>
    </Main>
  );
};

export { RepeatableDemo };
