/**
 * [breakout-kit] Render-stable identities for the `Default*` components the seams hand
 * to consumer callbacks (renderEntry/renderAddButton/renderBox).
 *
 * A component type created inside render is a NEW type every render, so consumer JSX
 * like `<DefaultEntry />` makes React unmount/remount the whole subtree on every form
 * change (accordion state wiped, mount effects re-fired, focus lost). These helpers keep
 * the component identity stable across renders while the rendered content stays current:
 * the identity closes over a mutable slot that each render refreshes (render-phase slot
 * writes are safe here — the slot is only read by children rendered in the same pass).
 */
import { jsx } from 'react/jsx-runtime';
import * as React from 'react';

/**
 * One stable zero-prop component that renders whatever node the returned ref holds.
 * Usage: assign `ref.current = stockNode` during render, pass `Component` to the seam.
 */
export function useStableNodeComponent() {
    const nodeRef = React.useRef(null);
    const Component = React.useMemo(()=>{
        const StableSeamDefault = ()=>nodeRef.current;
        return StableSeamDefault;
    }, []);
    return [
        nodeRef,
        Component
    ];
}

/**
 * A per-entry-key store of stable Default components (for lists keyed by
 * `__temp_key__`). `get(key, Impl, props)` returns the same component identity for a
 * key across renders, rendering `Impl` with the latest `props` merged under any
 * overrides the consumer passes (`<DefaultEntry icon={…} />`). Call `prune(liveKeys)`
 * once per render so removed entries don't leak slots. Temp-key changes (stock
 * reorder semantics) naturally produce a fresh identity, matching stock remounts.
 */
export function useStableEntrySlots() {
    const slotsRef = React.useRef(new Map());
    return React.useMemo(()=>({
            prune (liveKeys) {
                const keep = new Set(liveKeys);
                for (const key of slotsRef.current.keys()){
                    if (!keep.has(key)) slotsRef.current.delete(key);
                }
            },
            get (key, Impl, props) {
                let slot = slotsRef.current.get(key);
                if (!slot) {
                    slot = {
                        props
                    };
                    const StableSeamEntry = (overrides)=>jsx(Impl, {
                            ...slot.props,
                            ...overrides
                        });
                    slot.Default = StableSeamEntry;
                    slotsRef.current.set(key, slot);
                } else {
                    slot.props = props;
                }
                return slot.Default;
            }
        }), []);
}
