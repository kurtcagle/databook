/**
 * databook pull — retrieve RDF from a SPARQL triplestore into a DataBook.
 * Spec: https://w3id.org/databook/specs/cli-pull
 *
 * Four modes:
 *   Mode 1 — Named graph fetch (GSP GET)
 *   Mode 2 — External query file (--query)
 *   Mode 3 — Fragment-ref embedded SPARQL block (--fragment)
 *   Mode 4 — Full document recovery by DataBook IRI (--databook-id)
 *
 * v1.4.2: resolveGraphIris() checks processors.toml default_endpoint.named_graph
 *         as step 3. --databook-id added for source-file-free roundtripping.
 */

import { readFileSync }                                  from 'fs';
import { writeOutput, atomicWriteEncoded, resolveEncoding } from '../lib/encoding.js';
import { tmpdir }                                         from 'os';
import { join, basename, resolve }                        from 'path';
import crypto                                             from 'crypto';
import { loadDataBookFile, blockPayload }                 from '../lib/parser.js';
import { fetchDatabook }                                  from '../lib/fetchDatabook.js';
import { getDefaultEndpoint, inferGspEndpoint, getDefaultNamedGraph } from '../lib/config.js';
import { resolveAuth } from '../lib/auth.js';
import { resolveServer, listServers, LOCALHOST_FUSEKI, datasetToEndpoints } from '../lib/serverConfig.js';
import { gspGet, sparqlQuery, detectQueryType, acceptForQueryType, checkResponse } from '../lib/gsp.js';
import { computeStats } from '../lib/stats.js';

/**
 * Run the `databook pull` command.
 * @param {string|null} filePath  - DataBook file path (not required when --databook-id is set)
 * @param {object}      opts
 */
