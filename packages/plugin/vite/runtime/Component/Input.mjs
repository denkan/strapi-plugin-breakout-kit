/**
 * VENDORED from @strapi/content-manager dist/admin/pages/EditView/components/FormInputs/
 * Component/Input.mjs at the drift-manifest version, installed by the
 * breakoutKit() Vite plugin via a redirect. Deviations are marked
 * `// [breakout-kit]`: the renderBox seam for SINGLE (non-repeatable) components —
 * one state-aware slot covering both the null-state initializer box and the
 * value-state fields box. Imports NonRepeatable from the sibling vendored copy (its
 * only upstream importer is this module, so a single instance still loads) and
 * Repeatable via the deep specifier (redirected to the vendored copy by the helper).
 * No config present => byte-identical stock rendering (parity + stock-cm-unaffected).
 * Drift entry: cm-component-input.
 */
import { jsxs, Fragment, jsx } from 'react/jsx-runtime';
import * as React from 'react';
import { useField, useForm } from '@strapi/admin/strapi-admin';
import { Field, Flex, IconButton } from '@strapi/design-system';
import { Trash } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { useDocumentContext } from '@strapi/content-manager/dist/admin/hooks/useDocumentContext.mjs';
import { getIn } from '@strapi/content-manager/dist/admin/utils/objects.mjs';
import { getTranslation } from '@strapi/content-manager/dist/admin/utils/translations.mjs';
import { transformDocument } from '@strapi/content-manager/dist/admin/pages/EditView/utils/data.mjs';
import { createDefaultForm } from '@strapi/content-manager/dist/admin/pages/EditView/utils/forms.mjs';
import { Initializer } from '@strapi/content-manager/dist/admin/pages/EditView/components/FormInputs/Component/Initializer.mjs';
import { useComponent, ComponentProvider } from '@strapi/content-manager/dist/admin/pages/EditView/components/FormInputs/ComponentContext.mjs';
import { RepeatableComponent as MemoizedRepeatableComponent } from '@strapi/content-manager/dist/admin/pages/EditView/components/FormInputs/Component/Repeatable.mjs';
import { NonRepeatableComponent as MemoizedNonRepeatableComponent, NonRepeatableComponentFields } from './NonRepeatable.mjs';
// [breakout-kit]
import { getEntryCustomizationContext } from '../entry-customization-context.mjs';
import { useStableNodeComponent } from '../stable-seam.mjs';

const ComponentInput = ({ label, required, name, attribute, disabled, labelAction, ...props })=>{
    const { formatMessage } = useIntl();
    const field = useField(name);
    // [breakout-kit] render-stable DefaultBox identity: this component re-renders on
    // every change inside the component (useField), so a per-render type here would
    // remount the consumer's `<DefaultBox />` subtree on each keystroke.
    const [stockBoxRef, DefaultBox] = useStableNodeComponent();
    // [breakout-kit] renderBox seam (single components only); null config = stock
    const scConfig = React.useContext(getEntryCustomizationContext())?.singleComponent ?? {};
    const showResetComponent = !attribute.repeatable && field.value !== undefined && field.value !== null && !disabled;
    const { currentDocument: { components } } = useDocumentContext('ComponentInput');
    const handleInitialisationClick = ()=>{
        const schema = components[attribute.component];
        const form = createDefaultForm(schema, components);
        const data = transformDocument(schema, components)(form);
        field.onChange(name, data);
    };
    // [breakout-kit] renderBox resolution. `box.renderFields()` carries its own
    // ComponentProvider (mirroring the stock NonRepeatable wrapper) so nested inputs
    // resolve level/uid/id inside custom chrome; returning `<DefaultBox />` is pure
    // stock (it brings its own provider). `undefined` = stock for the current state.
    const level = useComponent('ComponentInput', (state)=>state.level);
    const componentId = useForm('ComponentInput', (state)=>getIn(state.values, `${name}.id`));
    let boxOverride;
    if (!attribute.repeatable && scConfig.renderBox) {
        const componentSchema = components[attribute.component];
        const box = {
            source: 'singleComponent',
            componentUid: attribute.component,
            name,
            schema: componentSchema ? {
                icon: componentSchema.info?.icon,
                displayName: componentSchema.info?.displayName,
                category: componentSchema.category
            } : undefined,
            value: field.value ?? null,
            disabled: Boolean(disabled),
            onInitialize: handleInitialisationClick,
            onClear: ()=>field.onChange(name, null),
            renderFields: ()=>field.value ? /*#__PURE__*/ jsx(ComponentProvider, {
                id: componentId,
                uid: attribute.component,
                level: level + 1,
                type: "component",
                children: /*#__PURE__*/ jsx(NonRepeatableComponentFields, {
                    attribute: attribute,
                    name: name,
                    layout: props.layout,
                    children: props.children
                })
            }) : null
        };
        const stockCurrent = field.value ? /*#__PURE__*/ jsx(MemoizedNonRepeatableComponent, {
            attribute: attribute,
            name: name,
            disabled: disabled,
            ...props,
            children: props.children
        }) : /*#__PURE__*/ jsx(Initializer, {
            disabled: disabled,
            name: name,
            onClick: handleInitialisationClick
        });
        stockBoxRef.current = stockCurrent;
        boxOverride = scConfig.renderBox(box, DefaultBox);
    }
    return /*#__PURE__*/ jsxs(Field.Root, {
        error: field.error,
        required: required,
        children: [
            /*#__PURE__*/ jsxs(Flex, {
                justifyContent: "space-between",
                children: [
                    /*#__PURE__*/ jsxs(Field.Label, {
                        action: labelAction,
                        children: [
                            label,
                            attribute.repeatable && /*#__PURE__*/ jsxs(Fragment, {
                                children: [
                                    " (",
                                    Array.isArray(field.value) ? field.value.length : 0,
                                    ")"
                                ]
                            })
                        ]
                    }),
                    showResetComponent && /*#__PURE__*/ jsx(IconButton, {
                        label: formatMessage({
                            id: getTranslation('components.reset-entry'),
                            defaultMessage: 'Reset Entry'
                        }),
                        variant: "ghost",
                        onClick: ()=>{
                            field.onChange(name, null);
                        },
                        children: /*#__PURE__*/ jsx(Trash, {})
                    })
                ]
            }),
            // [breakout-kit] single-component box slot; stock branches when no override
            !attribute.repeatable && (boxOverride !== undefined ? boxOverride : !field.value ? /*#__PURE__*/ jsx(Initializer, {
                disabled: disabled,
                name: name,
                onClick: handleInitialisationClick
            }) : /*#__PURE__*/ jsx(MemoizedNonRepeatableComponent, {
                attribute: attribute,
                name: name,
                disabled: disabled,
                ...props,
                children: props.children
            })),
            attribute.repeatable && /*#__PURE__*/ jsx(MemoizedRepeatableComponent, {
                attribute: attribute,
                name: name,
                disabled: disabled,
                ...props,
                children: props.children
            }),
            /*#__PURE__*/ jsx(Field.Error, {})
        ]
    });
};
const MemoizedComponentInput = /*#__PURE__*/ React.memo(ComponentInput);

export { MemoizedComponentInput as ComponentInput };
