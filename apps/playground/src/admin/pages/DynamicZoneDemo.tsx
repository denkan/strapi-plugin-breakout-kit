import * as React from 'react';
import {
  Box,
  Button,
  Flex,
  IconButton,
  Main,
  Modal,
  SingleSelect,
  SingleSelectOption,
  Typography,
} from '@strapi/design-system';
import {
  ArrowDown,
  ArrowUp,
  Images,
  Information,
  Link,
  Quotes,
  Sparkle,
  Trash,
} from '@strapi/icons';
import { styled } from 'styled-components';

import { useFetchClient } from '@strapi/strapi/admin';
import { EditPage } from 'strapi-plugin-breakout-kit/strapi-admin';
import type {
  AddButtonContext,
  ComponentEntry,
  ComponentEntryMeta,
  DefaultEntryComponent,
  EntryActionDefaults,
  EntryCustomization,
} from 'strapi-plugin-breakout-kit/strapi-admin';

/**
 * Issue #4 demo page: the dynamic-zone entry customization API on the seeded Article's
 * `sections` zone (shared.quote / shared.media-block / shared.link). Each mode is a
 * self-contained worked example; "stock" passes no config and must be indistinguishable
 * from the plain edit view (also the contract-test baseline).
 */

/**
 * Mode "sugars" — the three top-level slots. Every slot receives the stock default(s)
 * and treats `undefined` as "keep stock", so lookup-map misses fall through naturally.
 */
const CUSTOM_ICONS: Record<string, React.ReactNode> = {
  'shared.quote': <Quotes data-testid="dz-custom-icon" />,
  'shared.link': <Link data-testid="dz-custom-icon" />,
  // no entry for shared.media-block => entryIcon returns undefined => stock icon
};

const sugarsConfig: EntryCustomization = {
  // Mix custom and stock icons: return undefined to keep the default.
  entryIcon: (entry) => CUSTOM_ICONS[entry.componentUid],

  // Decorate the stock label instead of replacing it.
  entryLabel: (entry, defaultLabel) => `${entry.index + 1}. ${defaultLabel}`,

  // Actions come as MULTIPLE named defaults plus `all` (the stock-ordered composite).
  // All of them are live nodes — the drag handle keeps its drag & drop wiring wherever
  // you put it. Return undefined to keep stock untouched.
  entryActions: (entry: ComponentEntryMeta, d: EntryActionDefaults) => {
    const infoButton = (
      <IconButton
        variant="ghost"
        label="Entry info"
        data-testid="dz-custom-action"
        onClick={() =>
          window.alert(`${entry.schema?.displayName} — position ${entry.index + 1} of ${entry.total}`)
        }
      >
        <Information />
      </IconButton>
    );
    if (entry.componentUid === 'shared.quote') {
      // Surgical: quotes keep delete + reorder but lose the "more actions" menu.
      return (
        <>
          {infoButton}
          {d.delete}
          {d.drag}
          {d.moveUp}
          {d.moveDown}
        </>
      );
    }
    // Common case: prepend a custom action, keep everything stock.
    return (
      <>
        {infoButton}
        {d.all}
      </>
    );
  },
};

/**
 * Mode "renderEntry" — full chrome control per entry. `DefaultEntry` is the stock
 * accordion with all behavior pre-bound; pass `icon`/`label`/`actions` to tweak it,
 * or skip it entirely and build your own container around `entry.renderFields()`.
 */
const renderEntryConfig: EntryCustomization = {
  renderEntry: (entry: ComponentEntry, DefaultEntry: DefaultEntryComponent) => {
    if (entry.componentUid === 'shared.media-block') {
      // Keep stock behavior, override chrome pieces per entry via DefaultEntry props.
      return <DefaultEntry icon={<Images />} label={`Media — ${entry.schema?.displayName}`} />;
    }
    if (entry.componentUid === 'shared.link') {
      // Custom chrome: no accordion at all. Reorder/remove affordances are ours now,
      // wired through entry.onMove / entry.onRemove.
      return (
        <Box
          hasRadius
          borderColor="primary200"
          background="primary100"
          padding={4}
          data-testid="dz-custom-chrome"
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
        </Box>
      );
    }
    // Everything else: untouched stock entry.
    return <DefaultEntry />;
  },
};

/**
 * Mode "boxes" — no accordion at all. Every entry becomes a styled, always-open card:
 * `renderEntry` never touches `DefaultEntry`, just wraps `entry.renderFields()` in its
 * own chrome. Reorder/remove affordances are ours, wired via entry.onMove/onRemove.
 */