export async function runPull(filePath, opts) {
  const {
    server: serverName,
    endpoint: endpointOpt,
    graph: graphOpts = [],
    fragment,
    query: queryFile,
    queryRef,
    blockId,
    databookId,
    wrap = false,
    infer = false,
    format: formatOpt,
    stats: computeStatsOpt = false,
    out: outPath,
    auth: authOpt,
    dryRun = false,
    verbose = false,
    encoding: encOpt,
  } = opts;
  let enc;
  try { enc = resolveEncoding(encOpt); } catch (e) { die(e.message); }

  // ── Mode 4: full document recovery from DataBook IRI ──────────────────────
  // --databook-id bypasses source file loading entirely; endpoint is the only
  // required input.
  if (databookId) {
    // Resolve endpoint (same chain as other modes, but no source file needed)
    let serverCfg4 = null;
    if (serverName && serverName !== 'list') {
      try { serverCfg4 = resolveServer(serverName); } catch (e) { die(e.message, 2); }
    }
    const datasetCfg4    = opts.dataset ? datasetToEndpoints(opts.dataset) : null;
    const sparqlEp4      = endpointOpt ?? serverCfg4?.endpoint ?? datasetCfg4?.endpoint
                        ?? getDefaultEndpoint() ?? LOCALHOST_FUSEKI.endpoint;
    const auth4          = resolveAuth(sparqlEp4, authOpt ?? serverCfg4?.auth);

    await pullByDatabookId({
      databookId, sparqlEndpoint: sparqlEp4, formatOpt, auth: auth4,
      outPath, enc, verbose, dryRun, quiet: opts.quiet,
    });
    return;
  }

  // Source file is required for all other modes
  if (!filePath) {
    die('pull requires a source DataBook file, or --databook-id <iri> for source-file-free recovery', 2);
  }

  // ── Validate mutual exclusions ─────────────────────────────────────────────
  if (fragment && queryFile)   die('--query and --fragment are mutually exclusive', 2);
  if (queryRef && queryFile)   die('--query and --query-ref are mutually exclusive', 2);
  if (queryRef && fragment)    die('--fragment and --query-ref are mutually exclusive', 2);
  if (blockId  && !outPath)   die('--block-id requires --out', 2);
  if (wrap     && blockId)    die('--wrap and --block-id are mutually exclusive', 2);

  // ── Resolve --query-ref (remote SPARQL block) ────────────────────────────
  let queryRefContent = null;
  if (queryRef) {
    let fetchResult;
    try {
      fetchResult = await fetchDatabook(queryRef, { auth: authOpt });
    } catch (e) { die(`--query-ref: ${e.message}`, e.exitCode ?? 1); }
    if (!fetchResult.block) die(`--query-ref: no block found at ${queryRef}`, 4);
    const { blockPayload } = await import('../lib/parser.js');
    queryRefContent = blockPayload(fetchResult.block);
    if (verbose) process.stderr.write(`[pull] query-ref resolved: ${queryRef}\n`);
  }

  // ── Load DataBook ──────────────────────────────────────────────────────────
  let db;
  try {
    db = loadDataBookFile(filePath);
  } catch (e) {
    die(e.message, 2);
  }

  const fm = db.frontmatter;

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
      log(`[pull] Server '${serverName}': endpoint=${serverCfg.endpoint}`);
    }
  }

  // Priority: explicit flag > named server config > --dataset shorthand > processors.toml default > localhost:3030/ds
  const datasetCfg    = opts.dataset ? datasetToEndpoints(opts.dataset) : null;
  const sparqlEndpoint = endpointOpt ?? serverCfg?.endpoint ?? datasetCfg?.endpoint ?? getDefaultEndpoint() ?? LOCALHOST_FUSEKI.endpoint;

  const auth = resolveAuth(sparqlEndpoint, authOpt ?? serverCfg?.auth);

  // ── Execute pull ───────────────────────────────────────────────────────────
  let resultBody, outputType;

  if (queryFile) {
    // Mode 2: External .sparql/.rq file
    ({ resultBody, outputType } = await pullExternalQuery(
      sparqlEndpoint, queryFile, formatOpt, auth, verbose, dryRun
    ));

  } else if (fragment) {
    // Mode 3: Embedded SPARQL block by id
    ({ resultBody, outputType } = await pullFragment(
      db, fragment, sparqlEndpoint, formatOpt, auth, verbose, dryRun
    ));

  } else {
    // Mode 1: Named graph fetch (GSP GET)
    const graphIris = resolveGraphIris(graphOpts, fm, db);
    ({ resultBody, outputType } = await pullNamedGraphs(
      sparqlEndpoint, graphIris, formatOpt, auth, verbose, dryRun
    ));
  }

  if (dryRun) { process.exit(0); }
  if (!resultBody || resultBody.trim() === '') {
    process.stderr.write(`warn: endpoint returned empty result\n`);
    process.exit(5);
  }

  // ── In-place block replacement ─────────────────────────────────────────────
  if (blockId) {
    const block = db.blocks.find(b => b.id === blockId);
    if (!block) die(`no block with id '${blockId}' in document`, 2);

    let newStats = null;
    if (computeStatsOpt && (outputType === 'turtle' || outputType === 'trig')) {
      try {
        newStats = await computeStats(resultBody);
        if (verbose) log(`[pull] Stats: triple_count=${newStats.tripleCount} subjects=${newStats.subjectCount}`);
      } catch (e) {
        process.stderr.write(`warn: stats recomputation failed (${e.message}); pull result retained\n`);
      }
    }

    const updatedContent = replaceBlockInDataBook(db, block, resultBody, outputType, newStats);
    if (verbose) log(`[pull] Block '${blockId}' replaced in ${filePath}`);
    const targetPath = outPath === filePath ? filePath : outPath;
    atomicWriteEncoded(targetPath, updatedContent, enc);

  // ── Wrap result in a new DataBook ──────────────────────────────────────────
  } else if (wrap) {
    let newStats = null;
    if (computeStatsOpt && (outputType === 'turtle' || outputType === 'trig')) {
      try {
        newStats = await computeStats(resultBody);
        if (verbose) log(`[pull] Stats: triple_count=${newStats.tripleCount} subjects=${newStats.subjectCount}`);
      } catch (e) {
        process.stderr.write(`warn: stats recomputation failed (${e.message})\n`);
      }
    }

    const wrappedContent = buildWrappedDataBook({
      sourceFilePath: filePath,
      sourceFm:       fm,
      sparqlEndpoint,
      fragment,
      queryFile,
      graphOpts,
      resultBody,
      outputType,
      stats: newStats,
    });

    if (outPath && outPath !== '-') {
      atomicWriteEncoded(outPath, wrappedContent, enc);
      if (verbose) log(`[pull] Wrapped DataBook written to ${outPath}`);
    } else {
      writeOutput(null, wrappedContent, enc);
    }

  // ── Raw output ─────────────────────────────────────────────────────────────
  } else {
    if (outPath && outPath !== '-') {
      writeOutput(outPath, resultBody, enc);
    } else {
      writeOutput(null, resultBody, enc);
    }
  }
}

