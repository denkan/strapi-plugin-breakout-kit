import * as React from 'react';

/**
 * The headless document context is shared between two module graphs that must agree on one
 * React context instance: the plugin's bundled admin code (<DocumentProvider>) and the
 * useDocumentContext shim injected into @strapi/content-manager's module graph by the Vite
 * helper. A global-symbol get-or-create makes the instance independent of module identity
 * and evaluation order.
 *
 * Context value shape (must match what CM's useDocumentContext returns):
 *   { currentDocumentMeta: DocumentMeta, currentDocument: ReturnType<useDocument> }
 */
const KEY = Symbol.for('strapi-plugin-breakout-kit/document-context@v1');

export function getHeadlessDocumentContext() {
  if (!globalThis[KEY]) {
    globalThis[KEY] = React.createContext(null);
  }
  return globalThis[KEY];
}
