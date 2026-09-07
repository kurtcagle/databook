#!/usr/bin/env node
/**
 * scripts/check-version-consistency.mjs
 *
 * The CLI declares its version in three independent places, and nothing
 * used to enforce that they agree:
 *   1. package.json's "version" field
 *   2. bin/databook.js's header comment ("... v1.4.2")
 *   3. bin/databook.js's own .version('1.4.2') call passed to commander
 *
 * They drifted: package.json sat at 1.2.0 while bin/databook.js reported
 * 1.4.2 across several releases, with no error anywhere. This script
 * checks all three agree, and additionally enforces a floor version --
 * 1.5.0, set 2026-09-07 -- below which none of the three may fall, since
 * that release folded in a large enough batch of work (the v1.2
 * directive-parsing fix, the databook: namespace re-home, profiles[],
 * comment-key-prefix generalisation, and typeToken) that a silent
 * regression below it should fail loudly rather than ship quietly.
 *
 * Run in CI on every push (.github/workflows/version-consistency.yml)
 * and locally before a release:
 *   node scripts/check-version-consistency.mjs
 *
 * Exit code 0 = all checks passed. Exit code 1 = at least one failed;
 * every failure is printed, not just the first, so a single run surfaces
 * everything that needs fixing.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const FLOOR_VERSION = '1.5.0';

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v ?? '');
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function compareSemver(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

let failed = false;
function fail(msg) {
  console.error(`\u2717 ${msg}`);
  failed = true;
}
function ok(msg) {
  console.log(`\u2713 ${msg}`);
}

// ── Read the three declarations ─────────────────────────────────────────
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const packageVersion = pkg.version ?? null;

const binSource = readFileSync(join(ROOT, 'bin', 'databook.js'), 'utf8');

const commentMatch = /DataBook semantic documents\.\s*v(\d+\.\d+\.\d+)/.exec(binSource);
const commentVersion = commentMatch ? commentMatch[1] : null;

const versionCallMatch = /\.version\(\s*['"]([^'"]+)['"]\s*\)/.exec(binSource);
const versionCallVersion = versionCallMatch ? versionCallMatch[1] : null;

console.log('Declared versions:');
console.log(`  package.json                : ${packageVersion ?? '(missing)'}`);
console.log(`  bin/databook.js (comment)    : ${commentVersion ?? '(not found)'}`);
console.log(`  bin/databook.js (.version()) : ${versionCallVersion ?? '(not found)'}`);
console.log('');

// ── All three must be present ───────────────────────────────────────────
if (!packageVersion) fail('package.json has no "version" field.');
if (!commentVersion) fail("bin/databook.js's header comment has no \"vX.Y.Z\" version string.");
if (!versionCallVersion) fail("bin/databook.js has no .version('X.Y.Z') call.");

// ── All three must agree ────────────────────────────────────────────────
if (packageVersion && commentVersion && versionCallVersion) {
  const versions = new Set([packageVersion, commentVersion, versionCallVersion]);
  if (versions.size === 1) {
    ok(`All three declarations agree: ${packageVersion}`);
  } else {
    fail(
      'Version declarations disagree:\n' +
      `    package.json                = ${packageVersion}\n` +
      `    bin/databook.js (comment)    = ${commentVersion}\n` +
      `    bin/databook.js (.version()) = ${versionCallVersion}\n` +
      '  Update all three to the same value.'
    );
  }
}

// ── Floor check, applied to each declaration independently ─────────────
const floor = parseSemver(FLOOR_VERSION);
for (const [label, value] of [
  ['package.json', packageVersion],
  ['bin/databook.js (comment)', commentVersion],
  ["bin/databook.js (.version())", versionCallVersion],
]) {
  if (!value) continue;  // already reported as missing above
  const parsed = parseSemver(value);
  if (!parsed) {
    fail(`${label}'s version "${value}" is not a parseable MAJOR.MINOR.PATCH string.`);
    continue;
  }
  if (compareSemver(parsed, floor) < 0) {
    fail(`${label}'s version ${value} is below the ${FLOOR_VERSION} floor.`);
  } else {
    ok(`${label} (${value}) meets the ${FLOOR_VERSION} floor.`);
  }
}

console.log('');
if (failed) {
  console.error('Version consistency check FAILED.');
  process.exit(1);
} else {
  console.log('Version consistency check passed.');
  process.exit(0);
}
