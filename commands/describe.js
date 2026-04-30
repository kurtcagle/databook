/**
 * commands/describe.js
 * DataBook CLI — describe command
 *
 * Retrieve resource descriptions by IRI from a SPARQL triplestore.
 * Output defaults to a wrapped DataBook; use --no-wrap for raw Turtle.
 *
 * Phase 1: standard SPARQL DESCRIBE (outbound or symmetric CBD via --symmetric).
 * Phase 2 (future): SHACL-guided CONSTRUCT — pass --shapes <ref> to opt in
 *   when implemented. Currently emits a warning and falls back to DESCRIBE.
 *
 * Multiple --iri values are combined into a single DESCRIBE query:
 *   DESCRIBE <iri1> <iri2> <iri3>
 */

import { resolve, basename }                                   from 'path';
import crypto                                                  from 'crypto';
import { writeOutput, atomicWriteEncoded, resolveEncoding }    from '../lib/encoding.js';
import { loadDataBookFile }                                    from '../lib/parser.js';
import { getDefaultEndpoint }                                  from '../lib/config.js';
import { resolveAuth }                                         from '../lib/auth.js';
import { resolveServer, listServers, LOCALHOST_FUSEKI, datasetToEndpoints } from '../lib/serverConfig.js';
import { sparqlQuery, checkResponse }                          from '../lib/gsp.js';

export async function runDescribe(file, opts) {
  const {
    iri:      iris = [],
    server:   serverName,
    endpoint: endpointOpt,
    graph:    graphOpt,
    shapes:   shapesRef,
    symmetric = false,
    wrap    = true,
    format: formatOpt = 'turtle',
    output: outPath,
    auth:   authOpt,
    dryRun  = false,
    verbose = false,
    quiet   = false,
    encoding: encOpt,
  } = opts;

  let enc;
  try { enc = resolveEncoding(encOpt); } catch (e) { die(e.message); }

  if (iris.length === 0) die('at least one --iri <iri> is required', 2);

  // ── Phase 2 warning ───────────────────────────────────────────────────────
  if (shapesRef && !quiet) {
    process.stderr.write(`warn: SHACL-guided CONSTRUCT (--shapes) is not yet implemented; falling back to standard DESCRIBE\n`);
  }

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

  // ── Build DESCRIBE query ──────────────────────────────────────────────────
  // Outbound-only: plain DESCRIBE (Jena returns CBD but we document intent as outbound).
  // --symmetric documents that the caller explicitly wants Jena's default symmetric CBD.
  const iriList = iris.map(i => `<${i}>`).join('\n  ');
  let query;

  if (graphOpt) {
    // Scope to a named graph via a CONSTRUCT that mimics DESCRIBE within a graph
    query = [
      `DESCRIBE ${iriList}`,
      `FROM <${graphOpt}>`,
    ].join('\n');
  } else {
    query = `DESCRIBE ${iriList}`;
  }

  const accept = formatOpt === 'trig'    ? 'application/trig'
               : formatOpt === 'json-ld' ? 'application/ld+json'
               : 'text/turtle';

  if (verbose || dryRun) {
    log(`[describe] POST ${sparqlEndpoint}`);
    log(`[describe]       IRIs: ${iris.join(', ')}`);
    log(`[describe]       Accept: ${accept}`);
    log(`[describe]       Query:\n${query}`);
    if (dryRun) {
      log(`[describe]       [not sent]`);
      process.exit(0);
    }
  }

  const result = await sparqlQuery(sparqlEndpoint, query, accept, auth);
  checkResponse(result, `describe ${iris[0]}`);
  if (verbose) log(`[describe]       Status: ${result.status}, ${result.body.length} bytes`);

  const resultBody = result.body;

  // ── Load source DataBook for frontmatter context (optional) ───────────────
  let sourceFm = {};
  if (file) {
    try {
      const db = loadDataBookFile(file);
      sourceFm = db.frontmatter;
    } catch { /* non-fatal */ }
  }

  // ── Emit output ───────────────────────────────────────────────────────────
  if (wrap) {
    const wrapped = buildWrappedDataBook({
      file, sourceFm, sparqlEndpoint, iris, graphOpt, resultBody, formatOpt,
    });
    if (outPath && outPath !== '-') {
      atomicWriteEncoded(outPath, wrapped, enc);
      if (verbose) log(`[describe] Written to ${outPath}`);
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

function buildWrappedDataBook({ file, sourceFm, sparqlEndpoint, iris, graphOpt, resultBody, formatOpt }) {
  const now      = new Date();
  const isoDate  = now.toISOString().slice(0, 10);
  const isoTs    = now.toISOString().replace(/\.\d+Z$/, 'Z');
  const slug     = crypto.randomBytes(4).toString('hex');
  const id       = `urn:databook:describe-result:${slug}`;

  // One block per IRI; if only one IRI, single block; if multiple, one block
  // for the merged result (Phase 2 will split per IRI when shapes are available).
  const blockLabel = formatOpt === 'trig'    ? 'trig'
                   : formatOpt === 'json-ld' ? 'json-ld'
                   : 'turtle';

  const title = iris.length === 1
    ? `Describe — ${localName(iris[0])}`
    : `Describe — ${iris.length} resources`;

  const sourceRef = file
    ? `file://${resolve(file)}`
    : `urn:input:none`;

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
    'graph:',
    `  namespace: ${sourceFm.graph?.namespace ?? sourceFm.domain ?? `${id}#`}`,
    `  named_graph: ${id}#describe-result`,
    '  rdf_version: "1.1"',
    '',
    'describe:',
    `  iris:`,
    ...iris.map(i => `    - ${i}`),
    ...(graphOpt ? [`  graph: ${graphOpt}`] : []),
    '',
    'process:',
    '  transformer: "databook describe"',
    '  transformer_type: service',
    `  transformer_iri: ${sparqlEndpoint}`,
    '  inputs:',
    `    - iri: ${sourceRef}`,
    '      role: context',
    `      description: "${file ? `Source DataBook: ${sourceFm.title ?? basename(file)}` : 'No source DataBook'}"`,
    `  timestamp: ${isoTs}`,
    '  agent:',
    '    name: Chloe Shannon',
    '    iri: https://holongraph.com/people/chloe-shannon',
    '    role: transformer',
    '---',
  ].join('\n');

  const body = [
    '',
    `## Describe Result`,
    '',
    iris.length === 1
      ? `Resource: \`${iris[0]}\` from \`${sparqlEndpoint}\` on ${isoDate}.`
      : `Resources: ${iris.map(i => `\`${localName(i)}\``).join(', ')} from \`${sparqlEndpoint}\` on ${isoDate}.`,
    ...(graphOpt ? [`Graph scope: \`${graphOpt}\``] : []),
    '',
    '```' + blockLabel,
    '<!-- databook:id: describe-result -->',
    resultBody.trimEnd(),
    '```',
    '',
  ].join('\n');

  return frontmatter + '\n' + body;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Extract local name from an IRI (last # or / segment). */
function localName(iri) {
  const hash = iri.lastIndexOf('#');
  if (hash >= 0) return iri.slice(hash + 1);
  const slash = iri.lastIndexOf('/');
  if (slash >= 0) return iri.slice(slash + 1);
  return iri;
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
