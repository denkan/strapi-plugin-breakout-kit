#!/usr/bin/env node
/**
 * Drift check: compares every dependency in drift/manifest.json against the Strapi
 * source at a target version's tag (fetched from GitHub, no clone needed).
 *
 * Usage:
 *   node drift/scripts/check.mjs --version 5.54.0 [--json out.json] [--report out.md]
 *
 * Output: a human-readable markdown report (stdout or --report), with unified diffs for
 * changed files and an export-name analysis for `kind: "export"` entries.
 * Exit codes: 0 = no drift, 1 = drift detected, 2 = error.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashSource } from './lib/normalize.mjs';
import { fetchFileAtTag, fetchCommitForTag } from './lib/github.mjs';
import { extractExportNames } from './lib/exports-list.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifest = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'drift', 'manifest.json'), 'utf8')
);

const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const targetVersion = getArg('version');
if (!targetVersion) {
  console.error('Usage: node drift/scripts/check.mjs --version <strapi version>');
  process.exit(2);
}

const unifiedDiff = (label, oldContent, newContent) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-'));
  const oldFile = path.join(dir, 'old');
  const newFile = path.join(dir, 'new');
  fs.writeFileSync(oldFile, oldContent);
  fs.writeFileSync(newFile, newContent);
  try {
    execFileSync('git', ['diff', '--no-index', '--', oldFile, newFile], {
      encoding: 'utf8',
    });
    return '';
  } catch (err) {
    // git diff --no-index exits 1 when files differ; stdout holds the diff.
    const raw = err.stdout ?? '';
    return raw
      .split('\n')
      .filter((line) => !line.startsWith('diff --git') && !line.startsWith('index '))
      .map((line) =>
        line
          .replace(`a${oldFile}`, `a/${label}`)
          .replace(`b${newFile}`, `b/${label}`)
          .replace(oldFile, `a/${label}`)
          .replace(newFile, `b/${label}`)
      )
      .join('\n');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const results = [];
for (const dep of manifest.dependencies) {
  const [baseContent, targetContent] = await Promise.all([
    fetchFileAtTag(manifest.strapiVersion, dep.path),
    fetchFileAtTag(targetVersion, dep.path),
  ]);

  if (targetContent === null) {
    results.push({ dep, status: 'removed' });
    continue;
  }
  const targetHash = hashSource(targetContent);
  if (targetHash === dep.hash) {
    results.push({ dep, status: 'unchanged' });
    continue;
  }
  const entry = { dep, status: 'changed', targetHash };
  if (baseContent !== null) {
    entry.diff = unifiedDiff(dep.path, baseContent, targetContent);
    if (dep.kind === 'export') {
      const before = extractExportNames(baseContent);
      const after = extractExportNames(targetContent);
      entry.exportsRemoved = before.filter((name) => !after.includes(name));
      entry.exportsAdded = after.filter((name) => !before.includes(name));
    }
  }
  results.push(entry);
}

const changed = results.filter((r) => r.status === 'changed');
const removed = results.filter((r) => r.status === 'removed');
const unchanged = results.filter((r) => r.status === 'unchanged');
const targetCommit = await fetchCommitForTag(targetVersion);

const lines = [];
lines.push(`# Drift report: Strapi ${manifest.strapiVersion} → ${targetVersion}`);
lines.push('');
lines.push(
  `Base commit: \`${manifest.strapiCommit}\` · target commit: \`${targetCommit ?? 'unknown'}\``
);
lines.push('');
lines.push(
  `**${unchanged.length} unchanged · ${changed.length} changed · ${removed.length} removed** (of ${results.length} tracked dependencies)`
);
lines.push('');
if (removed.length) {
  lines.push('## ❌ Removed upstream');
  lines.push('');
  for (const { dep } of removed) {
    lines.push(`- \`${dep.id}\` — \`${dep.path}\` no longer exists (used by: ${dep.usedBy.join(', ')})`);
  }
  lines.push('');
}
if (changed.length) {
  lines.push('## ⚠️ Changed');
  lines.push('');
  for (const entry of changed) {
    const { dep } = entry;
    lines.push(`### \`${dep.id}\``);
    lines.push('');
    lines.push(`- path: \`${dep.path}\``);
    if (dep.symbol) lines.push(`- symbols we use: ${dep.symbol}`);
    lines.push(`- used by: ${dep.usedBy.join(', ')}`);
    if (dep.note) lines.push(`- note: ${dep.note}`);
    if (entry.exportsRemoved?.length) {
      lines.push(`- **exports removed:** ${entry.exportsRemoved.join(', ')}`);
    }
    if (entry.exportsAdded?.length) {
      lines.push(`- exports added: ${entry.exportsAdded.join(', ')}`);
    }
    lines.push('');
    if (entry.diff) {
      lines.push('<details><summary>diff</summary>');
      lines.push('');
      lines.push('```diff');
      lines.push(entry.diff.trimEnd());
      lines.push('```');
      lines.push('');
      lines.push('</details>');
      lines.push('');
    }
  }
}
if (unchanged.length) {
  lines.push('## ✅ Unchanged');
  lines.push('');
  lines.push(unchanged.map(({ dep }) => `\`${dep.id}\``).join(' · '));
  lines.push('');
}

const report = lines.join('\n');
const reportPath = getArg('report');
if (reportPath) fs.writeFileSync(reportPath, report);
else console.log(report);

const jsonPath = getArg('json');
if (jsonPath) {
  fs.writeFileSync(
    jsonPath,
    `${JSON.stringify(
      {
        baseVersion: manifest.strapiVersion,
        targetVersion,
        targetCommit,
        summary: {
          unchanged: unchanged.length,
          changed: changed.length,
          removed: removed.length,
        },
        changed: changed.map((entry) => ({
          id: entry.dep.id,
          path: entry.dep.path,
          usedBy: entry.dep.usedBy,
          exportsRemoved: entry.exportsRemoved ?? [],
          exportsAdded: entry.exportsAdded ?? [],
        })),
        removed: removed.map((entry) => ({ id: entry.dep.id, path: entry.dep.path })),
      },
      null,
      2
    )}\n`
  );
}

process.exit(changed.length + removed.length > 0 ? 1 : 0);
