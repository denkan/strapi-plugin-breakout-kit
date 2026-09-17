/**
 * VENDORED from @strapi/content-manager dist/admin/pages/EditView/components/FormInputs/
 * Component/NonRepeatable.mjs at the drift-manifest version. NOT alias-redirected: its
 * only upstream importer is Component/Input.mjs, which IS redirected to our vendored
 * copy (which imports this one) — so a single instance still loads everywhere.
 * Deviations are marked `// [breakout-kit]` and limited to exporting the fields grid
 * for renderBox consumers. Drift entry: cm-non-repeatable-component.
 */
import { jsx } from 'react/jsx-runtime';
import * as React from 'react';
import { useForm, useIsMobile } from '@strapi/admin/strapi-admin';
import { Flex, Box } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { getIn } from '@strapi/content-manager/dist/admin/utils/objects.mjs';
import { ResponsiveGridRoot, ResponsiveGridItem } from '@strapi/content-manager/dist/admin/pages/EditView/components/FormLayout.mjs';
import { useComponent, ComponentProvider } from '@strapi/content-manager/dist/admin/pages/EditView/components/FormInputs/ComponentContext.mjs';

const NonRepeatableComponent = ({ attribute, name, children, layout })=>{
    const componentId = useForm('NonRepeatableComponent', (state)=>getIn(state.values, `${name}.id`));
    const level = useComponent('NonRepeatableComponent', (state)=>state.level);
    const isNested = level > 0;
    const isMobile = useIsMobile();
    return /*#__PURE__*/ jsx(ComponentProvider, {
        id: componentId,
        uid: attribute.component,
        level: level + 1,
        type: "component",
        children: /*#__PURE__*/ jsx(Box, {
            background: 'neutral100',
            padding: {
                initial: 4,
                medium: 6
            },
            hasRadius: isNested,
            borderColor: isNested || isMobile ? 'neutral200' : undefined,
            children: /*#__PURE__*/ jsx(NonRepeatableComponentFields, {
                attribute: attribute,
                name: name,
                layout: layout,
                children: children
            })
        })
    });
};
const NonRepeatableComponentFields = /*#__PURE__*/ React.memo(({ attribute, children, layout, name })=>{
    const { formatMessage } = useIntl();
    return /*#__PURE__*/ jsx(Flex, {
        direction: "column",
        alignItems: "stretch",
        gap: 6,
        children: layout.map((row, index)=>{
            return /*#__PURE__*/ jsx(ResponsiveGridRoot, {
                gap: {
                    initial: 3,
                    medium: 4
                },
                children: row.map(({ size, ...field })=>{
                    /**
                 * Layouts are built from schemas so they don't understand the complete
                 * schema tree, for components we append the parent name to the field name
                 * because this is the structure for the data & permissions also understand
                 * the nesting involved.
                 */ const completeFieldName = `${name}.${field.name}`;
                    const translatedLabel = formatMessage({
                        id: `content-manager.components.${attribute.component}.${field.name}`,
                        defaultMessage: field.label
                    });
                    return /*#__PURE__*/ jsx(ResponsiveGridItem, {
                        col: size,
                        s: 12,
                        xs: 12,
                        direction: "column",
                        alignItems: "stretch",
                        children: children({
                            ...field,
                            label: translatedLabel,
                            name: completeFieldName
                        })
                    }, completeFieldName);
                })
            }, index);
        })
    });
});
NonRepeatableComponentFields.displayName = 'NonRepeatableComponentFields';
const MemoizedNonRepeatableComponent = /*#__PURE__*/ React.memo(NonRepeatableComponent);

// [breakout-kit] the fields grid is also exported standalone so renderBox consumers
// can build their own chrome around it (stock keeps it module-private).
export { MemoizedNonRepeatableComponent as NonRepeatableComponent, NonRepeatableComponentFields };
