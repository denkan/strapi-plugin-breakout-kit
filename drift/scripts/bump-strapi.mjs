#!/usr/bin/env node
/**
 * Bumps the Strapi version across the monorepo for an adaptation run:
 * - apps/playground: every exact-pinned @strapi/* dependency currently at the manifest's
 *   version is set to the target (other deps untouched)
 * - packages/plugin: @strapi/{strapi,admin,content-manager} devDependency ranges -> ^target,
 *   peerDependency ranges -> the tested window ">=manifest.strapiFloor <target's-next-minor"
 *   (versioning decision #7: peers declare exactly what a release was tested against)
 * - packages/plugin/README.md: the Compatibility table row and the dist-tag install
 *   example follow the window (issue #13), so npm never shows a stale range
 *
 * Usage: node drift/scripts/bump-strapi.mjs --version 5.54.0
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { updateReadmeWindow } from './lib/readme-window.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const args = process.argv.slice(2);
const index = args.indexOf('--version');
const target = index >= 0 ? args[index + 1] : undefined;
if (!target) {
  console.error('Usage: node drift/scripts/bump-strapi.mjs --version <strapi version>');
  process.exit(2);
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'drift', 'manifest.json'), 'utf8')
);
const current = manifest.strapiVersion;

const playgroundPath = path.join(repoRoot, 'apps', 'playground', 'package.json');
const playground = JSON.parse(fs.readFileSync(playgroundPath, 'utf8'));
let bumped = 0;
for (const [name, version] of Object.entries(playground.dependencies ?? {})) {
  if (name.startsWith('@strapi/') && version === current) {
    playground.dependencies[name] = target;
    bumped += 1;
  }
}
fs.writeFileSync(playgroundPath, `${JSON.stringify(playground, null, 2)}\n`);

const pluginPath = path.join(repoRoot, 'packages', 'plugin', 'package.json');
const plugin = JSON.parse(fs.readFileSync(pluginPath, 'utf8'));
const [major, minor] = target.split('.').map(Number);
// The support window keeps its floor (manifest.strapiFloor); adaptation moves the roof.
const floor = manifest.strapiFloor ?? target;
const tightRange = `>=${floor} <${major}.${minor + 1}.0`;
for (const name of ['@strapi/strapi', '@strapi/admin', '@strapi/content-manager']) {
  if (plugin.devDependencies?.[name]) plugin.devDependencies[name] = `^${target}`;
  if (plugin.peerDependencies?.[name]) plugin.peerDependencies[name] = tightRange;
}
fs.writeFileSync(pluginPath, `${JSON.stringify(plugin, null, 2)}\n`);

const readmePath = path.join(repoRoot, 'packages', 'plugin', 'README.md');
const readme = fs.readFileSync(readmePath, 'utf8');
const { content: nextReadme, replaced } = updateReadmeWindow(readme, floor, target);
fs.writeFileSync(readmePath, nextReadme);
if (replaced !== 2) {
  // The README was reworded past the anchors — fail loudly rather than ship a stale window.
  console.error(
    `README window rewrite made ${replaced} substitution(s), expected 2 — check packages/plugin/README.md against drift/scripts/lib/readme-window.mjs.`
  );
  process.exitCode = 1;
}

console.log(
  `Bumped ${bumped} playground @strapi/* deps ${current} -> ${target}; plugin peers -> ${tightRange}; README window -> ${floor.split('.').slice(0, 2).join('.')}–${target.split('.').slice(0, 2).join('.')}.`
);
