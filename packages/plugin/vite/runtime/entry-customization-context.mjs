import * as React from 'react';

/**
 * Bridge context for component-entry customization (issues #4, #10): provided by
 * <EditForm>'s `dynamicZone` (and later `repeatable`) props (plugin bundle), consumed
 * by the vendored entry modules living in @strapi/content-manager's module graph.
 * Same global-symbol get-or-create pattern as headless-document-context — one instance
 * regardless of module identity.
 *
 * Value shape (all optional; absent config = byte-identical stock rendering):
 *   { dynamicZone?: EntryCustomization, repeatable?: EntryCustomization }
 * where EntryCustomization =
 *   { entryIcon(entry, defaultIcon) -> node|undefined,
 *     entryLabel(entry, defaultLabel) -> node|undefined,
 *     entryActions(entry, defaults) -> node|undefined,
 *     renderEntry(entry, DefaultEntry) -> node,
 *     renderAddButton(ctx, DefaultAddButton) -> node|undefined }
 * Typed twin: admin/src/data/entry-customization.ts — keep symbol + shape in sync.
 */
const KEY = Symbol.for('strapi-plugin-breakout-kit/entry-customization@v1');

export function getEntryCustomizationContext() {
  if (!globalThis[KEY]) {
    globalThis[KEY] = React.createContext(null);
  }
  return globalThis[KEY];
}
