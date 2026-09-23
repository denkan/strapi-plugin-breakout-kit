import { describe, expect, it } from 'vitest';

import { filterLayoutRows } from '../../packages/plugin/vite/runtime/layout-filter.mjs';

const f = (name) => ({ name, size: 6 });
const layout = [[f('title'), f('slug')], [f('body')], [f('image'), f('caption')]];

describe('filterLayoutRows', () => {
  it('returns the layout untouched without a field list', () => {
    expect(filterLayoutRows(layout, undefined)).toBe(layout);
    expect(filterLayoutRows(undefined, ['title'])).toBeUndefined();
  });

  it('keeps only the listed fields, preserving row structure and order', () => {
    expect(filterLayoutRows(layout, ['caption', 'title'])).toEqual([[f('title')], [f('caption')]]);
  });

  it('drops rows left empty and tolerates unknown names', () => {
    expect(filterLayoutRows(layout, ['nope'])).toEqual([]);
    expect(filterLayoutRows(layout, ['body', 'nope'])).toEqual([[f('body')]]);
  });
});
