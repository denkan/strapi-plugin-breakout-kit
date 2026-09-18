/**
 * VENDORED from @strapi/content-manager dist/admin/pages/EditView/components/FormInputs/
 * Component/Repeatable.mjs at the drift-manifest version, installed by the
 * breakoutKit() Vite plugin via a redirect (like DynamicZone/Field.mjs).
 * Deviations are marked `// [breakout-kit]`: the entry-customization seams for
 * repeatable components (issue #10) — entryIcon/entryLabel/entryActions sugars,
 * renderEntry, renderAddButton — reading the `repeatable` slot of the bridge context.
 * No config present => byte-identical stock rendering (parity + stock-cm-unaffected).
 * Drift entry: cm-repeatable-component.
 */
import { jsx, Fragment, jsxs } from 'react/jsx-runtime';
import * as React from 'react';
import { useNotification, useField, useForm, useIsDesktop } from '@strapi/admin/strapi-admin';
import { Accordion, TextButton, Box, VisuallyHidden, useComposedRefs, IconButton, Flex } from '@strapi/design-system';
import { Plus, Trash, Drag, ArrowUp, ArrowDown } from '@strapi/icons';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { useIntl } from 'react-intl';
import { useLocation } from 'react-router-dom';
import { styled } from 'styled-components';
import { ItemTypes } from '@strapi/content-manager/dist/admin/constants/dragAndDrop.mjs';
import { useDocumentContext } from '@strapi/content-manager/dist/admin/hooks/useDocumentContext.mjs';
import { useDragAndDrop } from '@strapi/content-manager/dist/admin/hooks/useDragAndDrop.mjs';
import { usePrev } from '@strapi/content-manager/dist/admin/hooks/usePrev.mjs';
import { getIn } from '@strapi/content-manager/dist/admin/utils/objects.mjs';
import { getTranslation } from '@strapi/content-manager/dist/admin/utils/translations.mjs';
import { transformDocument } from '@strapi/content-manager/dist/admin/pages/EditView/utils/data.mjs';
import { createDefaultForm } from '@strapi/content-manager/dist/admin/pages/EditView/utils/forms.mjs';
import { ResponsiveGridRoot, ResponsiveGridItem } from '@strapi/content-manager/dist/admin/pages/EditView/components/FormLayout.mjs';
import { useComponent, ComponentProvider } from '@strapi/content-manager/dist/admin/pages/EditView/components/FormInputs/ComponentContext.mjs';
import { Initializer } from '@strapi/content-manager/dist/admin/pages/EditView/components/FormInputs/Component/Initializer.mjs';
// [breakout-kit]
import { getEntryCustomizationContext } from '../entry-customization-context.mjs';

