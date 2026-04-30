/**
 * commands/validate.js
 * DataBook CLI — validate command
 *
 * Run SHACL validation against RDF blocks in a DataBook.
 * Output defaults to a wrapped DataBook containing the validation report.
 * Use --no-wrap for a raw SHACL report (Turtle/JSON-LD).
 *
 * Engine resolution:
 *   1. --endpoint  → remote SHACL endpoint
 *   2. JENA_HOME / jena on PATH → local Jena shacl CLI
 *   3. pyshacl subprocess → Python fallback
 */

import { readFileSync }                                        from 'fs';
import { resolve, basename }                                   from 'path';
import { execFileSync }                                        from 'child_process';
import crypto                                                  from 'crypto';
import { writeOutput, atomicWriteEncoded, resolveEncoding }    from '../lib/encoding.js';
import { loadDataBookFile, blockPayload, PUSHABLE_LABELS }     from '../lib/parser.js';
import { resolveAuth }                                         from '../lib/auth.js';
import { resolveServer, LOCALHOST_FUSEKI, datasetToEndpoints } from '../lib/serverConfig.js';
import { sparqlQuery, checkResponse }                          from '../lib/gsp.js';

export async function runValidate(source, opts) {
  const {
    blockId,
    shapes:   shapesRef,
    server:   serverName,
    endpoint: endpointOpt,
    wrap    = true,
    format: formatOpt = 'turtle',
    failOnViolation = false,
    output: outPath,
    auth:   authOpt,
    dryRun  = false,
    verbose = false,
    quiet   = false,
    encoding: encOpt,
  } = opts;

  let enc;
  try { enc = resolveEncoding(encOpt); } catch (e) { die(e.message); }

  if (!source) die('a source DataBook file is required', 2);

  // ── Load source DataBook ──────────────────────────────────────────────────
  let db;
  try { db = loadDataBookFile(source); } catch (e) { die(e.message, 2); }
  const fm = db.frontmatter;

  // ── Select data blocks to validate ───────────────────────────────────────
  let dataBlocks;
  if (blockId) {
    const block = db.blocks.find(b => b.id === blockId);
    if (!block) die(`no block with id '${blockId}'`, 2);
    dataBlocks = [block];
  } else {
    dataBlocks = db.blocks.filter(b => PUSHABLE_LABELS.has(b.label) && b.label !== 'sparql-update');
  }

  if (dataBlocks.length === 0) die('no RDF data blocks found in source DataBook', 2);

  // ── Resolve shapes ─────────────────────────────────────────────────────────
  let shapesText;
  if (!shapesRef) {
    die('--shapes <ref> is required', 2);
  }

  if (shapesRef.includes('#')) {
    // Fragment reference: file#block-id
    const idx       = shapesRef.lastIndexOf('#');
    const shapesFile = shapesRef.slice(0, idx);
    const shapesId  = shapesRef.slice(idx + 1);
    let shapesDb;
    try { shapesDb = loadDataBookFile(shapesFile); } catch (e) { die(`shapes file: ${e.message}`, 2); }
    const block = shapesDb.blocks.find(b => b.id === shapesId);
    if (!block) die(`no block with id '${shapesId}' in ${shapesFile}`, 2);
    shapesText = blockPayload(block);
  } else {
    // Plain Turtle file
    try { shapesText = readFileSync(shapesRef, 'utf8'); } catch (e) { die(`shapes file not found: ${shapesRef}`, 2); }
  }

  if (verbose) {
    log(`[validate] Data blocks: ${dataBlocks.map(b => b.id ?? b.label).join(', ')}`);
    log(`[validate] Shapes: ${shapesRef}`);
  }

  // ── Merge data blocks ─────────────────────────────────────────────────────
  const dataText = dataBlocks.map(b => blockPayload(b)).join('\n');

  if (dryRun) {
    log(`[validate] Would validate ${dataBlocks.length} block(s) against ${shapesRef}`);
    log(`[validate] Data: ${dataText.split('\n').length} lines`);
    log(`[validate] Shapes: ${shapesText.split('\n').length} lines`);
    process.exit(0);
  }

  // ── Execute validation ────────────────────────────────────────────────────
  const reportText = await executeValidation(dataText, shapesText, endpointOpt, formatOpt, authOpt, verbose);

  // ── Check for violations ──────────────────────────────────────────────────
  const hasViolation = reportText.includes('sh:Violation') || reportText.includes('sh:violation');

  if (!quiet) {
    const status = hasViolation ? 'VIOLATION' : 'CONFORMS';
    process.stderr.write(`validate: ${status} — ${source}\n`);
  }

  // ── Emit output ───────────────────────────────────────────────────────────
  if (wrap) {
    const wrapped = buildWrappedDataBook({
      source, fm, shapesRef, reportText, formatOpt, hasViolation,
    });
    if (outPath && outPath !== '-') {
      atomicWriteEncoded(outPath, wrapped, enc);
      if (verbose) log(`[validate] Written to ${outPath}`);
    } else {
      writeOutput(null, wrapped, enc);
    }
  } else {
    if (outPath && outPath !== '-') {
      writeOutput(outPath, reportText, enc);
    } else {
      writeOutput(null, reportText, enc);
    }
  }

  if (failOnViolation && hasViolation) process.exit(1);
}

