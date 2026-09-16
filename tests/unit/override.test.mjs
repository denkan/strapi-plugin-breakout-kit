import { describe, expect, it } from 'vitest';

import {
  isControlledValue,
  resolveOverride,
} from '../../packages/plugin/admin/src/data/override';

describe('resolveOverride', () => {
  it('returns the default when no override is given', () => {
    expect(resolveOverride(undefined, 'default')).toBe('default');
  });

  it('returns the replacement value when a plain value is given', () => {
    expect(resolveOverride('mine', 'default')).toBe('mine');
    expect(resolveOverride({ a: 1 }, { a: 2 })).toEqual({ a: 1 });
  });

  it('applies a transform function to the default', () => {
    expect(resolveOverride((v) => `${v}!`, 'default')).toBe('default!');
    expect(
      resolveOverride((layout) => [...layout, 'extra'], ['a', 'b'])
    ).toEqual(['a', 'b', 'extra']);
  });

  it('lets a transform return something unrelated to the default', () => {
    expect(resolveOverride(() => null, 'default')).toBeNull();
  });
});

describe('isControlledValue', () => {
  it('is false for undefined (uncontrolled)', () => {
    expect(isControlledValue(undefined)).toBe(false);
  });

  it('is false for transform functions (still needs the fetched default)', () => {
    expect(isControlledValue(() => ({}))).toBe(false);
  });

  it('is true for plain values (controlled: skip fetching)', () => {
    expect(isControlledValue({})).toBe(true);
    expect(isControlledValue(null)).toBe(true);
    expect(isControlledValue('x')).toBe(true);
  });
});