const RepeatableComponent = ({ attribute, disabled, name, mainField, children, layout })=>{
    const { toggleNotification } = useNotification();
    const { formatMessage } = useIntl();
    const { search: searchString } = useLocation();
    const search = React.useMemo(()=>new URLSearchParams(searchString), [
        searchString
    ]);
    const { currentDocument } = useDocumentContext('RepeatableComponent');
    const components = currentDocument.components;
    // [breakout-kit] entry-customization seams (issue #10); null config = stock
    const rConfig = React.useContext(getEntryCustomizationContext())?.repeatable ?? {};
    const componentSchema = components[attribute.component];
    const schemaInfo = React.useMemo(()=>componentSchema ? {
        icon: componentSchema.info?.icon,
        displayName: componentSchema.info?.displayName,
        category: componentSchema.category
    } : undefined, [componentSchema]);
    const { value: rawValue, error, rawError } = useField(name);
    const addFieldRow = useForm('RepeatableComponent', (state)=>state.addFieldRow);
    const moveFieldRow = useForm('RepeatableComponent', (state)=>state.moveFieldRow);
    const removeFieldRow = useForm('RepeatableComponent', (state)=>state.removeFieldRow);
    const { max = Infinity } = attribute;
    const value = React.useMemo(()=>Array.isArray(rawValue) ? rawValue : [], [
        rawValue
    ]);
    const [collapseToOpen, setCollapseToOpen] = React.useState('');
    const [liveText, setLiveText] = React.useState('');
    React.useEffect(()=>{
        const hasNestedErrors = rawError && Array.isArray(rawError) && rawError.length > 0;
        const hasNestedValue = value && Array.isArray(value) && value.length > 0;
        if (hasNestedErrors && hasNestedValue) {
            const errorOpenItems = rawError.map((_, idx)=>{
                return value[idx] ? value[idx].__temp_key__ : null;
            }).filter((value)=>!!value);
            if (errorOpenItems && errorOpenItems.length > 0) {
                setCollapseToOpen((collapseToOpen)=>{
                    if (!errorOpenItems.includes(collapseToOpen)) {
                        return errorOpenItems[0];
                    }
                    return collapseToOpen;
                });
            }
        }
    }, [
        rawError,
        value
    ]);
    /**
   * Get the temp key of the component that has the field that is currently focussed
   * as defined by the `field` query param. We can then force this specific component
   * to be in its "open" state.
   */ const componentTmpKeyWithFocussedField = React.useMemo(()=>{
        if (search.has('field')) {
            const fieldParam = search.get('field');
            if (!fieldParam) {
                return undefined;
            }
            const [, path] = fieldParam.split(`${name}.`);
            if (getIn(value, path, undefined) !== undefined) {
                const [subpath] = path.split('.');
                return getIn(value, subpath, undefined)?.__temp_key__;
            }
        }
        return undefined;
    }, [
        search,
        name,
        value
    ]);
    const prevValue = usePrev(value);
    React.useEffect(()=>{
        /**
     * When we add a new item to the array, we want to open the collapse.
     */ if (prevValue && prevValue.length < value.length) {
            setCollapseToOpen(value[value.length - 1].__temp_key__);
        }
    }, [
        value,
        prevValue
    ]);
    React.useEffect(()=>{
        if (typeof componentTmpKeyWithFocussedField === 'string') {
            setCollapseToOpen(componentTmpKeyWithFocussedField);
        }
    }, [
        componentTmpKeyWithFocussedField
    ]);
    const toggleCollapses = React.useCallback(()=>{
        setCollapseToOpen('');
    }, []);
    const handleClick = ()=>{
        if (value.length < max) {
            const schema = components[attribute.component];
            const form = createDefaultForm(schema, components);
            const data = transformDocument(schema, components)(form);
            addFieldRow(name, data);
        // setCollapseToOpen(nextTempKey);
        } else if (value.length >= max) {
            toggleNotification({
                type: 'info',
                message: formatMessage({
                    id: getTranslation('components.notification.info.maximum-requirement')
                })
            });
        }
    };
    const handleMoveComponentField = React.useCallback((newIndex, currentIndex)=>{
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
    const handleValueChange = (key)=>{
        setCollapseToOpen(key);
    };
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
    const handleDeleteComponent = React.useCallback((index)=>{
        removeFieldRow(name, index);
        toggleCollapses();
    }, [
        name,
        removeFieldRow,
        toggleCollapses
    ]);
    const ariaDescriptionId = React.useId();
    const level = useComponent('RepeatableComponent', (state)=>state.level);
    // [breakout-kit] renderAddButton seam (shared AddButtonContext shape). Repeatables
    // have no picker: `toggle` performs the stock add (max-enforced with the stock
    // notification), `isOpen` is always false, and `add` inserts raw (no max check),
    // ignoring the uid argument — the component type is fixed.
    const addRaw = React.useCallback((_uid, position)=>{
        const schema = components[attribute.component];
        if (!schema) {
            return;
        }
        const form = createDefaultForm(schema, components);
        const data = transformDocument(schema, components)(form);
        addFieldRow(name, data, position);
    }, [components, attribute.component, addFieldRow, name]);
    const addCtx = rConfig.renderAddButton ? {
        source: 'repeatable',
        name,
        total: value.length,
        min: attribute.min,
        max: attribute.max,
        disabled,
        isOpen: false,
        toggle: handleClick,
        add: addRaw,
        componentsByCategory: schemaInfo ? {
            [schemaInfo.category]: [
                {
                    uid: attribute.component,
                    displayName: schemaInfo.displayName,
                    icon: schemaInfo.icon
                }
            ]
        } : {}
    } : undefined;
    if (value.length === 0) {
        // [breakout-kit] DefaultAddButton = the stock affordance for the current state:
        // here the empty-state initializer, below the "Add an entry" footer button.
        const stockInitializer = /*#__PURE__*/ jsx(Initializer, {
            disabled: disabled,
            name: name,
            onClick: handleClick
        });
        if (rConfig.renderAddButton) {
            const override = rConfig.renderAddButton(addCtx, ()=>stockInitializer);
            if (override !== undefined) {
                return override;
            }
        }
        return stockInitializer;
    }
    return /*#__PURE__*/ jsxs(Box, {
        hasRadius: true,
        children: [
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
            /*#__PURE__*/ jsxs(AccordionRoot, {
                $error: error,
                value: collapseToOpen,
                onValueChange: handleValueChange,
                "aria-describedby": ariaDescriptionId,
                children: [
                    value.map((componentValue, index)=>{
                        const key = componentValue.__temp_key__;
                        const id = componentValue.id;
                        const nameWithIndex = `${name}.${index}`;
                        const stockProps = {
                            disabled: disabled,
                            name: nameWithIndex,
                            attributeComponent: attribute.component,
                            index: index,
                            mainField: mainField,
                            onMoveItem: handleMoveComponentField,
                            onDeleteComponent: handleDeleteComponent,
                            toggleCollapses: toggleCollapses,
                            onCancel: handleCancel,
                            onDropItem: handleDropItem,
                            onGrabItem: handleGrabItem,
                            __temp_key__: key,
                            totalLength: value.length,
                            layout: layout,
                            renderField: children,
                            schemaInfo: schemaInfo
                        };
                        // [breakout-kit] renderEntry seam (mirrors DynamicZone/Field.mjs).
                        // DefaultEntry keeps full stock behavior and accepts
                        // icon/label/actions overrides on top of any config sugars.
                        let rendered;
                        if (rConfig.renderEntry) {
                            const entry = {
                                source: 'repeatable',
                                componentUid: attribute.component,
                                index,
                                total: value.length,
                                name,
                                value: componentValue,
                                disabled,
                                schema: schemaInfo,
                                onRemove: ()=>handleDeleteComponent(index),
                                onMove: (newIndex)=>handleMoveComponentField(newIndex, index),
                                renderFields: ()=>/*#__PURE__*/ jsx(RepeatableComponentFields, {
                                    attributeComponent: attribute.component,
                                    layout: layout,
                                    nameWithIndex: nameWithIndex,
                                    children: children
                                })
                            };
                            const DefaultEntry = (overrides)=>/*#__PURE__*/ jsx(MemoizedComponent, {
                                    ...stockProps,
                                    ...overrides
                                });
                            rendered = rConfig.renderEntry(entry, DefaultEntry);
                        } else {
                            rendered = /*#__PURE__*/ jsx(MemoizedComponent, stockProps);
                        }
                        return /*#__PURE__*/ jsx(ComponentProvider, {
                            // id is always a number in a component
                            id: id,
                            uid: attribute.component,
                            level: level + 1,
                            type: "repeatable",
                            children: rendered
                        }, key);
                    }),
                    // [breakout-kit] add-button slot; falls back to the exact stock button
                    (()=>{
                        const stockAddButton = /*#__PURE__*/ jsx(TextButtonCustom, {
                            disabled: disabled,
                            onClick: handleClick,
                            startIcon: /*#__PURE__*/ jsx(Plus, {}),
                            children: formatMessage({
                                id: getTranslation('containers.EditView.add.new-entry'),
                                defaultMessage: 'Add an entry'
                            })
                        });
                        if (!rConfig.renderAddButton) {
                            return stockAddButton;
                        }
                        const override = rConfig.renderAddButton(addCtx, ()=>stockAddButton);
                        return override === undefined ? stockAddButton : override;
                    })()
                ]
            })
        ]
    });
};
const AccordionRoot = styled(Accordion.Root)`
  border: 1px solid
    ${({ theme, $error })=>$error ? theme.colors.danger600 : theme.colors.neutral200};
`;
const TextButtonCustom = styled(TextButton)`
  width: 100%;
  display: flex;
  justify-content: center;
  border-top: 1px solid ${({ theme })=>theme.colors.neutral200};
  padding-inline: ${(props)=>props.theme.spaces[6]};
  padding-block: ${(props)=>props.theme.spaces[3]};

  &:not([disabled]) {
    cursor: pointer;

    &:hover {
      background-color: ${(props)=>props.theme.colors.primary100};
    }
  }

  span {
    font-weight: 600;
    font-size: 1.4rem;
    line-height: 2.4rem;
  }

  @media (prefers-reduced-motion: no-preference) {
    transition: background-color 120ms ${(props)=>props.theme.motion.easings.easeOutQuad};
  }
`;
const RepeatableComponentFields = /*#__PURE__*/ React.memo(({ attributeComponent, children, layout, nameWithIndex })=>{
    const { formatMessage } = useIntl();
    return /*#__PURE__*/ jsx(Fragment, {
        children: layout.map((row, index)=>{
            return /*#__PURE__*/ jsx(ResponsiveGridRoot, {
                gap: 4,
                children: row.map(({ size, ...field })=>{
                    /**
                 * Layouts are built from schemas so they don't understand the complete
                 * schema tree, for components we append the parent name to the field name
                 * because this is the structure for the data & permissions also understand
                 * the nesting involved.
                 */ const completeFieldName = `${nameWithIndex}.${field.name}`;
                    const translatedLabel = formatMessage({
                        id: `content-manager.components.${attributeComponent}.${field.name}`,
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
RepeatableComponentFields.displayName = 'RepeatableComponentFields';
const Component = ({ attributeComponent, disabled, index, name, mainField = {
    name: 'id',
    type: 'integer'
}, layout, onDeleteComponent, renderField, toggleCollapses, __temp_key__, totalLength, onMoveItem, icon: iconOverride, label: labelOverride, actions: actionsOverride, schemaInfo, ...dragProps })=>{
    // [breakout-kit] entry slots: explicit props > config fns > stock defaults
    const rConfig = React.useContext(getEntryCustomizationContext())?.repeatable ?? {};
    const { formatMessage } = useIntl();
    const isDesktop = useIsDesktop();
    const displayValue = useForm('RepeatableComponent', (state)=>{
        return getIn(state.values, [
            ...name.split('.'),
            mainField.name
        ]);
    });
    const displayedValue = typeof displayValue === 'string' ? displayValue : '';
    const accordionRef = React.useRef(null);
    /**
   * The last item in the fieldName array will be the index of this component.
   * Drag and drop should be isolated to the parent component so nested repeatable
   * components are not affected by the drag and drop of the parent component in
   * their own re-ordering context.
   */ const componentKey = name.split('.').slice(0, -1).join('.');
    const [{ handlerId, isDragging, handleKeyDown }, boxRef, dropRef, dragRef, dragPreviewRef] = useDragAndDrop(!disabled, {
        type: `${ItemTypes.COMPONENT}_${componentKey}`,
        index,
        item: {
            index,
            id: __temp_key__,
            displayedValue
        },
        onStart () {
            // Close all collapses
            toggleCollapses();
        },
        onMoveItem,
        ...dragProps
    });
    React.useEffect(()=>{
        dragPreviewRef(getEmptyImage(), {
            captureDraggingState: false
        });
    }, [
        dragPreviewRef,
        index
    ]);
    const composedAccordionRefs = useComposedRefs(accordionRef, dragRef);
    const composedBoxRefs = useComposedRefs(boxRef, dropRef);
    const canMoveUp = index > 0;
    const canMoveDown = index < totalLength - 1;
    const handleDeleteClick = ()=>{
        onDeleteComponent?.(index);
    };
    // [breakout-kit] the stock action buttons, hoisted into named consts (null when
    // stock wouldn't render them: wrong breakpoint, list edge — NOTE: unlike dynamic
    // zones, repeatables render their buttons DISABLED rather than hiding them when
    // the field is disabled, and there is no "more" menu). Markup is stock-identical.
    const deleteAction = /*#__PURE__*/ jsx(IconButton, {
        disabled: disabled,
        variant: "ghost",
        onClick: handleDeleteClick,
        label: formatMessage({
            id: getTranslation('containers.Edit.delete'),
            defaultMessage: 'Delete'
        }),
        children: /*#__PURE__*/ jsx(Trash, {})
    });
    const dragAction = !isDesktop ? null : /*#__PURE__*/ jsx(IconButton, {
        disabled: disabled,
        ref: composedAccordionRefs,
        variant: "ghost",
        onClick: (e)=>e.stopPropagation(),
        "data-handler-id": handlerId,
        label: formatMessage({
            id: getTranslation('components.DragHandle-label'),
            defaultMessage: 'Drag'
        }),
        onKeyDown: handleKeyDown,
        children: /*#__PURE__*/ jsx(Drag, {})
    });
    const moveUpAction = isDesktop || !canMoveUp ? null : /*#__PURE__*/ jsx(IconButton, {
        disabled: disabled || !canMoveUp,
        variant: "ghost",
        onClick: (e)=>{
            e.stopPropagation();
            if (onMoveItem) {
                onMoveItem(index - 1, index);
            }
        },
        label: formatMessage({
            id: getTranslation('components.DynamicZone.move-up'),
            defaultMessage: 'Move up'
        }),
        children: /*#__PURE__*/ jsx(ArrowUp, {})
    });
    const moveDownAction = isDesktop || !canMoveDown ? null : /*#__PURE__*/ jsx(IconButton, {
        disabled: disabled || !canMoveDown,
        variant: "ghost",
        onClick: (e)=>{
            e.stopPropagation();
            if (onMoveItem) {
                onMoveItem(index + 1, index);
            }
        },
        label: formatMessage({
            id: getTranslation('components.DynamicZone.move-down'),
            defaultMessage: 'Move down'
        }),
        children: /*#__PURE__*/ jsx(ArrowDown, {})
    });
    const accordionActions = /*#__PURE__*/ jsxs(Fragment, {
        children: [
            deleteAction,
            dragAction,
            moveUpAction,
            moveDownAction
        ]
    });
    // [breakout-kit] slot resolution; `undefined` means "use the stock default".
    // Stock repeatables have NO leading icon (defaultIcon is null) — entryIcon can add
    // one — and the default label is the raw mainField display value.
    const entryMeta = React.useMemo(()=>({
        source: 'repeatable',
        componentUid: attributeComponent,
        index,
        total: totalLength,
        name: componentKey,
        schema: schemaInfo
    }), [attributeComponent, index, totalLength, componentKey, schemaInfo]);
    const resolvedIcon = iconOverride !== undefined
        ? iconOverride
        : rConfig.entryIcon?.(entryMeta, null);
    const resolvedLabel = labelOverride !== undefined
        ? labelOverride
        : rConfig.entryLabel?.(entryMeta, displayedValue);
    const resolvedActions = actionsOverride !== undefined
        ? actionsOverride
        : rConfig.entryActions?.(entryMeta, {
            all: accordionActions,
            delete: deleteAction,
            drag: dragAction,
            moveUp: moveUpAction,
            moveDown: moveDownAction,
            more: null
        });
    return /*#__PURE__*/ jsx(Fragment, {
        children: isDragging ? /*#__PURE__*/ jsx(Preview, {}) : /*#__PURE__*/ jsxs(Accordion.Item, {
            ref: composedBoxRefs,
            value: __temp_key__,
            children: [
                /*#__PURE__*/ jsxs(Accordion.Header, {
                    children: [
                        /*#__PURE__*/ jsx(Accordion.Trigger, {
                            // [breakout-kit] slots; stock renders no icon and the raw value
                            icon: resolvedIcon === undefined || resolvedIcon === null ? undefined : ()=>resolvedIcon,
                            children: resolvedLabel === undefined ? displayValue : resolvedLabel
                        }),
                        /*#__PURE__*/ jsx(Accordion.Actions, {
                            // [breakout-kit] actions slot; falls back to stock
                            children: resolvedActions === undefined ? accordionActions : resolvedActions
                        })
                    ]
                }),
                /*#__PURE__*/ jsx(Accordion.Content, {
                    children: /*#__PURE__*/ jsx(Flex, {
                        direction: "column",
                        alignItems: "stretch",
                        background: "neutral100",
                        padding: {
                            initial: 4,
                            medium: 6
                        },
                        gap: {
                            initial: 3,
                            medium: 4
                        },
                        children: /*#__PURE__*/ jsx(RepeatableComponentFields, {
                            attributeComponent: attributeComponent,
                            layout: layout,
                            nameWithIndex: name,
                            children: renderField
                        })
                    })
                })
            ]
        })
    });
};
const Preview = ()=>{
    return /*#__PURE__*/ jsx(StyledSpan, {
        tag: "span",
        padding: 6,
        background: "primary100"
    });
};
const StyledSpan = styled(Box)`
  display: block;
  outline: 1px dashed ${({ theme })=>theme.colors.primary500};
  outline-offset: -1px;
`;
const MemoizedComponent = /*#__PURE__*/ React.memo(Component);
const MemoizedRepeatableComponent = /*#__PURE__*/ React.memo(RepeatableComponent);

export { MemoizedRepeatableComponent as RepeatableComponent };
//# sourceMappingURL=Repeatable.mjs.map
