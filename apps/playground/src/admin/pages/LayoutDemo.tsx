import * as React from 'react';
import {
  Accordion,
  Box,
  Flex,
  Main,
  SingleSelect,
  SingleSelectOption,
  Tabs,
  Typography,
} from '@strapi/design-system';

import { useFetchClient } from '@strapi/strapi/admin';
import {
  DocumentProvider,
  EditForm,
  EditPage,
  useEditForm,
} from 'strapi-plugin-breakout-kit/strapi-admin';
import type { PanelInfo, RenderBody } from 'strapi-plugin-breakout-kit/strapi-admin';

/**
 * renderBody demo: rearrange the form body's PANELS (Strapi's term — the white boxes
 * the edit view stacks; every dynamic zone forms its own full-width panel). The seam
 * receives every rendered panel at once, so cross-panel layouts (accordion grouping,
 * tabs) become plain compositions of `panel.node`.
 */

/** "General accordion": everything NOT in a dynamic zone goes into one accordion. */
const accordionBody: RenderBody = (panels) => {
  const general = panels.filter((p) => !p.isDynamicZone);
  const zones = panels.filter((p) => p.isDynamicZone);
  return (
    <Flex direction="column" alignItems="stretch" gap={6}>
      <Box data-testid="body-general-accordion">
        <Accordion.Root defaultValue="general">
          <Accordion.Item value="general">
            <Accordion.Header>
              <Accordion.Trigger>General</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content>
              <Box padding={6}>
                <Flex direction="column" alignItems="stretch" gap={6}>
                  {general.map((panel) => panel.node)}
                </Flex>
              </Box>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      </Box>
      {zones.map((panel) => panel.node)}
    </Flex>
  );
};

/** Tabs: one tab per panel — "General" for field boxes, the zone name for DZ panels. */
const tabLabel = (panel: PanelInfo) =>
  panel.isDynamicZone ? (panel.fields[0]?.[0]?.label ?? panel.fields[0]?.[0]?.name) : 'General';

const tabsBody: RenderBody = (panels) => (
  <Box data-testid="body-tabs">
    <Tabs.Root defaultValue={`panel-${panels[0]?.index ?? 0}`}>
      <Tabs.List aria-label="Form sections">
        {panels.map((panel) => (
          <Tabs.Trigger key={panel.index} value={`panel-${panel.index}`}>
            {String(tabLabel(panel))}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {panels.map((panel) => (
        <Tabs.Content key={panel.index} value={`panel-${panel.index}`}>
          <Box paddingTop={6}>{panel.node}</Box>
        </Tabs.Content>
      ))}
    </Tabs.Root>
  </Box>
);

/**
 * Dogfood replica of a consumer "controller": subscribes to the whole form values
 * (useEditForm().values) so it RE-RENDERS ON EVERY KEYSTROKE, and renders the
 * stock-body <EditForm> beneath it. The plugin must keep every rendered piece
 * mounted across those re-renders (stable DefaultBody identity + memoized inputs) —
 * a remount here loses input focus and re-fires mount-time fetches.
 */
const ValuesController = () => {
  const { values } = useEditForm();
  return (
    <Flex direction="column" alignItems="stretch" gap={4}>
      <Typography data-testid="controller-values-size">
        {`values:${JSON.stringify(values ?? {}).length}`}
      </Typography>
      <EditForm />
    </Flex>
  );
};

const MODES = [
  { value: 'stock', label: 'Stock (no config)' },
  { value: 'accordion', label: 'renderBody: General accordion + zones below' },
  { value: 'tabs', label: 'renderBody: one tab per panel' },
  { value: 'controller', label: 'controller: values-subscribed wrapper + stock EditForm' },
] as const;

type Mode = (typeof MODES)[number]['value'];

const CONFIGS: Record<Exclude<Mode, 'controller'>, RenderBody | undefined> = {
  stock: undefined,
  accordion: accordionBody,
  tabs: tabsBody,
};

const LayoutDemo = () => {
  const { get } = useFetchClient();
  const [articleId, setArticleId] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<Mode>('accordion');

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
        <Flex gap={4} paddingBottom={6} data-testid="layout-demo-controls">
          <Box data-testid="layout-demo-mode">
            <SingleSelect
              aria-label="Body layout mode"
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
        <Box data-testid="layout-demo-root">
          {mode === 'controller' ? (
            <DocumentProvider
              key={mode}
              model="api::article.article"
              documentId={articleId}
              locale="en"
            >
              <ValuesController />
            </DocumentProvider>
          ) : (
            <EditPage
              key={mode}
              model="api::article.article"
              documentId={articleId}
              locale="en"
              form={{ renderBody: CONFIGS[mode] }}
            />
          )}
        </Box>
      </Box>
    </Main>
  );
};

export { LayoutDemo };
