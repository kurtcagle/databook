/**
 * databook process — execute a processor-registry DataBook as a DAG pipeline.
 * Spec: https://w3id.org/databook/specs/cli-process-v1
 *
 * Supports:
 *   - Full pipeline mode: -P <process-databook>
 *   - Single-operation shorthand: --sparql / --shapes / --xslt / --xquery
 *   - Jena SPARQL, Jena SHACL, Saxon XSLT, Saxon XQuery processors
 *   - DAG topological sort with build:dependsOn + build:order tiebreaking
 */

import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, accessSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname, resolve } from 'path';
import { spawn } from 'child_process';
import { loadDataBookFile, fetchFragmentBlock, blockPayload, RDF_LABELS } from '../lib/parser.js';
import { getProcessor, loadProcessorsConfig } from '../lib/config.js';
import { frontmatterToTurtle } from '../lib/reify.js';
import { Parser as N3Parser, Store } from 'n3';
import yaml from 'js-yaml';
import { convert, resolveFormat } from '../lib/convert.js';
import { writeOutput, resolveEncoding }   from '../lib/encoding.js';
import { fetchDatabook, parseSourceRef, loadRegistry } from '../lib/fetchDatabook.js';

// Canonical processor IRIs — used by single-op mode (no explicit build:processorRef on stage)
const CANONICAL_PROCESSOR_IRIS = {
  'sparql':          'https://w3id.org/databook/plugins/core#jena-sparql',
  'shacl':           'https://w3id.org/databook/plugins/core#jena-shacl',
  'xslt':            'https://w3id.org/databook/plugins/core#saxon-xslt',
  'xquery':          'https://w3id.org/databook/plugins/core#saxon-xquery',
  'sparql-anything': 'https://w3id.org/databook/plugins/core#sparql-anything',
};


const BUILD = 'https://w3id.org/databook/ns#';
const DCT   = 'http://purl.org/dc/terms/';

// Core processor IRIs (as declared in process DataBooks)
const PROCESSOR_TYPES = {
  sparql:             'sparql',
  shacl:              'shacl',
  xslt:               'xslt',
  xquery:             'xquery',
  'sparql-anything':  'sparql-anything',
};


/**
 * Resolve a ref that may be a local fragment, file path, HTTP IRI, or @alias.
 * Returns the payload string (block content) synchronously where possible,
 * or a Promise<string> for remote refs. Always await the result.
 *
 * @param {string} ref       - fragment ref, file path, https://, or @alias
 * @param {object|null} db   - current DataBook (for local #fragment refs)
 * @returns {Promise<string>}
 */
async function resolvePayloadRef(ref, db = null) {
  if (!ref) return null;

  // @alias or HTTP IRI — remote fetch
  if (ref.startsWith('@') || ref.startsWith('https://') || ref.startsWith('http://')) {
    const result = await fetchDatabook(ref);
    if (!result.block) {
      throw new Error(`no block found at remote ref: ${ref}`);
    }
    const { blockPayload } = await import('../lib/parser.js');
    return blockPayload(result.block);
  }

  // Local file or fragment — delegate to existing fetchFragmentBlock
  const { fetchFragmentBlock, blockPayload } = await import('../lib/parser.js');
  const { block } = fetchFragmentBlock(ref, db);
  return blockPayload(block);
}

/**
 * Run the `databook process` command.
 */
