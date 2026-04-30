/**
 * commands/ingest.js
 * DataBook CLI — ingest command
 *
 * Converts a plain Markdown document to a DataBook by:
 *   1. Extracting source front matter → DataBook frontmatter skeleton
 *   2. Detecting adjacent annotations (<!-- databook:key: value -->) → typed blocks
 *   3. Uplifting known semantic fence labels (turtle, sparql, etc.) → typed blocks
 *   4. Counting triples for uplifted RDF blocks (N3.js)
 *   5. Preserving source metadata in source-metadata: subkey
 *   6. Writing output as a valid v1.1 DataBook
 *
 * Phase 1 (algorithmic): handles 95%+ of conversion deterministically.
 * Phase 2 (LLM enrichment): use `databook prompt --patch frontmatter.description` afterwards.
 *
 * Usage:
 *   databook ingest source.md -o output.databook.md
 *   databook ingest source.md --base-iri https://vocab.example.org/ -o output.databook.md
 *   databook ingest source.md --dry-run
 *   cat source.md | databook ingest - -o output.databook.md
 */

import fs   from 'fs';
import path from 'path';
import crypto from 'crypto';
import yaml   from 'js-yaml';
import { Parser as N3Parser } from 'n3';
import { writeOutput, atomicWriteEncoded, resolveEncoding } from '../lib/encoding.js';
import { parseAdjacentAnnotation, serializeAdjacentAnnotation } from '../lib/parser.js';

// ── Content-type table ────────────────────────────────────────────────────────

/**
 * Fence labels that unambiguously signal semantic content.
 * Format: { contentType, databookLabel, mimeType }
 */
const SEMANTIC_LABELS = {
  'turtle':        { contentType: 'text/turtle',               databookLabel: 'turtle',        isRdf: true },
  'turtle12':      { contentType: 'text/turtle',               databookLabel: 'turtle12',       isRdf: true },
  'trig':          { contentType: 'application/trig',          databookLabel: 'trig',           isRdf: true },
  'json-ld':       { contentType: 'application/ld+json',       databookLabel: 'json-ld',        isRdf: true },
  'shacl':         { contentType: 'text/turtle',               databookLabel: 'shacl',          isRdf: true },
  'sparql':        { contentType: 'application/sparql-query',  databookLabel: 'sparql',         isRdf: false },
  'sparql-update': { contentType: 'application/sparql-update', databookLabel: 'sparql-update',  isRdf: false },
  'prompt':        { contentType: 'text/plain',                databookLabel: 'prompt',         isRdf: false },
  'manifest':      { contentType: 'text/turtle',               databookLabel: 'manifest',       isRdf: true },
};

/** Fence labels that are display-only by default — not uplifted. */
const DISPLAY_ONLY_LABELS = new Set([
  'javascript', 'js', 'typescript', 'ts', 'python', 'py',
  'bash', 'sh', 'shell', 'zsh', 'fish',
  'html', 'css', 'sql', 'java', 'rust', 'go', 'ruby', 'php', 'c', 'cpp',
  'text', 'plain',
]);

// ── Source front-matter → DataBook frontmatter field mapping ─────────────────

const FM_DIRECT = ['title', 'version', 'description', 'license'];
const FM_DATE   = ['date', 'created', 'updated'];
const FM_TAGS   = ['tags', 'keywords', 'subject'];
const FM_AUTHOR = ['author', 'authors'];

// ── Public entry point ────────────────────────────────────────────────────────

