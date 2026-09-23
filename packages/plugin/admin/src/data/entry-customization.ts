import * as React from 'react';

/**
 * Component-entry customization config (issues #4, #10). Typed twin of
 * vite/runtime/entry-customization-context.mjs — both get-or-create the context through
 * the same global symbol so the plugin bundle (<EditForm>) and the vendored entry modules
 * (inside @strapi/content-manager's graph) share one instance. Keep symbol + shape in sync.
 *
 * The shapes are zone-agnostic: the same `EntryCustomization` works for dynamic-zone
 * entries and repeatable-component entries alike; `meta.source` discriminates.
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

/** Options for `renderFields()` on entries and boxes. */
export interface RenderFieldsOptions {
  /**
   * Render only these fields (component attribute names), in layout order; rows left
   * empty are dropped. Omit for the full grid. Lets one entry be split across several
   * containers (tabs, sections) — each call carries its own component context.
   */
  fields?: string[];
}

/** Full entry contract handed to renderEntry. */
export interface ComponentEntry extends ComponentEntryMeta {
  /** The entry's current form value (includes __component, __temp_key__). */
  value: Record<string, unknown>;
  disabled?: boolean;
  onRemove: () => void;
  onMove: (newIndex: number) => void;
  /** Renders the entry's field grid (stock inputs, nested recursion intact). */
  renderFields: (options?: RenderFieldsOptions) => React.ReactNode;
}

/**
 * The stock header action buttons, individually. All are LIVE nodes — the drag handle
 * arrives with its drag & drop refs and keyboard wiring attached, so reordering or
 * wrapping them keeps behavior intact. Pieces reflect the current breakpoint: `drag`
 * is null on mobile, `moveUp`/`moveDown` are null on desktop (and at list edges);
 * `all` is exactly what stock renders, in stock order. Disabled fields mirror stock:
 * dynamic zones render NO actions (every piece incl. `all` is null), repeatables
 * render the buttons in their disabled state (nodes present).
 */
export interface EntryActionDefaults {
  all: React.ReactNode;
  delete: React.ReactNode | null;
  drag: React.ReactNode | null;
  moveUp: React.ReactNode | null;
  moveDown: React.ReactNode | null;
  /** The "add component above/below" category menu — dynamic zones only (null for repeatables). */
  more: React.ReactNode | null;
}

/** One selectable component in an "add" picker. */
export interface ComponentOption {
  uid: string;
  displayName: string;
  icon?: string;
}

/** Context handed to renderAddButton — everything a custom add UI needs. */
export interface AddButtonContext {
  source: 'dynamicZone' | 'repeatable';
  /** The zone/repeatable field name. */
  name: string;
  /** Current entry count. */
  total: number;
  min?: number;
  max?: number;
  disabled: boolean;
  /** Stock inline picker open state (always false for repeatables — they have no picker). */
  isOpen: boolean;
  /**
   * Dynamic zones: open/close the stock inline picker. Repeatables: perform the stock
   * add. Both enforce `max` with the stock notification.
   */
  toggle: () => void;
  /**
   * Insert a component at `position` (append when omitted). Does NOT enforce `max` —
   * custom UIs check `total`/`max` themselves. Repeatables ignore the uid argument
   * (the component type is fixed).
   */
  add: (componentUid: string, position?: number) => void;
  /** Allowed components grouped by category (one fixed entry for repeatables). */
  componentsByCategory: Record<string, ComponentOption[]>;
}

/**
 * The stock add affordance for the current state: dynamic zones render the centered
 * button wired to the stock inline picker; repeatables render the "Add an entry"
 * footer button — or the empty-state initializer box when there are no entries yet.
 */
export type DefaultAddButtonComponent = React.ComponentType;

/**
 * DefaultEntry = the vendored stock accordion entry, pre-bound with all behavior
 * (drag & drop, keyboard reorder, delete, collapse, error handling). Accepts
 * per-entry `icon`/`label`/`actions` overrides on top of any top-level sugars.
 */
export type DefaultEntryComponent = React.ComponentType<{
  icon?: React.ReactNode;
  label?: React.ReactNode;
  actions?: React.ReactNode;
  /**
   * Replaces the accordion BODY (the stock fields grid and its padding) while keeping
   * the stock chrome: header, drag & drop, actions, collapse state. Compose it from
   * `entry.renderFields({ fields })` calls to group fields into tabs/sections.
   */
  body?: React.ReactNode;
}>;

