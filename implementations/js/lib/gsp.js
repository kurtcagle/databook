/**
 * GSP (Graph Store Protocol) and SPARQL HTTP client.
 * Uses native Node.js fetch (Node >= 18).
 */

import { buildHeaders } from './auth.js';

const CONTENT_TYPES = {
  turtle:          'text/turtle',
  turtle12:        'text/turtle',
  shacl:           'text/turtle',
  trig:            'application/trig',
  'json-ld':       'application/ld+json',
  'sparql-update': 'application/sparql-update',
};

export function contentTypeForLabel(label) {
  return CONTENT_TYPES[label] ?? 'text/turtle';
}

/**
 * GSP PUT — replace a named graph.
 * @param {string} gspEndpoint
 * @param {string} graphIri
 * @param {string} body        - Turtle / TriG / JSON-LD content
 * @param {string} contentType
 * @param {string|null} auth
 * @returns {{ status: number, ok: boolean }}
 */
export async function gspPut(gspEndpoint, graphIri, body, contentType, auth = null) {
  const url = `${gspEndpoint}?graph=${encodeURIComponent(graphIri)}`;
  const headers = buildHeaders(gspEndpoint, auth, {
    'Content-Type': contentType,
  });
  const resp = await fetchWithErrors(url, { method: 'PUT', headers, body });
  return { status: resp.status, ok: resp.ok };
}

/**
 * GSP POST — merge triples into a named graph.
 */
export async function gspPost(gspEndpoint, graphIri, body, contentType, auth = null) {
  const url = `${gspEndpoint}?graph=${encodeURIComponent(graphIri)}`;
  const headers = buildHeaders(gspEndpoint, auth, {
    'Content-Type': contentType,
  });
  const resp = await fetchWithErrors(url, { method: 'POST', headers, body });
  return { status: resp.status, ok: resp.ok };
}

/**
 * GSP GET — fetch a named graph.
 * @param {string} gspEndpoint
 * @param {string} graphIri
 * @param {string} accept      - 'text/turtle' | 'application/trig'
 * @param {string|null} auth
 * @returns {{ status: number, ok: boolean, body: string }}
 */
export async function gspGet(gspEndpoint, graphIri, accept = 'text/turtle', auth = null) {
  const url = `${gspEndpoint}?graph=${encodeURIComponent(graphIri)}`;
  const headers = buildHeaders(gspEndpoint, auth, { Accept: accept });
  const resp = await fetchWithErrors(url, { method: 'GET', headers });
  const body = await resp.text();
  return { status: resp.status, ok: resp.ok, body };
}

/**
 * Execute a SPARQL query (SELECT / CONSTRUCT / ASK / DESCRIBE).
 * @param {string} endpoint    - SPARQL query endpoint
 * @param {string} query
 * @param {string} accept      - expected media type for results
 * @param {string|null} auth
 * @returns {{ status: number, ok: boolean, body: string }}
 */
export async function sparqlQuery(endpoint, query, accept, auth = null) {
  const headers = buildHeaders(endpoint, auth, {
    'Content-Type': 'application/sparql-query',
    'Accept': accept,
  });
  const resp = await fetchWithErrors(endpoint, {
    method: 'POST',
    headers,
    body: query,
  });
  const body = await resp.text();
  return { status: resp.status, ok: resp.ok, body };
}

/**
 * Execute a SPARQL Update.
 */
export async function sparqlUpdate(updateEndpoint, update, auth = null) {
  const headers = buildHeaders(updateEndpoint, auth, {
    'Content-Type': 'application/sparql-update',
  });
  const resp = await fetchWithErrors(updateEndpoint, {
    method: 'POST',
    headers,
    body: update,
  });
  return { status: resp.status, ok: resp.ok };
}

/**
 * Detect query type from SPARQL text.
 * Handles # inside IRIs (e.g. <https://example.org/ns#>) correctly
 * by masking IRI tokens before stripping line comments.
 * @returns {'SELECT'|'CONSTRUCT'|'ASK'|'DESCRIBE'|'UPDATE'|'UNKNOWN'}
 */
export function detectQueryType(sparql) {
  // Mask IRIs so their # fragments aren't stripped as SPARQL comments
  const masked = sparql.replace(/<[^>]+>/g, '<IRI>');
  // Strip SPARQL line comments (# not inside a string or IRI)
  const noComments = masked.replace(/#[^\n]*/g, '');
  // Case-insensitive keyword search — first query verb wins
  const upper = noComments.toUpperCase();
  if (/\bCONSTRUCT\b/.test(upper)) return 'CONSTRUCT';
  if (/\bSELECT\b/.test(upper))    return 'SELECT';
  if (/\bASK\b/.test(upper))       return 'ASK';
  if (/\bDESCRIBE\b/.test(upper))  return 'DESCRIBE';
  if (/\b(INSERT|DELETE|LOAD)\b/.test(upper)) return 'UPDATE';
  return 'UNKNOWN';
}

/**
 * Accept header for a given query type.
 */
export function acceptForQueryType(queryType) {
  switch (queryType) {
    case 'CONSTRUCT':
    case 'DESCRIBE': return 'text/turtle';
    case 'SELECT':   return 'application/sparql-results+json';
    case 'ASK':      return 'application/sparql-results+json';
    default:         return '*/*';
  }
}

/** Wrap fetch to translate connection errors to DataBook exit-code semantics. */
async function fetchWithErrors(url, options) {
  try {
    return await fetch(url, options);
  } catch (e) {
    const err = new Error(`cannot reach endpoint: ${url}`);
    err.code = 'E_UNREACHABLE';
    throw err;
  }
}

/**
 * Handle HTTP status codes and throw typed errors.
 * @param {Response} resp
 * @param {string} context   - e.g. "block 'primary'"
 */
export function checkResponse(resp, context = '') {
  if (resp.ok) return;
  if (resp.status === 401 || resp.status === 403) {
    const err = new Error(
      `auth rejected by endpoint (HTTP ${resp.status})${context ? ` — ${context}` : ''}`
    );
    err.code = 'E_AUTH';
    err.exitCode = 3;
    throw err;
  }
  if (resp.status === 404) {
    const err = new Error(`not found (HTTP 404)${context ? ` — ${context}` : ''}`);
    err.code = 'E_NOT_FOUND';
    err.exitCode = 5;
    throw err;
  }
  if (resp.status >= 500) {
    const err = new Error(`server error (HTTP ${resp.status})${context ? ` — ${context}` : ''}`);
    err.code = 'E_SERVER';
    err.exitCode = 1;
    throw err;
  }
  const err = new Error(`HTTP ${resp.status}${context ? ` — ${context}` : ''}`);
  err.code = 'E_HTTP';
  err.exitCode = 1;
  throw err;
}