// ─── Wrapped DataBook generation ──────────────────────────────────────────────

function buildWrappedDataBook({ sourceFilePath, sourceFm, sparqlEndpoint, fragment, queryFile, graphOpts, resultBody, outputType, stats }) {
  const now      = new Date();
  const isoDate  = now.toISOString().slice(0, 10);
  const isoTs    = now.toISOString().replace(/\.\d+Z$/, 'Z');
  const slug     = crypto.randomBytes(4).toString('hex');
  const sourceId = sourceFm.id ?? `file://${resolve(sourceFilePath)}`;

  // Derive a meaningful id and title
  const pullDesc = fragment  ? `fragment:${fragment}`
                 : queryFile ? `query:${basename(queryFile)}`
                 : `graph:${graphOpts[0] ?? 'named'}`;

  const id    = `urn:databook:pull-result:${slug}`;
  const title = `Pull Result — ${sourceFm.title ?? basename(sourceFilePath)} (${pullDesc})`;

  // Block label for result content
  const blockLabel = fenceLabelForOutputType(outputType, 'turtle');
  const blockId    = 'pull-result';

  // Input IRI — point to the fragment block if applicable
  const inputIri  = fragment ? `${sourceId}#${fragment}` : sourceId;
  const inputDesc = fragment  ? `SPARQL block '${fragment}' from ${sourceFm.title ?? sourceFilePath}`
                  : queryFile ? `External query ${basename(queryFile)}`
                  : `Named graph pull from ${sourceId}`;

  // Graph metadata lines (only for RDF result types)
  const isRdf = ['turtle', 'turtle12', 'trig', 'json-ld'].includes(blockLabel);
  const graphLines = isRdf ? [
    '',
    'graph:',
    `  namespace: ${sourceFm.graph?.namespace ?? sourceFm.domain ?? sourceId + '#'}`,
    `  named_graph: ${sourceId}#${blockId}`,
    ...(stats ? [
      `  triple_count: ${stats.tripleCount}`,
      `  subjects: ${stats.subjectCount}`,
    ] : []),
    '  rdf_version: "1.1"',
  ] : [];

  const frontmatter = [
    '<script language="application/yaml">',
    '',
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
    ...graphLines,
    '',
    'process:',
    '  transformer: "databook pull"',
    '  transformer_type: service',
    `  transformer_iri: ${sparqlEndpoint}`,
    '  inputs:',
    `    - iri: ${inputIri}`,
    '      role: primary',
    `      description: "${inputDesc}"`,
    `  timestamp: ${isoTs}`,
    '  agent:',
    '    name: Chloe Shannon',
    '    iri: https://holongraph.com/people/chloe-shannon',
    '    role: transformer',
    '---',
    '',
    '</script>',
  ].join('\n');

  const body = [
    '',
    '## Pull Result',
    '',
    `Retrieved via \`${pullDesc}\` from \`${sparqlEndpoint}\` on ${isoDate}.`,
    '',
    '```' + blockLabel,
    `<!-- databook:id: ${blockId} -->`,
    resultBody.trimEnd(),
    '```',
    '',
  ].join('\n');

  return frontmatter + '\n' + body;
}