export async function runProcess(sourceArg, opts) {
  const {
    process: processFile,
    pipeline: pipelineId,
    sparql: sparqlRef,
    shapes: shapesRef,
    xslt:   xsltRef,
    xquery: xqueryRef,
    params: paramsSource,
    interpolate = false,
    sourceBlock,
    config: configFile,
    set: setOverrides = [],
    output: outputPath,
    encoding: encOpt,       // ← FIX: was missing from destructure
    force = false,
    dryRun = false,
    verbose = false,
    quiet = false,
  } = opts;

  // ── Resolve encoding ────────────────────────────────────────────────────
  // FIX: enc was used in writeOutput calls below but never declared.
  let enc;
  try { enc = resolveEncoding(encOpt); } catch (e) { die(e.message); }

  // ── Mode validation ────────────────────────────────────────────────────
  const singleOpFlags = [sparqlRef, shapesRef, xsltRef, xqueryRef].filter(Boolean);
  if (singleOpFlags.length > 0 && processFile) {
    die('E_MODE_CONFLICT: single-operation flags (--sparql/--shapes/--xslt/--xquery) cannot be combined with -P without --pipeline', 2);
  }

  // ── Load source DataBook ───────────────────────────────────────────────
  let sourceDb = null;
  if (sourceArg && sourceArg !== '-') {
    try {
      sourceDb = loadDataBookFile(sourceArg);
    } catch (e) {
      die(e.message, 2);
    }
  }

  // ── Materialise temp files for non-RDF source blocks ──────────────────
  const tempDir = mkdtempSync(join(tmpdir(), 'databook-proc-'));
  const tempFiles = {};
  if (sourceDb) {
    for (const block of sourceDb.blocks) {
      if (!RDF_LABELS.has(block.label) && block.id) {
        const ext = block.label.split('-')[0] || 'txt';
        const tmpPath = join(tempDir, `${block.id}.${ext}`);
        writeFileSync(tmpPath, blockPayload(block), 'utf8');
        tempFiles[block.id] = tmpPath;
        if (verbose) log(`[process] Materialised block '${block.id}' → ${tmpPath}`);
      }
    }
  }

  // ── Resolve parameters ─────────────────────────────────────────────────
  let params = null;
  if (paramsSource) {
    params = loadParams(paramsSource, sourceDb);
  }

  // ── Build stage list ───────────────────────────────────────────────────
  let stages;
  if (processFile) {
    stages = await loadPipelineStages(processFile, pipelineId, sourceDb, verbose);
  } else if (singleOpFlags.length > 0) {
    stages = buildSingleOpStage(sparqlRef, shapesRef, xsltRef, xqueryRef, sourceDb);
  } else {
    die('must specify -P <process-databook> or one of --sparql/--shapes/--xslt/--xquery', 2);
  }

  if (dryRun) {
    log('\n[process] Execution plan:');
    for (let i = 0; i < stages.length; i++) {
      log(`  Stage ${i + 1}: ${stages[i].title ?? stages[i].id}`);
      log(`    Processor: ${stages[i].processorType}`);
      log(`    Input:     ${stages[i].inputBlock ?? '(default graph)'}`);
      log(`    Output:    ${stages[i].outputBlock}`);
      if (stages[i].dependsOn?.length > 0) log(`    Depends:   ${stages[i].dependsOn.join(', ')}`);
    }
    return;
  }

  // ── Execute stages ─────────────────────────────────────────────────────
  const stageOutputs = {};  // outputBlock → RDF turtle content

  for (const stage of stages) {
    if (verbose) log(`\n[process] Executing stage: ${stage.title ?? stage.id}`);

    // Resolve input content
    const inputContent = resolveStageInput(stage, sourceDb, stageOutputs, processFile ? loadDataBookFile(processFile) : null);

    // Resolve payload (query, shapes, stylesheet, etc.)
    const payload = await resolvePayload(stage, processFile, sourceDb);
    if (!payload && ['sparql', 'shacl', 'xslt', 'xquery'].includes(stage.processorType)) {
      die(`E_PAYLOAD_NOT_FOUND: no payload resolved for stage '${stage.id}'`, 1);
    }

    // Apply params injection
    let finalPayload = payload;
    if (params && finalPayload) {
      finalPayload = injectParams(finalPayload, params, stage.processorType, interpolate || stage.interpolate);
    }

    // Inject temp file paths if requested
    if (stage.injectTempPaths && params == null) {
      finalPayload = interpolateTemplates(finalPayload, tempFiles);
    }

    // Execute
    try {
      const output = await executeStage(stage, inputContent, finalPayload, tempDir, verbose);
      stageOutputs[stage.outputBlock] = output;
      if (verbose) log(`[process] Stage complete → block '${stage.outputBlock}'`);
    } catch (e) {
      process.stderr.write(`error: stage '${stage.id}' failed: ${e.message}\n`);
      if (!quiet) process.stderr.write(`[process] Temp files retained for debugging: ${tempDir}\n`);
      process.exit(1);
    }
  }

  // ── Apply --to conversion if requested ────────────────────────────────
  // Convert every stage output block to the requested format before assembly.
  // stage.outputType carries the current label (e.g. 'turtle', 'json') which
  // is exactly the inputLabel that convert() needs. Mutating stage.outputType
  // here causes assembleOutputDataBook to write the correct fence label.
  if (opts.to) {
    let targetFmt;
    try { targetFmt = resolveFormat(opts.to); } catch (e) { die(e.message); }
    for (const stage of stages) {
      const content = stageOutputs[stage.outputBlock];
      if (content == null) continue;
      const inputLabel = stage.outputType ?? 'turtle';
      try {
        const result = await convert(content, inputLabel, targetFmt, { tempDir });
        stageOutputs[stage.outputBlock] = result.content;
        stage.outputType = result.label;   // update fence label for assembly
        if (result.lossy && !quiet) {
          process.stderr.write(
            `warn: --to '${targetFmt}' conversion of block '${stage.outputBlock}' is lossy\n`
          );
        }
        if (verbose) log(`[process] Converted '${stage.outputBlock}': ${inputLabel} → ${result.label}`);
      } catch (e) {
        // Non-fatal: warn and keep the original content
        process.stderr.write(
          `warn: --to conversion failed for block '${stage.outputBlock}': ${e.message}\n`
        );
      }
    }
  }

  // ── Assemble output DataBook ───────────────────────────────────────────
  const outputDb = assembleOutputDataBook(stages, stageOutputs, sourceDb, processFile, opts);
  const outputContent = outputDb;

  // ── Write output ───────────────────────────────────────────────────────
  const outPath = outputPath ?? inferOutputPath(sourceArg);
  if (outPath && outPath !== '-') {
    writeOutput(outPath, outputContent, enc);
    if (verbose) log(`\n[process] Output written to: ${outPath}`);
  } else {
    writeOutput(null, outputContent, enc);
  }
}

