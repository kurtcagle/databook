/**
 * databook extract — emit the raw content of a named block to stdout or a file.
 *
 * Primary use cases:
 *   Pipe Turtle to riot/arq/shacl validate:
 *     databook extract source.databook.md#primary-graph | riot --syntax=turtle -
 *     databook extract source.databook.md --block-id sensor-construct | arq --query=-
 *
 *   Save a block to a standalone file:
 *     databook extract source.databook.md --block-id primary-graph -o graph.ttl
 *     databook extract source.databook.md --block-id pipeline-manifest -o pipeline.ttl
 *
 *   Feed a SPARQL block to curl:
 *     databook extract queries.databook.md#all-sensors \
 *       | curl -X POST http://localhost:3030/ds/sparql \
 *              -H 'Content-Type: application/sparql-query' \
 *              --data-binary @-
 *
 *   Fence-wrapped for copy-paste:
 *     databook extract source.databook.md --block-id primary-graph --fence
 *
 * Fragment syntax (shorthand for --block-id):
 *   databook extract source.databook.md#primary-graph
 *   databook extract source.databook.md#primary-graph -o graph.ttl
 */

import { readFileSync } from 'fs';
import { writeOutput, resolveEncoding } from '../lib/encoding.js';
import { resolve, extname } from 'path';
import { loadDataBookFile, parseDataBook, blockPayload } from '../lib/parser.js';
import { convert, resolveFormat } from '../lib/convert.js';

// Map fence labels to conventional file extensions
const LABEL_EXTENSIONS = {
  'turtle':          '.ttl',
  'turtle12':        '.ttl',
  'trig':            '.trig',
  'json-ld':         '.jsonld',
  'shacl':           '.shacl.ttl',
  'sparql':          '.sparql',
  'sparql-update':   '.ru',
  'sparql-results':  '.srj',
  'manifest':        '.ttl',
  'processor-registry': '.ttl',
  'transformer-library': '.ttl',
  'json':            '.json',
  'yaml':            '.yaml',
  'xml':             '.xml',
  'csv':             '.csv',
  'xslt':            '.xsl',
  'xquery':          '.xq',
  'prompt':          '.txt',
};

// MIME types for --type output
const LABEL_MIMETYPES = {
  'turtle':          'text/turtle',
  'turtle12':        'text/turtle',
  'trig':            'application/trig',
  'json-ld':         'application/ld+json',
  'shacl':           'text/turtle',
  'sparql':          'application/sparql-query',
  'sparql-update':   'application/sparql-update',
  'sparql-results':  'application/sparql-results+json',
  'json':            'application/json',
  'yaml':            'application/yaml',
  'xml':             'application/xml',
  'csv':             'text/csv',
};

/**
 * Run `databook extract`.
 * @param {string} inputArg  File path, optionally with #fragment suffix
 * @param {object} opts
 * @param {string|null}  opts.blockId        Block id (overridden by fragment syntax)
 * @param {string|null}  opts.output         Output file path ('-' = stdout, '.' = auto-name)
 * @param {boolean}      opts.withMetadata   Include <!-- databook:* --> comment lines
 * @param {boolean}      opts.fence          Wrap output in fence markers
 * @param {boolean}      opts.type           Print MIME type to stderr
 * @param {boolean}      opts.list           List all block ids and labels, then exit
 * @param {boolean}      opts.quiet          Suppress info messages
 */
