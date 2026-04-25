/**
 * databook head — extract and serialise DataBook frontmatter and block metadata.
 * Spec: https://w3id.org/databook/specs/cli-head-v1
 */

import { readFileSync } from 'fs';
import { writeOutput, resolveEncoding } from '../lib/encoding.js';
import { loadDataBookFile, parseDataBook } from '../lib/parser.js';
import yaml from 'js-yaml';

const BUILD_NS = 'https://w3id.org/databook/ns#';
const DCT_NS   = 'http://purl.org/dc/terms/';
const PROV_NS  = 'http://www.w3.org/ns/prov#';
const XSD_NS   = 'http://www.w3.org/2001/XMLSchema#';

/**
 * Run the `databook head` command.
 * @param {string|null} inputArg  - File path or '-' for stdin
 * @param {object} opts
 * @param {string|null} opts.blockId
 * @param {string}      opts.format   - 'json' | 'yaml' | 'xml' | 'turtle'
 * @param {string|null} opts.output   - Output file path or null for stdout
 * @param {boolean}     opts.quiet
 */
export async function runHead(inputArg, opts) {
  const { blockId, format = 'json', output = null, quiet = false, encoding: encOpt } = opts;
  let enc;
  try { enc = resolveEncoding(encOpt); } catch (e) { die(e.message); }

  // ── Validate format ──────────────────────────────────────────────────────
  const validFormats = ['json', 'yaml', 'xml', 'turtle'];
  if (!validFormats.includes(format)) {
    die(`E_HEAD_FORMAT_UNKNOWN: --format must be one of: ${validFormats.join(', ')}`);
  }

  // ── Read input ────────────────────────────────────────────────────────────
  let db;
  if (!inputArg || inputArg === '-') {
    // stdin
    if (process.stdin.isTTY) {
      die('E_STDIN_FORMAT_REQUIRED: no input file specified and stdin is a tty');
    }
    const content = readFileSync(0, 'utf8');  // fd 0 = stdin
    db = parseDataBook(content, null);
    if (!db) die('E_HEAD_NO_FRONTMATTER: input is not a DataBook');
  } else {
    try {
      db = loadDataBookFile(inputArg);
    } catch (e) {
      die(e.message);
    }
  }

  if (db.form === 'pre-v1' && !quiet) {
    warn('W_HEAD_PRE_V1: frontmatter in bare --- form (pre-v1.0 DataBook); parsed with fallback');
  }

  // ── Determine output mode ─────────────────────────────────────────────────
  let result;

  if (blockId) {
    // Block metadata mode
    const block = db.blocks.find(b => b.id === blockId);
    if (!block) die(`E_HEAD_BLOCK_NOT_FOUND: no block with id '${blockId}'`);
    result = blockMetadataResult(block);
  } else {
    // Default mode: frontmatter + block summary
    const unresolvedBlocks = db.blocks.filter(b => b.id && !b.role);
    if (unresolvedBlocks.length > 0 && !quiet) {
      warn('W_HEAD_ROLE_UNRESOLVED: one or more blocks have no role in process.inputs');
    }
    if (!db.frontmatter.id && format === 'turtle' && !quiet) {
      warn('W_HEAD_TURTLE_NO_ID: DataBook has no id field; Turtle output uses file:// URI as subject');
    }
    result = defaultResult(db);
  }

  // ── Serialise ─────────────────────────────────────────────────────────────
  const serialised = serialise(result, format, db.frontmatter.id, db.filePath, !!blockId);

  // ── Output ────────────────────────────────────────────────────────────────
  if (output && output !== '-') {
    writeOutput(output, serialised, enc);
  } else {
    writeOutput(null, serialised, enc);
  }
}

// ─── Result builders ─────────────────────────────────────────────────────────

function defaultResult(db) {
  return {
    frontmatter: db.frontmatter,
    blocks: db.blocks.map(b => ({
      id:           b.id,
      label:        b.label,
      role:         b.role ?? null,
      line_count:   b.line_count,
      display_only: b.display_only,
    })),
  };
}

function blockMetadataResult(block) {
  return {
    id:            block.id,
    label:         block.label,
    role:          block.role ?? null,
    line_count:    block.line_count,
    comment_count: block.comment_count,
    display_only:  block.display_only,
    all_meta:      block.all_meta,
  };
}

// ─── Serialisation ────────────────────────────────────────────────────────────

function serialise(result, format, databookId, filePath, isBlockMode) {
  switch (format) {
    case 'json':   return JSON.stringify(result, null, 2) + '\n';
    case 'yaml':   return yaml.dump(result, { lineWidth: 100 });
    case 'xml':    return toXml(result, isBlockMode);
    case 'turtle': return toTurtle(result, databookId, filePath, isBlockMode);
    default:       return JSON.stringify(result, null, 2) + '\n';
  }
}

// ── XML serialisation ─────────────────────────────────────────────────────────

