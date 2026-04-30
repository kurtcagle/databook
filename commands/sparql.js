/**
 * commands/sparql.js
 * DataBook CLI — sparql command
 *
 * Execute a SPARQL SELECT, CONSTRUCT, or ASK query against a triplestore.
 * Output defaults to a wrapped DataBook; use --no-wrap for raw results.
 *
 * Query source (one required):
 *   --id <id>      Embedded sparql block in the source DataBook
 *   --query <file> External .sparql/.rq file
 *   source#id      Fragment syntax on the positional argument
 */

import { readFileSync }                                        from 'fs';
import { basename, resolve }                                   from 'path';
import crypto                                                  from 'crypto';
import { writeOutput, atomicWriteEncoded, resolveEncoding }    from '../lib/encoding.js';
import { loadDataBookFile, blockPayload }                      from '../lib/parser.js';
import { getDefaultEndpoint }                                  from '../lib/config.js';
import { resolveAuth }                                         from '../lib/auth.js';
import { resolveServer, listServers, LOCALHOST_FUSEKI, datasetToEndpoints } from '../lib/serverConfig.js';
import { sparqlQuery, detectQueryType, acceptForQueryType, checkResponse }   from '../lib/gsp.js';

export async function runSparql(source, opts) {
  const {
    id:       blockId,
    query:    queryFile,
    server:   serverName,
    endpoint: endpointOpt,
    graph:    graphOpts = [],
    wrap = true,
    format:   formatOpt,
    output:   outPath,
    auth:     authOpt,
    dryRun  = false,
    verbose = false,
    quiet   = false,
    encoding: encOpt,
  } = opts;

  let enc;
  try { enc = resolveEncoding(encOpt); } catch (e) { die(e.message); }

  // ── Resolve fragment syntax on positional (source#id) ─────────────────────
  let sourceFile = source;
  let resolvedId = blockId;
  if (source && source.includes('#') && !blockId) {
    const idx = source.lastIndexOf('#');
    sourceFile  = source.slice(0, idx);
    resolvedId  = source.slice(idx + 1);
  }

  // ── Validate query source ─────────────────────────────────────────────────
  if (!resolvedId && !queryFile) {
    die('one of --id, --query, or source#id fragment syntax is required', 2);
  }
  if (resolvedId && queryFile) die('--id and --query are mutually exclusive', 2);

  // ── Resolve endpoint ──────────────────────────────────────────────────────
  let serverCfg = null;
  if (serverName) {
    if (serverName === 'list') { listAndExit(); }
    try { serverCfg = resolveServer(serverName); }
    catch (e) { die(`E_SERVER_NOT_FOUND: server '${serverName}' not found in processors.toml`, 2); }
  }
  const datasetCfg     = opts.dataset ? datasetToEndpoints(opts.dataset) : null;
  const sparqlEndpoint = endpointOpt ?? serverCfg?.endpoint ?? datasetCfg?.endpoint ?? getDefaultEndpoint() ?? LOCALHOST_FUSEKI.endpoint;
  const auth           = resolveAuth(sparqlEndpoint, authOpt ?? serverCfg?.auth);

  // ── Resolve query text ────────────────────────────────────────────────────
  let query, querySourceDesc;
  if (resolvedId) {
    if (!sourceFile) die('--id requires a source DataBook file', 2);
    let db;
    try { db = loadDataBookFile(sourceFile); } catch (e) { die(e.message, 2); }
    const block = db.blocks.find(b => b.id === resolvedId);
    if (!block) die(`no block with id '${resolvedId}' in ${sourceFile}`, 2);
    if (block.label !== 'sparql') die(`block '${resolvedId}' has label '${block.label}', expected 'sparql'`, 2);
    query           = blockPayload(block);
    querySourceDesc = `${sourceFile}#${resolvedId}`;
  } else {
    try { query = readFileSync(queryFile, 'utf8'); } catch (e) { die(`query file not found: ${queryFile}`, 2); }
    querySourceDesc = queryFile;
  }

  // ── Optionally inject named graph restriction ─────────────────────────────
  // If --graph supplied and query doesn't already have a FROM clause, we wrap
  // the WHERE body with GRAPH <iri> { ... } as a convenience. This is advisory
  // only — complex queries should express graph scoping themselves.
  // (Not applied for now; left as a TODO for Phase 2.)

  const queryType  = detectQueryType(query);
  const accept     = formatOpt ? mimeForFormat(formatOpt) : acceptForQueryType(queryType);
  const outputType = formatOpt ?? outputTypeForQueryType(queryType);

  if (verbose || dryRun) {
    log(`[sparql] POST ${sparqlEndpoint}`);
    log(`[sparql]       Source: ${querySourceDesc}`);
    log(`[sparql]       Type: ${queryType}`);
    log(`[sparql]       Accept: ${accept}`);
    if (dryRun) {
      log(`[sparql]       [not sent]\n\nQuery:\n${query}`);
      process.exit(0);
    }
  }

  const result = await sparqlQuery(sparqlEndpoint, query, accept, auth);
  checkResponse(result, `sparql query ${querySourceDesc}`);
  if (verbose) log(`[sparql]       Status: ${result.status}, ${result.body.length} bytes`);

  const resultBody = result.body;

  // ── Emit output ───────────────────────────────────────────────────────────
  if (wrap) {
    const db        = sourceFile ? (() => { try { return loadDataBookFile(sourceFile); } catch { return null; } })() : null;
    const sourceFm  = db?.frontmatter ?? {};
    const wrapped   = buildWrappedDataBook({
      sourceFile, sourceFm, sparqlEndpoint, querySourceDesc, queryType, resultBody, outputType,
    });
    if (outPath && outPath !== '-') {
      atomicWriteEncoded(outPath, wrapped, enc);
      if (verbose) log(`[sparql] Written to ${outPath}`);
    } else {
      writeOutput(null, wrapped, enc);
    }
  } else {
    if (outPath && outPath !== '-') {
      writeOutput(outPath, resultBody, enc);
    } else {
      writeOutput(null, resultBody, enc);
    }
  }
}

