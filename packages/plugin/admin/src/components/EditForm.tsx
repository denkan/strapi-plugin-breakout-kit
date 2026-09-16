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

export interface EditFormProps {
  /** Extra per-instance transform on top of the provider's resolved layout. */
  layout?: Override<EditLayout['layout']>;
  renderField?: RenderField;
  renderPanel?: RenderPanel;
  /** Force-disable every field (defaults to the layout/RBAC/status-driven state). */
  disabled?: boolean;
  hasBackground?: boolean;
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
  disabled,
  hasBackground = true,
}: EditFormProps) => {
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

  return (
    <Flex direction="column" alignItems="stretch" gap={6}>
      {layout.map((panel, index) => {
        // Dynamic zones get their own full-width block (stock behavior).
        if (panel.some((row) => row.some((field) => field.type === 'dynamiczone'))) {
          const [row] = panel;
          const [field] = row;
          return (
            <Grid.Root gap={4} key={field.name}>
              <Grid.Item col={12} s={12} xs={12} direction="column" alignItems="stretch">
                {renderOneField(field)}
              </Grid.Item>
            </Grid.Root>
          );
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

        if (renderPanel) {
          return (
            <React.Fragment key={index}>
              {renderPanel({ fields: panel, index, children: panelContent }, PanelBox)}
            </React.Fragment>
          );
        }
        return <PanelBox key={index}>{panelContent}</PanelBox>;
      })}
    </Flex>
  );
};
