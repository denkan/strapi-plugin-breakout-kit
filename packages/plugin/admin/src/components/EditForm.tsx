import * as React from 'react';
import { Box, Flex, Grid } from '@strapi/design-system';
import { useIntl } from 'react-intl';

import {
  InputRenderer,
  ResponsiveGridItem,
  ResponsiveGridRoot,
} from '../access';
import type { EditFieldLayout, EditLayout } from '../access';
import { useHeadlessData } from '../data/context';
import {
  getEntryCustomizationContext,
  type EntryCustomization,
  type SingleComponentCustomization,
} from '../data/entry-customization';
import { resolveOverride, type Override } from '../data/override';

/**
 * Markup mirrors CM's FormLayout (drift/manifest.json#cm-form-layout) 1:1 — panels,
 * responsive grid, dynamic-zone full-width special case, per-model intl label overrides —
 * re-implemented here only to add the renderField/renderPanel seams. Behavioral parity
 * with the stock component is asserted by the Phase 5 parity tests.
 */

const PANEL_STYLES = {
  padding: { initial: 4, medium: 6 },
  borderColor: 'neutral150',
  background: 'neutral0',
  hasRadius: true,
  shadow: 'tableShadow',
} as const;

export type RenderField = (
  field: EditFieldLayout,
  Default: React.ComponentType<EditFieldLayout>
) => React.ReactNode;

export type RenderPanel = (
  panel: { fields: EditFieldLayout[][]; index: number; children: React.ReactNode },
  Default: React.ComponentType<{ children: React.ReactNode }>
) => React.ReactNode;

/**
 * One resolved panel — Strapi's term for the white boxes the edit view stacks
 * vertically (`layout.map(panel => panel.map(row => row.map(field => …)))`). Panel
 * boundaries are computed by Strapi: every dynamic zone forms its own full-width
 * panel, consecutive non-DZ rows between them share one box.
 */
export interface PanelInfo {
  index: number;
  /** The panel's rows of fields. */
  fields: EditFieldLayout[][];
  isDynamicZone: boolean;
  /** The fully-rendered panel (renderPanel/renderField already applied), keyed. */
  node: React.ReactNode;
}

export type RenderBody = (
  panels: PanelInfo[],
  DefaultBody: React.ComponentType
) => React.ReactNode;

export interface EditFormProps {
  /** Extra per-instance transform on top of the provider's resolved layout. */
  layout?: Override<EditLayout['layout']>;
  renderField?: RenderField;
  renderPanel?: RenderPanel;
  /**
   * Rearrange the whole form body: receives every rendered panel at once (group into
   * accordions, spread across tabs, …). `undefined` keeps the stock vertical stack.
   */
  renderBody?: RenderBody;
  /** Force-disable every field (defaults to the layout/RBAC/status-driven state). */
  disabled?: boolean;
  hasBackground?: boolean;
  /** Dynamic-zone entry customization: entryIcon/entryLabel/entryActions/renderAddButton + renderEntry. */
  dynamicZone?: EntryCustomization;
  /** Repeatable-component entry customization — same shape, applies to every repeatable (incl. nested). */
  repeatable?: EntryCustomization;
  /** Single (non-repeatable) component box customization: renderBox covers both the null-state initializer and the boxed fields. */
  singleComponent?: SingleComponentCustomization;
}

const DefaultPanelBox = ({ children }: { children: React.ReactNode }) => (
  <Box {...PANEL_STYLES}>{children}</Box>
);
const PlainPanelBox = ({ children }: { children: React.ReactNode }) => <Box>{children}</Box>;

/**
 * Layer 3: renders the full resolved edit layout with stock inputs. Everything a
 * consumer sees is identical to the stock edit view's form unless overridden.
 */