export async function runIngest(inputArg, opts) {
  let enc;
  try { enc = resolveEncoding(opts.encoding); } catch (e) { die(e.message, 2); }

  // ── Read source ───────────────────────────────────────────────────────────
  let sourceText, sourceName;
  if (!inputArg || inputArg === '-') {
    sourceText = fs.readFileSync(0, 'utf8');
    sourceName = 'stdin';
  } else {
    if (!fs.existsSync(inputArg)) die(`file not found: ${inputArg}`, 2);
    sourceText = fs.readFileSync(inputArg, 'utf8');
    sourceName = path.basename(inputArg);
  }

  // ── Parse source ─────────────────────────────────────────────────────────
  const { sourceFm, sourceBody } = parseSourceFrontmatter(sourceText);

  if (opts.dryRun) {
    const blocks = scanBlocks(sourceBody, opts);
    const uplifted = blocks.filter(b => b.uplift);
    const literal  = blocks.filter(b => !b.uplift);
    process.stderr.write(`[ingest] Source: ${sourceName}\n`);
    process.stderr.write(`[ingest] Front matter keys: ${Object.keys(sourceFm).join(', ') || '(none)'}\n`);
    process.stderr.write(`[ingest] Blocks scanned:  ${blocks.length}\n`);
    process.stderr.write(`[ingest] Uplifted blocks:  ${uplifted.length}\n`);
    process.stderr.write(`[ingest] Literal blocks:   ${literal.length}\n`);
    for (const b of blocks) {
      const annot = b.hasAdjAnnot ? '[adjacent]' : b.hasFallbackLabel ? '[label-inferred]' : '[display-only]';
      process.stderr.write(`  ${b.uplift ? '↑' : '·'} ${b.fenceLabel.padEnd(12)} ${annot}  id=${b.blockId ?? '(none)'}\n`);
    }
    process.exit(0);
  }

  // ── Scan and classify all fenced blocks ──────────────────────────────────
  const blocks = scanBlocks(sourceBody, opts);

  // ── Count triples for RDF blocks ─────────────────────────────────────────
  await countTriplesForBlocks(blocks, opts.baseIri ?? 'https://example.org/');

  // ── Build DataBook frontmatter ────────────────────────────────────────────
  const databookFm = buildFrontmatter(sourceFm, blocks, sourceName, opts);

  // ── Build DataBook body ───────────────────────────────────────────────────
  const databookBody = buildBody(sourceBody, blocks);

  // ── Emit ──────────────────────────────────────────────────────────────────
  const output = serializeFrontmatter(databookFm) + '\n' + databookBody;

  const outPath = opts.output ?? null;
  if (outPath && outPath !== '-') {
    atomicWriteEncoded(outPath, output, enc);
    if (!opts.quiet) process.stderr.write(`[ingest] Written to ${outPath}\n`);
  } else {
    writeOutput(null, output, enc);
  }
}

// ── Source front-matter parser ────────────────────────────────────────────────

function parseSourceFrontmatter(text) {
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;

  if (i < lines.length && /^---\s*$/.test(lines[i])) {
    let fmEnd = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^---\s*$/.test(lines[j])) { fmEnd = j; break; }
    }
    if (fmEnd > i) {
      const yamlStr = lines.slice(i + 1, fmEnd).join('\n');
      try {
        const sourceFm = yaml.load(yamlStr, { schema: yaml.JSON_SCHEMA }) ?? {};
        const sourceBody = lines.slice(fmEnd + 1).join('\n');
        return { sourceFm, sourceBody };
      } catch { /* malformed — treat as no front matter */ }
    }
  }

  return { sourceFm: {}, sourceBody: text };
}

// ── Block scanner ─────────────────────────────────────────────────────────────

/**
 * Scan all fenced blocks in the body, classify them, and return metadata.
 * Does NOT modify the body text.
 *
 * @returns {IngestBlock[]}
 * @typedef {Object} IngestBlock
 * @property {number} fenceOpenOffset   - char offset in sourceBody of ``` open line
 * @property {number} fenceCloseOffset  - char offset in sourceBody of ``` close line
 * @property {number} adjAnnotOffset    - char offset of adjacent annotation line (-1 if none)
 * @property {string} fenceLabel        - original fence label
 * @property {string} blockContent      - content between fences (verbatim)
 * @property {string|null} blockId      - resolved block id
 * @property {string|null} contentType  - resolved content-type
 * @property {string} databookLabel     - DataBook fence label to use in output
 * @property {Object} meta              - all resolved metadata key-values
 * @property {boolean} uplift           - true if this block should be uplifted
 * @property {boolean} hasAdjAnnot      - true if annotation came from adjacent comment
 * @property {boolean} hasFallbackLabel - true if uplift is from label lookup, not annotation
 * @property {number} tripleCount       - filled in by countTriplesForBlocks()
 * @property {number} subjectCount      - filled in by countTriplesForBlocks()
 * @property {string|null} headingContext - nearest preceding heading text (for id generation)
 */
