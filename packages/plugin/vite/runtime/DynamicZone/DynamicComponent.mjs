/**
 * VENDORED from @strapi/content-manager dist/admin/pages/EditView/components/FormInputs/
 * DynamicZone/DynamicComponent.mjs at the drift-manifest version, installed by the
 * headlessContentManager() Vite plugin via the Field.mjs redirect. Deviations from
 * upstream are marked with `// [breakout-kit]` and limited to the entry-customization
 * slots (icon/label/actions overrides). The stock action buttons are hoisted into named
 * consts so entryActions can receive them individually; markup is unchanged. No config
 * present => byte-identical stock rendering (guarded by the parity +
 * stock-cm-unaffected contract tests).
 * Drift entry: cm-dz-dynamic-component.
 */
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import * as React from 'react';
import { useIsDesktop, useForm } from '@strapi/admin/strapi-admin';
import { Box, Grid, useComposedRefs, IconButton, Menu, Flex, Accordion } from '@strapi/design-system';
import { Trash, Drag, ArrowUp, ArrowDown, More } from '@strapi/icons';
import upperFirst from 'lodash/upperFirst';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { useIntl } from 'react-intl';
import { styled } from 'styled-components';
import { COMPONENT_ICONS } from '@strapi/content-manager/dist/admin/components/ComponentIcon.mjs';
import { ItemTypes } from '@strapi/content-manager/dist/admin/constants/dragAndDrop.mjs';
import { useDocumentContext } from '@strapi/content-manager/dist/admin/hooks/useDocumentContext.mjs';
import { useDocumentLayout } from '@strapi/content-manager/dist/admin/hooks/useDocumentLayout.mjs';
import { useDragAndDrop } from '@strapi/content-manager/dist/admin/hooks/useDragAndDrop.mjs';
import { getIn } from '@strapi/content-manager/dist/admin/utils/objects.mjs';
import { getTranslation } from '@strapi/content-manager/dist/admin/utils/translations.mjs';
import { ResponsiveGridRoot, ResponsiveGridItem } from '@strapi/content-manager/dist/admin/pages/EditView/components/FormLayout.mjs';
import { InputRenderer as MemoizedInputRenderer } from '@strapi/content-manager/dist/admin/pages/EditView/components/InputRenderer.mjs';
// [breakout-kit]
import { getEntryCustomizationContext } from '../entry-customization-context.mjs';