// ─── Pipeline stage loading ────────────────────────────────────────────────

async function loadPipelineStages(processFile, pipelineId, sourceDb, verbose) {
  const processDb = loadDataBookFile(processFile);

  // Find the processor-registry block
  const catalogueBlock = processDb.blocks.find(b =>
    b.label === 'processor-registry' || b.label === 'manifest'
  );
  if (!catalogueBlock) die('E_DAG_MISSING_STAGE: no processor-registry block found in process DataBook', 2);

  const turtle = blockPayload(catalogueBlock);

  // Parse Turtle into N3 store
  const store = await parseTurtleToStore(turtle);

  // Extract stages
  const stageIris = getSubjectsOfType(store, `${BUILD}Stage`);
  const targetIris = getSubjectsOfType(store, `${BUILD}Target`);

  if (stageIris.length === 0) die('E_DAG_MISSING_STAGE: no build:Stage declarations found', 2);
  if (targetIris.length === 0) die('E_DAG_MISSING_STAGE: no build:Target declarations found', 2);

  // Resolve pipeline root
  let rootIri;
  if (targetIris.length === 1) {
    rootIri = targetIris[0];
  } else if (pipelineId) {
    rootIri = targetIris.find(t => t === pipelineId || t.endsWith(`#${pipelineId}`));
    if (!rootIri) die(`E_DAG_AMBIGUOUS_ROOT: no build:Target with id '${pipelineId}'`, 2);
  } else {
    die(`E_DAG_AMBIGUOUS_ROOT: multiple build:Target roots; use --pipeline to specify one`, 2);
  }

  // Build stage objects from store
  const allStageIris = [...stageIris];
  const stageMap = {};

  const targetOutputBlock = getOneObject(store, rootIri, `${BUILD}outputBlock`) ?? 'pipeline-output';

  for (const iri of allStageIris) {
    const stage = {
      id:             iri,
      title:          getOneObject(store, iri, `${DCT}title`) ?? iri.split('#').pop(),
      processorType:  resolveProcessorType(store, iri),
      payloadRef:     getOneObject(store, iri, `${BUILD}payloadRef`),
      shapesRef:      getOneObject(store, iri, `${BUILD}shapesRef`),
      paramsRef:      getOneObject(store, iri, `${BUILD}paramsRef`),
      inputBlock:     getOneObject(store, iri, `${BUILD}inputBlock`),
      selfBlock:      getOneObject(store, iri, `${BUILD}selfBlock`),
      outputBlock:    getOneObject(store, iri, `${BUILD}outputBlock`) ?? iri.split('#').pop(),
      outputType:     getOneObject(store, iri, `${BUILD}outputType`) ?? 'turtle',
      order:          parseInt(getOneObject(store, iri, `${BUILD}order`) ?? '0', 10),
      dependsOn:      getAllObjects(store, iri, `${BUILD}dependsOn`),
      interpolate:    getOneObject(store, iri, `${BUILD}interpolate`) === 'true',
      injectTempPaths: getOneObject(store, iri, `${BUILD}injectTempPaths`) === 'true',
      shapesGraph:    getOneObject(store, iri, `${BUILD}shapesGraph`),
    };
    stageMap[iri] = stage;
  }

  // Topological sort
  return topologicalSort(stageMap, rootIri, targetIris);
}