function scanBlocks(body, opts = {}) {
  const lines       = body.split('\n');
  const blocks      = [];
  const blockCounters = {};  // fenceLabel → counter (for unique id generation)

  let i = 0;
  let pendingAdjMeta = {};
  let pendingAdjLine = -1;
  let lastWasAnnotation = false;
  let currentHeading    = null;
  let lineOffset        = 0;  // accumulate char offsets
  const lineOffsets     = [];
  { // precompute line start offsets
    let off = 0;
    for (const l of lines) { lineOffsets.push(off); off += l.length + 1; }
  }

  while (i < lines.length) {
    const line = lines[i];

    // Track nearest heading for id-slug generation
    const headingMatch = /^#{1,3}\s+(.+)$/.exec(line);
    if (headingMatch) {
      currentHeading = headingMatch[1].trim();
      pendingAdjMeta = {};
      pendingAdjLine = -1;
      lastWasAnnotation = false;
      i++;
      continue;
    }

    // Adjacent annotation?
    if (/^<!--\s*databook:[\w-]+:.*?-->\s*$/.test(line)) {
      const adjMeta = parseAdjacentAnnotation(line);
      if (adjMeta) {
        Object.assign(pendingAdjMeta, adjMeta);
        pendingAdjLine = lineOffsets[i];
      }
      lastWasAnnotation = true;
      i++;
      continue;
    }

    // Fence open?
    const fenceOpen = /^```([\w][\w.\-+]*)\s*$/.exec(line);
    if (!fenceOpen) {
      if (line.trim() !== '' || !lastWasAnnotation) {
        pendingAdjMeta = {};
        pendingAdjLine = -1;
      }
      lastWasAnnotation = false;
      i++;
      continue;
    }

    const adjMeta        = { ...pendingAdjMeta };
    const adjAnnotOffset = pendingAdjLine;
    const fenceOpenOff   = lineOffsets[i];
    pendingAdjMeta       = {};
    pendingAdjLine       = -1;
    lastWasAnnotation    = false;

    const fenceLabel = fenceOpen[1];
    i++;

    // Collect content
    const contentLines = [];
    let fenceCloseOff  = -1;

    while (i < lines.length) {
      const cl = lines[i];
      if (/^```\s*$/.test(cl)) {
        fenceCloseOff = lineOffsets[i];
        i++;
        break;
      }
      contentLines.push(cl);
      i++;
    }

    const content = contentLines.join('\n');

    // ── Classify ────────────────────────────────────────────────────────────
    const hasAdjAnnot = Object.keys(adjMeta).length > 0;
    let uplift = false;
    let meta   = { ...adjMeta };
    let databookLabel = fenceLabel;
    let contentType   = adjMeta['content-type'] ?? null;
    let hasFallbackLabel = false;

    if (hasAdjAnnot) {
      // Adjacent annotation is authoritative — always uplift
      uplift = true;
      if (!contentType && SEMANTIC_LABELS[fenceLabel]) {
        contentType   = SEMANTIC_LABELS[fenceLabel].contentType;
        databookLabel = SEMANTIC_LABELS[fenceLabel].databookLabel;
      } else if (!contentType) {
        contentType = `text/plain`;
      }
    } else if (SEMANTIC_LABELS[fenceLabel]) {
      // Known semantic label — uplift with inferred content-type
      uplift            = true;
      hasFallbackLabel  = true;
      contentType       = SEMANTIC_LABELS[fenceLabel].contentType;
      databookLabel     = SEMANTIC_LABELS[fenceLabel].databookLabel;
    } else if (fenceLabel === 'json') {
      // Ambiguous: inspect for @context
      if (/"@context"/.test(content) || /'@context'/.test(content)) {
        uplift        = true;
        hasFallbackLabel = true;
        contentType   = 'application/ld+json';
        databookLabel = 'json-ld';
        meta['content-type'] = contentType;
      }
    } else if (fenceLabel === 'xml') {
      // Ambiguous: inspect for rdf:RDF
      if (/<rdf:RDF/i.test(content)) {
        uplift        = true;
        hasFallbackLabel = true;
        contentType   = 'application/rdf+xml';
        databookLabel = 'xml';
        meta['content-type'] = contentType;
      }
    }
    // else: display-only or unknown — uplift = false

    // ── Resolve or generate block ID ────────────────────────────────────────
    let blockId = meta['id'] ?? null;
    if (!blockId && uplift) {
      const counter = (blockCounters[databookLabel] ?? 0) + 1;
      blockCounters[databookLabel] = counter;
      const slug = currentHeading
        ? slugify(currentHeading) + (counter > 1 ? `-${counter}` : '')
        : `${databookLabel}-block-${counter}`;
      blockId = slug;
      meta['id'] = blockId;
    }

    if (contentType && !meta['content-type']) meta['content-type'] = contentType;

    blocks.push({
      fenceOpenOffset:  fenceOpenOff,
      fenceCloseOffset: fenceCloseOff,
      adjAnnotOffset,
      fenceLabel,
      databookLabel,
      blockContent:    content,
      blockId,
      contentType,
      meta,
      uplift,
      hasAdjAnnot,
      hasFallbackLabel,
      tripleCount:     0,
      subjectCount:    0,
      headingContext:  currentHeading,
    });
  }

  return blocks;
}

// ── Triple counting ───────────────────────────────────────────────────────────

