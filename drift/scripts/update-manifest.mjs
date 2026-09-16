#!/usr/bin/env node
/**
 * Rewrites drift/manifest.json for a new Strapi version once adaptation is done:
 * recomputes every dependency hash from the target tag (fetched from GitHub) and
 * updates strapiVersion/strapiCommit.
 *
 * Usage: node drift/scripts/update-manifest.mjs --version 5.54.0
 * Exit codes: 0 = updated, 2 = error (e.g. a tracked file no longer exists — resolve
 * that in the manifest first; this script never silently drops dependencies).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashSource } from './lib/normalize.mjs';
import { fetchFileAtTag, fetchCommitForTag } from './lib/github.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifestPath = path.join(repoRoot, 'drift', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const args = process.argv.slice(2);
const index = args.indexOf('--version');
const targetVersion = index >= 0 ? args[index + 1] : undefined;
if (!targetVersion) {
  console.error('Usage: node drift/scripts/update-manifest.mjs --version <strapi version>');
  process.exit(2);
}

let failed = false;
for (const dep of manifest.dependencies) {
  const content = await fetchFileAtTag(targetVersion, dep.path);
  if (content === null) {
    console.error(`MISSING at v${targetVersion}: ${dep.id} -> ${dep.path}`);
    failed = true;
    continue;
  }
  dep.hash = hashSource(content);
}
if (failed) {
  console.error('Manifest NOT updated — fix or remove the missing dependencies first.');
  process.exit(2);
}

manifest.strapiVersion = targetVersion;
manifest.strapiCommit = (await fetchCommitForTag(targetVersion)) ?? 'unknown';
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `Manifest updated to Strapi ${targetVersion} (${manifest.strapiCommit}); ${manifest.dependencies.length} hashes recomputed.`
);
