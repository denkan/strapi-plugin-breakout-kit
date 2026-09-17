/**
 * VENDORED from @strapi/content-manager dist/admin/pages/EditView/components/FormInputs/
 * DynamicZone/Field.mjs at the drift-manifest version. The headlessContentManager() Vite
 * plugin redirects the original module here (like the useDocumentContext shim), so BOTH
 * the stock content manager and headless pages render this implementation. Deviations
 * are marked `// [breakout-kit]`: the renderEntry seam (issue #4) and the renderAddButton
 * seam (issue #5). No entry-customization config present => byte-identical stock
 * rendering (parity + stock-cm-unaffected tests).
 * Drift entry: cm-dz-field.
 */
import { jsx, jsxs } from 'react/jsx-runtime';
import * as React from 'react';
import { createContext, useForm, useField, useNotification } from '@strapi/admin/strapi-admin';
import { Flex, Box, VisuallyHidden } from '@strapi/design-system';
import pipe from 'lodash/fp/pipe';
import { useIntl } from 'react-intl';
import { useDocumentContext } from '@strapi/content-manager/dist/admin/hooks/useDocumentContext.mjs';
import { usePrev } from '@strapi/content-manager/dist/admin/hooks/usePrev.mjs';
import { getTranslation } from '@strapi/content-manager/dist/admin/utils/translations.mjs';
import { transformDocument } from '@strapi/content-manager/dist/admin/pages/EditView/utils/data.mjs';
import { createDefaultForm } from '@strapi/content-manager/dist/admin/pages/EditView/utils/forms.mjs';
import { useComponent, ComponentProvider } from '@strapi/content-manager/dist/admin/pages/EditView/components/FormInputs/ComponentContext.mjs';
import { AddComponentButton } from '@strapi/content-manager/dist/admin/pages/EditView/components/FormInputs/DynamicZone/AddComponentButton.mjs';
import { ComponentPicker } from '@strapi/content-manager/dist/admin/pages/EditView/components/FormInputs/DynamicZone/ComponentPicker.mjs';
import { DynamicComponent as MemoizedDynamicComponent, DzEntryFields } from './DynamicComponent.mjs';
// [breakout-kit]
import { getEntryCustomizationContext } from '../entry-customization-context.mjs';
import { DynamicZoneLabel } from '@strapi/content-manager/dist/admin/pages/EditView/components/FormInputs/DynamicZone/DynamicZoneLabel.mjs';