const EntryCard = styled(Box)`
  border-left: 4px solid ${({ theme }) => theme.colors.primary600};
`;

const boxesConfig: EntryCustomization = {
  renderEntry: (entry: ComponentEntry) => (
    <EntryCard
      hasRadius
      background="neutral0"
      shadow="tableShadow"
      padding={6}
      marginBottom={4}
      data-testid="dz-box-entry"
    >
      <Flex justifyContent="space-between" paddingBottom={4}>
        <Typography variant="delta" tag="h3">
          {entry.index + 1}. {entry.schema?.displayName}
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
    </EntryCard>
  ),
};

/**
 * Mode "addButton" — replace the "Add a component" affordance entirely (issue #5).
 * A clearly-customized button opens a Modal listing every allowed component grouped by
 * category (plain buttons, no accordions); picking one calls `ctx.add(uid)` directly,
 * so the stock inline picker never opens. `ctx` also carries total/min/max/disabled
 * for custom limit handling (`ctx.add` does not enforce `max` on its own).
 */
const FancyAddButton = styled(Button)`
  width: 100%;
  justify-content: center;
  border: 2px dashed ${({ theme }) => theme.colors.primary600};
  background: ${({ theme }) => theme.colors.primary100};

  &:hover:not([aria-disabled='true']) {
    background: ${({ theme }) => theme.colors.primary200};
  }
`;

const CustomAddFlow = ({ ctx }: { ctx: AddButtonContext }) => {
  const [open, setOpen] = React.useState(false);
  const atMax = ctx.max !== undefined && ctx.total >= ctx.max;
  return (
    <>
      <FancyAddButton
        variant="tertiary"
        startIcon={<Sparkle />}
        disabled={ctx.disabled || atMax}
        onClick={() => setOpen(true)}
        data-testid="dz-custom-add"
      >
        Add a section — custom picker ({ctx.total} added)
      </FancyAddButton>
      <Modal.Root open={open} onOpenChange={setOpen}>
        <Modal.Content data-testid="dz-custom-picker">
          <Modal.Header>
            <Typography fontWeight="bold">Pick a component</Typography>
          </Modal.Header>
          <Modal.Body>
            {Object.entries(ctx.componentsByCategory).map(([category, comps]) => (
              <Box key={category} paddingBottom={4}>
                <Typography variant="sigma" textColor="neutral600" tag="h4">
                  {category}
                </Typography>
                <Flex gap={2} paddingTop={2} wrap="wrap">
                  {comps.map((comp) => (
                    <Button
                      key={comp.uid}
                      variant="secondary"
                      onClick={() => {
                        ctx.add(comp.uid);
                        setOpen(false);
                      }}
                    >
                      {comp.displayName}
                    </Button>
                  ))}
                </Flex>
              </Box>
            ))}
          </Modal.Body>
        </Modal.Content>
      </Modal.Root>
    </>
  );
};

const addButtonConfig: EntryCustomization = {
  renderAddButton: (ctx) => <CustomAddFlow ctx={ctx} />,
};

const MODES = [
  { value: 'stock', label: 'Stock (no config)' },
  { value: 'sugars', label: 'Sugars: entryIcon / entryLabel / entryActions' },
  { value: 'renderEntry', label: 'renderEntry: DefaultEntry tweaks + custom chrome' },
  { value: 'boxes', label: 'Boxes: no accordion, styled cards for every entry' },
  { value: 'addButton', label: 'renderAddButton: custom button + popup picker' },
] as const;

type Mode = (typeof MODES)[number]['value'];

const CONFIGS: Record<Mode, EntryCustomization | undefined> = {
  stock: undefined,
  sugars: sugarsConfig,
  renderEntry: renderEntryConfig,
  boxes: boxesConfig,
  addButton: addButtonConfig,
};

const DynamicZoneDemo = () => {
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
        <Flex gap={4} paddingBottom={6} data-testid="dz-demo-controls">
          <Box data-testid="dz-demo-mode">
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
        <Box data-testid="dz-demo-root">
          <EditPage
            key={mode}
            model="api::article.article"
            documentId={articleId}
            locale="en"
            form={{ dynamicZone: CONFIGS[mode] }}
          />
        </Box>
      </Box>
    </Main>
  );
};

export { DynamicZoneDemo };
