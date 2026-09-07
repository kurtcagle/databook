/**
 * lib/profiles.js
 * Resolves DataBook profile IRIs (frontmatter `profiles[]`) to their
 * registered comment-key prefixes and any additional SHACL shapes they
 * declare, per the profile model proposed in the DataBook Specification
 * Primer, S4 (https://w3id.org/holon/databook/primer).
 *
 * A profile is itself a DataBook whose primary content is a W3C Profiles
 * Vocabulary (PROF, https://www.w3.org/ns/dx/prof/) descriptor: a
 * `prof:Profile` that `prof:isProfileOf` core and lists its resources by
 * role. This module treats any `turtle` or `shacl` block in that DataBook
 * as fair game to parse for two things:
 *
 *   1. `sh:declare` entries (the same SHACL 1.2 mechanism core's own
 *      shapes file uses for its `databook:` prefix) -- these register the
 *      profile's comment-key prefix, e.g. `holon:` for the holon profile.
 *   2. `sh:NodeShape` content -- additional constraints to union with core
 *      when validating a header projection under `databook validate --header`.
 *
 * Resolution order per profile IRI:
 *   1. Bundled registry (schema/profiles/index.json) -- always tried first,
 *      works fully offline, and is what keeps `--no-profiles`-free usage
 *      deterministic in CI and in this package's own test suite.
 *   2. A live HTTP fetch of the IRI itself, unless `offline` is set.
 *
 * A profile that resolves neither way is not an error: per the spec's own
 * parser contract (S15.2), an unrecognised profile means "warn and
 * continue as core" -- this module returns `{ ok: false, reason }` for the
 * caller to warn with, never throws for an unresolvable profile.
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Parser as N3Parser, Store } from 'n3';
import { parseDataBook, blockPayload } from './parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = path.join(__dirname, '..', 'schema', 'profiles', 'index.json');
const PROFILES_DIR  = path.join(__dirname, '..', 'schema', 'profiles');

const SH = 'http://www.w3.org/ns/shacl#';
const sh = p => `${SH}${p}`;

/**
 * The bundled profile registry: profile IRI -> filename under
 * schema/profiles/. Missing or unreadable registry degrades to "nothing
 * bundled" rather than throwing -- a fresh checkout with no profiles
 * directory yet is a valid state, not an error.
 * @returns {Record<string,string>}
 */
export function loadBundledRegistry() {
  try {
    return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Resolve one profile IRI to its registered prefixes and shapes text.
 * @param {string} iri
 * @param {{ offline?: boolean }} [opts]
 * @returns {Promise<{iri:string, ok:boolean, source?:'bundled'|'network', title?:string, prefixes?:Record<string,string>, shapesText?:string, reason?:string}>}
 */
export async function resolveProfile(iri, opts = {}) {
  const { offline = false } = opts;
  const registry = loadBundledRegistry();

  let dbText = null;
  let source = null;

  if (registry[iri]) {
    const localPath = path.join(PROFILES_DIR, registry[iri]);
    if (existsSync(localPath)) {
      dbText = readFileSync(localPath, 'utf8');
      source = 'bundled';
    }
  }

  if (!dbText && !offline) {
    if (!(iri.startsWith('http://') || iri.startsWith('https://'))) {
      return { iri, ok: false, reason: 'not in bundled registry and not an HTTP(S) IRI to fetch' };
    }
    try {
      const res = await fetch(iri, { headers: { Accept: 'text/markdown, text/plain, */*' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      dbText = await res.text();
      source = 'network';
    } catch (e) {
      return { iri, ok: false, reason: `fetch failed: ${e.message}` };
    }
  }

  if (!dbText) {
    return {
      iri,
      ok: false,
      reason: offline
        ? 'not in bundled registry (offline mode -- network fetch skipped)'
        : 'not in bundled registry and no network fetch succeeded',
    };
  }

  let parsed;
  try {
    parsed = parseDataBook(dbText, null);
  } catch (e) {
    return { iri, ok: false, reason: `not a parseable DataBook: ${e.message}` };
  }
  if (!parsed || !parsed.frontmatter) {
    return { iri, ok: false, reason: 'no DataBook frontmatter found in resolved content' };
  }

  const { frontmatter, blocks } = parsed;

  // Merge every turtle/shacl block into one store -- a profile descriptor
  // and its shapes may live in the same block or separate ones.
  const store = new Store();
  for (const b of blocks.filter(b => b.label === 'turtle' || b.label === 'shacl')) {
    try {
      store.addQuads(new N3Parser().parse(blockPayload(b)));
    } catch {
      // A block that doesn't parse as Turtle is skipped, not fatal --
      // mirrors the core parser contract for unrecognised content.
    }
  }

  const prefixes = {};
  for (const q of store.getQuads(null, sh('declare'), null, null)) {
    const declNode = q.object;
    const prefixTerm = store.getObjects(declNode, sh('prefix'), null)[0];
    const nsTerm     = store.getObjects(declNode, sh('namespace'), null)[0];
    if (prefixTerm && nsTerm) prefixes[prefixTerm.value] = nsTerm.value;
  }

  // Shapes to union for validation: only blocks labelled `shacl`. A profile
  // descriptor's own PROF metadata (labelled `turtle`) is not a constraint
  // and must not be handed to a SHACL engine as one.
  const shapesText = blocks
    .filter(b => b.label === 'shacl')
    .map(b => blockPayload(b))
    .join('\n\n');

  return {
    iri,
    ok: true,
    source,
    title: frontmatter.title ?? iri,
    prefixes,
    shapesText,
  };
}

/**
 * Resolve every profile IRI in `iris`, in order. Never throws for an
 * individual unresolvable profile -- see module doc.
 * @param {string[]} iris
 * @param {{ offline?: boolean }} [opts]
 * @returns {Promise<Array<Awaited<ReturnType<typeof resolveProfile>>>>}
 */
export async function resolveProfiles(iris, opts = {}) {
  const results = [];
  for (const iri of iris ?? []) {
    results.push(await resolveProfile(iri, opts));
  }
  return results;
}

/**
 * Given a DataBook's parsed blocks and a set of resolved (ok) profiles,
 * find every profile-prefixed comment-key (a `block.all_meta` key of the
 * form `prefix:key`, as produced by the generalised parser -- see
 * lib/parser.js's PREFIXED_META_RE) whose prefix is not registered by any
 * resolved profile. Returns one warning string per offending key, not
 * fatal -- the spec's own contract for an unrecognised prefix is to
 * ignore it, not reject the document.
 * @param {import('./parser.js').Block[]} blocks
 * @param {Array<{ok:boolean, prefixes?:Record<string,string>}>} resolvedProfiles
 * @returns {string[]}
 */
export function findUnregisteredPrefixes(blocks, resolvedProfiles) {
  const known = new Set();
  for (const p of resolvedProfiles) {
    if (p.ok) for (const prefix of Object.keys(p.prefixes ?? {})) known.add(prefix);
  }

  const warnings = [];
  for (const b of blocks) {
    for (const key of Object.keys(b.all_meta ?? {})) {
      const colon = key.indexOf(':');
      if (colon <= 0) continue;  // core (databook:) keys are stored bare, no colon
      const prefix = key.slice(0, colon);
      if (!known.has(prefix)) {
        warnings.push(
          `block '${b.id ?? '(unnamed)'}': comment key '${key}' uses prefix '${prefix}:', ` +
          `which no declared profile registers`
        );
      }
    }
  }
  return warnings;
}
