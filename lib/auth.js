/**
 * Auth credential resolution.
 * Priority order (per spec):
 *   1. --auth flag (passed as cliAuth)
 *   2. DATABOOK_FUSEKI_AUTH environment variable
 *   3. processors.toml [endpoints."<url>"] .auth or .auth_env
 */

import { getEndpointConfig } from './config.js';

/**
 * Resolve the Authorization header value for a given endpoint.
 * @param {string} endpointUrl
 * @param {string|null} cliAuth   - Value of --auth flag, if provided
 * @returns {string|null}         - Full Authorization header value, or null
 */
export function resolveAuth(endpointUrl, cliAuth = null) {
  // 1. CLI flag
  if (cliAuth) return normaliseCredential(cliAuth);

  // 2. Environment variable
  const envAuth = process.env.DATABOOK_FUSEKI_AUTH;
  if (envAuth) return normaliseCredential(envAuth);

  // 3. processors.toml
  const epConfig = getEndpointConfig(endpointUrl);
  if (epConfig.auth) return normaliseCredential(epConfig.auth);
  if (epConfig.auth_env) {
    const envVal = process.env[epConfig.auth_env];
    if (envVal) return normaliseCredential(envVal);
  }

  return null;
}

/**
 * Normalise a credential string to a full Authorization header value.
 * Accepted forms:
 *   "Basic <base64>"  → returned verbatim
 *   "Bearer <token>"  → returned verbatim
 *   "<base64>"        → prefixed with "Basic "
 */
function normaliseCredential(cred) {
  const trimmed = cred.trim();
  if (trimmed.startsWith('Basic ') || trimmed.startsWith('Bearer ')) {
    return trimmed;
  }
  return `Basic ${trimmed}`;
}

/**
 * Build fetch headers including Authorization if available.
 * @param {string} endpointUrl
 * @param {string|null} cliAuth
 * @param {object} extra  - Additional headers to include
 * @returns {object}
 */
export function buildHeaders(endpointUrl, cliAuth = null, extra = {}) {
  const headers = { ...extra };
  const auth = resolveAuth(endpointUrl, cliAuth);
  if (auth) headers['Authorization'] = auth;
  return headers;
}
