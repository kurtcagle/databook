/**
 * databook push — transfer RDF blocks from a DataBook to a SPARQL triplestore via GSP.
 * Spec: https://w3id.org/databook/specs/cli-push
 */

import { loadDataBookFile, PUSHABLE_LABELS, blockPayload } from '../lib/parser.js';
import { resolveEncoding, writeOutput }                    from '../lib/encoding.js';
import { getDefaultEndpoint, inferGspEndpoint, inferUpdateEndpoint } from '../lib/config.js';
import { resolveAuth } from '../lib/auth.js';
import { resolveServer, listServers, LOCALHOST_FUSEKI, datasetToEndpoints } from '../lib/serverConfig.js'; // localhost default included
import { gspPut, gspPost, sparqlUpdate, contentTypeForLabel, checkResponse } from '../lib/gsp.js';
import { frontmatterToTurtle } from '../lib/reify.js';

/**
 * Run the `databook push` command.
 * @param {string} filePath
 * @param {object} opts
 */
export async function runPush(filePath, opts) {
  const {
    server: serverName,
    endpoint: endpointOpt,
    gspEndpoint: gspOpt,
    blockId: blockIdOpts = [],   // may be specified multiple times
    graph: graphOpt,
    meta = true,
    merge = false,
    auth: authOpt,
    publish: publishUrl,
    dryRun = false,
    verbose = false,
  } = opts;

  if (dryRun) opts.verbose = true;

  // ── HTTP publish mode (--publish) ─────────────────────────────────────────
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

  // ── Resolve named server config ───────────────────────────────────────────
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

  // ── Load DataBook ─────────────────────────────────────────────────────────
  let db;
  try {
    db = loadDataBookFile(filePath);
  } catch (e) {
    die(e.message, 2);
  }

  const fm = db.frontmatter;

  // ── Resolve endpoints ─────────────────────────────────────────────────────
  // Priority: explicit flag > named server config > --dataset shorthand > processors.toml default > localhost:3030/ds
  const datasetCfg    = opts.dataset ? datasetToEndpoints(opts.dataset) : null;
  const sparqlEndpoint = endpointOpt ?? serverCfg?.endpoint ?? datasetCfg?.endpoint ?? getDefaultEndpoint() ?? LOCALHOST_FUSEKI.endpoint;

  let gspEndpoint = gspOpt ?? serverCfg?.gsp ?? datasetCfg?.gsp;
  if (!gspEndpoint) {
    try {
      gspEndpoint = inferGspEndpoint(sparqlEndpoint);
    } catch (e) {
      gspEndpoint = LOCALHOST_FUSEKI.gsp;
    }
  }

  const updateEndpoint = inferUpdateEndpoint(sparqlEndpoint);
  const auth = resolveAuth(sparqlEndpoint, authOpt ?? serverCfg?.auth);

  // ── Select blocks ──────────────────────────────────────────────────────────
  const blockIds = Array.isArray(blockIdOpts) ? blockIdOpts : [blockIdOpts].filter(Boolean);
  let selectedBlocks;

  if (blockIds.length > 0) {
    selectedBlocks = [];
    for (const bid of blockIds) {
      const block = db.blocks.find(b => b.id === bid);
      if (!block) die(`no block with id '${bid}'`, 2);
      selectedBlocks.push(block);
    }
  } else {
    selectedBlocks = db.blocks.filter(b => PUSHABLE_LABELS.has(b.label));
  }

  // Validate --graph constraint
  if (graphOpt && selectedBlocks.length > 1) {
    die('--graph requires exactly one block; multiple blocks selected', 2);
  }

  const pushableBlocks = selectedBlocks.filter(b => PUSHABLE_LABELS.has(b.label));
  const skippedBlocks  = selectedBlocks.filter(b => !PUSHABLE_LABELS.has(b.label));

  if (verbose && skippedBlocks.length > 0) {
    for (const b of skippedBlocks) {
      log(`[push] SKIP  block '${b.id ?? '(unlabelled)'}' (${b.label}) — not a pushable type`);
    }
  }

  // ── Execute pushes ─────────────────────────────────────────────────────────
  let pushed = 0, failed = 0;
  const databookId = fm.id;

  for (const block of pushableBlocks) {
    const graphIri = resolveGraphIri(block, graphOpt, fm, databookId, db.filePath, pushableBlocks.length);
    const payload = blockPayload(block);

    if (block.label === 'sparql-update') {
      // Execute as SPARQL Update, not GSP
      await executeSparqlUpdate(block, payload, updateEndpoint, auth, dryRun, verbose);
      pushed++;
      continue;
    }

    const contentType = contentTypeForLabel(block.label);
    const method = merge ? 'POST' : 'PUT';

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

  // ── Push metadata graph (--meta, default on) ──────────────────────────────
  if (meta) {
    const metaIri = databookId ? `${databookId}#meta` : null;
    if (metaIri) {
      const metaTurtle = frontmatterToTurtle(fm, db.filePath);
      if (verbose || dryRun) {
        logBlockOp('PUT', gspEndpoint, metaIri, 'text/turtle', metaTurtle, dryRun, true);
      }
      if (!dryRun) {
        try {
          const result = await gspPut(gspEndpoint, metaIri, metaTurtle, 'text/turtle', auth);
          checkResponse(result, 'meta graph');
          if (verbose) log(`[push]       Status: ${result.status}`);
        } catch (e) {
          process.stderr.write(`warn: meta graph push failed: ${e.message}\n`);
        }
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  if (verbose || dryRun) {
    const metaNote = meta && databookId ? '  (1 meta graph)' : '';
    log(`[push] ${pushed} block${pushed !== 1 ? 's' : ''} pushed, ${skippedBlocks.length} skipped, ${failed} failed${metaNote}`);
  }

  if (failed > 0 && pushed > 0) process.exit(1);
  if (failed > 0 && pushed === 0) process.exit(2);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determine the target named graph IRI for a block.
 * Priority: --graph flag > graph.named_graph > fragment-addressing rule
 */
function resolveGraphIri(block, graphOpt, fm, databookId, filePath, totalBlocks = 1) {
  // 1. Explicit --graph
  if (graphOpt) return graphOpt;

  // 2. graph.named_graph (single-block convenience, only when one block selected)
  if (fm.graph?.named_graph && totalBlocks === 1) return fm.graph.named_graph;

  // 3. Fragment-addressing rule
  const docId = databookId ?? `file://${filePath ?? 'unknown'}`;
  const blockId = block.id ?? block.label;
  return `${docId}#${blockId}`;
}

async function executeSparqlUpdate(block, payload, updateEndpoint, auth, dryRun, verbose) {
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
  const lines = payload.split('\n').filter(l => l.trim()).length;
  log(`[push] ${method.padEnd(4)} ${endpoint}`);
  log(`[push]       ?graph=${graphIri}`);
  log(`[push]       Content-Type: ${contentType}`);
  log(`[push]       Lines: ~${lines}`);
  if (dryRun) log(`[push]       Status: [not sent]`);
}

function log(msg)      { process.stderr.write(msg + '\n'); }
function die(msg, code = 2) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}