// ─── Pull mode implementations ────────────────────────────────────────────────

async function pullExternalQuery(endpoint, queryFilePath, formatOpt, auth, verbose, dryRun) {
  let query;
  try {
    query = readFileSync(queryFilePath, 'utf8');
  } catch (e) {
    die(`query file not found: ${queryFilePath}`, 2);
  }

  const queryType = detectQueryType(query);
  const accept    = formatOpt ? mimeForFormat(formatOpt) : acceptForQueryType(queryType);
  const outputType = formatOpt ?? outputTypeForQueryType(queryType);

  if (verbose || dryRun) {
    log(`[pull] POST ${endpoint}`);
    log(`[pull]       Content-Type: application/sparql-query`);
    log(`[pull]       Accept: ${accept}`);
    if (dryRun) { log(`[pull]       [not sent]`); return { resultBody: '', outputType }; }
  }

  const result = await sparqlQuery(endpoint, query, accept, auth);
  checkResponse(result, `query ${queryFilePath}`);
  if (verbose) log(`[pull]       Status: ${result.status}`);

  return { resultBody: result.body, outputType };
}

async function pullFragment(db, fragmentId, endpoint, formatOpt, auth, verbose, dryRun) {
  const block = db.blocks.find(b => b.id === fragmentId);
  if (!block) die(`no block with id '${fragmentId}'`, 2);
  if (block.label !== 'sparql') {
    die(`block '${fragmentId}' has label '${block.label}', expected 'sparql'`, 2);
  }

  const query = blockPayload(block);
  const queryType = detectQueryType(query);
  const accept    = formatOpt ? mimeForFormat(formatOpt) : acceptForQueryType(queryType);
  const outputType = formatOpt ?? outputTypeForQueryType(queryType);

  if (verbose || dryRun) {
    log(`[pull] Fragment '${fragmentId}' extracted (${queryType}, ${query.split('\n').length} lines)`);
    log(`[pull] POST ${endpoint}`);
    log(`[pull]       Content-Type: application/sparql-query`);
    log(`[pull]       Accept: ${accept}`);
    if (dryRun) {
      log(`[pull]       [not sent]`);
      log(`\nExtracted SPARQL:\n${query}`);
      return { resultBody: '', outputType };
    }
  }

  const result = await sparqlQuery(endpoint, query, accept, auth);
  checkResponse(result, `fragment '${fragmentId}'`);
  if (verbose) log(`[pull]       Status: ${result.status}`);

  return { resultBody: result.body, outputType };
}

async function pullNamedGraphs(endpoint, graphIris, formatOpt, auth, verbose, dryRun) {
  let gspEndpoint;
  try {
    gspEndpoint = inferGspEndpoint(endpoint);
  } catch (e) {
    die(e.message, 2);
  }

  const outputType = formatOpt ?? 'turtle';
  const accept     = formatOpt === 'trig' ? 'application/trig' : 'text/turtle';

  const allParts = [];

  for (const graphIri of graphIris) {
    if (verbose || dryRun) {
      log(`[pull] GET  ${gspEndpoint}`);
      log(`[pull]       ?graph=${graphIri}`);
      log(`[pull]       Accept: ${accept}`);
      if (dryRun) { log(`[pull]       [not sent]`); continue; }
    }

    const result = await gspGet(gspEndpoint, graphIri, accept, auth);

    if (result.status === 404) {
      process.stderr.write(`warn: graph not found: ${graphIri} (HTTP 404)\n`);
      process.exit(5);
    }
    checkResponse(result, `graph ${graphIri}`);
    if (verbose) log(`[pull]       Status: ${result.status}`);

    allParts.push(result.body);
  }

  return { resultBody: allParts.join('\n'), outputType };
}

