/**
 * databook push — transfer RDF blocks from a DataBook to a SPARQL triplestore.
 *
 * Changes in v1.4.2:
 *   1. Empty-string --graph guard
 *   2. Meta graph push respects --merge
 *   3. resolveGraphIri — restored fragment-addressing + processors.toml step
 *
 * Changes in v1.5.0 (index graph):
 *   4. --index-graph <IRI> | "none" — write catalog record to index named graph
 *      after a successful push. Default IRI derived from dataset name.
 *   5. --path <path> — store db:path in the index record (overrides frontmatter path).
 */

import { loadDataBookFile, PUSHABLE_LABELS, blockPayload } from '../lib/parser.js';
import { resolveEncoding, writeOutput }                     from '../lib/encoding.js';
import { getDefaultEndpoint, inferGspEndpoint, inferUpdateEndpoint, getDefaultNamedGraph } from '../lib/config.js';
import { resolveAuth } from '../lib/auth.js';
import { resolveServer, listServers, LOCALHOST_FUSEKI, datasetToEndpoints } from '../lib/serverConfig.js';
import { gspPut, gspPost, sparqlUpdate, contentTypeForLabel, checkResponse } from '../lib/gsp.js';
import { frontmatterToTurtle } from '../lib/reify.js';

export async function runPush(filePath, opts) {
  const {
    server: serverName,
    endpoint: endpointOpt,
    gspEndpoint: gspOpt,
    blockId: blockIdOpts = [],
    graph: graphOpt,
    meta = true,
    merge = false,
    auth: authOpt,
    publish: publishUrl,
    dryRun = false,
    verbose = false,
    indexGraph: indexGraphOpt,  // v1.5.0: --index-graph
    path: pathOpt,               // v1.5.0: --path (override frontmatter path in index)
  } = opts;

  if (dryRun) opts.verbose = true;

  // ── Validate --graph early: reject explicit empty string ──────────────────────
  if (graphOpt !== undefined && graphOpt !== null && graphOpt.trim() === '') {
    die('--graph requires a non-empty IRI; pass no flag to use the default graph', 2);
  }

  // ── HTTP publish mode (--publish) ─────────────────────────────────────────────
  if (publishUrl) {
    let content;
    try { content = (await import('fs')).readFileSync(filePath, 'utf8'); }
    catch (e) { die(e.message, 2); }

    const auth = authOpt ?? process.env.DATABOOK_AUTH ?? null;
    const headers = { 'Content-Type': 'application/x.databook+markdown' };
    if (auth) {
      headers['Authorization'] = auth.startsWith('Bearer ') || auth.startsWith('Basic ')
        ? auth
        : auth.includes(':') ? `Basic ${Buffer.from(auth).toString('base64')}` : `Bearer ${auth}`;
    }

    if (dryRun) {
      process.stderr.write(`[push] dry-run: PUT ${publishUrl}\n`);
      process.stderr.write(`[push] Content-Type: application/x.databook+markdown\n`);
      process.stderr.write(`[push] Content-Length: ${Buffer.byteLength(content)}\n`);
      return;
    }

    let response;
    try {
      response = await fetch(publishUrl, { method: 'PUT', headers, body: content });
    } catch (e) { die(`publish failed: ${e.message}`, 1); }

    if (!response.ok && response.status !== 201) {
      die(`publish returned HTTP ${response.status}: ${publishUrl}`, 1);
    }
    process.stderr.write(`published: ${publishUrl} (${response.status} ${response.statusText})\n`);
    return;
  }

  // ── Resolve named server config ───────────────────────────────────────────────
  let serverCfg = null;
  if (serverName) {
    if (serverName === 'list') {
      const servers = listServers();
      if (servers.length === 0) {
        process.stdout.write('No servers configured in processors.toml.\n');
      } else {
        for (const s of servers) {
          process.stdout.write(`  ${s.name.padEnd(16)} ${s.endpoint ?? '(no endpoint)'}${s.auth ? '  auth: (set)' : ''}\n`);
        }
      }
      process.exit(0);
    }
    try { serverCfg = resolveServer(serverName); }
    catch (e) { die(e.message, 2); }
    if (verbose) {
      log(`[push] Server '${serverName}': endpoint=${serverCfg.endpoint} gsp=${serverCfg.gsp ?? '(inferred)'}`);
    }
  }

  // ── Load DataBook ─────────────────────────────────────────────────────────────
  let db;
  try { db = loadDataBookFile(filePath); }
  catch (e) { die(e.message, 2); }

  const fm = db.frontmatter;

  // ── Filename stem validation (v1.5.0) ─────────────────────────────────────
  // Warn when the source filename stem doesn't match the path terminal segment.
  if (fm.path && filePath) {
    const { basename } = await import('path');
    const terminalSegment = fm.path.split('/').pop();
    const fileStem = basename(filePath).replace(/\.databook\.md$/i, '').replace(/\.md$/i, '');
    if (fileStem !== terminalSegment) {
      process.stderr.write(
        `warn: filename stem '${fileStem}' does not match path terminal '${terminalSegment}'\n` +
        `  Consider renaming the file to '${terminalSegment}.databook.md'\n`
      );
    }
  }
  const datasetCfg     = opts.dataset ? datasetToEndpoints(opts.dataset) : null;
  const sparqlEndpoint = endpointOpt ?? serverCfg?.endpoint ?? datasetCfg?.endpoint ?? getDefaultEndpoint() ?? LOCALHOST_FUSEKI.endpoint;

  let gspEndpoint = gspOpt ?? serverCfg?.gsp ?? datasetCfg?.gsp;
  if (!gspEndpoint) {
    try   { gspEndpoint = inferGspEndpoint(sparqlEndpoint); }
    catch { gspEndpoint = LOCALHOST_FUSEKI.gsp; }
  }

  const updateEndpoint = inferUpdateEndpoint(sparqlEndpoint);
  const auth = resolveAuth(sparqlEndpoint, authOpt ?? serverCfg?.auth);

  // ── Select blocks ─────────────────────────────────────────────────────────────
  const blockIds = Array.isArray(blockIdOpts) ? blockIdOpts : [blockIdOpts].filter(Boolean);
  let selectedBlocks;

  if (blockIds.length > 0) {
    selectedBlocks = [];
    for (const bid of blockIds) {
      const block = db.blocks.find(b => b.id === bid);
      if (!block) {
        const available = db.blocks.map(b => b.id).filter(Boolean);
        const hint = available.length > 0
          ? `\n  Available block IDs: ${available.join(', ')}`
          : '\n  No named blocks found in document. Check that <!-- databook:id: ... --> annotations are present.';
        die(`no block with id '${bid}'${hint}`, 2);
      }
      selectedBlocks.push(block);
    }
  } else {
    selectedBlocks = db.blocks.filter(b => PUSHABLE_LABELS.has(b.label));
  }

  const effectiveGraphOpt = (graphOpt !== undefined && graphOpt !== null && graphOpt.trim() !== '')
    ? graphOpt : undefined;

  if (effectiveGraphOpt && selectedBlocks.length > 1) {
    const ids = selectedBlocks.map(b => b.id ?? '(unnamed)').join(', ');
    die(
      `--graph applies to a single block but ${selectedBlocks.length} blocks are selected (${ids}).\n` +
      `  Use --block-id <id> to target a specific block.`,
      2
    );
  }

  const pushableBlocks = selectedBlocks.filter(b => PUSHABLE_LABELS.has(b.label));
  const skippedBlocks  = selectedBlocks.filter(b => !PUSHABLE_LABELS.has(b.label));

  if (verbose && skippedBlocks.length > 0) {
    for (const b of skippedBlocks)
      log(`[push] SKIP  block '${b.id ?? '(unlabelled)'}' (${b.label}) — not a pushable type`);
  }

  // ── Execute pushes ────────────────────────────────────────────────────────────
  let pushed = 0, failed = 0;
  const databookId = fm.id;

  for (const block of pushableBlocks) {
    const graphIri = resolveGraphIri(block, effectiveGraphOpt, fm, databookId, db.filePath, pushableBlocks.length);
    const payload  = blockPayload(block);

    if (block.label === 'sparql-update') {
      await executeSparlqUpdate(block, payload, updateEndpoint, auth, dryRun, verbose);
      pushed++;
      continue;
    }

    const contentType = contentTypeForLabel(block.label);
    const method      = merge ? 'POST' : 'PUT';

    if (verbose || dryRun) {
      logBlockOp(method, gspEndpoint, graphIri, contentType, payload, dryRun);
    }

    if (!dryRun) {
      try {
        const result = method === 'PUT'
          ? await gspPut(gspEndpoint, graphIri, payload, contentType, auth)
          : await gspPost(gspEndpoint, graphIri, payload, contentType, auth);

        checkResponse(result, `block '${block.id}'`);
        if (verbose) log(`[push]       Status: ${result.status}`);
        pushed++;
      } catch (e) {
        process.stderr.write(`error: ${e.message}\n`);
        failed++;
      }
    } else {
      pushed++;
    }
  }

  // ── Push metadata graph (--meta, default on) ──────────────────────────────────
  if (meta) {
    const metaIri = databookId ? `${databookId}#meta` : null;
    if (metaIri) {
      const metaTurtle = frontmatterToTurtle(fm, db.filePath);
      if (verbose || dryRun) {
        logBlockOp(merge ? 'POST' : 'PUT', gspEndpoint, metaIri, 'text/turtle', metaTurtle, dryRun, true);
      }
      if (!dryRun) {
        try {
          const result = merge
            ? await gspPost(gspEndpoint, metaIri, metaTurtle, 'text/turtle', auth)
            : await gspPut(gspEndpoint, metaIri, metaTurtle, 'text/turtle', auth);
          checkResponse(result, 'meta graph');
          if (verbose) log(`[push]       Status: ${result.status}`);
        } catch (e) {
          process.stderr.write(`warn: meta graph push failed: ${e.message}\n`);
        }
      }
    }
  }

  // ── Index graph upsert (v1.5.0) ───────────────────────────────────────────────
  // Runs after successful push; non-fatal on failure.
  if (!dryRun && pushed > 0 && failed === 0 && indexGraphOpt !== 'none') {
    const indexGraphIri = indexGraphOpt ?? deriveIndexGraphIri(sparqlEndpoint);
    if (indexGraphIri) {
      const effectivePath = pathOpt ?? fm.path ?? null;
      await upsertIndexRecord(fm, effectivePath, indexGraphIri, updateEndpoint, auth, verbose);
    } else if (verbose) {
      log('[push] index upsert skipped — could not derive index graph IRI');
    }
  } else if (dryRun && indexGraphOpt !== 'none') {
    const indexGraphIri = indexGraphOpt ?? deriveIndexGraphIri(sparqlEndpoint);
    if (indexGraphIri) log(`[push] dry-run: would upsert index record → ${indexGraphIri}`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  if (verbose || dryRun) {
    const metaNote = meta && databookId ? '  (1 meta graph)' : '';
    log(`[push] ${pushed} block${pushed !== 1 ? 's' : ''} pushed, ${skippedBlocks.length} skipped, ${failed} failed${metaNote}`);
  }

  if (failed > 0 && pushed > 0)  process.exit(1);
  if (failed > 0 && pushed === 0) process.exit(2);
}

// ─── Index graph helpers (v1.5.0) ─────────────────────────────────────────────

/**
 * Derive index graph IRI from the SPARQL endpoint URL.
 * http://localhost:3030/causalspark/sparql → urn:causalspark:databook:index#graph
 */
function deriveIndexGraphIri(sparqlEndpoint) {
  try {
    const url    = new URL(sparqlEndpoint);
    const parts  = url.pathname.split('/').filter(Boolean);
    // parts: ['causalspark', 'sparql'] or ['ds', 'sparql']
    const dataset = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    if (dataset) return `urn:${dataset}:databook:index#graph`;
  } catch {}
  return null;
}

/**
 * Upsert a catalog record for this DataBook into the index named graph.
 * Uses WITH … DELETE … INSERT … WHERE for idempotent upsert.
 */
async function upsertIndexRecord(fm, pathValue, indexGraphIri, updateEndpoint, auth, verbose) {
  const id = fm.id;
  if (!id) {
    if (verbose) log('[push] index upsert skipped — DataBook has no id');
    return;
  }

  const now         = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const title       = (fm.title    ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const type        = fm.type      ?? 'databook';
  const version     = fm.version   ?? '1.0.0';
  const created     = fm.created   ?? now.slice(0, 10);
  const description = fm.description
    ? `        dcterms:description "${fm.description.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    : null;
  const pathTriple  = pathValue
    ? `        db:path             "${pathValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    : null;
  const namedGraph  = fm.graph?.named_graph
    ? `        db:namedGraph       <${fm.graph.named_graph}>`
    : null;

  const optionalTriples = [description, pathTriple, namedGraph]
    .filter(Boolean)
    .join(' ;\n') + (description || pathTriple || namedGraph ? ' ;' : '');

  const update = `\
PREFIX db:      <https://w3id.org/databook/ns#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX xsd:     <http://www.w3.org/2001/XMLSchema#>

WITH <${indexGraphIri}>
DELETE { <${id}> ?p ?o }
INSERT {
    <${id}>
        a db:DataBook ;
        dcterms:title       "${title}" ;
        dcterms:type        "${type}" ;
        dcterms:created     "${created}"^^xsd:date ;
${optionalTriples ? optionalTriples + '\n' : ''}\
        db:version          "${version}" ;
        db:indexedAt        "${now}"^^xsd:dateTime .
}
WHERE { OPTIONAL { <${id}> ?p ?o } }`;

  if (verbose) log(`[push] index upsert → ${indexGraphIri}`);

  try {
    const result = await sparqlUpdate(updateEndpoint, update, auth);
    if (!result.ok) {
      process.stderr.write(`warn: index upsert failed (HTTP ${result.status}) — push succeeded\n`);
    } else if (verbose) {
      log(`[push] index upsert OK (${result.status})`);
    }
  } catch (e) {
    process.stderr.write(`warn: index upsert error: ${e.message} — push succeeded\n`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveGraphIri(block, graphOpt, fm, databookId, filePath, totalBlocks = 1) {
  if (graphOpt) return graphOpt;
  if (fm.graph?.named_graph && totalBlocks === 1) return fm.graph.named_graph;
  const configGraph = getDefaultNamedGraph();
  if (configGraph) return configGraph;
  if (databookId && block.id) return `${databookId}#${block.id}`;
  return null;
}

async function executeSparlqUpdate(block, payload, updateEndpoint, auth, dryRun, verbose) {
  if (verbose || dryRun) {
    log(`[push] SPARQL-UPDATE  ${updateEndpoint}`);
    if (dryRun) log(`[push]       [not sent]`);
  }
  if (!dryRun) {
    const result = await sparqlUpdate(updateEndpoint, payload, auth);
    checkResponse(result, `block '${block.id}' (sparql-update)`);
    if (verbose) log(`[push]       Status: ${result.status}`);
  }
}

function logBlockOp(method, endpoint, graphIri, contentType, payload, dryRun, isMeta = false) {
  const graphLabel = graphIri === null ? '(default graph)' : graphIri;
  const lines = payload.split('\n').filter(l => l.trim()).length;
  log(`[push] ${method.padEnd(4)} ${endpoint}`);
  log(`[push]       ?graph=${graphLabel}`);
  log(`[push]       Content-Type: ${contentType}`);
  log(`[push]       Lines: ~${lines}`);
  if (dryRun) log(`[push]       Status: [not sent]`);
}

function log(msg)          { process.stderr.write(msg + '\n'); }
function die(msg, code=2)  { process.stderr.write(`error: ${msg}\n`); process.exit(code); }
