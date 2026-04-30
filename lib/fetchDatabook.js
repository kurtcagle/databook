/**
 * lib/fetchDatabook.js
 * HTTP retrieval of DataBook documents and blocks.
 *
 * Handles:
 *   - Full document fetch via HTTP GET with DataBook Accept headers
 *   - Fragment IRI resolution (document-iri#block-id)
 *   - @alias resolution via processors.toml [databook_registry]
 *   - Optional local cache (cache_dir in [databook_registry])
 *   - document id verification
 *
 * Used by: commands/fetch.js, commands/pull.js (--query-ref),
 *          commands/push.js (--publish), commands/process.js (@alias refs)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { loadProcessorsToml } from './serverConfig.js';
import { parseDataBook } from './parser.js';

// ── MIME types ─────────────────────────────────────────────────────────────

export const DATABOOK_MIME        = 'application/x.databook+markdown';
export const DATABOOK_MIME_ACCEPT = `${DATABOOK_MIME}, text/markdown;q=0.9`;

// ── Registry loading ───────────────────────────────────────────────────────

/**
 * Load the [databook_registry] section from processors.toml.
 * Returns { aliases: {name: iri}, cacheDir, fetchTimeoutMs }
 */
export function loadRegistry() {
  const config = loadProcessorsToml();
  const reg    = config.databook_registry ?? {};

  // Separate config keys from alias entries
  const configKeys = new Set(['cache_dir', 'cache_ttl_hours', 'fetch_timeout_ms']);
  const aliases    = {};

  for (const [k, v] of Object.entries(reg)) {
    if (!configKeys.has(k)) aliases[k] = v;
  }

  return {
    aliases,
    cacheDir:       reg.cache_dir          ?? null,
    cacheTtlHours:  reg.cache_ttl_hours    ?? null,
    fetchTimeoutMs: reg.fetch_timeout_ms   ?? 30000,
  };
}

// ── Alias resolution ───────────────────────────────────────────────────────

/**
 * Resolve an @alias or @alias#block-id string to { iri, blockId }.
 * Throws if alias not found in registry.
 *
 * @param {string} aliasRef  - e.g. "@source-taxonomy" or "@my-shapes#person-shape"
 * @param {object} registry  - aliases map from loadRegistry()
 * @returns {{ iri: string, blockId: string|null }}
 */
export function resolveAlias(aliasRef, registry) {
  if (!aliasRef.startsWith('@')) {
    throw new Error(`not an alias reference: ${aliasRef}`);
  }

  const withoutAt = aliasRef.slice(1);
  const hashIdx   = withoutAt.indexOf('#');
  const aliasName = hashIdx >= 0 ? withoutAt.slice(0, hashIdx) : withoutAt;
  const blockId   = hashIdx >= 0 ? withoutAt.slice(hashIdx + 1) : null;

  const iri = registry[aliasName];
  if (!iri) {
    const available = Object.keys(registry);
    const hint = available.length > 0
      ? `Available aliases: ${available.join(', ')}`
      : 'No aliases defined in [databook_registry] in processors.toml.';
    throw new Error(`Registry alias '@${aliasName}' not found. ${hint}`);
  }

  return { iri, blockId };
}

/**
 * Parse any source reference into { iri, blockId }.
 * Handles: URL, URL#fragment, @alias, @alias#fragment
 *
 * @param {string} source
 * @param {object} registry  - from loadRegistry()
 */
export function parseSourceRef(source, registry = {}) {
  if (source.startsWith('@')) {
    return resolveAlias(source, registry);
  }

  // HTTP/HTTPS IRI — split on first #
  if (source.startsWith('https://') || source.startsWith('http://')) {
    const hashIdx = source.indexOf('#');
    if (hashIdx >= 0) {
      return { iri: source.slice(0, hashIdx), blockId: source.slice(hashIdx + 1) };
    }
    return { iri: source, blockId: null };
  }

  throw new Error(`source must be an HTTP IRI or @alias: ${source}`);
}

// ── Cache helpers ──────────────────────────────────────────────────────────

function cacheKeyPath(cacheDir, iri) {
  // Derive a safe filename from the IRI
  const slug = iri
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9_.-]/g, '_')
    .slice(0, 120);
  return join(cacheDir, `${slug}.databook.md`);
}

function readCache(cacheDir, iri, ttlHours) {
  if (!cacheDir) return null;
  const path = cacheKeyPath(cacheDir, iri);
  if (!existsSync(path)) return null;

  if (ttlHours != null) {
    const stat = statSync(path);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs > ttlHours * 3600000) return null;
  }

  return readFileSync(path, 'utf8');
}

function writeCache(cacheDir, iri, content) {
  if (!cacheDir) return;
  try {
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(cacheKeyPath(cacheDir, iri), content, 'utf8');
  } catch (e) {
    process.stderr.write(`warn: could not write DataBook cache: ${e.message}\n`);
  }
}