// ─── Wrapped DataBook generation ──────────────────────────────────────────────

function buildWrappedDataBook({ sourceFile, sourceFm, sparqlEndpoint, querySourceDesc, queryType, resultBody, outputType }) {
  const now     = new Date();
  const isoDate = now.toISOString().slice(0, 10);
  const isoTs   = now.toISOString().replace(/\.\d+Z$/, 'Z');
  const slug    = crypto.randomBytes(4).toString('hex');
  const id      = `urn:databook:sparql-result:${slug}`;
  const title   = `SPARQL Result — ${querySourceDesc}`;
  const blockLabel = fenceLabelForOutputType(outputType);
  const blockId    = 'sparql-result';

  const frontmatter = [
    '---',
    `id: ${id}`,
    `title: "${title.replace(/"/g, '\\"')}"`,
    'type: databook',
    'version: 1.0.0',
    `created: ${isoDate}`,
    '',
    'author:',
    `  - name: ${sourceFm.author?.[0]?.name ?? 'Kurt Cagle'}`,
    `    iri: ${sourceFm.author?.[0]?.iri ?? 'https://holongraph.com/people/kurt-cagle'}`,
    '    role: orchestrator',
    '  - name: Chloe Shannon',
    '    iri: https://holongraph.com/people/chloe-shannon',
    '    role: transformer',
    '',
    'process:',
    '  transformer: "databook sparql"',
    '  transformer_type: service',
    `  transformer_iri: ${sparqlEndpoint}`,
    '  inputs:',
    `    - iri: ${sourceFile ? `file://${resolve(sourceFile)}` : 'urn:input:inline'}`,
    '      role: primary',
    `      description: "SPARQL ${queryType} from ${querySourceDesc}"`,
    `  timestamp: ${isoTs}`,
    '  agent:',
    '    name: Chloe Shannon',
    '    iri: https://holongraph.com/people/chloe-shannon',
    '    role: transformer',
    '---',
  ].join('\n');

  const body = [
    '',
    `## SPARQL ${queryType} Result`,
    '',
    `Query: \`${querySourceDesc}\` against \`${sparqlEndpoint}\` on ${isoDate}.`,
    '',
    '```' + blockLabel,
    `<!-- databook:id: ${blockId} -->`,
    resultBody.trimEnd(),
    '```',
    '',
  ].join('\n');

  return frontmatter + '\n' + body;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function fenceLabelForOutputType(outputType) {
  const map = {
    turtle:          'turtle',
    trig:            'trig',
    json:            'sparql-results',
    'sparql-results':'sparql-results',
    csv:             'csv',
    tsv:             'tsv',
    markdown:        'markdown',
  };
  return map[outputType] ?? outputType;
}

function mimeForFormat(fmt) {
  const map = {
    turtle:   'text/turtle',
    trig:     'application/trig',
    json:     'application/sparql-results+json',
    csv:      'text/csv',
    tsv:      'text/tab-separated-values',
    markdown: 'text/csv',   // fetch CSV, render as markdown downstream
  };
  return map[fmt] ?? '*/*';
}

function outputTypeForQueryType(queryType) {
  switch (queryType) {
    case 'CONSTRUCT':
    case 'DESCRIBE': return 'turtle';
    case 'SELECT':
    case 'ASK':      return 'json';
    default:         return 'turtle';
  }
}

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
