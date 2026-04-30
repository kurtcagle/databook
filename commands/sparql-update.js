/**
 * commands/sparql-update.js
 * DataBook CLI — sparql-update command
 *
 * Execute a SPARQL INSERT / DELETE / DROP update against a triplestore.
 * Produces no DataBook output. A summary line is written to stderr on success.
 */

import { readFileSync }                                        from 'fs';
import { loadDataBookFile, blockPayload }                      from '../lib/parser.js';
import { getDefaultEndpoint, inferUpdateEndpoint }             from '../lib/config.js';
import { resolveAuth }                                         from '../lib/auth.js';
import { resolveServer, listServers, LOCALHOST_FUSEKI, datasetToEndpoints } from '../lib/serverConfig.js';
import { sparqlUpdate, checkResponse }                         from '../lib/gsp.js';

export async function runSparqlUpdate(source, opts) {
  const {
    id:       blockId,
    query:    queryFile,
    server:   serverName,
    endpoint: endpointOpt,
    auth:     authOpt,
    dryRun  = false,
    verbose = false,
    quiet   = false,
  } = opts;

  // ── Resolve fragment syntax on positional ─────────────────────────────────
  let sourceFile  = source;
  let resolvedId  = blockId;
  if (source && source.includes('#') && !blockId) {
    const idx  = source.lastIndexOf('#');
    sourceFile = source.slice(0, idx);
    resolvedId = source.slice(idx + 1);
  }

  if (!resolvedId && !queryFile) {
    die('one of --id, --query, or source#id fragment syntax is required', 2);
  }
  if (resolvedId && queryFile) die('--id and --query are mutually exclusive', 2);

  // ── Resolve endpoint ──────────────────────────────────────────────────────
  let serverCfg = null;
  if (serverName) {
    if (serverName === 'list') {
      listAndExit();
    }
    try { serverCfg = resolveServer(serverName); }
    catch (e) { die(`E_SERVER_NOT_FOUND: server '${serverName}' not found in processors.toml`, 2); }
  }
  const datasetCfg      = opts.dataset ? datasetToEndpoints(opts.dataset) : null;
  const sparqlEndpoint  = endpointOpt ?? serverCfg?.endpoint ?? datasetCfg?.endpoint ?? getDefaultEndpoint() ?? LOCALHOST_FUSEKI.endpoint;
  const updateEndpoint  = inferUpdateEndpoint(sparqlEndpoint);
  const auth            = resolveAuth(sparqlEndpoint, authOpt ?? serverCfg?.auth);

  // ── Resolve update text ───────────────────────────────────────────────────
  let updateText, updateSourceDesc;
  if (resolvedId) {
    if (!sourceFile) die('--id requires a source DataBook file', 2);
    let db;
    try { db = loadDataBookFile(sourceFile); } catch (e) { die(e.message, 2); }
    const block = db.blocks.find(b => b.id === resolvedId);
    if (!block) die(`no block with id '${resolvedId}' in ${sourceFile}`, 2);
    if (block.label !== 'sparql-update') die(`block '${resolvedId}' has label '${block.label}', expected 'sparql-update'`, 2);
    updateText       = blockPayload(block);
    updateSourceDesc = `${sourceFile}#${resolvedId}`;
  } else {
    try { updateText = readFileSync(queryFile, 'utf8'); } catch (e) { die(`query file not found: ${queryFile}`, 2); }
    updateSourceDesc = queryFile;
  }

  if (verbose || dryRun) {
    log(`[sparql-update] POST ${updateEndpoint}`);
    log(`[sparql-update]       Source: ${updateSourceDesc}`);
    if (dryRun) {
      log(`[sparql-update]       [not sent]\n\nUpdate:\n${updateText}`);
      process.exit(0);
    }
  }

  const result = await sparqlUpdate(updateEndpoint, updateText, auth);
  checkResponse(result, `sparql-update ${updateSourceDesc}`);

  if (!quiet) {
    process.stderr.write(`sparql-update: 1 operation completed against ${updateEndpoint}\n`);
  }
  if (verbose) log(`[sparql-update]       Status: ${result.status}`);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function listAndExit() {
  const servers = listServers();
  if (servers.length === 0) {
    process.stdout.write('No servers configured in processors.toml.\n');
  } else {
    for (const s of servers) {
      process.stdout.write(`  ${s.name.padEnd(16)} ${s.endpoint ?? '(no endpoint)'}\n`);
    }
  }
  process.exit(0);
}

function log(msg)  { process.stderr.write(msg + '\n'); }
function die(msg, code = 2) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}