// ── HTTP fetch ─────────────────────────────────────────────────────────────

/**
 * Fetch a URL and return text content.
 * Uses global fetch (Node 18+).
 *
 * @param {string} url
 * @param {{ auth?: string, timeoutMs?: number }} opts
 */
async function httpGet(url, { auth, timeoutMs = 30000 } = {}) {
  const headers = { 'Accept': DATABOOK_MIME_ACCEPT };
  if (auth) {
    if (auth.startsWith('Bearer ') || auth.startsWith('Basic ')) {
      headers['Authorization'] = auth;
    } else if (auth.includes(':')) {
      const b64 = Buffer.from(auth).toString('base64');
      headers['Authorization'] = `Basic ${b64}`;
    } else {
      headers['Authorization'] = `Bearer ${auth}`;
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, { headers, signal: controller.signal });
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error(`request timed out after ${timeoutMs}ms: ${url}`);
      err.exitCode = 5;
      throw err;
    }
    const err = new Error(`network error fetching ${url}: ${e.message}`);
    err.exitCode = 1;
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 404) {
    const err = new Error(`not found (404): ${url}`);
    err.exitCode = 1;
    throw err;
  }
  if (response.status === 401 || response.status === 403) {
    const err = new Error(`access denied (${response.status}): ${url}`);
    err.exitCode = 2;
    throw err;
  }
  if (!response.ok) {
    const err = new Error(`HTTP ${response.status} fetching ${url}`);
    err.exitCode = 1;
    throw err;
  }

  return response.text();
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Fetch a DataBook or block from an HTTP IRI, registry alias, or fragment IRI.
 *
 * @param {string} source
 *   One of:
 *     - https://example.org/databooks/my-databook-v1
 *     - https://example.org/databooks/my-databook-v1#block-id
 *     - @alias-name
 *     - @alias-name#block-id
 *
 * @param {object} options
 *   @param {string}  [options.auth]       Bearer or Basic credential
 *   @param {number}  [options.timeoutMs]  Request timeout ms (default: from registry or 30000)
 *   @param {boolean} [options.noCache]    Bypass cache
 *   @param {boolean} [options.verifyId]   Fail (vs warn) on document id mismatch
 *   @param {string}  [options.blockId]    Override/supplement fragment block id
 *
 * @returns {{
 *   frontmatter: object,
 *   blocks: Block[],
 *   rawBody: string,
 *   documentIri: string,
 *   blockId: string|null,
 *   block: Block|null,
 *   raw: string
 * }}
 */
export async function fetchDatabook(source, options = {}) {
  const registry = loadRegistry();
  const {
    auth,
    noCache  = false,
    verifyId = false,
    blockId: blockIdOverride,
  } = options;

  const timeoutMs = options.timeoutMs ?? registry.fetchTimeoutMs;

  // Resolve @alias or parse IRI
  const { iri, blockId: fragmentBlockId } = parseSourceRef(source, registry.aliases);
  const blockId = blockIdOverride ?? fragmentBlockId;

  // Check cache
  let raw = null;
  if (!noCache) {
    raw = readCache(registry.cacheDir, iri, registry.cacheTtlHours);
    if (raw && process.env.DATABOOK_DEBUG) {
      process.stderr.write(`[fetch] cache hit: ${iri}\n`);
    }
  }

  // Fetch if not cached
  if (!raw) {
    if (process.env.DATABOOK_DEBUG) {
      process.stderr.write(`[fetch] GET ${iri}\n`);
    }
    raw = await httpGet(iri, { auth, timeoutMs });
    writeCache(registry.cacheDir, iri, raw);
  }

  // Parse
  const db = parseDataBook(raw, null);
  if (!db) {
    const err = new Error(`returned content is not a valid DataBook: ${iri}`);
    err.exitCode = 6;
    throw err;
  }

  // Verify document id
  const returnedId = db.frontmatter?.id;
  if (returnedId && returnedId !== iri) {
    const msg = `document id mismatch — requested: ${iri} — returned id: ${returnedId}`;
    if (verifyId) {
      const err = new Error(msg);
      err.exitCode = 3;
      throw err;
    } else {
      process.stderr.write(`warn: ${msg}\n`);
    }
  }

  // Resolve block
  let block = null;
  if (blockId) {
    block = db.blocks.find(b => b.id === blockId);
    if (!block) {
      const ids = db.blocks.map(b => b.id).filter(Boolean).join(', ');
      const err = new Error(
        `block '${blockId}' not found in ${iri}` +
        (ids ? `\nAvailable block ids: ${ids}` : '')
      );
      err.exitCode = 4;
      throw err;
    }
  }

  return {
    frontmatter: db.frontmatter,
    blocks:      db.blocks,
    rawBody:     db.rawBody,
    documentIri: iri,
    blockId,
    block,
    raw,
  };
}