async function countTriplesForBlocks(blocks, baseIri) {
  for (const block of blocks) {
    if (!block.uplift) continue;
    const sem = SEMANTIC_LABELS[block.fenceLabel] ?? SEMANTIC_LABELS[block.databookLabel];
    if (!sem?.isRdf) continue;

    try {
      const { triples, subjects } = await countTurtle(block.blockContent, baseIri);
      block.tripleCount  = triples;
      block.subjectCount = subjects;
    } catch {
      // Parse failure — counts stay 0
    }
  }
}

function countTurtle(content, baseIri) {
  return new Promise((resolve) => {
    const parser = new N3Parser({ format: 'Turtle', baseIRI: baseIri });
    let triples = 0;
    const subjects = new Set();
    parser.parse(content, (err, quad) => {
      if (err || !quad) {
        resolve({ triples, subjects: subjects.size });
      } else {
        triples++;
        subjects.add(quad.subject.value);
      }
    });
  });
}

// ── Frontmatter builder ───────────────────────────────────────────────────────

function buildFrontmatter(sourceFm, blocks, sourceName, opts) {
  const now      = new Date();
  const isoDate  = now.toISOString().slice(0, 10);
  const isoTs    = now.toISOString().replace(/\.\d+Z$/, 'Z');

  // Identity
  const slug  = opts.id
    ? null
    : (sourceFm.title ? slugify(sourceFm.title) : path.basename(sourceName, path.extname(sourceName)));
  const version = sourceFm.version ?? opts.version ?? '1.0.0';
  const id    = opts.id ?? `urn:databook:${slug}-v${version}`;
  const title = sourceFm.title ?? slug ?? sourceName;

  // Created date: prefer source front matter
  let created = isoDate;
  for (const key of FM_DATE) {
    if (sourceFm[key]) { created = String(sourceFm[key]).slice(0, 10); break; }
  }

  // Author
  let author = null;
  for (const key of FM_AUTHOR) {
    if (sourceFm[key]) {
      if (typeof sourceFm[key] === 'string') {
        author = [{ name: sourceFm[key], role: 'orchestrator' }];
      } else if (Array.isArray(sourceFm[key])) {
        author = sourceFm[key].map(a =>
          typeof a === 'string' ? { name: a, role: 'contributor' } : a
        );
      }
      break;
    }
  }

  // Subject
  let subject = null;
  for (const key of FM_TAGS) {
    if (sourceFm[key]) {
      subject = Array.isArray(sourceFm[key]) ? sourceFm[key] : [sourceFm[key]];
      break;
    }
  }

  // Description
  const description = sourceFm.description ?? sourceFm.abstract ?? null;

  // Graph metadata (aggregate from uplifted RDF blocks)
  const rdfBlocks = blocks.filter(b => b.uplift && (SEMANTIC_LABELS[b.fenceLabel] ?? SEMANTIC_LABELS[b.databookLabel])?.isRdf);
  const totalTriples  = rdfBlocks.reduce((acc, b) => acc + b.tripleCount, 0);
  const totalSubjects = rdfBlocks.reduce((acc, b) => acc + b.subjectCount, 0);

  const graph = rdfBlocks.length > 0
    ? {
        namespace: opts.namespace ?? sourceFm.namespace ?? null,
        named_graph: `${id}#graph`,
        triple_count: totalTriples,
        subjects: totalSubjects,
        rdf_version: '1.1',
      }
    : null;
  // Remove null graph fields
  if (graph) Object.keys(graph).forEach(k => graph[k] === null && delete graph[k]);

  // Source metadata: everything not cleanly mapped
  const mappedKeys = new Set([
    ...FM_DIRECT, ...FM_DATE, ...FM_TAGS, ...FM_AUTHOR,
    'description', 'abstract', 'namespace', 'version',
  ]);
  const sourceMeta = Object.fromEntries(
    Object.entries(sourceFm).filter(([k]) => !mappedKeys.has(k))
  );

  // Process stamp
  const process = {
    transformer: 'databook ingest',
    transformer_type: 'script',
    transformer_iri: 'https://w3id.org/databook/cli#ingest',
    timestamp: isoTs,
    inputs: [{
      iri: opts.sourceIri ?? `file://${path.resolve(sourceName !== 'stdin' ? sourceName : 'stdin')}`,
      role: 'primary',
      description: `Source Markdown file: ${sourceName}`,
    }],
    agent: {
      name: 'databook-cli',
      iri: 'https://w3id.org/databook/cli',
      role: 'orchestrator',
    },
  };

  return {
    id,
    title,
    type: 'databook',
    version,
    created,
    status: sourceFm.status ?? null,
    ...(author      ? { author }      : {}),
    ...(description ? { description } : {}),
    ...(subject     ? { subject }     : {}),
    ...(sourceFm.license ? { license: sourceFm.license } : {}),
    ...(opts.domain  ? { domain: opts.domain } : sourceFm.domain ? { domain: sourceFm.domain } : {}),
    ...(graph && Object.keys(graph).length > 0 ? { graph } : {}),
    ...(Object.keys(sourceMeta).length > 0 ? { 'source-metadata': sourceMeta } : {}),
    process,
  };
}

