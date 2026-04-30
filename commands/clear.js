/**
 * commands/clear.js
 * DataBook CLI — clear command
 *
 * Removes named graphs from a SPARQL triplestore via GSP DELETE,
 * or drops all graphs in a dataset via SPARQL UPDATE DROP ALL.
 *
 * Graph IRI resolution (same priority as push):
 *   --graph <iri>  > --block-id > graph.named_graph > fragment-addressing rule
 *
 * Endpoint resolution:
 *   --endpoint > --server > --dataset > localhost:3030/ds (default)
 *
 * Usage:
 *   databook clear observatory.databook.md -d ggsc
 *   databook clear observatory.databook.md -d ggsc --block-id observatory-shapes
 *   databook clear -d ggsc --graph https://example.org/my-graph
 *   databook clear observatory.databook.md -d ggsc --all --force
 */

import readline                                         from 'readline';
import { loadDataBookFile }                             from '../lib/parser.js';
import { getDefaultEndpoint,
         inferGspEndpoint,
         inferUpdateEndpoint }                          from '../lib/config.js';
import { resolveAuth }                                  from '../lib/auth.js';
import { sparqlUpdate, checkResponse }                  from '../lib/gsp.js';
import { resolveServer,
         listServers,
         LOCALHOST_FUSEKI,
         datasetToEndpoints }                           from '../lib/serverConfig.js';

// ── Public entry point ─────────────────────────────────────────────────────

export async function runClear(file, opts) {
  const {
    server:      serverName,
    dataset:     datasetName,
    endpoint:    endpointOpt,
    gspEndpoint: gspOpt,
    graph:       graphOpt,
    blockId,
    meta = true,
    all  = false,
    force = false,
    auth: authOpt,
    dryRun  = false,
    verbose = false,
  } = opts;

  // ── Resolve named server ─────────────────────────────────────────────────
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
  }

  // ── Resolve endpoints ────────────────────────────────────────────────────
  const datasetCfg     = datasetName ? datasetToEndpoints(datasetName) : null;
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
  const auth           = resolveAuth(sparqlEndpoint, authOpt ?? serverCfg?.auth);

  if (verbose) {
    log(`[clear] SPARQL endpoint: ${sparqlEndpoint}`);
    log(`[clear] GSP endpoint:    ${gspEndpoint}`);
    log(`[clear] Update endpoint: ${updateEndpoint}`);
  }

  // ── DROP ALL ─────────────────────────────────────────────────────────────
  if (all) {
    if (!force && !dryRun) {
      const confirmed = await confirm(
        `This will DROP ALL graphs in the dataset at ${sparqlEndpoint}.\nType "yes" to confirm: `
      );
      if (!confirmed) {
        log('[clear] Aborted.');
        process.exit(0);
      }
    }

    if (verbose || dryRun) {
      log(`[clear] SPARQL UPDATE  ${updateEndpoint}`);
      log(`[clear]   DROP SILENT ALL`);
      if (dryRun) { log('[clear] [dry-run: not sent]'); process.exit(0); }
    }

    try {
      const result = await sparqlUpdate(updateEndpoint, 'DROP SILENT ALL', auth);
      checkResponse(result, 'DROP ALL');
      log(`[clear] All graphs dropped (${result.status}).`);
    } catch (e) {
      die(`DROP ALL failed: ${e.message}`, 3);
    }
    return;
  }

  // ── Resolve graph IRIs to clear ───────────────────────────────────────────
  const graphIris = resolveGraphIris(file, graphOpt, blockId, meta);

  if (graphIris.length === 0) {
    die('No graph IRIs resolved — supply a DataBook file, --graph, or --block-id.', 2);
  }

  if (verbose || dryRun) {
    for (const iri of graphIris) {
      log(`[clear] DELETE ${gspEndpoint}?graph=${iri}`);
    }
    if (dryRun) { log('[clear] [dry-run: not sent]'); process.exit(0); }
  }

  // ── Execute GSP DELETE for each graph ─────────────────────────────────────
  let cleared = 0, failed = 0;

  for (const iri of graphIris) {
    try {
      const result = await gspDelete(gspEndpoint, iri, auth);
      if (result.status === 404) {
        process.stderr.write(`warn: graph not found (already empty?): ${iri}\n`);
      } else {
        checkResponse(result, `graph ${iri}`);
        if (verbose) log(`[clear] Cleared ${iri} (${result.status})`);
        cleared++;
      }
    } catch (e) {
      process.stderr.write(`error: ${e.message}\n`);
      failed++;
    }
  }

  if (!verbose && cleared > 0) {
    log(`[clear] ${cleared} graph${cleared !== 1 ? 's' : ''} cleared.`);
  }
  if (failed > 0) process.exit(failed === cleared + failed ? 2 : 1);
}

// ── Graph IRI resolution ───────────────────────────────────────────────────

function resolveGraphIris(file, graphOpt, blockId, includeMeta) {
  const iris = [];

  if (graphOpt) {
    // Explicit IRI — no DataBook needed
    iris.push(graphOpt);
    return iris;
  }

  if (!file) return iris;

  let db;
  try { db = loadDataBookFile(file); } catch (e) { die(e.message, 2); }

  const fm = db.frontmatter;
  const docId = fm.id ?? `file://${file}`;

  if (blockId) {
    // Specific block
    const block = db.blocks.find(b => b.id === blockId);
    if (!block) die(`Block '${blockId}' not found in ${file}`, 2);
    iris.push(`${docId}#${blockId}`);
  } else {
    // All pushable blocks — mirror push's graph IRI derivation
    const PUSHABLE = new Set(['turtle', 'turtle12', 'trig', 'shacl', 'json-ld']);
    const pushable = db.blocks.filter(b => PUSHABLE.has(b.label));

    if (pushable.length === 0) {
      die(`No pushable blocks found in ${file}`, 2);
    }

    // Single pushable block — use graph.named_graph if present
    if (pushable.length === 1 && fm.graph?.named_graph) {
      iris.push(fm.graph.named_graph);
    } else {
      for (const block of pushable) {
        iris.push(`${docId}#${block.id ?? block.label}`);
      }
    }

    // Meta graph
    if (includeMeta) {
      iris.push(`${docId}#meta`);
    }
  }

  return iris;
}

// ── GSP DELETE ─────────────────────────────────────────────────────────────

async function gspDelete(gspEndpoint, graphIri, auth) {
  const url     = `${gspEndpoint}?graph=${encodeURIComponent(graphIri)}`;
  const headers = { ...(auth ? { Authorization: auth } : {}) };

  const res = await fetch(url, { method: 'DELETE', headers });
  return { status: res.status, ok: res.ok, body: '' };
}

// ── Confirmation prompt ────────────────────────────────────────────────────

function confirm(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input:  process.stdin,
      output: process.stderr,
    });
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });
}

// ── Utilities ──────────────────────────────────────────────────────────────

function log(msg)           { process.stderr.write(msg + '\n'); }
function die(msg, code = 1) {
  const err    = new Error(msg);
  err.exitCode = code;
  throw err;
}
