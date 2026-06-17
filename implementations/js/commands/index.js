/**
 * databook index — manage the dataset index named graph.
 *
 * v1.5.0: New command.
 *
 * Subcommands:
 *   databook index --repair   Reconcile stale index records against live graphs.
 *   databook index --show     Print the index graph as a table (alias for list --index-graph).
 *   databook index --rebuild  Rebuild the index from #meta graphs (migration from pre-v1.5).
 */

import { sparqlQuery, sparqlUpdate, checkResponse }                          from '../lib/gsp.js';
import { getDefaultEndpoint, inferUpdateEndpoint }                           from '../lib/config.js';
import { resolveAuth }                                                       from '../lib/auth.js';
import { resolveServer, LOCALHOST_FUSEKI, datasetToEndpoints }               from '../lib/serverConfig.js';

export async function runIndex(opts) {
  const {
    server:     serverName,
    endpoint:   endpointOpt,
    indexGraph: indexGraphOpt,
    repair      = false,
    rebuild     = false,
    show        = false,
    auth:       authOpt,
    dryRun      = false,
    verbose     = false,
    quiet       = false,
  } = opts;

  if (!repair && !rebuild && !show) {
    die('specify --repair, --rebuild, or --show', 2);
  }

  // ── Resolve endpoints ──────────────────────────────────────────────────────
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

  const updateEndpoint = inferUpdateEndpoint(sparqlEndpoint);
  const auth           = resolveAuth(sparqlEndpoint, authOpt ?? serverCfg?.auth);
  const indexGraphIri  = indexGraphOpt ?? deriveIndexGraphIri(opts.dataset, sparqlEndpoint);

  if (!indexGraphIri) die('cannot derive index graph IRI — supply --index-graph or --dataset', 2);

  if (verbose) log(`[index] index graph: ${indexGraphIri}`);

  // ── --repair: remove stale records ────────────────────────────────────────
  if (repair) {
    await runRepair({ indexGraphIri, sparqlEndpoint, updateEndpoint, auth, dryRun, verbose, quiet });
    return;
  }

  // ── --rebuild: reconstruct index from #meta graphs ────────────────────────
  if (rebuild) {
    await runRebuild({ indexGraphIri, sparqlEndpoint, updateEndpoint, auth, dryRun, verbose, quiet });
    return;
  }

  // ── --show: print index (delegates to list logic) ─────────────────────────
  if (show) {
    const { runList } = await import('./list.js');
    await runList({ ...opts, indexGraph: indexGraphIri });
    return;
  }
}

// ─── --repair ─────────────────────────────────────────────────────────────────

async function runRepair({ indexGraphIri, sparqlEndpoint, updateEndpoint, auth, dryRun, verbose, quiet }) {
  // Step 1: enumerate all namedGraph IRIs in the index
  const enumQuery = `
PREFIX db: <https://w3id.org/databook/ns#>

SELECT ?id ?namedGraph WHERE {
    GRAPH <${indexGraphIri}> {
        ?id a db:DataBook .
        OPTIONAL { ?id db:namedGraph ?namedGraph }
    }
}`.trim();

  if (verbose) log('[index] --repair: fetching index records');

  let result;
  try {
    result = await sparqlQuery(sparqlEndpoint, enumQuery, 'application/sparql-results+json', auth);
  } catch (e) { die(e.message, 1); }
  checkResponse(result, 'index enumeration');

  let records;
  try {
    const parsed = JSON.parse(result.body);
    records = (parsed?.results?.bindings ?? []).map(b => ({
      id:         b.id?.value,
      namedGraph: b.namedGraph?.value ?? null,
    }));
  } catch (e) { die(`parse error: ${e.message}`, 1); }

  if (records.length === 0) {
    if (!quiet) process.stderr.write('Index graph is empty — nothing to repair.\n');
    return;
  }

  if (verbose) log(`[index] --repair: ${records.length} record(s) to check`);

  // Step 2: for each record with a namedGraph, ASK if the graph exists
  const stale = [];
  for (const rec of records) {
    if (!rec.namedGraph) {
      // No named graph recorded — can't verify; skip
      if (verbose) log(`[index] --repair: SKIP ${rec.id} (no namedGraph recorded)`);
      continue;
    }

    const askQuery = `ASK { GRAPH <${rec.namedGraph}> { ?s ?p ?o } }`;
    try {
      const askResult = await sparqlQuery(sparqlEndpoint, askQuery, 'application/sparql-results+json', auth);
      checkResponse(askResult, `ASK for ${rec.namedGraph}`);
      const askParsed = JSON.parse(askResult.body);
      const exists = askParsed?.boolean === true;

      if (!exists) {
        stale.push(rec);
        if (verbose) log(`[index] --repair: STALE ${rec.id}`);
      } else if (verbose) {
        log(`[index] --repair: OK    ${rec.id}`);
      }
    } catch (e) {
      process.stderr.write(`warn: ASK failed for ${rec.namedGraph}: ${e.message}\n`);
    }
  }

  if (stale.length === 0) {
    if (!quiet) process.stderr.write('Index is clean — no stale records found.\n');
    return;
  }

  if (!quiet) process.stderr.write(`Found ${stale.length} stale record(s).\n`);

  // Step 3: remove stale records
  for (const rec of stale) {
    const update = `\
PREFIX db: <https://w3id.org/databook/ns#>

WITH <${indexGraphIri}>
DELETE { <${rec.id}> ?p ?o }
WHERE  { <${rec.id}> ?p ?o }`;

    if (verbose || dryRun) log(`[index] --repair: ${dryRun ? '[dry-run] ' : ''}DELETE ${rec.id}`);

    if (!dryRun) {
      try {
        const delResult = await sparqlUpdate(updateEndpoint, update, auth);
        if (!delResult.ok) {
          process.stderr.write(`warn: failed to remove stale record ${rec.id} (HTTP ${delResult.status})\n`);
        }
      } catch (e) {
        process.stderr.write(`warn: error removing stale record ${rec.id}: ${e.message}\n`);
      }
    }
  }

  if (!quiet) {
    process.stderr.write(
      `${dryRun ? '[dry-run] ' : ''}${stale.length} stale record${stale.length !== 1 ? 's' : ''} removed.\n`
    );
  }
}