// ─── Named graph IRI resolution (Mode 1) ──────────────────────────────────────

function resolveGraphIris(graphOpts, fm, db) {
  // 1. Explicit --graph flag(s)
  if (graphOpts && graphOpts.length > 0) return Array.isArray(graphOpts) ? graphOpts : [graphOpts];

  // 2. Frontmatter graph.named_graph
  if (fm.graph?.named_graph) return [fm.graph.named_graph];

  // 3. processors.toml default_endpoint.named_graph (per-environment)
  //    Mirrors push's resolveGraphIri() for push/pull symmetry.
  const configGraph = getDefaultNamedGraph();
  if (configGraph) return [configGraph];

  // 4. Fragment-addressing rule: {document.id}#{first-block-id}
  const firstBlock = db.blocks.find(b => b.id);
  if (fm.id && firstBlock) return [`${fm.id}#${firstBlock.id}`];

  die('no graph IRI \u2014 supply --graph or add graph.named_graph to frontmatter', 2);
}

// ─── In-place block replacement ───────────────────────────────────────────────

/**
 * Replace a named block's content in the raw DataBook text.
 * Returns the full updated DataBook string.
 */
function replaceBlockInDataBook(db, targetBlock, newContent, outputType, newStats) {
  // Re-read the raw file so we do text manipulation
  const rawContent = readFileSync(db.filePath, 'utf8');
  const lines = rawContent.split('\n');

  // Find the block's fence markers by scanning for matching id comment
  const targetId = targetBlock.id;
  let inFence = false, fenceLabel = null, fenceStart = -1, fenceEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    if (!inFence) {
      const m = /^```([\w][\w.\-+]*)\s*$/.exec(lines[i]);
      if (m) {
        // Check if this fence contains our block id
        const nextLine = lines[i + 1] ?? '';
        if (nextLine.includes(`databook:id: ${targetId}`)) {
          inFence = true;
          fenceLabel = m[1];
          fenceStart = i;
        }
      }
    } else {
      if (/^```\s*$/.test(lines[i])) {
        fenceEnd = i;
        break;
      }
    }
  }

  if (fenceStart < 0 || fenceEnd < 0) {
    die(`could not locate fence for block '${targetId}' in source file`, 1);
  }

  // Determine new fence label
  const newLabel = fenceLabelForOutputType(outputType, fenceLabel);

  // Build replacement block
  const newBlockLines = [
    `\`\`\`${newLabel}`,
    `<!-- databook:id: ${targetId} -->`,
    ...newContent.trimEnd().split('\n'),
    '```',
  ];

  // Splice the replacement in
  const updatedLines = [
    ...lines.slice(0, fenceStart),
    ...newBlockLines,
    ...lines.slice(fenceEnd + 1),
  ];

  let updatedContent = updatedLines.join('\n');

  // Update frontmatter stats if requested
  if (newStats) {
    updatedContent = updateFrontmatterStats(updatedContent, newStats);
  }

  // Update process stamp
  updatedContent = updateProcessStamp(updatedContent);

  return updatedContent;
}

function fenceLabelForOutputType(outputType, original) {
  const map = {
    turtle:    'turtle',
    trig:      'trig',
    json:      'sparql-results',
    'sparql-results': 'sparql-results',
  };
  return map[outputType] ?? original;
}

/** Naive regex-based frontmatter stat update. */
function updateFrontmatterStats(content, stats) {
  content = content.replace(/triple_count:\s*\d+/, `triple_count: ${stats.tripleCount}`);
  content = content.replace(/subjects:\s*\d+/, `subjects: ${stats.subjectCount}`);
  return content;
}