function buildSingleOpStage(sparqlRef, shapesRef, xsltRef, xqueryRef, sourceDb) {
  let processorType, payloadRef;
  if (sparqlRef)  { processorType = 'sparql'; payloadRef = sparqlRef; }
  else if (shapesRef) { processorType = 'shacl'; payloadRef = shapesRef; }
  else if (xsltRef)   { processorType = 'xslt';  payloadRef = xsltRef; }
  else if (xqueryRef) { processorType = 'xquery'; payloadRef = xqueryRef; }

  const primaryBlock = sourceDb?.blocks.find(b => b.role === 'primary' || RDF_LABELS.has(b.label));

  return [{
    id:            'single-op',
    title:         `Single ${processorType} operation`,
    processorType,
    payloadRef,
    inputBlock:    primaryBlock?.id ?? null,
    outputBlock:   'output',
    outputType:    processorType === 'shacl' ? 'turtle' : 'turtle',
    order:         1,
    dependsOn:     [],
    interpolate:   false,
  }];
}

// ─── DAG topological sort ──────────────────────────────────────────────────

function topologicalSort(stageMap, rootIri, targetIris = []) {
  // Kahn's algorithm
  const inDegree = {};
  const adjacency = {};  // id → set of dependents

  for (const [id, stage] of Object.entries(stageMap)) {
    inDegree[id] = inDegree[id] ?? 0;
    adjacency[id] = adjacency[id] ?? new Set();
    for (const dep of stage.dependsOn) {
      if (!stageMap[dep]) {
        if (targetIris.includes(dep)) continue;
        die(`E_DAG_MISSING_STAGE: build:dependsOn references undeclared stage <${dep}>`, 2);
      }
      adjacency[dep] = adjacency[dep] ?? new Set();
      adjacency[dep].add(id);
      inDegree[id] = (inDegree[id] ?? 0) + 1;
    }
  }

  const queue = Object.entries(inDegree)
    .filter(([, d]) => d === 0)
    .map(([id]) => stageMap[id])
    .sort((a, b) => a.order - b.order);

  const sorted = [];
  const visited = new Set();

  while (queue.length > 0) {
    const stage = queue.shift();
    if (visited.has(stage.id)) continue;
    visited.add(stage.id);
    sorted.push(stage);

    const dependents = [...(adjacency[stage.id] ?? [])].map(id => stageMap[id]);
    for (const dep of dependents) {
      inDegree[dep.id]--;
      if (inDegree[dep.id] === 0) {
        const insertPos = queue.findIndex(s => s.order > dep.order);
        if (insertPos < 0) queue.push(dep);
        else queue.splice(insertPos, 0, dep);
      }
    }
  }

  if (sorted.length !== Object.keys(stageMap).length) {
    die('E_DAG_CYCLE: cycle detected in build:dependsOn graph', 2);
  }

  return sorted;
}