function toXml(result, isBlockMode) {
  const NS = 'https://w3id.org/databook/ns#';
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>'];

  if (isBlockMode) {
    const b = result;
    const attrs = [
      `xmlns:db="${NS}"`,
      attr('id', b.id),
      attr('label', b.label),
      attr('role', b.role),
      attr('line_count', b.line_count),
      attr('comment_count', b.comment_count),
      attr('display_only', b.display_only),
    ].filter(Boolean).join(' ');
    lines.push(`<db:block ${attrs}>`);
    for (const [k, v] of Object.entries(b.all_meta ?? {})) {
      lines.push(`  <db:meta key="${escXml(k)}">${escXml(v)}</db:meta>`);
    }
    lines.push('</db:block>');
  } else {
    lines.push(`<db:databook xmlns:db="${NS}">`);
    lines.push('');
    lines.push('  <db:frontmatter>');
    xmlObject(result.frontmatter, lines, '    ');
    lines.push('  </db:frontmatter>');
    lines.push('');
    lines.push('  <db:blocks>');
    for (const b of (result.blocks ?? [])) {
      const ba = [
        attr('id', b.id), attr('label', b.label), attr('role', b.role),
        attr('line_count', b.line_count), attr('display_only', b.display_only),
      ].filter(Boolean).join(' ');
      lines.push(`    <db:block ${ba}/>`);
    }
    lines.push('  </db:blocks>');
    lines.push('');
    lines.push('</db:databook>');
  }

  return lines.join('\n') + '\n';
}

function xmlObject(obj, lines, indent) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (v == null) continue;
    const tag = `db:${k.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === 'object') {
          lines.push(`${indent}<${tag}>`);
          xmlObject(item, lines, indent + '  ');
          lines.push(`${indent}</${tag}>`);
        } else {
          lines.push(`${indent}<${tag}>${escXml(item)}</${tag}>`);
        }
      }
    } else if (typeof v === 'object') {
      lines.push(`${indent}<${tag}>`);
      xmlObject(v, lines, indent + '  ');
      lines.push(`${indent}</${tag}>`);
    } else {
      lines.push(`${indent}<${tag}>${escXml(v)}</${tag}>`);
    }
  }
}

function attr(key, value) {
  if (value == null) return null;
  return `${key}="${escXml(String(value))}"`;
}

function escXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Turtle serialisation ──────────────────────────────────────────────────────

function toTurtle(result, databookId, filePath, isBlockMode) {
  const subject = databookId
    ? `<${databookId}>`
    : `<file://${filePath ?? 'unknown'}>`;

  const prefixes = [
    `@prefix build: <${BUILD_NS}> .`,
    `@prefix dct:   <${DCT_NS}> .`,
    `@prefix prov:  <${PROV_NS}> .`,
    `@prefix xsd:   <${XSD_NS}> .`,
    `@prefix foaf:  <http://xmlns.com/foaf/0.1/> .`,
    '',
  ];

  if (isBlockMode) {
    const b = result;
    const blockSubject = databookId
      ? `<${databookId}#${b.id}>`
      : `<file://${filePath ?? 'unknown'}#${b.id}>`;
    const triples = [
      `${blockSubject}`,
      `    a build:Block ;`,
      `    build:blockId      ${ttlStr(b.id)} ;`,
      `    build:blockLabel   ${ttlStr(b.label)} ;`,
    ];
    if (b.role)         triples.push(`    build:blockRole    ${ttlStr(b.role)} ;`);
    triples.push(`    build:lineCount    ${b.line_count} ;`);
    triples.push(`    build:commentCount ${b.comment_count} ;`);
    triples.push(`    build:displayOnly  ${b.display_only} .`);
    return prefixes.join('\n') + triples.join('\n') + '\n';
  }

  // Default mode
  const fm = result.frontmatter;
  const blocks = result.blocks ?? [];

  const triples = [
    `${subject}`,
    `    a build:DataBook ;`,
  ];

  if (fm.title)   triples.push(`    dct:title       ${ttlStr(fm.title, 'en')} ;`);
  if (fm.created) triples.push(`    dct:created     "${fm.created}"^^xsd:date ;`);
  if (fm.version) triples.push(`    build:version   ${ttlStr(fm.version)} ;`);
  if (fm.type)    triples.push(`    dct:type        build:${fm.type} ;`);

  // build:hasBlock references — only blocks with IDs get named IRIs
  const namedBlocks = blocks.filter(b => b.id);
  const blockRefs = namedBlocks.map((b, i) => {
    if (databookId) return `<${databookId}#${b.id}>`;
    return `_:block${i}`;
  });
  if (blockRefs.length > 0) {
    triples.push(`    build:hasBlock   ${blockRefs.join(' ,\n                    ')} ;`);
  }

  // Fix last ; to .
  triples[triples.length - 1] = triples[triples.length - 1].replace(/ ;$/, ' .');

  const blockTriples = namedBlocks.map((b, i) => {
    const bs = databookId ? `<${databookId}#${b.id}>` : `_:block${i}`;
    const bt = [
      `\n${bs}`,
      `    a build:Block ;`,
      `    build:blockId    ${ttlStr(b.id)} ;`,
      `    build:blockLabel ${ttlStr(b.label)} ;`,
    ];
    if (b.role) bt.push(`    build:blockRole  ${ttlStr(b.role)} ;`);
    bt.push(`    build:lineCount  ${b.line_count} ;`);
    bt.push(`    build:displayOnly ${b.display_only} .`);
    return bt.join('\n');
  });

  return prefixes.join('\n') + triples.join('\n') + blockTriples.join('') + '\n';
}

function ttlStr(value, lang = null) {
  if (value == null) return '""';
  const escaped = String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  if (lang) return `"${escaped}"@${lang}`;
  return `"${escaped}"`;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function die(msg) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(2);
}

function warn(msg) {
  process.stderr.write(`warn: ${msg}\n`);
}
