#!/usr/bin/env node
/**
 * Recomputes the `hash` of every dependency in drift/manifest.json from a local
 * Strapi source checkout (default: scratch/strapi, expected to be at the tag named
 * by manifest.strapiVersion). Used to populate the manifest; the Phase 7 check
 * script compares these hashes against a fetched tag instead.
 *
 * Usage: node drift/scripts/update-hashes.mjs [path-to-strapi-checkout]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashSource } from './lib/normalize.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifestPath = path.join(repoRoot, 'drift', 'manifest.json');
const strapiRoot = path.resolve(process.argv[2] ?? path.join(repoRoot, 'scratch', 'strapi'));

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

let updated = 0;
for (const dep of manifest.dependencies) {
  const filePath = path.join(strapiRoot, dep.path);
  if (!fs.existsSync(filePath)) {
    console.error(`MISSING in checkout: ${dep.id} -> ${dep.path}`);
    process.exitCode = 1;
    continue;
  }
  const hash = hashSource(fs.readFileSync(filePath, 'utf8'));
  if (dep.hash !== hash) {
    dep.hash = hash;
    updated += 1;
  }
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${manifest.dependencies.length} dependencies, ${updated} hash(es) updated.`);