// ─── Stage execution ───────────────────────────────────────────────────────

async function executeStage(stage, inputContent, payload, tempDir, verbose) {
  const processorIri = stage.processorIri
    ?? CANONICAL_PROCESSOR_IRIS[stage.processorType]
    ?? null;
  const config = processorIri ? getProcessor(processorIri) : null;

  switch (stage.processorType) {
    case 'sparql':          return executeJenaSparql(stage, inputContent, payload, config, tempDir, verbose);
    case 'shacl':           return executeJenaShacl(stage, inputContent, payload, config, tempDir, verbose);
    case 'xslt':            return executeSaxon(stage, inputContent, payload, config, tempDir, verbose, 'xslt');
    case 'xquery':          return executeSaxon(stage, inputContent, payload, config, tempDir, verbose, 'xquery');
    case 'sparql-anything': return executeSparqlAnything(stage, inputContent, payload, config, tempDir, verbose);
    default:
      throw new Error(`E_PROC_NOT_CONFIGURED: unknown processorType '${stage.processorType}'`);
  }
}


// Normalise a filesystem path for use in Jena CLI arguments.
// Jena parses --data= and --shapes= values as file: IRIs; backslashes
// are invalid in IRIs (RFC 3986), so convert to forward slashes on Windows.
function toJenaPath(p) {
  return p.replace(/\\/g, '/');
}

async function executeJenaSparql(stage, inputContent, query, config, tempDir, verbose) {
  if (!config?.command) {
    throw new Error(
      'E_PROC_NOT_CONFIGURED: no processors.toml entry for Jena SPARQL.\n' +
      '  Add to .databook/processors.toml:\n' +
      '  [processor."https://w3id.org/databook/plugins/core#jena-sparql"]\n' +
      '  command   = "C:/path/to/apache-jena-6.0.0/bin/sparql.bat"\n' +
      '  version   = "6.0.0"\n' +
      '  jvm_flags = "-Xmx4g"'
    );
  }

  const inputFile  = join(tempDir, `${stage.id}-input.ttl`);
  const queryFile  = join(tempDir, `${stage.id}-query.sparql`);
  writeFileSync(inputFile, inputContent ?? '', 'utf8');
  writeFileSync(queryFile, query, 'utf8');

  const queryType = detectQueryTypeSimple(query);
  const resultFmt = queryType === 'CONSTRUCT' ? 'turtle'
                  : queryType === 'SELECT'    ? 'json'
                  : 'turtle';

  const args = [
    `--data=${toJenaPath(inputFile)}`,
    `--query=${toJenaPath(queryFile)}`,
    `--results=${resultFmt}`,
  ];

  if (verbose) log(`[process]   Jena sparql: ${config.command} ${args.join(' ')}`);

  return spawnCapture(config.command, args, config);
}

async function executeJenaShacl(stage, inputContent, shapes, config, tempDir, verbose) {
  if (!config?.command) {
    throw new Error(
      'E_PROC_NOT_CONFIGURED: no processors.toml entry for Jena SHACL.\n' +
      '  Add to .databook/processors.toml:\n' +
      '  [processor."https://w3id.org/databook/plugins/core#jena-shacl"]\n' +
      '  command   = "C:/path/to/apache-jena-6.0.0/bin/shacl.bat"\n' +
      '  version   = "6.0.0"\n' +
      '  jvm_flags = "-Xmx4g"'
    );
  }

  const inputFile  = join(tempDir, `${stage.id}-input.ttl`);
  const shapesFile = join(tempDir, `${stage.id}-shapes.ttl`);
  writeFileSync(inputFile, inputContent ?? '', 'utf8');
  writeFileSync(shapesFile, shapes, 'utf8');

  const args = ['validate', `--shapes=${toJenaPath(shapesFile)}`, `--data=${toJenaPath(inputFile)}`];

  if (verbose) log(`[process]   Jena shacl: ${config.command} ${args.join(' ')}`);

  return spawnCapture(config.command, args, config);
}

