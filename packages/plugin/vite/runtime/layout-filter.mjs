/**
 * [breakout-kit] `renderFields({ fields })` support: keep only the listed fields of a
 * component layout, preserving row structure and order; rows left empty are dropped.
 * `fields` undefined = the full layout (stock).
 */
export function filterLayoutRows(layout, fields) {
  if (!layout || !fields) return layout;
  const wanted = new Set(fields);
  return layout
    .map((row) => row.filter((field) => wanted.has(field.name)))
    .filter((row) => row.length > 0);
}