export interface EntryCustomization {
  /**
   * Override the accordion icon per entry. Return `undefined` to keep the stock icon
   * (so a lookup-map miss naturally falls back). `defaultIcon` is the rendered stock
   * icon — wrap it (`<Badge>{defaultIcon}</Badge>`) or replace it. Repeatables have no
   * stock icon (`defaultIcon` is null) but the accordion supports one, so this can add
   * an icon stock can't.
   */
  entryIcon?: (
    entry: ComponentEntryMeta,
    defaultIcon: React.ReactNode
  ) => React.ReactNode | undefined;
  /** Override the accordion label per entry; `undefined` keeps the stock label. */
  entryLabel?: (entry: ComponentEntryMeta, defaultLabel: string) => React.ReactNode | undefined;
  /**
   * Override the header action buttons per entry; `undefined` keeps stock. `defaults`
   * exposes the stock buttons individually plus `all` (the stock-ordered composite) —
   * filter, reorder, wrap or extend them: `(e, d) => <>{myButton}{d.all}</>`.
   * Called even when the field is disabled (all defaults null) so read-only actions
   * are possible.
   */
  entryActions?: (
    entry: ComponentEntryMeta,
    defaults: EntryActionDefaults
  ) => React.ReactNode | undefined;
  /**
   * Replace the "add" affordance (button and, if you like, the whole picking flow).
   * `undefined` keeps stock. A custom UI typically renders its own button + popup and
   * calls `ctx.add(uid)` — the stock inline picker simply stays closed. Render
   * `<DefaultAddButton />` to keep the stock button/picker.
   */
  renderAddButton?: (
    ctx: AddButtonContext,
    DefaultAddButton: DefaultAddButtonComponent
  ) => React.ReactNode | undefined;
  /**
   * Full control over each entry's chrome. Render `<DefaultEntry />` (optionally with
   * `icon`/`label`/`actions`) to keep stock behavior, or build your own container around
   * `entry.renderFields()` — in which case reorder/a11y affordances are yours to provide.
   */
  renderEntry?: (entry: ComponentEntry, DefaultEntry: DefaultEntryComponent) => React.ReactNode;
}

/**
 * A SINGLE (non-repeatable) component field, handed to renderBox. Not a list entry —
 * no index/actions; one state-aware box instead.
 */
export interface ComponentBox {
  source: 'singleComponent';
  componentUid: string;
  /** The field name (form path; nested single components carry their full path). */
  name: string;
  schema?: { icon?: string; displayName?: string; category?: string };
  /** null = uninitialized (stock shows the "click to add" box). */
  value: Record<string, unknown> | null;
  disabled: boolean;
  /** Initialize with the component's default form values (what the stock box click does). */
  onInitialize: () => void;
  /** Reset back to null (what the stock "Reset Entry" trash does). */
  onClear: () => void;
  /**
   * The stock fields grid without box chrome — carries its own ComponentProvider so
   * nested inputs work inside custom chrome. Returns null while `value` is null.
   * `{ fields }` renders a subset (see RenderFieldsOptions).
   */
  renderFields: (options?: RenderFieldsOptions) => React.ReactNode;
}

/** The stock box for the CURRENT state: the initializer when null, the boxed fields when set. */
export type DefaultBoxComponent = React.ComponentType;

export interface SingleComponentCustomization {
  /**
   * Replace the single-component box. Called in BOTH states — branch on `box.value`
   * and return `undefined` for any state you want to keep stock:
   * `(box, Default) => box.value ? <MyCard onClear={box.onClear}>{box.renderFields()}</MyCard> : undefined`.
   * The field label row (and its stock "Reset Entry" trash) stays either way.
   */
  renderBox?: (box: ComponentBox, DefaultBox: DefaultBoxComponent) => React.ReactNode | undefined;
}

/** Bridge-context value: one slot per entry source. */
export interface EntryCustomizationContextValue {
  dynamicZone?: EntryCustomization;
  repeatable?: EntryCustomization;
  singleComponent?: SingleComponentCustomization;
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