async function executeSaxon(stage, inputContent, payload, config, tempDir, verbose, mode) {
  if (!config?.jar) {
    throw new Error(
      `E_PROC_NOT_CONFIGURED: no processors.toml entry for Saxon ${mode}.\n` +
      '  Add to .databook/processors.toml:\n' +
      '  [processor."https://w3id.org/databook/plugins/core#saxon-xslt"]\n' +
      '  jar       = "C:/path/to/saxon-he-12.jar"\n' +
      '  version   = "12.0"\n' +
      '  jvm_flags = "-Xmx2g"'
    );
  }

  const inputFile   = join(tempDir, `${stage.id}-input.xml`);
  const payloadFile = join(tempDir, `${stage.id}-payload.${mode === 'xslt' ? 'xsl' : 'xq'}`);
  const outputFile  = join(tempDir, `${stage.id}-output.${stage.outputType ?? 'xml'}`);
  writeFileSync(inputFile, inputContent ?? '', 'utf8');
  writeFileSync(payloadFile, payload, 'utf8');

  const jvmFlags = (config.jvm_flags ?? '-Xmx2g').split(/\s+/).filter(Boolean);
  const saxonArgs = mode === 'xslt'
    ? ['-jar', config.jar, `-s:${inputFile}`, `-xsl:${payloadFile}`, `-o:${outputFile}`]
    : ['-jar', config.jar, `-q:${payloadFile}`, `-s:${inputFile}`, `-o:${outputFile}`];
  const args = [...jvmFlags, ...saxonArgs];

  if (verbose) log(`[process]   Saxon: java ${args.join(' ')}`);

  await spawnCapture('java', args, {});
  return readFileSync(outputFile, 'utf8');
}

async function executeSparqlAnything(stage, inputContent, query, config, tempDir, verbose) {
  if (!config) throw new Error(`E_PROC_NOT_CONFIGURED: no processors.toml entry for SPARQL Anything`);

  if (config.mode === 'endpoint') {
    const { sparqlQuery } = await import('../lib/gsp.js');
    const result = await sparqlQuery(config.endpoint, query, 'text/turtle', null);
    if (!result.ok) throw new Error(`E_PROC_SA_UNREACHABLE: SA endpoint returned ${result.status}`);
    return result.body;
  } else {
    const queryFile = join(tempDir, `${stage.id}-sa-query.sparql`);
    writeFileSync(queryFile, query, 'utf8');
    const jvmFlags = (config.jvm_flags ?? '-Xmx4g').split(/\s+/).filter(Boolean);
    const args = [...jvmFlags, '-jar', config.jar, '-q', queryFile, '-f', 'Turtle'];
    if (verbose) log(`[process]   SPARQL Anything: java ${args.join(' ')}`);
    return spawnCapture('java', args, {});
  }
}

// ─── Output DataBook assembly ──────────────────────────────────────────────

