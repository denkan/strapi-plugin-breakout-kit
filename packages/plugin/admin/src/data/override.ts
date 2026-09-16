/**
 * Design principle 3 (PLAN.md): every derived value accepts an override that is either a
 * replacement value or a transform `(defaultValue) => newValue`.
 */
export type Override<T> = T | ((defaultValue: T) => T);

export function resolveOverride<T>(override: Override<T> | undefined, defaultValue: T): T {
  if (override === undefined) {
    return defaultValue;
  }
  if (typeof override === 'function') {
    return (override as (defaultValue: T) => T)(defaultValue);
  }
  return override;
}

/**
 * A plain replacement value means controlled mode (skip fetching); a transform function
 * still needs the fetched default as input, so it stays uncontrolled.
 */
export function isControlledValue<T>(override: Override<T> | undefined): override is T {
  return override !== undefined && typeof override !== 'function';
}
