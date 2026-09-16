import { describe, expect, it } from 'vitest';

import { extractExportNames } from '../../drift/scripts/lib/exports-list.mjs';
import { normalizeSource, hashSource } from '../../drift/scripts/lib/normalize.mjs';

describe('extractExportNames', () => {
  it('handles named exports, aliases and re-exports', () => {
    const source = `
      export { buildValidParams } from './utils/api';
      export { useDocument as unstable_useDocument, useContentManagerContext } from './hooks/useDocument';
      export type { EditFieldLayout, EditLayout } from './hooks/useDocumentLayout';
      export * from './features/DocumentRBAC';
      export const DocumentStatus = () => null;
      export function helper() {}
    `;
    const names = extractExportNames(source);
    expect(names).toContain('buildValidParams');
    expect(names).toContain('unstable_useDocument'); // alias target, not original
    expect(names).not.toContain('useDocument');
    expect(names).toContain('useContentManagerContext');
    expect(names).toContain('EditFieldLayout');
    expect(names).toContain('*:./features/DocumentRBAC');
    expect(names).toContain('DocumentStatus');
    expect(names).toContain('helper');
  });
});

describe('normalizeSource', () => {
  it('ignores comments and whitespace but not code changes', () => {
    const a = `const x = 1; // comment\n/* block */\nconst y = 2;`;
    const b = `const x = 1;\nconst y = 2;`;
    const c = `const x = 1;\nconst y = 3;`;
    expect(normalizeSource(a)).toBe(normalizeSource(b));
    expect(hashSource(a)).toBe(hashSource(b));
    expect(hashSource(a)).not.toBe(hashSource(c));
  });
});
