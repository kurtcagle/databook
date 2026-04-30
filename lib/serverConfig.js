/**
 * lib/serverConfig.js
 * Named server configuration — loads processors.toml and resolves
 * a named [servers.X] entry into { endpoint, gsp, auth }.
 *
 * processors.toml search order:
 *   1. DATABOOK_PROCESSORS env var (explicit path)
 *   2. ./processors.toml (project-local, CWD)
 *   3. ~/.databook/processors.toml (user global)
 *
 * Example processors.toml:
 *
 *   [servers.local]
 *   endpoint = "http://localhost:3030/ds/sparql"
 *   gsp      = "http://localhost:3030/ds/data"
 *
 *   [servers.ggsc]
 *   endpoint = "http://localhost:3030/ggsc/sparql"
 *   gsp      = "http://localhost:3030/ggsc/data"
 *   auth     = "Basic dXNlcjpwYXNz"
 *
 *   [servers.production]
 *   endpoint = "https://fuseki.example.org/prod/sparql"
 *   gsp      = "https://fuseki.example.org/prod/data"
 *   auth     = "Bearer eyJhbGci..."
 */

import { readFileSync, existsSync } from 'fs';
import { join }                     from 'path';
import { homedir }                  from 'os';
import TOML                         from '@iarna/toml';

// ── Built-in localhost default ─────────────────────────────────────────────

/**
 * Default Fuseki endpoints assumed when no --endpoint, --server, or
 * processors.toml default_endpoint is present.
 * Dataset name 'ds' is the Fuseki out-of-the-box default.
 */
export const LOCALHOST_FUSEKI = {
  endpoint: 'http://localhost:3030/ds/sparql',
  gsp:      'http://localhost:3030/ds/data',
  update:   'http://localhost:3030/ds/update',
  auth:     null,
};

// ── Config file location ───────────────────────────────────────────────────

/**
 * Find and parse the first processors.toml in the search order.
 * Returns the parsed TOML object, or {} if none found.
 */
export function loadProcessorsToml() {
  const candidates = [
    process.env.DATABOOK_PROCESSORS ?? null,
    join(process.cwd(), 'processors.toml'),
    join(homedir(), '.databook', 'processors.toml'),
  ].filter(Boolean);

  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        const parsed = TOML.parse(readFileSync(p, 'utf8'));
        if (process.env.DATABOOK_DEBUG) {
          process.stderr.write(`[serverConfig] loaded processors.toml from: ${p}\n`);
        }
        return parsed;
      } catch (e) {
        process.stderr.write(`warn: could not parse processors.toml at ${p}: ${e.message}\n`);
      }
    }
  }

  return {};
}

// ── Dataset shorthand ─────────────────────────────────────────────────────

/**
 * Resolve a bare dataset name to localhost Fuseki endpoint URLs.
 * Used by --dataset <name> as a shorthand for --endpoint http://localhost:3030/<name>/sparql.
 */
export function datasetToEndpoints(name) {
  return {
    endpoint: `http://localhost:3030/${name}/sparql`,
    gsp:      `http://localhost:3030/${name}/data`,
    update:   `http://localhost:3030/${name}/update`,
  };
}

// ── Named server resolution ────────────────────────────────────────────────

/**
 * Resolve a named server entry from processors.toml.
 *
 * @param {string} serverName  - Key under [servers.*]
 * @returns {{ endpoint: string|null, gsp: string|null, auth: string|null }}
 * @throws  {Error} if serverName is not found in any processors.toml
 */
export function resolveServer(serverName) {
  const config  = loadProcessorsToml();
  const servers = config.servers ?? {};
  const entry   = servers[serverName];

  if (!entry) {
    const available = Object.keys(servers);
    const hint = available.length > 0
      ? `Available servers: ${available.join(', ')}`
      : 'No [servers.*] entries found in processors.toml.';
    throw new Error(
      `Server '${serverName}' not found in processors.toml. ${hint}\n` +
      `processors.toml search order:\n` +
      `  1. $DATABOOK_PROCESSORS\n` +
      `  2. ./processors.toml\n` +
      `  3. ~/.databook/processors.toml`
    );
  }

  return {
    endpoint: entry.endpoint ?? null,
    gsp:      entry.gsp      ?? null,
    auth:     entry.auth     ?? null,
  };
}

/**
 * List all named servers from processors.toml.
 * Returns an array of { name, endpoint, gsp, auth } objects.
 */
export function listServers() {
  const config  = loadProcessorsToml();
  const servers = config.servers ?? {};
  return Object.entries(servers).map(([name, entry]) => ({
    name,
    endpoint: entry.endpoint ?? null,
    gsp:      entry.gsp      ?? null,
    auth:     entry.auth     ? '(set)' : null,   // don't expose credential value
  }));
}