const [DynamicZoneProvider, useDynamicZone] = createContext('DynamicZone', {
    isInDynamicZone: false
});
const DynamicZone = ({ attribute, disabled: disabledProp, hint, label, labelAction, name, required = false, children })=>{
    // We cannot use the default props here
    const { max = Infinity, min = -Infinity } = attribute ?? {};
    const [addComponentIsOpen, setAddComponentIsOpen] = React.useState(false);
    const [liveText, setLiveText] = React.useState('');
    const [openComponentKey, setOpenComponentKey] = React.useState(null);
    const { currentDocument: { components, isLoading } } = useDocumentContext('DynamicZone');
    // [breakout-kit] renderEntry seam (null config = stock)
    const dzConfig = React.useContext(getEntryCustomizationContext())?.dynamicZone ?? {};
    const disabled = disabledProp || isLoading;
    const addFieldRow = useForm('DynamicZone', (state)=>state.addFieldRow);
    const removeFieldRow = useForm('DynamicZone', (state)=>state.removeFieldRow);
    const moveFieldRow = useForm('DynamicZone', (state)=>state.moveFieldRow);
    const { value: rawValue, error } = useField(name);
    // `value` can be `null` (for example after closing a relation modal). Match
    // RepeatableComponent: only accept arrays, otherwise treat as empty. (#26815)
    const value = React.useMemo(()=>Array.isArray(rawValue) ? rawValue : [], [
        rawValue
    ]);
    /**
   * Track the previous value array to detect when a new component is added.
   * When the array grows, we find the newly added item and force its accordion open.
   * This mirrors the same pattern used in RepeatableComponent.
   */ const prevValue = usePrev(value);
    React.useEffect(()=>{
        if (prevValue && prevValue.length < value.length) {
            const prevKeys = new Set(prevValue.map((v)=>v.__temp_key__));
            const newItem = value.find((v)=>!prevKeys.has(v.__temp_key__));
            if (newItem) {
                setOpenComponentKey(newItem.__temp_key__);
            }
        } else if (openComponentKey !== null) {
            // Component was removed before forceOpen was handled — clear stale key
            const currentKeys = new Set(value.map((v)=>v.__temp_key__));
            if (!currentKeys.has(openComponentKey)) {
                setOpenComponentKey(null);
            }
        }
    }, [
        value,
        prevValue,
        openComponentKey
    ]);
    const handleForceOpenHandled = React.useCallback(()=>{
        setOpenComponentKey(null);
    }, []);
    const dynamicComponentsByCategory = React.useMemo(()=>{
        return attribute.components.reduce((acc, componentUid)=>{
            const componentSchema = components[componentUid];
            if (!componentSchema) {
                return acc;
            }
            const { category, info } = componentSchema;
            const component = {
                uid: componentUid,
                displayName: info.displayName,
                icon: info.icon,
                preview: info.preview
            };
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category] = [
                ...acc[category],
                component
            ];
            return acc;
        }, {});
    }, [
        attribute.components,
        components
    ]);
    const { formatMessage } = useIntl();
    const { toggleNotification } = useNotification();
    const dynamicDisplayedComponentsLength = value.length;
    const handleAddComponent = React.useCallback((uid, position)=>{
        const schema = components[uid];
        if (!schema) {
            return;
        }
        setAddComponentIsOpen(false);
        const form = createDefaultForm(schema, components);
        const transformations = pipe(transformDocument(schema, components), (data)=>({
                ...data,
                __component: uid
            }));
        const data = transformations(form);
        addFieldRow(name, data, position);
    }, [
        addFieldRow,
        components,
        name
    ]);
    const handleClickOpenPicker = ()=>{
        if (dynamicDisplayedComponentsLength < max) {
            setAddComponentIsOpen((prev)=>!prev);
        } else {
            toggleNotification({
                type: 'info',
                message: formatMessage({
                    id: getTranslation('components.notification.info.maximum-requirement')
                })
            });
        }
    };
    const handleMoveComponent = React.useCallback((newIndex, currentIndex)=>{
        setLiveText(formatMessage({
            id: getTranslation('dnd.reorder'),
            defaultMessage: '{item}, moved. New position in list: {position}.'
        }, {
            item: `${name}.${currentIndex}`,
            position: `${newIndex + 1} of ${value.length}`
        }));
        moveFieldRow(name, currentIndex, newIndex);
    }, [
        formatMessage,
        moveFieldRow,
        name,
        value.length
    ]);
    const handleCancel = React.useCallback((index)=>{
        setLiveText(formatMessage({
            id: getTranslation('dnd.cancel-item'),
            defaultMessage: '{item}, dropped. Re-order cancelled.'
        }, {
            item: `${name}.${index}`
        }));
    }, [
        formatMessage,
        name
    ]);
    const handleGrabItem = React.useCallback((index)=>{
        setLiveText(formatMessage({
            id: getTranslation('dnd.grab-item'),
            defaultMessage: `{item}, grabbed. Current position in list: {position}. Press up and down arrow to change position, Spacebar to drop, Escape to cancel.`
        }, {
            item: `${name}.${index}`,
            position: `${index + 1} of ${value.length}`
        }));
    }, [
        formatMessage,
        name,
        value.length
    ]);
    const handleDropItem = React.useCallback((index)=>{
        setLiveText(formatMessage({
            id: getTranslation('dnd.drop-item'),
            defaultMessage: `{item}, dropped. Final position in list: {position}.`
        }, {
            item: `${name}.${index}`,
            position: `${index + 1} of ${value.length}`
        }));
    }, [
        formatMessage,
        name,
        value.length
    ]);
    const handleRemoveComponent = React.useCallback((currentIndex)=>{
        removeFieldRow(name, currentIndex);
    }, [
        name,
        removeFieldRow
    ]);
    const hasError = error !== undefined;
    const renderButtonLabel = ()=>{
        if (addComponentIsOpen) {
            return formatMessage({
                id: 'app.utils.close-label',
                defaultMessage: 'Close'
            });
        }
        if (hasError && dynamicDisplayedComponentsLength > max) {
            return formatMessage({
                id: getTranslation(`components.DynamicZone.extra-components`),
                defaultMessage: 'There {number, plural, =0 {are # extra components} one {is # extra component} other {are # extra components}}'
            }, {
                number: dynamicDisplayedComponentsLength - max
            });
        }
        if (hasError && dynamicDisplayedComponentsLength < min) {
            return formatMessage({
                id: getTranslation(`components.DynamicZone.missing-components`),
                defaultMessage: 'There {number, plural, =0 {are # missing components} one {is # missing component} other {are # missing components}}'
            }, {
                number: min - dynamicDisplayedComponentsLength
            });
        }
        return formatMessage({
            id: getTranslation('components.DynamicZone.add-component'),
            defaultMessage: 'Add a component to {componentName}'
        }, {
            componentName: label || name
        });
    };
    const level = useComponent('DynamicZone', (state)=>state.level);
    const ariaDescriptionId = React.useId();
    // [breakout-kit] renderAddButton seam (issue #5). The stock centered button is
    // wrapped as DefaultAddButton; a custom node replaces the whole block. The stock
    // ComponentPicker stays mounted below (it renders null while closed), so custom
    // UIs that never call ctx.toggle() fully bypass it via ctx.add().
    const stockAddButton = /*#__PURE__*/ jsx(Flex, {
        justifyContent: "center",
        children: /*#__PURE__*/ jsx(AddComponentButton, {
            hasError: hasError,
            isDisabled: disabled,
            isOpen: addComponentIsOpen,
            onClick: handleClickOpenPicker,
            children: renderButtonLabel()
        })
    });
    let addButtonOverride;
    if (dzConfig.renderAddButton) {
        const addCtx = {
            source: 'dynamicZone',
            name,
            total: dynamicDisplayedComponentsLength,
            min: attribute?.min,
            max: attribute?.max,
            disabled,
            isOpen: addComponentIsOpen,
            toggle: handleClickOpenPicker,
            add: handleAddComponent,
            componentsByCategory: dynamicComponentsByCategory
        };
        const DefaultAddButton = ()=>stockAddButton;
        addButtonOverride = dzConfig.renderAddButton(addCtx, DefaultAddButton);
    }
    return /*#__PURE__*/ jsx(DynamicZoneProvider, {
        isInDynamicZone: true,
        children: /*#__PURE__*/ jsxs(Flex, {
            direction: "column",
            alignItems: "stretch",
            gap: {
                initial: 4,
                medium: 6
            },
            children: [
                dynamicDisplayedComponentsLength > 0 && /*#__PURE__*/ jsxs(Box, {
                    children: [
                        /*#__PURE__*/ jsx(DynamicZoneLabel, {
                            hint: hint,
                            label: label,
                            labelAction: labelAction,
                            name: name,
                            numberOfComponents: dynamicDisplayedComponentsLength,
                            required: required
                        }),
                        /*#__PURE__*/ jsx(VisuallyHidden, {
                            id: ariaDescriptionId,
                            children: formatMessage({
                                id: getTranslation('dnd.instructions'),
                                defaultMessage: `Press spacebar to grab and re-order`
                            })
                        }),
                        /*#__PURE__*/ jsx(VisuallyHidden, {
                            "aria-live": "assertive",
                            children: liveText
                        }),
                        /*#__PURE__*/ jsx("ol", {
                            "aria-describedby": ariaDescriptionId,
                            children: value.map((field, index)=>{
                                const stockProps = {
                                    disabled: disabled,
                                    name: name,
                                    index: index,
                                    componentUid: field.__component,
                                    onMoveComponent: handleMoveComponent,
                                    onRemoveComponentClick: handleRemoveComponent,
                                    onCancel: handleCancel,
                                    onDropItem: handleDropItem,
                                    onGrabItem: handleGrabItem,
                                    onAddComponent: handleAddComponent,
                                    dynamicComponentsByCategory: dynamicComponentsByCategory,
                                    totalLength: dynamicDisplayedComponentsLength,
                                    forceOpen: openComponentKey === field.__temp_key__,
                                    onForceOpenHandled: handleForceOpenHandled,
                                    children: children
                                };
                                // [breakout-kit] renderEntry seam. DefaultEntry keeps the full
                                // stock behavior (drag & drop, a11y, delete, collapse) and accepts
                                // icon/label/actions overrides on top of any config sugars.
                                let rendered;
                                if (dzConfig.renderEntry) {
                                    const componentSchema = components[field.__component];
                                    const entry = {
                                        source: 'dynamicZone',
                                        componentUid: field.__component,
                                        index,
                                        total: dynamicDisplayedComponentsLength,
                                        name,
                                        value: field,
                                        disabled,
                                        schema: componentSchema ? {
                                            icon: componentSchema.info?.icon,
                                            displayName: componentSchema.info?.displayName,
                                            category: componentSchema.category
                                        } : undefined,
                                        onRemove: ()=>handleRemoveComponent(index),
                                        onMove: (newIndex)=>handleMoveComponent(newIndex, index),
                                        renderFields: ()=>/*#__PURE__*/ jsx(DzEntryFields, {
                                            componentUid: field.__component,
                                            index: index,
                                            name: name,
                                            children: children
                                        })
                                    };
                                    const DefaultEntry = (overrides)=>/*#__PURE__*/ jsx(MemoizedDynamicComponent, {
                                            ...stockProps,
                                            ...overrides
                                        });
                                    rendered = dzConfig.renderEntry(entry, DefaultEntry);
                                } else {
                                    rendered = /*#__PURE__*/ jsx(MemoizedDynamicComponent, {
                                        ...stockProps
                                    });
                                }
                                return /*#__PURE__*/ jsx(ComponentProvider, {
                                    level: level + 1,
                                    uid: field.__component,
                                    // id is always a number in a dynamic zone.
                                    id: field.id,
                                    type: "dynamiczone",
                                    children: rendered
                                }, field.__temp_key__);
                            })
                        })
                    ]
                }),
                // [breakout-kit] add-button slot; falls back to the exact stock block
                addButtonOverride === undefined ? stockAddButton : addButtonOverride,
                /*#__PURE__*/ jsx(ComponentPicker, {
                    dynamicComponentsByCategory: dynamicComponentsByCategory,
                    isOpen: addComponentIsOpen,
                    onClickAddComponent: handleAddComponent
                })
            ]
        })
    });
};

export { DynamicZone, useDynamicZone };