function assembleOutputDataBook(stages, stageOutputs, sourceDb, processFile, opts) {
  const now = new Date().toISOString();
  const sourceFm = sourceDb?.frontmatter ?? {};

  const inputs = [];
  if (sourceDb?.frontmatter?.id) {
    inputs.push({ iri: sourceDb.frontmatter.id, role: 'primary', description: 'Source DataBook' });
  }
  if (processFile) {
    inputs.push({ iri: processFile, role: 'context', description: 'Process DataBook' });
  }

  const frontmatter = {
    id:      opts.set?.find(s => s.startsWith('id='))?.split('=')[1] ?? `${sourceFm.id ?? 'urn:output'}-output`,
    title:   `Output: ${sourceFm.title ?? 'DataBook process output'}`,
    type:    'databook',
    version: '1.0.0',
    created: now.split('T')[0],
    process: {
      transformer:      'databook process',
      transformer_type: 'composite',
      inputs,
      timestamp:        now,
    },
  };

  const fmYaml = yaml.dump(frontmatter, { lineWidth: 100 });
  const lines = [
    '<script language="application/yaml">',
    '',
    '---',
    fmYaml.trimEnd(),
    '---',
    '',
    '</script>',
    '',
    '# Process Output',
    '',
    `Generated by \`databook process\` at ${now}.`,
    '',
  ];

  for (const stage of stages) {
    const content = stageOutputs[stage.outputBlock];
    if (content != null) {
      const label = stage.outputType ?? 'turtle';
      lines.push(`## ${stage.title ?? stage.outputBlock}`);
      lines.push('');
      lines.push(`\`\`\`${label}`);
      lines.push(`<!-- databook:id: ${stage.outputBlock} -->`);
      lines.push(content.trim());
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ─── Input resolution ──────────────────────────────────────────────────────

function resolveStageInput(stage, sourceDb, stageOutputs, processDb) {
  // 1. Prior stage output (via dependsOn)
  for (const dep of (stage.dependsOn ?? [])) {
    const depStage = dep.split('#').pop();
    if (stageOutputs[depStage]) return stageOutputs[depStage];
  }

  // 2. build:inputBlock from source DataBook
  if (stage.inputBlock && sourceDb) {
    const block = sourceDb.blocks.find(b => b.id === stage.inputBlock);
    if (block) return blockPayload(block);
  }

  // 3. build:selfBlock from process DataBook
  if (stage.selfBlock && processDb) {
    const block = processDb.blocks.find(b => b.id === stage.selfBlock);
    if (block) return blockPayload(block);
  }

  // 4. Default: all RDF blocks merged
  if (sourceDb) {
    return sourceDb.blocks
      .filter(b => RDF_LABELS.has(b.label))
      .map(b => blockPayload(b))
      .join('\n');
  }

  return '';
}

async function resolvePayload(stage, processFileP, sourceDb) {
  if (!stage.payloadRef && !stage.shapesRef) return null;

  const ref = stage.shapesRef ?? stage.payloadRef;

  const cleanRef = ref.startsWith('<') ? ref.slice(1, -1) : ref;

  const contextDb = processFileP ? loadDataBookFile(processFileP) : null;

  try {
    const { block } = fetchFragmentBlock(cleanRef, contextDb);
    return blockPayload(block);
  } catch (e) {
    throw new Error(`E_PAYLOAD_NOT_FOUND: ${e.message}`);
  }
}

// ─── Parameter injection ───────────────────────────────────────────────────

function loadParams(paramsSource, db) {
  if (paramsSource.startsWith('{')) {
    return JSON.parse(paramsSource);
  }
  if (paramsSource.includes('#')) {
    const { block } = fetchFragmentBlock(paramsSource, db);
    const content = blockPayload(block);
    return block.label === 'yaml' ? yaml.load(content) : JSON.parse(content);
  }
  const content = readFileSync(paramsSource, 'utf8');
  return paramsSource.endsWith('.yaml') || paramsSource.endsWith('.yml')
    ? yaml.load(content)
    : JSON.parse(content);
}

function injectParams(payload, params, processorType, doInterpolate) {
  let result = payload;

  if (doInterpolate) result = interpolateTemplates(result, params);

  if (result.includes('<<db:inject>>')) {
    const valuesClause = buildValuesClause(params);
    result = result.replace(/<<db:inject>>/g, valuesClause);
  }

  return result;
}

function interpolateTemplates(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function buildValuesClause(params) {
  const entries = Object.entries(params);
  if (entries.length === 0) return '';

  const rows = entries.map(([, v]) => {
    if (Array.isArray(v)) {
      return v.map(x => formatSparqlValue(x)).join(' ');
    }
    return formatSparqlValue(v);
  });
  return rows.join(' ');
}

function formatSparqlValue(v) {
  if (typeof v === 'string' && (v.startsWith('<') || v.includes(':'))) return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return `"${v}"^^xsd:boolean`;
  return `"${v}"`;
}

// ─── N3 store helpers ──────────────────────────────────────────────────────

async function parseTurtleToStore(turtle) {
  return new Promise((resolve, reject) => {
    const store = new Store();
    const parser = new N3Parser({ format: 'Turtle' });
    parser.parse(turtle, (err, quad) => {
      if (err) reject(err);
      else if (quad) store.add(quad);
      else resolve(store);
    });
  });
}

function getSubjectsOfType(store, typeIri) {
  return store
    .getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
              { termType: 'NamedNode', value: typeIri }, null)
    .map(q => q.subject.value);
}

function getOneObject(store, subjectIri, predicateIri) {
  const quads = store.getQuads(
    { termType: 'NamedNode', value: subjectIri },
    { termType: 'NamedNode', value: predicateIri },
    null, null
  );
  return quads[0]?.object?.value ?? null;
}

function getAllObjects(store, subjectIri, predicateIri) {
  return store
    .getQuads(
      { termType: 'NamedNode', value: subjectIri },
      { termType: 'NamedNode', value: predicateIri },
      null, null
    )
    .map(q => q.object.value);
}

function resolveProcessorType(store, stageIri) {
  const processorRefIri = getOneObject(store, stageIri, `${BUILD}processorRef`);
  if (!processorRefIri) return 'sparql';  // default
  const typeStr = getOneObject(store, processorRefIri, `${BUILD}processorType`);
  return typeStr ?? 'sparql';
}

// ─── Child process ─────────────────────────────────────────────────────────

function spawnCapture(command, args, config) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    if (config?.jvm_flags) env.JVM_ARGS = config.jvm_flags;

    const isWindows = process.platform === 'win32';
    let resolvedCmd = command;
    if (isWindows && !command.match(/\.(bat|cmd|exe|com)$/i)) {
      for (const ext of ['.bat', '.cmd', '.exe']) {
        try { accessSync(command + ext); resolvedCmd = command + ext; break; } catch { /* try next */ }
      }
    }
    const isBat = isWindows && resolvedCmd.match(/\.(bat|cmd)$/i);
    const spawnCmd  = isBat ? 'cmd.exe' : resolvedCmd;
    const spawnArgs = isBat ? ['/c', resolvedCmd, ...args] : args;

    const child = spawn(spawnCmd, spawnArgs, { env });
    const stdout = [], stderr = [];

    child.stdout.on('data', d => stdout.push(d));
    child.stderr.on('data', d => stderr.push(d));

    child.on('close', code => {
      if (code !== 0) {
        const errText = Buffer.concat(stderr).toString();
        reject(new Error(`E_PROC_FAILED: ${command} exited ${code}\n${errText}`));
      } else {
        resolve(Buffer.concat(stdout).toString());
      }
    });

    child.on('error', err => {
      if (err.code === 'ENOENT') {
        reject(new Error(`E_PROC_NOT_FOUND: executable not found: ${command}`));
      } else {
        reject(err);
      }
    });
  });
}

// ─── Utilities ─────────────────────────────────────────────────────────────

function detectQueryTypeSimple(sparql) {
  const s = sparql.replace(/#[^\n]*/g, '').trimStart().toUpperCase();
  const m = s.match(/^(PREFIX\s+\S+\s+<[^>]*>\s*)*(SELECT|CONSTRUCT|ASK|DESCRIBE|INSERT|DELETE)/);
  return m?.[2] ?? 'CONSTRUCT';
}

function inferOutputPath(sourceArg) {
  if (!sourceArg || sourceArg === '-') return null;
  return sourceArg.replace(/\.databook\.md$/, '-output.databook.md')
                  .replace(/\.md$/, '-output.md');
}

function log(msg)  { process.stderr.write(msg + '\n'); }
function die(msg, code = 2) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}
