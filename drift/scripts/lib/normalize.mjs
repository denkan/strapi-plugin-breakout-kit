import crypto from 'node:crypto';

/**
 * Normalizes source content before hashing so formatting-only upstream changes
 * (comments, whitespace, line endings) don't register as drift. Regex-based comment
 * stripping is imperfect for pathological strings containing comment markers, but it
 * is deterministic and applied identically on both sides of every comparison.
 */
export function normalizeSource(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/^[ \t]*\/\/.*$/gm, '') // full-line line comments
    .replace(/\s+/g, ''); // all whitespace
}

export function hashSource(content) {
  return crypto.createHash('sha256').update(normalizeSource(content)).digest('hex');
}
