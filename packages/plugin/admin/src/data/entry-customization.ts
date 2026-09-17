import * as React from 'react';

/**
 * Component-entry customization config (issues #4, #10). Typed twin of
 * vite/runtime/entry-customization-context.mjs — both get-or-create the context through
 * the same global symbol so the plugin bundle (<EditForm>) and the vendored entry modules
 * (inside @strapi/content-manager's graph) share one instance. Keep symbol + shape in sync.
 *
 * The shapes are zone-agnostic: the same `EntryCustomization` works for dynamic-zone
 * entries today and repeatable-component entries later (#10); `meta.source` discriminates.
 */

/** Metadata every slot receives about the entry being rendered. */
export interface ComponentEntryMeta {
  /** Which kind of list the entry lives in. */
  source: 'dynamicZone' | 'repeatable';
  /** For repeatables this is the attribute's fixed component uid. */
  componentUid: string;
  index: number;
  total: number;
  /** The zone/repeatable field name (form path prefix). */
  name: string;
  schema?: { icon?: string; displayName?: string; category?: string };
}

/** Full entry contract handed to renderEntry. */
export interface ComponentEntry extends ComponentEntryMeta {
  /** The entry's current form value (includes __component, __temp_key__). */
  value: Record<string, unknown>;
  disabled?: boolean;
  onRemove: () => void;
  onMove: (newIndex: number) => void;
  /** Renders the entry's field grid (stock inputs, nested recursion intact). */
  renderFields: () => React.ReactNode;
}

/**
 * The stock header action buttons, individually. All are LIVE nodes — the drag handle
 * arrives with its drag & drop refs and keyboard wiring attached, so reordering or
 * wrapping them keeps behavior intact. Pieces reflect the current breakpoint: `drag`
 * is null on mobile, `moveUp`/`moveDown` are null on desktop (and at list edges);
 * `all` is exactly what stock renders, in stock order. When the field is disabled,
 * stock renders no actions and every piece (incl. `all`) is null.
 */
export interface EntryActionDefaults {
  all: React.ReactNode;
  delete: React.ReactNode | null;
  drag: React.ReactNode | null;
  moveUp: React.ReactNode | null;
  moveDown: React.ReactNode | null;
  /** The "add component above/below" category menu — dynamic zones only. */
  more: React.ReactNode | null;
}

/**
 * DefaultEntry = the vendored stock accordion entry, pre-bound with all behavior
 * (drag & drop, keyboard reorder, delete, collapse, error handling). Accepts
 * per-entry `icon`/`label`/`actions` overrides on top of any top-level sugars.
 */
export type DefaultEntryComponent = React.ComponentType<{
  icon?: React.ReactNode;
  label?: React.ReactNode;
  actions?: React.ReactNode;
}>;

export interface EntryCustomization {
  /**
   * Override the accordion icon per entry. Return `undefined` to keep the stock icon
   * (so a lookup-map miss naturally falls back). `defaultIcon` is the rendered stock
   * icon — wrap it (`<Badge>{defaultIcon}</Badge>`) or replace it. Repeatables have no
   * stock icon (`defaultIcon` is null) but the accordion supports one, so this can add
   * an icon stock can't.
   */
  entryIcon?: (entry: ComponentEntryMeta, defaultIcon: React.ReactNode) => React.ReactNode | undefined;
  /** Override the accordion label per entry; `undefined` keeps the stock label. */
  entryLabel?: (entry: ComponentEntryMeta, defaultLabel: string) => React.ReactNode | undefined;
  /**
   * Override the header action buttons per entry; `undefined` keeps stock. `defaults`
   * exposes the stock buttons individually plus `all` (the stock-ordered composite) —
   * filter, reorder, wrap or extend them: `(e, d) => <>{myButton}{d.all}</>`.
   * Called even when the field is disabled (all defaults null) so read-only actions
   * are possible.
   */
  entryActions?: (entry: ComponentEntryMeta, defaults: EntryActionDefaults) => React.ReactNode | undefined;
  /**
   * Full control over each entry's chrome. Render `<DefaultEntry />` (optionally with
   * `icon`/`label`/`actions`) to keep stock behavior, or build your own container around
   * `entry.renderFields()` — in which case reorder/a11y affordances are yours to provide.
   */
  renderEntry?: (entry: ComponentEntry, DefaultEntry: DefaultEntryComponent) => React.ReactNode;
}

/** Bridge-context value: one slot per entry source (repeatable lands with #10). */
export interface EntryCustomizationContextValue {
  dynamicZone?: EntryCustomization;
  repeatable?: EntryCustomization;
}

const KEY = Symbol.for('strapi-plugin-breakout-kit/entry-customization@v1');

type EntryCustomizationContext = React.Context<EntryCustomizationContextValue | null>;

export function getEntryCustomizationContext(): EntryCustomizationContext {
  const store = globalThis as { [KEY]?: EntryCustomizationContext };
  if (!store[KEY]) {
    store[KEY] = React.createContext<EntryCustomizationContextValue | null>(null);
  }
  return store[KEY];
}
