/**
 * commands/shacl2sparql.js
 *
 * databook shacl2sparql — compile SHACL shapes to SPARQL retrieval queries.
 *
 * Reads a SHACL block from a DataBook (or a plain .ttl/.shacl file),
 * generates one SPARQL SELECT and/or CONSTRUCT query per NodeShape, and
 * either prints the queries or inserts them back into the DataBook as
 * named sparql blocks.
 *
 * Synopsis:
 *   databook shacl2sparql <source> [options]
 *
 * Options:
 *   -b, --block-id <id>    SHACL block to compile (default: first shacl/turtle block)
 *   --data-block <id>      Turtle data block whose named graph IRI to use as FROM
 *   --from-graph <iri>     Explicit FROM clause IRI (repeatable; stacks with --data-block)
 *   --shape <iri>          Compile only this named shape IRI (default: all shapes)
 *   --type <type>          Query type: select (default) | construct | both
 *   --insert               Insert generated SPARQL block(s) into source DataBook in-place
 *   --prefix <id>          Prefix for generated block IDs (default: 'select-' / 'construct-')
 *   --dry-run              Print generated queries without writing
 *   -o, --output <file>    Output file (default: stdout or in-place with --insert)
 *   --encoding <enc>       Output encoding: utf8 (default), utf8bom, utf16
 *   -v, --verbose          Log shape extraction details
 *   -q, --quiet            Suppress info messages to stderr
 */

import { readFileSync, existsSync }             from 'fs';
import { writeOutput, resolveEncoding,
         atomicWriteEncoded }                   from '../lib/encoding.js';
import { loadDataBookFile, parseDataBook,
         PUSHABLE_LABELS }                      from '../lib/parser.js';