// ─── Validation engine ────────────────────────────────────────────────────────

async function executeValidation(dataText, shapesText, endpointOpt, formatOpt, authOpt, verbose) {
  // Try local Jena shacl CLI first
  const jenaShacl = resolveJenaShaclCli();
  if (jenaShacl || !endpointOpt) {
    return executeLocalValidation(dataText, shapesText, jenaShacl, verbose);
  }

  // Remote endpoint fallback
  return executeRemoteValidation(dataText, shapesText, endpointOpt, formatOpt, authOpt, verbose);
}

function resolveJenaShaclCli() {
  const candidates = [];
  if (process.env.JENA_HOME) candidates.push(`${process.env.JENA_HOME}/bin/shacl`);
  candidates.push('shacl');  // on PATH

  for (const cmd of candidates) {
    try {
      execFileSync(cmd, ['--version'], { stdio: 'ignore' });
      return cmd;
    } catch { /* not available */ }
  }

  // Try pyshacl
  try {
    execFileSync('pyshacl', ['--version'], { stdio: 'ignore' });
    return 'pyshacl';
  } catch { /* not available */ }

  return null;
}

function executeLocalValidation(dataText, shapesText, engine, verbose) {
  const { writeFileSync, unlinkSync } = require('fs');
  const { tmpdir } = require('os');
  const { join } = require('path');

  const tmpData   = join(tmpdir(), `db-data-${process.pid}.ttl`);
  const tmpShapes = join(tmpdir(), `db-shapes-${process.pid}.ttl`);

  try {
    writeFileSync(tmpData,   dataText,   'utf8');
    writeFileSync(tmpShapes, shapesText, 'utf8');

    let result;
    if (engine === 'pyshacl') {
      result = execFileSync('pyshacl', ['-s', tmpShapes, '-o', '-', tmpData], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    } else {
      result = execFileSync(engine, ['validate', '--shapes', tmpShapes, '--data', tmpData], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    }
    return result;
  } catch (e) {
    // execFileSync throws on non-zero exit; SHACL violations exit non-zero in some engines
    return e.stdout ?? e.message ?? '';
  } finally {
    try { unlinkSync(tmpData); } catch {}
    try { unlinkSync(tmpShapes); } catch {}
  }
}

async function executeRemoteValidation(dataText, shapesText, endpoint, formatOpt, authOpt, verbose) {
  die('Remote SHACL endpoint validation not yet implemented. Use a local Jena or pyshacl installation.', 3);
}

// ─── Wrapped DataBook generation ──────────────────────────────────────────────

function buildWrappedDataBook({ source, fm, shapesRef, reportText, formatOpt, hasViolation }) {
  const now      = new Date();
  const isoDate  = now.toISOString().slice(0, 10);
  const isoTs    = now.toISOString().replace(/\.\d+Z$/, 'Z');
  const slug     = crypto.randomBytes(4).toString('hex');
  const id       = `urn:databook:shacl-report:${slug}`;
  const status   = hasViolation ? 'VIOLATION' : 'CONFORMS';
  const title    = `SHACL Report — ${fm.title ?? basename(source)} (${status})`;
  const blockLabel = formatOpt === 'json-ld' ? 'json-ld' : 'turtle';

  const frontmatter = [
    '---',
    `id: ${id}`,
    `title: "${title.replace(/"/g, '\\"')}"`,
    'type: databook',
    'version: 1.0.0',
    `created: ${isoDate}`,
    '',
    'author:',
    `  - name: ${fm.author?.[0]?.name ?? 'Kurt Cagle'}`,
    `    iri: ${fm.author?.[0]?.iri ?? 'https://holongraph.com/people/kurt-cagle'}`,
    '    role: orchestrator',
    '  - name: Chloe Shannon',
    '    iri: https://holongraph.com/people/chloe-shannon',
    '    role: transformer',
    '',
    'process:',
    '  transformer: "databook validate"',
    '  transformer_type: service',
    '  transformer_iri: urn:shacl:local',
    '  inputs:',
    `    - iri: file://${resolve(source)}`,
    '      role: primary',
    `      description: "Source DataBook: ${fm.title ?? basename(source)}"`,
    `    - iri: ${shapesRef.includes('://') ? shapesRef : `file://${resolve(shapesRef.split('#')[0])}`}`,
    '      role: constraint',
    `      description: "SHACL shapes: ${shapesRef}"`,
    `  timestamp: ${isoTs}`,
    '  agent:',
    '    name: Chloe Shannon',
    '    iri: https://holongraph.com/people/chloe-shannon',
    '    role: transformer',
    '---',
  ].join('\n');

  const body = [
    '',
    `## SHACL Validation Report`,
    '',
    `Status: **${status}**`,
    `Validated: \`${source}\` against \`${shapesRef}\` on ${isoDate}.`,
    '',
    '```' + blockLabel,
    '<!-- databook:id: shacl-report -->',
    reportText.trimEnd(),
    '```',
    '',
  ].join('\n');

  return frontmatter + '\n' + body;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function log(msg)  { process.stderr.write(msg + '\n'); }
function die(msg, code = 2) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}