const DynamicComponent = ({ componentUid, disabled, index, name, onRemoveComponentClick, onMoveComponent, onGrabItem, onDropItem, onCancel, dynamicComponentsByCategory = {}, onAddComponent, totalLength, children, forceOpen, onForceOpenHandled, icon: iconOverride, label: labelOverride, actions: actionsOverride })=>{
    // [breakout-kit] entry slots: explicit props > config fns > stock defaults
    const dzConfig = React.useContext(getEntryCustomizationContext())?.dynamicZone ?? {};
    const { formatMessage } = useIntl();
    const { currentDocumentMeta } = useDocumentContext('DynamicComponent');
    const isDesktop = useIsDesktop();
    const { edit: { components } } = useDocumentLayout(currentDocumentMeta.model);
    const { mainField = 'id' } = componentUid ? components[componentUid]?.settings ?? {} : {};
    const mainFieldValue = useForm('DynamicComponent', (state)=>getIn(state.values, `${name}.${index}.${mainField}`));
    const displayedValue = mainField === 'id' || !mainFieldValue ? '' : String(mainFieldValue).trim();
    const displayTitle = displayedValue.length > 0 ? `- ${displayedValue}` : displayedValue;
    const { icon, displayName } = React.useMemo(()=>{
        if (!componentUid) {
            return {
                icon: null,
                displayName: formatMessage({
                    id: getTranslation('components.DynamicZone.unknown-component'),
                    defaultMessage: 'Unknown component'
                })
            };
        }
        const [category] = componentUid.split('.');
        const { icon, displayName } = (dynamicComponentsByCategory[category] ?? []).find((component)=>component.uid === componentUid) ?? {
            icon: null,
            displayName: null
        };
        return {
            icon,
            displayName: formatMessage({
                id: componentUid,
                defaultMessage: displayName || componentUid
            })
        };
    }, [
        componentUid,
        dynamicComponentsByCategory,
        formatMessage
    ]);
    const tempKey = useForm('DynamicComponent', (state)=>getIn(state.values, `${name}.${index}.__temp_key__`));
    const [{ handlerId, isDragging, handleKeyDown }, boxRef, dropRef, dragRef, dragPreviewRef] = useDragAndDrop(!disabled, {
        type: `${ItemTypes.DYNAMIC_ZONE}_${name}`,
        index,
        item: {
            index,
            id: tempKey,
            displayedValue: `${displayName} ${displayTitle}`,
            icon
        },
        onMoveItem: onMoveComponent,
        onDropItem,
        onGrabItem,
        onCancel
    });
    React.useEffect(()=>{
        dragPreviewRef(getEmptyImage(), {
            captureDraggingState: false
        });
    }, [
        dragPreviewRef,
        index
    ]);
    const accordionValue = React.useId();
    /**
   * Ref for the component container `<li>`, used to scroll the newly added
   * component into view when `forceOpen` is set by the parent.
   */ const componentRef = React.useRef(null);
    const componentPath = `${name}.${index}`;
    const hasValue = useForm('DynamicComponent', (state)=>getIn(state.values, componentPath) != null);
    const isNewItem = useForm('DynamicComponent', (state)=>getIn(state.values, componentPath)?.id == null);
    const rawError = useForm('DynamicComponent', (state)=>getIn(state.errors, componentPath));
    const [collapseToOpen, setCollapseToOpen] = React.useState(isNewItem ? accordionValue : '');
    React.useEffect(()=>{
        if (rawError && hasValue) {
            setCollapseToOpen(accordionValue);
        }
    }, [
        rawError,
        hasValue,
        accordionValue
    ]);
    /**
   * When the parent flags this component as newly added via `forceOpen`,
   * expand the accordion and scroll it into view so the user can immediately
   * start editing. Once handled, notify the parent so it can clear the flag.
   */ React.useEffect(()=>{
        if (forceOpen) {
            setCollapseToOpen(accordionValue);
            requestAnimationFrame(()=>{
                componentRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
                onForceOpenHandled?.();
            });
        }
    }, [
        forceOpen,
        accordionValue,
        onForceOpenHandled
    ]);
    const composedBoxRefs = useComposedRefs(boxRef, dropRef);
    const canMoveUp = index > 0;
    const canMoveDown = index < totalLength - 1;
    const handleRemoveCurrentComponent = React.useCallback(()=>{
        onRemoveComponentClick(index);
    }, [
        onRemoveComponentClick,
        index
    ]);
    // [breakout-kit] the stock action buttons, hoisted into named consts (null when
    // stock wouldn't render them: disabled field, wrong breakpoint, list edge) so
    // entryActions receives them individually. Each node's markup is stock-identical.
    const deleteAction = disabled ? null : /*#__PURE__*/ jsx(IconButton, {
        variant: "ghost",
        label: formatMessage({
            id: getTranslation('components.DynamicZone.delete-label'),
            defaultMessage: 'Delete {name}'
        }, {
            name: displayTitle
        }),
        onClick: handleRemoveCurrentComponent,
        children: /*#__PURE__*/ jsx(Trash, {})
    });
    const dragAction = disabled || !isDesktop ? null : /*#__PURE__*/ jsx(IconButton, {
        variant: "ghost",
        onClick: (e)=>e.stopPropagation(),
        "data-handler-id": handlerId,
        ref: dragRef,
        label: formatMessage({
            id: getTranslation('components.DragHandle-label'),
            defaultMessage: 'Drag'
        }),
        onKeyDown: handleKeyDown,
        children: /*#__PURE__*/ jsx(Drag, {})
    });
    const moveUpAction = disabled || isDesktop || !canMoveUp ? null : /*#__PURE__*/ jsx(IconButton, {
        variant: "ghost",
        onClick: (e)=>{
            e.stopPropagation();
            onMoveComponent(index - 1, index);
        },
        disabled: !canMoveUp,
        label: formatMessage({
            id: getTranslation('components.DynamicZone.move-up'),
            defaultMessage: 'Move up'
        }),
        children: /*#__PURE__*/ jsx(ArrowUp, {})
    });
    const moveDownAction = disabled || isDesktop || !canMoveDown ? null : /*#__PURE__*/ jsx(IconButton, {
        variant: "ghost",
        onClick: (e)=>{
            e.stopPropagation();
            onMoveComponent(index + 1, index);
        },
        disabled: !canMoveDown,
        label: formatMessage({
            id: getTranslation('components.DynamicZone.move-down'),
            defaultMessage: 'Move down'
        }),
        children: /*#__PURE__*/ jsx(ArrowDown, {})
    });
    const moreAction = disabled ? null : /*#__PURE__*/ jsxs(Menu.Root, {
                children: [
                    /*#__PURE__*/ jsx(Menu.Trigger, {
                        size: "S",
                        endIcon: null,
                        paddingLeft: 0,
                        paddingRight: 0,
                        children: /*#__PURE__*/ jsx(IconButton, {
                            variant: "ghost",
                            label: formatMessage({
                                id: getTranslation('components.DynamicZone.more-actions'),
                                defaultMessage: 'More actions'
                            }),
                            tag: "span",
                            children: /*#__PURE__*/ jsx(More, {
                                "aria-hidden": true,
                                focusable: false
                            })
                        })
                    }),
                    /*#__PURE__*/ jsxs(Menu.Content, {
                        children: [
                            /*#__PURE__*/ jsxs(Menu.SubRoot, {
                                children: [
                                    /*#__PURE__*/ jsx(Menu.SubTrigger, {
                                        children: formatMessage({
                                            id: getTranslation('components.DynamicZone.add-item-above'),
                                            defaultMessage: 'Add component above'
                                        })
                                    }),
                                    /*#__PURE__*/ jsx(Menu.SubContent, {
                                        children: Object.entries(dynamicComponentsByCategory).map(([category, components])=>/*#__PURE__*/ jsxs(React.Fragment, {
                                                children: [
                                                    /*#__PURE__*/ jsx(Menu.Label, {
                                                        children: formatMessage({
                                                            id: category,
                                                            defaultMessage: upperFirst(category)
                                                        })
                                                    }),
                                                    components.map(({ displayName, uid })=>/*#__PURE__*/ jsx(Menu.Item, {
                                                            onSelect: ()=>onAddComponent(uid, index),
                                                            children: formatMessage({
                                                                id: uid,
                                                                defaultMessage: displayName ?? uid
                                                            })
                                                        }, uid))
                                                ]
                                            }, category))
                                    })
                                ]
                            }),
                            /*#__PURE__*/ jsxs(Menu.SubRoot, {
                                children: [
                                    /*#__PURE__*/ jsx(Menu.SubTrigger, {
                                        children: formatMessage({
                                            id: getTranslation('components.DynamicZone.add-item-below'),
                                            defaultMessage: 'Add component below'
                                        })
                                    }),
                                    /*#__PURE__*/ jsx(Menu.SubContent, {
                                        children: Object.entries(dynamicComponentsByCategory).map(([category, components])=>/*#__PURE__*/ jsxs(React.Fragment, {
                                                children: [
                                                    /*#__PURE__*/ jsx(Menu.Label, {
                                                        children: formatMessage({
                                                            id: category,
                                                            defaultMessage: upperFirst(category)
                                                        })
                                                    }),
                                                    components.map(({ displayName, uid })=>/*#__PURE__*/ jsx(Menu.Item, {
                                                            onSelect: ()=>onAddComponent(uid, index + 1),
                                                            children: formatMessage({
                                                                id: uid,
                                                                defaultMessage: displayName ?? uid
                                                            })
                                                        }, uid))
                                                ]
                                            }, category))
                                    })
                                ]
                            })
                        ]
                    })
                ]
            });
    // [breakout-kit] the stock composite: same order and nesting-free output as
    // upstream's Fragment (nulls render nothing, like upstream's short-circuits).
    const accordionActions = disabled ? null : /*#__PURE__*/ jsxs(Fragment, {
        children: [
            deleteAction,
            dragAction,
            moveUpAction,
            moveDownAction,
            moreAction
        ]
    });
    const accordionTitle = displayTitle ? `${displayName} ${displayTitle}` : displayName;
    // [breakout-kit] slot resolution; `undefined` means "use the stock default"
    const entryMeta = React.useMemo(()=>({
        source: 'dynamicZone',
        componentUid,
        index,
        total: totalLength,
        name,
        schema: {
            icon,
            displayName,
            category: componentUid ? componentUid.split('.')[0] : undefined
        }
    }), [componentUid, index, totalLength, name, icon, displayName]);
    const DefaultIconComponent = icon && COMPONENT_ICONS[icon] ? COMPONENT_ICONS[icon] : COMPONENT_ICONS.dashboard;
    const resolvedIcon = iconOverride !== undefined
        ? iconOverride
        : dzConfig.entryIcon?.(entryMeta, /*#__PURE__*/ jsx(DefaultIconComponent, {}));
    const resolvedLabel = labelOverride !== undefined
        ? labelOverride
        : dzConfig.entryLabel?.(entryMeta, accordionTitle);
    const resolvedActions = actionsOverride !== undefined
        ? actionsOverride
        : dzConfig.entryActions?.(entryMeta, {
            all: accordionActions,
            delete: deleteAction,
            drag: dragAction,
            moveUp: moveUpAction,
            moveDown: moveDownAction,
            more: moreAction
        });
    return /*#__PURE__*/ jsxs(ComponentContainer, {
        ref: componentRef,
        tag: "li",
        width: "100%",
        children: [
            /*#__PURE__*/ jsx(Flex, {
                justifyContent: "center",
                children: /*#__PURE__*/ jsx(Rectangle, {
                    background: "neutral200"
                })
            }),
            /*#__PURE__*/ jsx(StyledBox, {
                ref: composedBoxRefs,
                hasRadius: true,
                children: isDragging ? /*#__PURE__*/ jsx(Preview, {}) : /*#__PURE__*/ jsx(Accordion.Root, {
                    value: collapseToOpen,
                    onValueChange: setCollapseToOpen,
                    children: /*#__PURE__*/ jsxs(Accordion.Item, {
                        value: accordionValue,
                        children: [
                            /*#__PURE__*/ jsxs(Accordion.Header, {
                                children: [
                                    /*#__PURE__*/ jsx(Accordion.Trigger, {
                                        // [breakout-kit] slots; both fall back to the exact stock values
                                        icon: resolvedIcon === undefined ? DefaultIconComponent : ()=>resolvedIcon,
                                        children: resolvedLabel === undefined ? accordionTitle : resolvedLabel
                                    }),
                                    /*#__PURE__*/ jsx(Accordion.Actions, {
                                        // [breakout-kit] actions slot; falls back to stock
                                        children: resolvedActions === undefined ? accordionActions : resolvedActions
                                    })
                                ]
                            }),
                            /*#__PURE__*/ jsx(Accordion.Content, {
                                children: /*#__PURE__*/ jsx(AccordionContentRadius, {
                                    background: "neutral0",
                                    children: /*#__PURE__*/ jsx(DynamicComponentFields, {
                                        componentUid: componentUid,
                                        index: index,
                                        layout: componentUid ? components[componentUid]?.layout : undefined,
                                        name: name,
                                        children: children
                                    })
                                })
                            })
                        ]
                    })
                })
            })
        ]
    });
};
// TODO: Delete once https://github.com/strapi/design-system/pull/858
// is merged and released.
const StyledBox = styled(Box)`
  > div:first-child {
    box-shadow: ${({ theme })=>theme.shadows.tableShadow};
  }
`;
const AccordionContentRadius = styled(Box)`
  border-radius: 0 0 ${({ theme })=>theme.spaces[1]} ${({ theme })=>theme.spaces[1]};
`;
const Rectangle = styled(Box)`
  width: ${({ theme })=>theme.spaces[2]};
  height: ${({ theme })=>theme.spaces[4]};
`;
const Preview = styled.span`
  display: block;
  background-color: ${({ theme })=>theme.colors.primary100};
  outline: 1px dashed ${({ theme })=>theme.colors.primary500};
  outline-offset: -1px;
  padding: ${({ theme })=>theme.spaces[6]};
`;
const ComponentContainer = styled(Box)`
  list-style: none;
  padding: 0;
  margin: 0;
`;
const DynamicComponentFields = /*#__PURE__*/ React.memo(({ children, componentUid, index, layout, name })=>{
    const { formatMessage } = useIntl();
    return /*#__PURE__*/ jsx(Box, {
        padding: {
            initial: 4,
            medium: 6
        },
        children: /*#__PURE__*/ jsx(Grid.Root, {
            gap: 4,
            children: layout?.map((row, rowInd)=>{
                return /*#__PURE__*/ jsx(Grid.Item, {
                    col: 12,
                    xs: 12,
                    direction: "column",
                    alignItems: "stretch",
                    children: /*#__PURE__*/ jsx(ResponsiveGridRoot, {
                        gap: 4,
                        children: row.map(({ size, ...field })=>{
                            const fieldName = `${name}.${index}.${field.name}`;
                            const fieldWithTranslatedLabel = {
                                ...field,
                                label: formatMessage({
                                    id: `content-manager.components.${componentUid}.${field.name}`,
                                    defaultMessage: field.label
                                })
                            };
                            return /*#__PURE__*/ jsx(ResponsiveGridItem, {
                                col: size,
                                s: 12,
                                xs: 12,
                                direction: "column",
                                alignItems: "stretch",
                                children: children ? children({
                                    ...fieldWithTranslatedLabel,
                                    name: fieldName
                                }) : /*#__PURE__*/ jsx(MemoizedInputRenderer, {
                                    ...fieldWithTranslatedLabel,
                                    name: fieldName
                                })
                            }, fieldName);
                        })
                    })
                }, rowInd);
            })
        })
    });
});
DynamicComponentFields.displayName = 'DynamicComponentFields';
const MemoizedDynamicComponent = /*#__PURE__*/ React.memo(DynamicComponent);
// [breakout-kit] standalone fields body for renderEntry consumers: fetches the component
// layout the same way DynamicComponent does, then renders the stock fields grid.
const DzEntryFields = ({ componentUid, index, name, children })=>{
    const { currentDocumentMeta } = useDocumentContext('DzEntryFields');
    const { edit: { components } } = useDocumentLayout(currentDocumentMeta.model);
    return /*#__PURE__*/ jsx(DynamicComponentFields, {
        componentUid: componentUid,
        index: index,
        layout: componentUid ? components[componentUid]?.layout : undefined,
        name: name,
        children: children
    });
};

export { MemoizedDynamicComponent as DynamicComponent, DzEntryFields };