export async function runExtract(inputArg, opts) {
  const {
    blockId:      blockIdOpt,
    output:       outputArg,
    withMetadata = false,
    fence        = false,
    type:        showType = false,
    list:        listMode = false,
    quiet        = false,
    encoding:    encOpt,
  } = opts;
  let enc;
  try { enc = resolveEncoding(encOpt); } catch (e) { die(e.message); }

  // ── Parse fragment syntax: file.md#block-id ────────────────────────────────
  let filePath = inputArg;
  let blockId  = blockIdOpt ?? null;

  if (inputArg) {
    // Only split on # that isn't part of an IRI scheme (http/https/urn)
    const hashIdx = inputArg.lastIndexOf('#');
    if (hashIdx > 0 && !inputArg.slice(0, hashIdx).match(/^https?:|^urn:/)) {
      filePath = inputArg.slice(0, hashIdx);
      blockId  = inputArg.slice(hashIdx + 1) || blockId;
    }
  }

  // ── Read input ─────────────────────────────────────────────────────────────
  let db;
  if (!filePath || filePath === '-') {
    if (process.stdin.isTTY && !filePath) {
      die('no input file specified. Usage: databook extract <file>[#block-id]');
    }
    const content = readFileSync(0, 'utf8');
    db = parseDataBook(content, null);
    if (!db) die('input is not a valid DataBook (no frontmatter found)');
  } else {
    try {
      db = loadDataBookFile(resolve(filePath));
    } catch (e) {
      die(e.message);
    }
  }

  // ── List mode: print all block ids ────────────────────────────────────────
  if (listMode) {
    const namedBlocks = db.blocks.filter(b => b.id);
    if (namedBlocks.length === 0) {
      process.stderr.write('warn: no named blocks found (no <!-- databook:id: --> comments)\n');
      process.exit(0);
    }
    for (const b of namedBlocks) {
      const ext  = LABEL_EXTENSIONS[b.label] ?? '';
      const role = b.role ? `  [${b.role}]` : '';
      process.stdout.write(`${b.id}	${b.label}  →  ${ext || "(no ext)"}${role}
`);
    }
    return;
  }

  // ── Block id required for extract ─────────────────────────────────────────
  if (!blockId) {
    // If there's only one named block, use it implicitly
    const namedBlocks = db.blocks.filter(b => b.id);
    if (namedBlocks.length === 1) {
      blockId = namedBlocks[0].id;
      if (!quiet) {
        process.stderr.write(
          `info: single named block — extracting '${blockId}'\n`
        );
      }
    } else {
      const ids = namedBlocks.map(b => b.id).join(', ');
      die(
        `--block-id is required when document has multiple named blocks.\n` +
        `  Available: ${ids || '(none)'}\n` +
        `  Or use fragment syntax: databook extract ${filePath}#<block-id>`
      );
    }
  }

  // ── Find block ─────────────────────────────────────────────────────────────
  const block = db.blocks.find(b => b.id === blockId);
  if (!block) {
    const available = db.blocks.filter(b => b.id).map(b => b.id);
    die(
      `no block with id '${blockId}'\n` +
      `  Available block ids: ${available.join(', ') || '(none)'}`
    );
  }

  // ── Extract content ────────────────────────────────────────────────────────
  const content = withMetadata ? block.content : blockPayload(block);

  // ── Info to stderr ─────────────────────────────────────────────────────────
  if (!quiet) {
    const mime = LABEL_MIMETYPES[block.label] ?? block.label;
    const ext  = LABEL_EXTENSIONS[block.label] ?? '';
    process.stderr.write(
      `[extract] '${blockId}'  label=${block.label}  mime=${mime}  lines=${block.line_count}\n`
    );
  }
  if (showType) {
    const mime = LABEL_MIMETYPES[block.label];
    if (mime) process.stderr.write(`Content-Type: ${mime}\n`);
  }

  // ── Assemble output ────────────────────────────────────────────────────────
  let content2 = content;
  let outputLabel = block.label;

  // ── Apply --to conversion if requested ────────────────────────────────────
  if (opts.to) {
    let targetFmt;
    try { targetFmt = resolveFormat(opts.to); } catch (e) { die(e.message); }
    const { mkdtempSync } = (await import('fs'));
    const { tmpdir } = (await import('os'));
    const { join } = (await import('path'));
    const tempDir = mkdtempSync(join(tmpdir(), 'databook-conv-'));
    try {
      const result = await convert(content, block.label, targetFmt, { tempDir });
      content2 = result.content;
      outputLabel = result.label;
      if (result.lossy && !quiet) process.stderr.write(`warn: conversion to '${targetFmt}' is lossy\n`);
      if (!quiet) process.stderr.write(`[extract] converted: ${block.label} → ${targetFmt}\n`);
    } catch (e) { die(e.message); }
  }

  let output = content2;
  if (!output.endsWith('\n')) output += '\n';

  if (fence) {
    output = `\`\`\`${block.label}\n` +
             `<!-- databook:id: ${blockId} -->\n` +
             content2.trimEnd() + '\n' +
             '```\n';
  }

  // ── Write output ───────────────────────────────────────────────────────────
  const outTarget = resolveOutputTarget(outputArg, blockId, outputLabel, filePath);

  if (!outTarget || outTarget === '-') {
    writeOutput(null, output, enc);
  } else {
    writeOutput(outTarget, output, enc);
    if (!quiet) process.stderr.write(`[extract] written to: ${outTarget}\n`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve the output file path.
 * '.'  → auto-name from block-id + label extension
 * null → stdout
 * '-'  → stdout
 */
function resolveOutputTarget(outputArg, blockId, label, sourceFilePath) {
  if (!outputArg || outputArg === '-') return null;
  if (outputArg === '.') {
    const ext = LABEL_EXTENSIONS[label] ?? '.txt';
    return `${blockId}${ext}`;
  }
  // If output has no extension, append label-appropriate extension
  if (outputArg && !extname(outputArg)) {
    const ext = LABEL_EXTENSIONS[label] ?? '';
    return outputArg + ext;
  }
  return outputArg;
}

function die(msg, code = 2) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}