// ── Body builder ──────────────────────────────────────────────────────────────

/**
 * Rebuild the document body, replacing fence regions with DataBook-annotated blocks.
 * Non-uplifted blocks and prose are preserved verbatim.
 */
function buildBody(sourceBody, blocks) {
  if (blocks.length === 0) return sourceBody;

  // We need to reconstruct the body by splicing in adjacent annotations
  // and potentially replacing fence labels.
  // Strategy: walk through body char-by-char using block offset markers.

  // Sort blocks by fenceOpenOffset (they should already be in order)
  const sorted = [...blocks].sort((a, b) => a.fenceOpenOffset - b.fenceOpenOffset);

  const lines   = sourceBody.split('\n');
  const result  = [];
  let lineIdx   = 0;
  const lineOffsets = [];
  { let off = 0; for (const l of lines) { lineOffsets.push(off); off += l.length + 1; } }

  // Map from line index to block
  const fenceLineToBlock = new Map();
  for (const block of sorted) {
    // Find which line the fence open is on
    let fenceLine = lineOffsets.findIndex((off, i) => off === block.fenceOpenOffset);
    if (fenceLine < 0) {
      // Fallback: find by scanning for the fence content
      fenceLine = lines.findIndex(l => /^```/.test(l) && lineOffsets[lines.indexOf(l)] === block.fenceOpenOffset);
    }
    if (fenceLine >= 0) fenceLineToBlock.set(fenceLine, block);
  }

  // Simpler reconstruction: line-by-line, inject adjacent annotations when needed
  lineIdx = 0;
  while (lineIdx < lines.length) {
    const block = fenceLineToBlock.get(lineIdx);

    if (block && block.uplift) {
      // Skip original adjacent annotation if we're going to re-emit it
      // (The original annotation was on the line before — we already passed it)
      // Emit adjacent annotation (DataBook canonical form)
      const adjAnnot = serializeAdjacentAnnotation(block.meta);
      if (adjAnnot && !block.hasAdjAnnot) {
        // New annotation being added — inject before the fence
        result.push(adjAnnot);
      } else if (adjAnnot && block.hasAdjAnnot) {
        // Replace the original adjacent annotation (already emitted above if it was output)
        // We need to find and replace the already-emitted annotation line
        // Actually: the annotation line was emitted in the previous iteration since
        // we didn't intercept it. We need to remove it from result and re-add enriched.
        // Find and update the last annotation line
        for (let k = result.length - 1; k >= 0; k--) {
          if (/^<!--\s*databook:/.test(result[k])) {
            result[k] = adjAnnot;
            break;
          }
        }
      }

      // Emit the fence open (possibly with updated label)
      result.push('```' + block.databookLabel);
      lineIdx++;  // skip original fence open

      // Emit content lines (verbatim — we don't strip internal comments, just add new ones)
      while (lineIdx < lines.length && !/^```\s*$/.test(lines[lineIdx])) {
        result.push(lines[lineIdx]);
        lineIdx++;
      }

      // Emit fence close
      if (lineIdx < lines.length) {
        result.push(lines[lineIdx]);
        lineIdx++;
      }
    } else if (block && !block.uplift) {
      // Non-uplifted block — emit verbatim, no annotation injection
      result.push(lines[lineIdx]);
      lineIdx++;
    } else {
      result.push(lines[lineIdx]);
      lineIdx++;
    }
  }

  return result.join('\n');
}

// ── Frontmatter serialiser ────────────────────────────────────────────────────

function serializeFrontmatter(fm) {
  // Remove null / undefined fields before serialisation
  const clean = deepRemoveNull(fm);
  const yamlStr = yaml.dump(clean, {
    lineWidth: 120,
    quotingType: '"',
    forceQuotes: false,
    noRefs: true,
  }).trimEnd();
  return `---\n${yamlStr}\n---`;
}

function deepRemoveNull(obj) {
  if (Array.isArray(obj)) return obj.map(deepRemoveNull);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => [k, deepRemoveNull(v)])
    );
  }
  return obj;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function die(msg, code = 2) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}
