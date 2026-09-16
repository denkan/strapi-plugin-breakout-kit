#!/usr/bin/env node
/**
 * Version matrix runner: verifies the plugin against one or more Strapi versions by
 * pinning a UNIFORM dependency tree per version (npm overrides + exact playground deps),
 * rebuilding, reseeding and running the full contract/parity suite.
 *
 * Script-first by design: local dev and CI run the SAME code —
 *   node drift/scripts/version-matrix.mjs 5.51.0            # one version
 *   node drift/scripts/version-matrix.mjs --window          # every minor floor..roof
 *   node drift/scripts/version-matrix.mjs --list            # print window versions (CI matrix)
 *   ... [--keep-going]                                      # don't stop on first failure
 *
 * The window comes from drift/manifest.json (strapiFloor .. strapiVersion). Patch levels
 * are not enumerated — one representative (the .0 or the manifest-pinned patch) per minor.
 *
 * DESTRUCTIVE while running (node_modules + lockfile are rebuilt per version); on exit it
 * restores package files from git and reinstalls the baseline tree.
 */
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifest = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'drift', 'manifest.json'), 'utf8')
);

const args = process.argv.slice(2);
const keepGoing = args.includes('--keep-going');
const noRestore = args.includes('--no-restore'); // CI: fresh checkout, restore is wasted time

const windowVersions = () => {
  const [maj, floorMinor] = manifest.strapiFloor.split('.').map(Number);
  const [, roofMinor] = manifest.strapiVersion.split('.').map(Number);
  const versions = [];
  for (let minor = floorMinor; minor <= roofMinor; minor += 1) {
    versions.push(minor === roofMinor ? manifest.strapiVersion : `${maj}.${minor}.0`);
  }
  return versions;
};

if (args.includes('--list')) {
  console.log(JSON.stringify(windowVersions()));
  process.exit(0);
}

const versions = args.includes('--window')
  ? windowVersions()
  : args.filter((a) => /^\d+\.\d+\.\d+$/.test(a));
if (versions.length === 0) {
  console.error(
    'Usage: version-matrix.mjs <version...> | --window | --list  [--keep-going] [--no-restore]'
  );
  process.exit(2);
}

const rootPkgPath = path.join(repoRoot, 'package.json');
const playgroundPkgPath = path.join(repoRoot, 'apps', 'playground', 'package.json');
const run = (cmd, opts = {}) =>
  execSync(cmd, { cwd: repoRoot, stdio: 'inherit', ...opts });
const tryRun = (cmd) => {
  const res = spawnSync(cmd, { cwd: repoRoot, stdio: 'inherit', shell: true });
  return res.status === 0;
};

const pinVersion = (version) => {
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
  // Uniform tree: without overrides, lockfile-less installs hoist newer @strapi
  // copies for loose peer ranges, breaking Strapi's own singleton aliasing
  // (duplicate @codemirror/state) — observed empirically.
  rootPkg.overrides = {
    '@strapi/admin': version,
    '@strapi/content-manager': version,
  };
  fs.writeFileSync(rootPkgPath, `${JSON.stringify(rootPkg, null, 2)}\n`);

  const pg = JSON.parse(fs.readFileSync(playgroundPkgPath, 'utf8'));
  for (const [name, current] of Object.entries(pg.dependencies)) {
    if (name.startsWith('@strapi/') && /^\d/.test(current)) {
      pg.dependencies[name] = version;
    }
  }
  fs.writeFileSync(playgroundPkgPath, `${JSON.stringify(pg, null, 2)}\n`);
};

const cleanInstall = () => {
  for (const dir of [
    'node_modules',
    'apps/playground/node_modules',
    'packages/plugin/node_modules',
    'apps/playground/.tmp',
  ]) {
    fs.rmSync(path.join(repoRoot, dir), { recursive: true, force: true });
  }
  fs.rmSync(path.join(repoRoot, 'package-lock.json'), { force: true });
  run('npm install --no-audit --no-fund');
  fs.mkdirSync(path.join(repoRoot, 'apps', 'playground', '.tmp'), { recursive: true });
};

const restore = () => {
  console.log('\n[matrix] restoring baseline…');
  run('git checkout -- package.json apps/playground/package.json package-lock.json');
  cleanInstallBaseline();
};
const cleanInstallBaseline = () => {
  for (const dir of ['node_modules', 'apps/playground/node_modules', 'packages/plugin/node_modules']) {
    fs.rmSync(path.join(repoRoot, dir), { recursive: true, force: true });
  }
  run('npm install --no-audit --no-fund');
  run('npm run build');
};

const results = [];
try {
  for (const version of versions) {
    console.log(`\n========== Strapi ${version} ==========`);
    pinVersion(version);
    let ok = false;
    let stage = 'install';
    try {
      cleanInstall();
      const installed = JSON.parse(
        fs.readFileSync(
          path.join(repoRoot, 'node_modules', '@strapi', 'strapi', 'package.json'),
          'utf8'
        )
      ).version;
      if (installed !== version) {
        throw new Error(`resolved @strapi/strapi ${installed}, expected ${version}`);
      }
      stage = 'build';
      run('npm run build');
      stage = 'seed';
      fs.rmSync(path.join(repoRoot, 'apps/playground/node_modules/.strapi'), {
        recursive: true,
        force: true,
      });
      run('npm run seed');
      stage = 'suite';
      ok = tryRun('npx playwright test');
    } catch (err) {
      console.error(`[matrix] ${version} failed during ${stage}: ${err.message}`);
    }
    results.push({ version, ok, stage: ok ? 'suite' : stage });
    if (!ok && !keepGoing) break;
  }
} finally {
  // Always restore the working tree; skip the slow reinstall only when asked (CI).
  run('git checkout -- package.json apps/playground/package.json package-lock.json');
  if (!noRestore) {
    try {
      cleanInstallBaseline();
    } catch {
      console.error('[matrix] baseline reinstall failed — run `npm install` manually.');
    }
  }
}

console.log('\n===== Version matrix results =====');
for (const { version, ok, stage } of results) {
  console.log(`  ${ok ? '✅' : '❌'} ${version}${ok ? '' : ` (failed: ${stage})`}`);
}
const failed = results.filter((r) => !r.ok);
process.exit(failed.length > 0 ? 1 : 0);
