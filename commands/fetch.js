/**
 * databook fetch — retrieve a DataBook document or block from an HTTP URL or registry alias.
 * Spec: https://w3id.org/databook/specs/cli-fetch
 *
 * Sources:
 *   https://example.org/databooks/my-db-v1            Full document fetch
 *   https://example.org/databooks/my-db-v1#block-id   Fragment fetch
 *   @alias                                            Registry alias (processors.toml)
 *   @alias#block-id                                   Registry alias + fragment
 */

import { writeFileSync } from 'fs';
import { basename } from 'path';
import { fetchDatabook, loadRegistry } from '../lib/fetchDatabook.js';
import { blockPayload } from '../lib/parser.js';
import { writeOutput, resolveEncoding } from '../lib/encoding.js';

// MIME type → fence label mapping (for --wrap block label inference)
const MIME_TO_LABEL = {
  'text/turtle':                    'turtle',
  'application/x-turtle':           'turtle',
  'application/trig':               'trig',
  'application/ld+json':            'json-ld',
  'application/sparql-query':       'sparql',
  'application/sparql-update':      'sparql-update',
  'text/shacl':                     'shacl',
};

// Block label → file extension
const LABEL_EXT = {
  turtle: 'ttl', turtle12: 'ttl', trig: 'trig',
  'json-ld': 'jsonld', sparql: 'rq', 'sparql-update': 'ru',
  shacl: 'ttl', prompt: 'txt', json: 'json', yaml: 'yaml',
  xml: 'xml', csv: 'csv', xslt: 'xslt', xquery: 'xq',
};

/**
 * Run the `databook fetch` command.
 * @param {string} source   - URL, fragment IRI, or @alias[#block-id]
 * @param {object} opts
 */
export async function runFetch(source, opts) {
  const {
    out: outPath,
    blockId: blockIdOpt,
    format: formatOpt,
    wrap = false,
    verifyId = false,
    server: serverName,
    auth: authOpt,
    timeout: timeoutOpt,
    noCache = false,
    verbose = false,
    encoding: encOpt,
  } = opts;

  let enc;
  try { enc = resolveEncoding(encOpt); } catch (e) { die(e.message); }

  if (wrap && !blockIdOpt && !source.includes('#') && !source.includes('@')) {
    // --wrap without a block target makes no sense on a full document
    die('--wrap requires a block target (fragment IRI or --block-id)', 2);
  }

  // ── Resolve auth ─────────────────────────────────────────────────────────
  const auth = authOpt ?? process.env.DATABOOK_AUTH ?? null;

  // ── Fetch ─────────────────────────────────────────────────────────────────
  let result;
  result = await fetchDatabook(source, {
    auth,
    blockId:   blockIdOpt ?? null,
    verifyId,
    noCache,
    timeoutMs: timeoutOpt ? parseInt(timeoutOpt, 10) : undefined,
  });

  const { frontmatter, blocks, raw, documentIri, blockId, block } = result;

  if (verbose) {
    process.stderr.write(`[fetch] document: ${documentIri}\n`);
    process.stderr.write(`[fetch] form: ${result.form ?? 'unknown'}\n`);
    if (blockId) process.stderr.write(`[fetch] block: ${blockId}\n`);
  }

  // ── Output: full document ─────────────────────────────────────────────────
  if (!blockId && !block) {
    // Write raw document
    const outFile = outPath ?? inferDocumentPath(documentIri);
    if (verbose) process.stderr.write(`[fetch] writing full document to: ${outFile === '-' ? 'stdout' : outFile}\n`);
    writeOutput(outFile, raw, enc);
    if (outFile !== '-') {
      process.stderr.write(`fetched: ${documentIri} → ${outFile}\n`);
    }
    return;
  }

  // ── Output: single block ──────────────────────────────────────────────────
  if (!block) {
    die(`block '${blockId}' not found in ${documentIri}`, 4);
  }

  const payload = blockPayload(block);

  if (wrap) {
    // Wrap the block in a new DataBook with provenance
    const now   = new Date().toISOString();
    const today = now.slice(0, 10);
    const outputId = `urn:databook:fetched:${documentIri}#${blockId}`;

    const wrapped = [
      '---',
      `id: ${outputId}`,
      `title: "Fetched block: ${blockId} from ${documentIri}"`,
      `type: databook`,
      `version: 1.0.0`,
      `created: ${today}`,
      `process:`,
      `  transformer: "databook fetch"`,
      `  transformer_type: service`,
      `  transformer_iri: https://w3id.org/databook/ns/cli#fetch`,
      `  inputs:`,
      `    - iri: ${documentIri}`,
      `      role: primary`,
      `      description: "Source DataBook"`,
      `  timestamp: ${now}`,
      '---',
      '',
      `## Fetched block: \`${blockId}\``,
      '',
      `Source: <${documentIri}#${blockId}>`,
      '',
      `\`\`\`${block.label}`,
      `<!-- databook:id: ${blockId} -->`,
      payload,
      '```',
      '',
    ].join('\n');

    const outFile = outPath ?? `${blockId}.databook.md`;
    writeOutput(outFile, wrapped, enc);
    if (outFile !== '-') process.stderr.write(`fetched: ${documentIri}#${blockId} → ${outFile}\n`);
    return;
  }

  // Raw block content
  const format   = formatOpt ?? block.label;
  const outFile  = outPath ?? (blockId ? `${blockId}.${LABEL_EXT[format] ?? format}` : '-');
  if (verbose) process.stderr.write(`[fetch] block label: ${block.label}, output format: ${format}\n`);
  writeOutput(outFile, payload, enc);
  if (outFile !== '-') process.stderr.write(`fetched: ${documentIri}#${blockId} → ${outFile}\n`);
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Infer a local filename from a document IRI. */
function inferDocumentPath(iri) {
  // Take the last path segment, ensure .databook.md extension
  const segment = iri.replace(/\/$/, '').split('/').pop() ?? 'fetched';
  if (segment.endsWith('.databook.md')) return segment;
  if (segment.endsWith('.md'))          return segment.replace(/\.md$/, '.databook.md');
  return `${segment}.databook.md`;
}

function die(msg, code = 1) {
  const err = new Error(msg);
  err.exitCode = code;
  throw err;
}
