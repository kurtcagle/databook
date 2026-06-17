/**
 * databook delete — remove a DataBook's named graphs from a SPARQL triplestore.
 *
 * v1.5.0: New command.
 *
 * Deletes:
 *   1. The DataBook's primary named graph (graph.named_graph or fragment-addressed graphs)
 *   2. The DataBook's #meta graph (unless --no-meta)
 *   3. The DataBook's index catalog record (unless --index-graph none)
 *
 * Usage:
 *   databook delete <file>                        # delete by source DataBook
 *   databook delete --databook-id <iri>           # delete by IRI (no file needed)
 */

import { loadDataBookFile }                                                  from '../lib/parser.js';
import { getDefaultEndpoint, inferGspEndpoint, inferUpdateEndpoint }         from '../lib/config.js';
import { resolveAuth }                                                       from '../lib/auth.js';
import { resolveServer, LOCALHOST_FUSEKI, datasetToEndpoints }               from '../lib/serverConfig.js';
import { gspDelete, sparqlUpdate, sparqlQuery, checkResponse }               from '../lib/gsp.js';

export async function runDelete(filePath, opts) {
  const {
    server:     serverName,
    endpoint:   endpointOpt,
    databookId: databookIdOpt,
    meta:       deleteMeta = true,
    indexGraph: indexGraphOpt,
    auth:       authOpt,
    dryRun      = false,
    verbose     = false,
    quiet       = false,
  } = opts;

  // ── Resolve named server config ────────────────────────────────────────────
  let serverCfg = null;
  if (serverName) {
    try { serverCfg = resolveServer(serverName); }
    catch (e) { die(e.message, 2); }
  }

  const datasetCfg     = opts.dataset ? datasetToEndpoints(opts.dataset) : null;
  const sparqlEndpoint = endpointOpt
    ?? serverCfg?.endpoint
    ?? datasetCfg?.endpoint
    ?? getDefaultEndpoint()
    ?? LOCALHOST_FUSEKI.endpoint;

  let gspEndpoint;
  try   { gspEndpoint = inferGspEndpoint(sparqlEndpoint); }
  catch { die(`cannot infer GSP endpoint from '${sparqlEndpoint}'`, 2); }

  const updateEndpoint = inferUpdateEndpoint(sparqlEndpoint);
  const auth = resolveAuth(sparqlEndpoint, authOpt ?? serverCfg?.auth);

  // ── Resolve DataBook IRI and graph list ────────────────────────────────────
  let databookId, namedGraphs;

  if (databookIdOpt) {
    // Direct IRI mode — enumerate graphs with prefix {id}#
    databookId = databookIdOpt;
    namedGraphs = await enumerateGraphs(databookId, sparqlEndpoint, auth, verbose);
  } else {
    if (!filePath) die('delete requires a source DataBook file or --databook-id <iri>', 2);
    let db;
    try { db = loadDataBookFile(filePath); }
    catch (e) { die(e.message, 2); }

    const fm = db.frontmatter;
    databookId = fm.id;
    if (!databookId) die('DataBook has no id — cannot determine graphs to delete', 2);

    // Collect the primary named graph and all fragment-addressed graphs
    const primary = fm.graph?.named_graph ?? null;
    const fragmentGraphs = db.blocks
      .filter(b => b.id)
      .map(b => `${databookId}#${b.id}`);

    namedGraphs = primary
      ? [primary, ...fragmentGraphs.filter(g => g !== primary)]
      : fragmentGraphs;

    if (namedGraphs.length === 0) {
      // Fall back to enumeration
      namedGraphs = await enumerateGraphs(databookId, sparqlEndpoint, auth, verbose);
    }
  }

  if (namedGraphs.length === 0 && !deleteMeta) {
    if (!quiet) process.stderr.write('No named graphs found to delete.\n');
    return;
  }

  // ── Delete data graphs ─────────────────────────────────────────────────────
  let deleted = 0, failed = 0;

  for (const graphIri of namedGraphs) {
    if (verbose || dryRun) log(`[delete] DELETE ${gspEndpoint}  ?graph=${graphIri}`);
    if (!dryRun) {
      try {
        const result = await gspDelete(gspEndpoint, graphIri, auth);
        if (result.status === 404) {
          if (verbose) log(`[delete]        not found (skipped)`);
        } else {
          checkResponse(result, `graph ${graphIri}`);
          if (verbose) log(`[delete]        Status: ${result.status}`);
          deleted++;
        }
      } catch (e) {
        process.stderr.write(`error: ${e.message}\n`);
        failed++;
      }
    } else {
      deleted++;
    }
  }

  // ── Delete #meta graph ─────────────────────────────────────────────────────
  if (deleteMeta && databookId) {
    const metaIri = `${databookId}#meta`;
    if (verbose || dryRun) log(`[delete] DELETE ${gspEndpoint}  ?graph=${metaIri}  (meta)`);
    if (!dryRun) {
      try {
        const result = await gspDelete(gspEndpoint, metaIri, auth);
        if (result.status !== 404) checkResponse(result, 'meta graph');
        if (verbose) log(`[delete]        Status: ${result.status}`);
      } catch (e) {
        process.stderr.write(`warn: meta graph delete failed: ${e.message}\n`);
      }
    }
  }

  // ── Remove index record (v1.5.0) ──────────────────────────────────────────
  if (databookId && indexGraphOpt !== 'none' && !dryRun) {
    const indexGraphIri = indexGraphOpt ?? deriveIndexGraphIri(sparqlEndpoint);
    if (indexGraphIri) {
      await deleteIndexRecord(databookId, indexGraphIri, updateEndpoint, auth, verbose);
    }
  } else if (dryRun && indexGraphOpt !== 'none' && databookId) {
    const indexGraphIri = indexGraphOpt ?? deriveIndexGraphIri(sparqlEndpoint);
    if (indexGraphIri) log(`[delete] dry-run: would remove index record from ${indexGraphIri}`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  if (!quiet) {
    process.stderr.write(
      `${dryRun ? '[dry-run] ' : ''}${deleted} graph${deleted !== 1 ? 's' : ''} deleted` +
      (failed > 0 ? `, ${failed} failed` : '') + '\n'
    );
  }

  if (failed > 0) process.exit(1);
}

// ─── Index record removal ──────────────────────────────────────────────────────

async function deleteIndexRecord(databookId, indexGraphIri, updateEndpoint, auth, verbose) {
  const update = `\
PREFIX db: <https://w3id.org/databook/ns#>

WITH <${indexGraphIri}>
DELETE { <${databookId}> ?p ?o }
WHERE  { <${databookId}> ?p ?o }`;

  if (verbose) log(`[delete] index record remove → ${indexGraphIri}`);

  try {
    const result = await sparqlUpdate(updateEndpoint, update, auth);
    if (!result.ok) {
      process.stderr.write(`warn: index record removal failed (HTTP ${result.status})\n`);
    } else if (verbose) {
      log(`[delete] index record removed (${result.status})`);
    }
  } catch (e) {
    process.stderr.write(`warn: index record removal error: ${e.message}\n`);
  }
}

// ─── Graph enumeration ─────────────────────────────────────────────────────────

async function enumerateGraphs(databookId, sparqlEndpoint, auth, verbose) {
  const metaIri = `${databookId}#meta`;
  const query = `
SELECT DISTINCT ?g WHERE {
  GRAPH ?g { ?s ?p ?o }
  FILTER(STRSTARTS(STR(?g), "${databookId}#"))
  FILTER(STR(?g) != "${metaIri}")
}
ORDER BY STR(?g)
`.trim();

  if (verbose) log(`[delete] enumerating graphs for <${databookId}>`);

  const result = await sparqlQuery(sparqlEndpoint, query, 'application/sparql-results+json', auth);
  checkResponse(result, `graph enumeration for <${databookId}>`);

  try {
    const parsed = JSON.parse(result.body);
    return (parsed?.results?.bindings ?? []).map(b => b.g?.value).filter(Boolean);
  } catch (e) {
    die(`could not parse graph enumeration response: ${e.message}`, 1);
  }
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function deriveIndexGraphIri(sparqlEndpoint) {
  try {
    const url    = new URL(sparqlEndpoint);
    const parts  = url.pathname.split('/').filter(Boolean);
    const dataset = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    if (dataset) return `urn:${dataset}:databook:index#graph`;
  } catch {}
  return null;
}

function log(msg)         { process.stderr.write(msg + '\n'); }
function die(msg, code=2) { process.stderr.write(`error: ${msg}\n`); process.exit(code); }