import { shaclToSparql }                        from '../lib/shacl2sparql.js';

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function runShacl2Sparql(sourceArg, opts) {
  const {
    blockId:    blockIdOpt,
    dataBlock:  dataBlockOpt,
    fromGraph:  fromGraphOpts = [],
    shape:      shapeIriOpt,
    type:       queryTypeOpt  = 'select',
    insert:     insertMode    = false,
    prefix:     blockPrefix,
    dryRun      = false,
    output:     outputOpt,
    encoding:   encOpt,
    verbose     = false,
    quiet       = false,
  } = opts;

  // ── Encoding ───────────────────────────────────────────────────────────────
  let enc;
  try { enc = resolveEncoding(encOpt); } catch (e) { die(e.message); }

  // ── Validate --type ────────────────────────────────────────────────────────
  const validTypes = ['select', 'construct', 'both'];
  if (!validTypes.includes(queryTypeOpt)) {
    die(`invalid --type '${queryTypeOpt}'. Valid values: ${validTypes.join(', ')}`);
  }

  // ── Resolve source ─────────────────────────────────────────────────────────
  if (!sourceArg) die('E_NO_SOURCE: a source file argument is required');
  if (!existsSync(sourceArg)) die(`source file not found: ${sourceArg}`);

  const isDataBook  = sourceArg.endsWith('.databook.md');
  const rawSource   = readFileSync(sourceArg, 'utf8');

  let shaclTurtle, db, fromGraphs;

  if (isDataBook) {
    db = parseDataBook(rawSource, sourceArg);
    if (!db) die(`E_NOT_DATABOOK: not a valid DataBook: ${sourceArg}`);

    // Find the SHACL block
    const shaclBlock = findShaclBlock(db, blockIdOpt);
    if (!shaclBlock) {
      die(
        blockIdOpt
          ? `E_BLOCK_NOT_FOUND: no block with id '${blockIdOpt}' in ${sourceArg}`
          : `E_NO_SHACL_BLOCK: no shacl or turtle block found in ${sourceArg}`
      );
    }

    shaclTurtle = shaclBlock.content;
    if (verbose) info(`[shacl2sparql] Using block '${shaclBlock.id ?? shaclBlock.label}'`);

    // Collect FROM graph IRIs
    fromGraphs = [...(Array.isArray(fromGraphOpts) ? fromGraphOpts : [fromGraphOpts]).filter(Boolean)];

    if (dataBlockOpt) {
      const dataBlock = db.blocks.find(b => b.id === dataBlockOpt);
      if (!dataBlock) die(`E_DATA_BLOCK_NOT_FOUND: no block '${dataBlockOpt}'`);
      // Use the block's databook:graph annotation, or fragment-address the document
      const blockGraph = dataBlock.graph
        ?? (db.frontmatter.id ? `${db.frontmatter.id}#${dataBlockOpt}` : null);
      if (blockGraph) {
        fromGraphs.push(blockGraph);
        if (verbose) info(`[shacl2sparql] FROM <${blockGraph}> (--data-block '${dataBlockOpt}')`);
      } else {
        warn(`[shacl2sparql] --data-block '${dataBlockOpt}' has no resolvable graph IRI; FROM clause omitted`);
      }
    }

  } else {
    // Plain .ttl / .shacl file
    shaclTurtle = rawSource;
    fromGraphs  = (Array.isArray(fromGraphOpts) ? fromGraphOpts : [fromGraphOpts]).filter(Boolean);
  }

  // ── Compile SHACL → SPARQL ─────────────────────────────────────────────────
  let results;
  try {
    results = await shaclToSparql(shaclTurtle, {
      fromGraphs,
      queryType: queryTypeOpt,
      shapeIri:  shapeIriOpt ?? null,
    });
  } catch (e) {
    die(`E_COMPILE: ${e.message}`);
  }

  if (results.length === 0) {
    if (!quiet) warn('No NodeShapes found in the SHACL input');
    return;
  }

  if (!quiet) {
    info(`[shacl2sparql] Compiled ${results.length} shape(s) → ${queryTypeOpt} queries`);
    for (const r of results) {
      const noTarget = !r.hasTargets ? ' (no target — full-graph scan)' : '';
      info(`  • <${r.shapeId}>${noTarget}`);
    }
  }

  // ── Output / insert mode ───────────────────────────────────────────────────
  if (insertMode && isDataBook) {
    // Insert generated blocks back into the DataBook
    const updatedDoc = insertSparqlBlocks(rawSource, results, queryTypeOpt, blockPrefix, db, verbose, quiet);
    const outPath    = outputOpt ?? sourceArg;

    if (dryRun) {
      writeOutput(null, updatedDoc, enc);
    } else {
      atomicWriteEncoded(outPath, updatedDoc, enc);
      if (!quiet) info(`[shacl2sparql] Inserted ${countBlocks(results, queryTypeOpt)} SPARQL block(s) into ${outPath}`);
    }
    return;
  }

  // ── Plain output (stdout or file) ──────────────────────────────────────────
  const outputLines = [];

  for (const r of results) {
    const heading = `# Shape: <${r.shapeId}>`;
    outputLines.push(heading);

    if (r.select) {
      outputLines.push('');
      outputLines.push(`## SELECT — match focus nodes`);
      outputLines.push('');
      outputLines.push(r.select);
    }
    if (r.construct) {
      outputLines.push('');
      outputLines.push('## CONSTRUCT — return matching triples');
      outputLines.push('');
      outputLines.push(r.construct);
    }
    outputLines.push('');
  }

  const output = outputLines.join('\n');
  if (dryRun || !outputOpt) {
    writeOutput(null, output, enc);
  } else {
    atomicWriteEncoded(outputOpt, output, enc);
    if (!quiet) info(`[shacl2sparql] Wrote queries to ${outputOpt}`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Find the best SHACL or Turtle block in a DataBook. */
function findShaclBlock(db, blockIdOpt) {
  if (blockIdOpt) return db.blocks.find(b => b.id === blockIdOpt) ?? null;
  // Prefer shacl-labelled blocks, then fall back to turtle
  return (
    db.blocks.find(b => b.label === 'shacl') ??
    db.blocks.find(b => b.label === 'turtle' || b.label === 'turtle12') ??
    null
  );
}

/** Count total blocks to be inserted (SELECT + CONSTRUCT per shape). */
function countBlocks(results, queryType) {
  return results.length * (queryType === 'both' ? 2 : 1);
}

/**
 * Insert generated SPARQL blocks into the raw DataBook text.
 * Appends blocks at the end of the body.
 */
function insertSparqlBlocks(raw, results, queryType, blockPrefix, db, verbose, quiet) {
  const lines    = raw.trimEnd().split('\n');
  const toInsert = [];

  for (const r of results) {
    // Derive a stable kebab-case block ID from the shape IRI
    const slug  = iriToSlug(r.shapeId);

    if (r.select) {
      const idSuffix = queryType === 'both' ? `-select` : '';
      const blockId  = blockPrefix
        ? `${blockPrefix}-${slug}${idSuffix}`
        : `select-${slug}`;
      // Guard: skip if already present
      if (db.blocks.some(b => b.id === blockId)) {
        if (!quiet) warn(`[shacl2sparql] Block '${blockId}' already exists — skipped (use --force to overwrite)`);
      } else {
        toInsert.push(
          ``,
          `<!-- databook:id: ${blockId} -->`,
          `<!-- databook:label: SELECT — ${r.label} -->`,
          `\`\`\`sparql`,
          r.select,
          `\`\`\``,
        );
        if (verbose) info(`[shacl2sparql] Appending block '${blockId}'`);
      }
    }

    if (r.construct) {
      const idSuffix = queryType === 'both' ? `-construct` : '';
      const blockId  = blockPrefix
        ? `${blockPrefix}-${slug}${idSuffix}`
        : `construct-${slug}`;
      if (db.blocks.some(b => b.id === blockId)) {
        if (!quiet) warn(`[shacl2sparql] Block '${blockId}' already exists — skipped`);
      } else {
        toInsert.push(
          ``,
          `<!-- databook:id: ${blockId} -->`,
          `<!-- databook:label: CONSTRUCT — ${r.label} -->`,
          `\`\`\`sparql`,
          r.construct,
          `\`\`\``,
        );
        if (verbose) info(`[shacl2sparql] Appending block '${blockId}'`);
      }
    }
  }

  if (toInsert.length === 0) return raw;
  return lines.join('\n') + '\n' + toInsert.join('\n') + '\n';
}

/** Convert a shape IRI to a kebab-case block ID fragment. */
function iriToSlug(iri) {
  const fragment = iri.replace(/^.*[#/]/, '');
  return fragment
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'shape';
}

function info(msg)  { process.stderr.write(msg + '\n'); }
function warn(msg)  { process.stderr.write(`warn: ${msg}\n`); }
function die(msg, code = 2) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}