function updateProcessStamp(content) {
  const ts = new Date().toISOString();
  content = content.replace(/(timestamp:\s*)[\d\-T:.Z]+/, `$1${ts}`);
  content = content.replace(/(transformer_type:\s*)[\w"']+/, `$1service`);
  return content;
}

// ─── Mode 4: full document recovery by DataBook IRI ─────────────────────────────

/**
 * Recover a complete DataBook from the triplestore using only its IRI.
 *
 * Steps:
 *   1. Query {id}#meta for title, version, created and provenance.
 *   2. SPARQL-enumerate all named graphs with prefix {id}# (excl. #meta).
 *   3. GSP GET each block graph as Turtle.
 *   4. Assemble a reconstructed DataBook and write to --output / stdout.
 */
async function pullByDatabookId({ databookId, sparqlEndpoint, formatOpt, auth, outPath, enc, verbose, dryRun, quiet }) {
  const metaIri = `${databookId}#meta`;
  if (verbose) log(`[pull] --databook-id ${databookId}`);

  // ── Step 1: fetch metadata from #meta ──────────────────────────────────────
  const metaQuery = `
PREFIX build: <https://w3id.org/databook/ns#>
PREFIX dct:   <http://purl.org/dc/terms/>
PREFIX owl:   <http://www.w3.org/2002/07/owl#>
PREFIX prov:  <http://www.w3.org/ns/prov#>

SELECT ?title ?version ?created WHERE {
  GRAPH <${metaIri}> {
    <${databookId}> a build:DataBook .
    OPTIONAL { <${databookId}> dct:title           ?title   }
    OPTIONAL { <${databookId}> owl:versionInfo      ?version }
    OPTIONAL { <${databookId}> dct:created          ?created }
  }
}
LIMIT 1
`.trim();

  let metaFm = { title: null, version: null, created: null };

  if (dryRun) {
    log(`[pull] [dry-run] Would query meta graph: ${metaIri}`);
    log(`[pull] [dry-run] Would enumerate graphs with prefix ${databookId}#`);
    log(`[pull] [dry-run] Would pull each block and assemble DataBook`);
    log(`[pull] [dry-run] Output: ${outPath ?? 'stdout'}`);
    return;
  }

  const metaResult = await sparqlQuery(sparqlEndpoint, metaQuery,
    'application/sparql-results+json', auth);

  if (metaResult.ok) {
    try {
      const mp = JSON.parse(metaResult.body);
      const mb = mp?.results?.bindings?.[0];
      if (mb) {
        metaFm.title   = mb.title?.value   ?? null;
        metaFm.version = mb.version?.value ?? null;
        metaFm.created = mb.created?.value ?? null;
      }
    } catch { /* ignore */ }
  } else if (!quiet) {
    process.stderr.write(
      `warn: meta graph not found (${metaResult.status}) — proceeding with inferred frontmatter.\n`
    );
  }

  if (verbose) log(`[pull] Meta: title="${metaFm.title ?? '(none)'}" ver=${metaFm.version ?? '(none)'}`);

  // ── Step 2: enumerate block graphs ────────────────────────────────────────
  const graphEnumQuery = `
SELECT DISTINCT ?g WHERE {
  GRAPH ?g { ?s ?p ?o }
  FILTER(STRSTARTS(STR(?g), "${databookId}#"))
  FILTER(STR(?g) != "${metaIri}")
}
ORDER BY STR(?g)
`.trim();

  const enumResult = await sparqlQuery(sparqlEndpoint, graphEnumQuery,
    'application/sparql-results+json', auth);
  checkResponse(enumResult, `graph enumeration for <${databookId}>`);

  let blockGraphs = [];
  try {
    const ep = JSON.parse(enumResult.body);
    blockGraphs = (ep?.results?.bindings ?? []).map(b => b.g?.value).filter(Boolean);
  } catch (e) {
    die(`could not parse graph enumeration response: ${e.message}`, 1);
  }

  if (blockGraphs.length === 0) {
    die(
      `no block graphs found for <${databookId}>.\n` +
      `  Verify the DataBook was pushed to this endpoint and has not been cleared.\n` +
      `  Use: databook list -e ${sparqlEndpoint}`,
      5
    );
  }

  if (verbose) log(`[pull] Found ${blockGraphs.length} block graph(s)`);

  // ── Step 3: GSP GET each block ─────────────────────────────────────────────
  let gspEndpoint;
  try   { gspEndpoint = inferGspEndpoint(sparqlEndpoint); }
  catch { die(`cannot infer GSP endpoint from '${sparqlEndpoint}'`, 2); }

  const accept     = formatOpt === 'trig' ? 'application/trig' : 'text/turtle';
  const fenceLabel = formatOpt === 'trig' ? 'trig' : (formatOpt ?? 'turtle');

  const blocks = [];
  for (const graphIri of blockGraphs) {
    // Derive block id from IRI fragment: {databookId}#my-block → my-block
    const blockId = graphIri.startsWith(databookId + '#')
      ? graphIri.slice(databookId.length + 1)
      : graphIri.replace(/[^a-zA-Z0-9_-]/g, '-');

    if (verbose) log(`[pull] GET  ${gspEndpoint}  ?graph=${graphIri}`);

    const r = await gspGet(gspEndpoint, graphIri, accept, auth);

    if (r.status === 404) {
      if (!quiet) process.stderr.write(`warn: block graph not found: ${graphIri} (skipped)\n`);
      continue;
    }
    checkResponse(r, `block graph ${graphIri}`);
    if (verbose) log(`[pull]   Status: ${r.status}  (${r.body.split('\n').length} lines)`);

    blocks.push({ blockId, content: r.body.trimEnd(), label: fenceLabel, graphIri });
  }

  if (blocks.length === 0) {
    die(`all block graphs returned 404 — DataBook may have been cleared`, 5);
  }

  // ── Step 4: assemble reconstructed DataBook ────────────────────────────────
  const now      = new Date();
  const isoDate  = now.toISOString().slice(0, 10);
  const isoTs    = now.toISOString().replace(/\.\d+Z$/, 'Z');

  const title   = metaFm.title   ?? 'Recovered DataBook';
  const version = metaFm.version ?? '1.0.0';
  const created = metaFm.created ?? isoDate;

  const frontmatter = [
    '---',
    `id: ${databookId}`,
    `title: "${title.replace(/"/g, '\\"')}"`,
    'type: databook',
    `version: ${version}`,
    `created: ${created}`,
    '',
    'process:',
    '  transformer: "databook pull --databook-id"',
    '  transformer_type: service',
    `  transformer_iri: ${sparqlEndpoint}`,
    `  timestamp: ${isoTs}`,
    '  inputs:',
    ...blocks.map(b => `    - iri: ${b.graphIri}`),
    '---',
    '',
  ].join('\n');

  const body = blocks.map(b => [
    `<!-- databook:id: ${b.blockId} -->`,
    `\`\`\`${b.label}`,
    b.content,
    '```',
  ].join('\n')).join('\n\n');

  const output = frontmatter + '\n' + body + '\n';

  if (outPath && outPath !== '-') {
    atomicWriteEncoded(outPath, output, enc);
    if (!quiet) process.stderr.write(
      `[pull] Recovered ${blocks.length} block${blocks.length !== 1 ? 's' : ''} → ${outPath}\n`
    );
  } else {
    writeOutput(null, output, enc);
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────


function mimeForFormat(fmt) {
  const map = {
    turtle:  'text/turtle',
    trig:    'application/trig',
    json:    'application/sparql-results+json',
    csv:     'text/csv',
    tsv:     'text/tab-separated-values',
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

function log(msg)  { process.stderr.write(msg + '\n'); }
function die(msg, code = 2) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}
