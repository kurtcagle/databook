/**
 * processors.toml configuration loader.
 * Merges the three-layer discovery chain:
 *   {package}/processors.default.toml  (template, read-only)
 *   ~/.config/databook/processors.toml (user-level)
 *   {cwd}/.databook/processors.toml    (project-level)
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import TOML from '@iarna/toml';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, '..');

const DISCOVERY_CHAIN = [
  join(PACKAGE_ROOT, 'processors.default.toml'),
  join(homedir(), '.config', 'databook', 'processors.toml'),
  join(process.cwd(), '.databook', 'processors.toml'),
];

let _cachedConfig = null;

/**
 * Load and merge the processors.toml chain.
 * Later layers overwrite earlier layers per-processor-IRI.
 * @returns {ProcessorsConfig}
 */
export function loadProcessorsConfig() {
  if (_cachedConfig) return _cachedConfig;

  let merged = { processor: {}, endpoints: {}, default_endpoint: {} };

  for (const path of DISCOVERY_CHAIN) {
    if (!existsSync(path)) continue;
    try {
      const raw = readFileSync(path, 'utf8');
      const parsed = TOML.parse(raw);
      // Deep merge by section
      if (parsed.processor) {
        Object.assign(merged.processor, parsed.processor);
      }
      if (parsed.endpoints) {
        // Merge per-endpoint (replace entire entry)
        for (const [url, entry] of Object.entries(parsed.endpoints)) {
          merged.endpoints[url] = entry;
        }
      }
      if (parsed.default_endpoint) {
        Object.assign(merged.default_endpoint, parsed.default_endpoint);
      }
    } catch (e) {
      // Non-fatal: skip malformed or missing files
    }
  }

  _cachedConfig = merged;
  return merged;
}

/**
 * Get the configured processor entry by IRI.
 * @param {string} processorIri
 * @returns {object|null}
 */
export function getProcessor(processorIri) {
  const config = loadProcessorsConfig();
  return config.processor?.[processorIri] ?? null;
}

/**
 * Get the default SPARQL endpoint URL.
 * @returns {string|null}
 */
export function getDefaultEndpoint() {
  const config = loadProcessorsConfig();
  return config.default_endpoint?.sparql ?? null;
}

/**
 * Get per-endpoint config (auth, inference endpoint, etc.)
 * @param {string} endpointUrl
 * @returns {object}
 */
export function getEndpointConfig(endpointUrl) {
  const config = loadProcessorsConfig();
  // Try exact match first, then prefix match
  if (config.endpoints?.[endpointUrl]) return config.endpoints[endpointUrl];
  // Match by base URL (strip path)
  for (const [key, val] of Object.entries(config.endpoints ?? {})) {
    if (endpointUrl.startsWith(key)) return val;
  }
  return {};
}

/**
 * Infer the GSP (Graph Store Protocol data) endpoint from a SPARQL query endpoint.
 * @param {string} sparqlUrl
 * @returns {string}
 */
export function inferGspEndpoint(sparqlUrl) {
  // Common patterns: /sparql → /data, /query → /data
  const url = new URL(sparqlUrl);
  const path = url.pathname;
  const patterns = { '/sparql': '/data', '/query': '/data', '/update': '/data' };
  for (const [suffix, replacement] of Object.entries(patterns)) {
    if (path.endsWith(suffix)) {
      url.pathname = path.slice(0, -suffix.length) + replacement;
      return url.toString();
    }
  }
  throw new Error(
    `cannot infer GSP endpoint from '${sparqlUrl}'; use --gsp-endpoint`
  );
}

/**
 * Infer the SPARQL Update endpoint from a query endpoint.
 */
export function inferUpdateEndpoint(sparqlUrl) {
  const url = new URL(sparqlUrl);
  const path = url.pathname;
  if (path.endsWith('/sparql')) {
    url.pathname = path.replace(/\/sparql$/, '/update');
    return url.toString();
  }
  if (path.endsWith('/query')) {
    url.pathname = path.replace(/\/query$/, '/update');
    return url.toString();
  }
  // Append /update as fallback
  url.pathname = path.replace(/\/$/, '') + '/update';
  return url.toString();
}

/** Invalidate cache (useful for testing). */
export function resetConfig() {
  _cachedConfig = null;
}