export const EditForm = ({
  layout: layoutOverride,
  renderField,
  renderPanel,
  renderBody,
  disabled,
  hasBackground = true,
  dynamicZone,
  repeatable,
  singleComponent,
}: EditFormProps) => {
  const EntryCustomizationContext = getEntryCustomizationContext();
  const entryCustomization = React.useMemo(
    () =>
      dynamicZone || repeatable || singleComponent
        ? { dynamicZone, repeatable, singleComponent }
        : null,
    [dynamicZone, repeatable, singleComponent]
  );
  const { currentDocument, editLayout } = useHeadlessData('EditForm');
  const { formatMessage } = useIntl();

  const layout = resolveOverride(layoutOverride, editLayout?.layout ?? []);
  const modelUid = (currentDocument as { schema?: { uid?: string } }).schema?.uid;

  const getLabel = (name: string, label: string) =>
    formatMessage({
      id: `content-manager.content-types.${modelUid}.${name}`,
      defaultMessage: label,
    });

  const renderOneField = (rawField: EditFieldLayout & { size?: number }) => {
    const { size: _size, ...field } = rawField;
    const fieldProps = {
      ...field,
      label: getLabel(field.name, field.label as string),
      ...(disabled !== undefined ? { disabled } : {}),
      document: currentDocument,
    } as unknown as EditFieldLayout;
    if (renderField) {
      const Default = InputRenderer as unknown as React.ComponentType<EditFieldLayout>;
      return renderField(fieldProps, Default);
    }
    return <InputRenderer {...fieldProps} />;
  };

  const PanelBox = hasBackground ? DefaultPanelBox : PlainPanelBox;

  const panels: PanelInfo[] = layout.map((panel, index) => {
    // Dynamic zones get their own full-width panel (stock behavior).
    const isDynamicZone = panel.some((row) => row.some((field) => field.type === 'dynamiczone'));
    if (isDynamicZone) {
      const [row] = panel;
      const [field] = row;
      const node = (
        <Grid.Root gap={4} key={field.name}>
          <Grid.Item col={12} s={12} xs={12} direction="column" alignItems="stretch">
            {renderOneField(field)}
          </Grid.Item>
        </Grid.Root>
      );
      return { index, fields: panel, isDynamicZone, node };
    }

    const panelContent = (
      <Flex direction="column" alignItems="stretch" gap={6}>
        {panel.map((row, gridRowIndex) => (
          <ResponsiveGridRoot gap={{ initial: 6, medium: 4 }} key={gridRowIndex}>
            {row.map((rawField) => (
              <ResponsiveGridItem
                col={(rawField as { size?: number }).size}
                s={12}
                xs={12}
                direction="column"
                alignItems="stretch"
                key={rawField.name}
              >
                {renderOneField(rawField as EditFieldLayout & { size?: number })}
              </ResponsiveGridItem>
            ))}
          </ResponsiveGridRoot>
        ))}
      </Flex>
    );

    const node = renderPanel ? (
      <React.Fragment key={index}>
        {renderPanel({ fields: panel, index, children: panelContent }, PanelBox)}
      </React.Fragment>
    ) : (
      <PanelBox key={index}>{panelContent}</PanelBox>
    );
    return { index, fields: panel, isDynamicZone, node };
  });

  // renderBody seam: sees every rendered panel at once (accordion grouping, tabs, …).
  // DefaultBody = the stock vertical stack; `undefined` keeps stock. Its component
  // identity must survive re-renders (fresh panels flow through a ref) — a new type per
  // render would make React remount the whole body on every EditForm re-render, wiping
  // consumer state (accordion expansion, focus) and re-firing mount-time fetches.
  const panelsRef = React.useRef<PanelInfo[]>(panels);
  panelsRef.current = panels;
  const DefaultBody = React.useMemo(
    () =>
      function DefaultBody() {
        return (
          <Flex direction="column" alignItems="stretch" gap={6}>
            {panelsRef.current.map((panel) => panel.node)}
          </Flex>
        );
      },
    []
  );
  const bodyOverride = renderBody?.(panels, DefaultBody);
  const body = bodyOverride === undefined ? <DefaultBody /> : <>{bodyOverride}</>;

  // Provide the entry customization to the vendored entry modules (bridge context);
  // no config = provider skipped = byte-identical stock rendering.
  return entryCustomization ? (
    <EntryCustomizationContext.Provider value={entryCustomization}>
      {body}
    </EntryCustomizationContext.Provider>
  ) : (
    body
  );
};
