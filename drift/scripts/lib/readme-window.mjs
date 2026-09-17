/**
 * Rewrites the support-window mentions in the plugin README (issue #13):
 * - the Compatibility table row: `| 0.x | 5.50 – 5.54 (every minor suite-verified) |`
 * - the dist-tag install example: `strapi-plugin-breakout-kit@strapi-5.54`
 *
 * Anchored on the fixed phrases around the version tokens so an unrelated edit to the
 * README can't be silently mangled; returns { content, replaced } where `replaced` is
 * the number of substitutions made — callers warn loudly when it isn't 2, so a reworded
 * README fails the adaptation run instead of shipping a stale window.
 */
const minorOf = (version) => version.split('.').slice(0, 2).join('.');

export function updateReadmeWindow(content, floor, target) {
  const floorMinor = minorOf(floor);
  const roofMinor = minorOf(target);
  let replaced = 0;

  const next = content
    .replace(/\d+\.\d+ – \d+\.\d+ \(every minor suite-verified\)/, () => {
      replaced += 1;
      return `${floorMinor} – ${roofMinor} (every minor suite-verified)`;
    })
    .replace(/@strapi-\d+\.\d+/g, () => {
      replaced += 1;
      return `@strapi-${roofMinor}`;
    });

  return { content: next, replaced };
}
