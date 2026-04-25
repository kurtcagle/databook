/**
 * databook pull — retrieve RDF from a SPARQL triplestore into a DataBook.
 * Spec: https://w3id.org/databook/specs/cli-pull
 *
 * Three modes:
 *   Mode 1 — Named graph fetch (GSP GET)
 *   Mode 2 — External query file (--query)
 *   Mode 3 — Fragment-ref embedded SPARQL block (--fragment)
 */

import { readFileSync }                                  from 'fs';
import { writeOutput, atomicWriteEncoded, resolveEncoding } from '../lib/encoding.js';
import { tmpdir }                                         from 'os';
import { join, basename, resolve }                        from 'path';
import crypto                                             from 'crypto';
import { loadDataBookFile, blockPayload }                 from '../lib/parser.js';
import { fetchDatabook }                                  from '../lib/fetchDatabook.js';
import { getDefaultEndpoint, inferGspEndpoint } from '../lib/config.js';
import { resolveAuth } from '../lib/auth.js';
import { resolveServer, listServers, LOCALHOST_FUSEKI, datasetToEndpoints } from '../lib/serverConfig.js';
import { gspGet, sparqlQuery, detectQueryType, acceptForQueryType, checkResponse } from '../lib/gsp.js';
import { computeStats } from '../lib/stats.js';

/**
 * Run the `databook pull` command.
 * @param {string} filePath   - DataBook file path (always required)
 * @param {object} opts
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
  if (graphOpts && graphOpts.length > 0) return Array.isArray(graphOpts) ? graphOpts : [graphOpts];

  // From frontmatter
  if (fm.graph?.named_graph) return [fm.graph.named_graph];

  // Fragment-addressing rule: {document.id}#{first-pushable-block-id}
  const firstBlock = db.blocks.find(b => b.id);
  if (fm.id && firstBlock) return [`${fm.id}#${firstBlock.id}`];

  die('no graph IRI — supply --graph or add graph.named_graph to frontmatter', 2);
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
