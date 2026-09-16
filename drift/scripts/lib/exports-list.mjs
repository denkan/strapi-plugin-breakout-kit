/**
 * Extracts exported symbol names from a TS/JS source file (regex-based; good enough for
 * the flat export files we track: exports.ts, index.ts, admin.ts).
 */
export function extractExportNames(source) {
  const names = new Set();
  // export { a, b as c } from '...' / export { a, b }
  for (const match of source.matchAll(/export\s*(?:type\s*)?\{([^}]*)\}/g)) {
    for (const part of match[1].split(',')) {
      const cleaned = part.trim();
      if (!cleaned) continue;
      const asMatch = cleaned.match(/(?:^|\s)as\s+([A-Za-z0-9_$]+)$/);
      names.add(asMatch ? asMatch[1] : cleaned.replace(/^type\s+/, '').split(/\s+/)[0]);
    }
  }
  // export const/function/class/let/var NAME
  for (const match of source.matchAll(
    /export\s+(?:declare\s+)?(?:const|function|class|let|var|type|interface|enum)\s+([A-Za-z0-9_$]+)/g
  )) {
    names.add(match[1]);
  }
  // export * from '...' — record the source module instead of names
  for (const match of source.matchAll(/export\s*\*\s*from\s*['"]([^'"]+)['"]/g)) {
    names.add(`*:${match[1]}`);
  }
  names.delete('');
  return [...names].sort();
}