// ─── --rebuild: reconstruct index from #meta graphs ───────────────────────────

async function runRebuild({ indexGraphIri, sparqlEndpoint, updateEndpoint, auth, dryRun, verbose, quiet }) {
  // Query all #meta graphs and extract DataBook metadata
  const metaQuery = `
PREFIX db:      <https://w3id.org/databook/ns#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX prov:    <http://www.w3.org/ns/prov#>
PREFIX owl:     <http://www.w3.org/2002/07/owl#>

SELECT ?id ?title ?type ?version ?created ?namedGraph WHERE {
  GRAPH ?metaGraph {
    ?id a db:DataBook .
    OPTIONAL { ?id dcterms:title       ?title }
    OPTIONAL { ?id dcterms:type        ?type  }
    OPTIONAL { ?id owl:versionInfo     ?version }
    OPTIONAL { ?id dcterms:created     ?created }
    OPTIONAL { ?id db:namedGraph       ?namedGraph }
  }
  FILTER(STRENDS(STR(?metaGraph), "#meta"))
}`.trim();

  if (verbose) log('[index] --rebuild: querying #meta graphs');

  let result;
  try {
    result = await sparqlQuery(sparqlEndpoint, metaQuery, 'application/sparql-results+json', auth);
  } catch (e) { die(e.message, 1); }
  checkResponse(result, 'meta graph enumeration');

  let records;
  try {
    const parsed = JSON.parse(result.body);
    records = (parsed?.results?.bindings ?? []).map(b => ({
      id:         b.id?.value,
      title:      b.title?.value      ?? '(untitled)',
      type:       b.type?.value       ?? 'databook',
      version:    b.version?.value    ?? '1.0.0',
      created:    b.created?.value    ?? new Date().toISOString().slice(0, 10),
      namedGraph: b.namedGraph?.value ?? null,
    })).filter(r => r.id);
  } catch (e) { die(`parse error: ${e.message}`, 1); }

  if (records.length === 0) {
    if (!quiet) process.stderr.write('No #meta graphs found — nothing to rebuild from.\n');
    return;
  }

  if (!quiet) process.stderr.write(`Rebuilding index from ${records.length} #meta graph(s)...\n`);

  let rebuilt = 0;
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

  for (const rec of records) {
    const title       = rec.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const namedGraph  = rec.namedGraph ? `        db:namedGraph <${rec.namedGraph}> ;` : '';

    const update = `\
PREFIX db:      <https://w3id.org/databook/ns#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX xsd:     <http://www.w3.org/2001/XMLSchema#>

WITH <${indexGraphIri}>
DELETE { <${rec.id}> ?p ?o }
INSERT {
    <${rec.id}>
        a db:DataBook ;
        dcterms:title   "${title}" ;
        dcterms:type    "${rec.type}" ;
        dcterms:created "${rec.created}"^^xsd:date ;
${namedGraph ? namedGraph + '\n' : ''}\
        db:version      "${rec.version}" ;
        db:indexedAt    "${now}"^^xsd:dateTime .
}
WHERE { OPTIONAL { <${rec.id}> ?p ?o } }`;

    if (verbose || dryRun) log(`[index] --rebuild: ${dryRun ? '[dry-run] ' : ''}upsert ${rec.id}`);

    if (!dryRun) {
      try {
        const upResult = await sparqlUpdate(updateEndpoint, update, auth);
        if (!upResult.ok) {
          process.stderr.write(`warn: upsert failed for ${rec.id} (HTTP ${upResult.status})\n`);
        } else {
          rebuilt++;
        }
      } catch (e) {
        process.stderr.write(`warn: upsert error for ${rec.id}: ${e.message}\n`);
      }
    } else {
      rebuilt++;
    }
  }

  if (!quiet) {
    process.stderr.write(
      `${dryRun ? '[dry-run] ' : ''}Index ${dryRun ? 'would have ' : ''}rebuilt: ${rebuilt} record${rebuilt !== 1 ? 's' : ''}.\n`
    );
  }
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function deriveIndexGraphIri(datasetName, sparqlEndpoint) {
  if (datasetName) return `urn:${datasetName}:databook:index#graph`;
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
