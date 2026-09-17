import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { extractExportNames } from '../../drift/scripts/lib/exports-list.mjs';
import { normalizeSource, hashSource } from '../../drift/scripts/lib/normalize.mjs';
import { updateReadmeWindow } from '../../drift/scripts/lib/readme-window.mjs';

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
  it('ignores full-line comments, block comments and whitespace — not code changes', () => {
    // Note: trailing `//` comments are deliberately NOT stripped (a regex would
    // corrupt string literals containing `//`, e.g. URLs).
    const a = `const x = 1;\n// full-line comment\n/* block\ncomment */\nconst y = 2;`;
    const b = `const x = 1;\nconst y = 2;`;
    const c = `const x = 1;\nconst y = 3;`;
    expect(normalizeSource(a)).toBe(normalizeSource(b));
    expect(hashSource(a)).toBe(hashSource(b));
    expect(hashSource(a)).not.toBe(hashSource(c));
    const url = `const u = 'https://example.com';`;
    expect(normalizeSource(url)).toContain('https://example.com');
  });
});

describe('updateReadmeWindow', () => {
  const readme = [
    '| Plugin version | Tested against Strapi |',
    '|---|---|',
    '| 0.x | 5.50 – 5.54 (every minor suite-verified) |',
    '',
    'Pin by Strapi version: `npm install strapi-plugin-breakout-kit@strapi-5.54`.',
  ].join('\n');

  it('rewrites the table row and the dist-tag example from floor/target', () => {
    const { content, replaced } = updateReadmeWindow(readme, '5.50.0', '5.57.0');
    expect(replaced).toBe(2);
    expect(content).toContain('| 0.x | 5.50 – 5.57 (every minor suite-verified) |');
    expect(content).toContain('@strapi-5.57`');
    expect(content).not.toContain('5.54');
  });

  it('follows a raised floor', () => {
    const { content } = updateReadmeWindow(readme, '5.52.0', '5.55.0');
    expect(content).toContain('| 0.x | 5.52 – 5.55 (every minor suite-verified) |');
  });

  it('reports missing anchors instead of guessing', () => {
    const { replaced } = updateReadmeWindow('a reworded README', '5.50.0', '5.55.0');
    expect(replaced).toBe(0);
  });

  it('matches the real README', () => {
    const real = fs.readFileSync('packages/plugin/README.md', 'utf8');
    const { replaced } = updateReadmeWindow(real, '5.50.0', '5.54.0');
    expect(replaced).toBe(2);
  });
});
