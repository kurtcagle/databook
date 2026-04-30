/**
 * databook head — extract, serialise, and update DataBook frontmatter and block metadata.
 * Spec: https://w3id.org/databook/specs/cli-head-v1
 *
 * READ MODE (default):
 *   Emits frontmatter and block summary; no write.
 *   Activated when none of --set / --json / --yaml / --file are present.
 *
 * UPDATE MODE:
 *   Patches frontmatter in-place (or to -o target) and rewrites the document.
 *   Activated when any of --set / --json / --yaml / --file are present.
 *
 *   Merge strategy (default): deep-merge patch into existing frontmatter.
 *   --replace: discard existing frontmatter, use patch as the new document.
 *   --dry-run: print resulting document to stdout without writing.
 *
 *   Dot-path notation in --set: e.g. --set graph.triple_count=47
 *   Built-in token in --set: @now expands to current ISO 8601 timestamp.
 */

import { readFileSync, existsSync } from 'fs';
import { extname }                  from 'path';
import { writeOutput, resolveEncoding, atomicWriteEncoded } from '../lib/encoding.js';
import { loadDataBookFile, parseDataBook } from '../lib/parser.js';
import yaml from 'js-yaml';

const BUILD_NS = 'https://w3id.org/databook/ns#';
const DCT_NS   = 'http://purl.org/dc/terms/';
const PROV_NS  = 'http://www.w3.org/ns/prov#';
const XSD_NS   = 'http://www.w3.org/2001/XMLSchema#';

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Run the `databook head` command.
 *
 * READ MODE opts:
 * @param {string|null} inputArg
 * @param {object}      opts
 * @param {string|null} opts.blockId
 * @param {string}      opts.format    - 'json' | 'yaml' | 'xml' | 'turtle'
 * @param {string|null} opts.output
 * @param {boolean}     opts.quiet
 *
 * UPDATE MODE opts (activate update mode when any present):
 * @param {string[]}    [opts.set]     - key=value pairs (repeatable); dot-path; @now token
 * @param {string}      [opts.json]    - inline JSON patch string
 * @param {string}      [opts.yaml]    - inline YAML patch string
 * @param {string}      [opts.file]    - path to .json or .yaml patch file
 * @param {boolean}     [opts.replace] - full frontmatter replacement (vs merge)
 * @param {boolean}     [opts.dryRun]  - print result, do not write
 * @param {string}      [opts.encoding]
 */
export async function runHead(inputArg, opts) {
  const {
    set:  setOpts = [],
    json: jsonOpt,
    yaml: yamlOpt,
    file: fileOpt,
  } = opts;

  const isUpdateMode =
    (setOpts && setOpts.length > 0) ||
    jsonOpt != null                  ||
    yamlOpt != null                  ||
    fileOpt != null;

  if (isUpdateMode) {
    return runHeadUpdate(inputArg, opts);
  }
  return runHeadRead(inputArg, opts);
}

// ─── READ MODE ────────────────────────────────────────────────────────────────

async function runHeadRead(inputArg, opts) {
  const { blockId, format = 'json', output = null, quiet = false, encoding: encOpt } = opts;
  let enc;
  try { enc = resolveEncoding(encOpt); } catch (e) { die(e.message); }

  const validFormats = ['json', 'yaml', 'xml', 'turtle'];
  if (!validFormats.includes(format)) {
    die(`E_HEAD_FORMAT_UNKNOWN: --format must be one of: ${validFormats.join(', ')}`);
  }

  let db;
  if (!inputArg || inputArg === '-') {
    if (process.stdin.isTTY) {
      die('E_STDIN_FORMAT_REQUIRED: no input file specified and stdin is a tty');
    }
    const content = readFileSync(0, 'utf8');
    db = parseDataBook(content, null);
    if (!db) die('E_HEAD_NO_FRONTMATTER: input is not a DataBook');
  } else {
    try { db = loadDataBookFile(inputArg); } catch (e) { die(e.message); }
  }

  if (db.form === 'pre-v1' && !quiet) {
    warn('W_HEAD_PRE_V1: frontmatter in bare --- form (pre-v1.0 DataBook); parsed with fallback');
  }

  let result;
  if (blockId) {
    const block = db.blocks.find(b => b.id === blockId);
    if (!block) die(`E_HEAD_BLOCK_NOT_FOUND: no block with id '${blockId}'`);
    result = blockMetadataResult(block);
  } else {
    const unresolvedBlocks = db.blocks.filter(b => b.id && !b.role);
    if (unresolvedBlocks.length > 0 && !quiet) {
      warn('W_HEAD_ROLE_UNRESOLVED: one or more blocks have no role in process.inputs');
    }
    if (!db.frontmatter.id && format === 'turtle' && !quiet) {
      warn('W_HEAD_TURTLE_NO_ID: DataBook has no id field; Turtle output uses file:// URI as subject');
    }
    result = defaultResult(db);
  }

  const serialised = serialise(result, format, db.frontmatter.id, db.filePath, !!blockId);

  if (output && output !== '-') {
    writeOutput(output, serialised, enc);
  } else {
    writeOutput(null, serialised, enc);
  }
}

// ─── UPDATE MODE ──────────────────────────────────────────────────────────────

async function runHeadUpdate(inputArg, opts) {
  const {
    set:     setOpts  = [],
    json:    jsonOpt,
    yaml:    yamlOpt,
    file:    fileOpt,
    replace: replaceMode = false,
    dryRun             = false,
    output:  outputOpt,
    encoding: encOpt,
    quiet              = false,
  } = opts;

  let enc;
  try { enc = resolveEncoding(encOpt); } catch (e) { die(e.message); }

  if (!inputArg || inputArg === '-') {
    die('E_HEAD_UPDATE_STDIN: --set / --json / --yaml / --file require a file path (stdin not supported in update mode)');
  }

  // ── Read and parse ────────────────────────────────────────────────────────
  let raw;
  try { raw = readFileSync(inputArg, 'utf8'); } catch (_) { die(`file not found: ${inputArg}`); }

  const db = parseDataBook(raw, inputArg);
  if (!db) die(`E_HEAD_NO_FRONTMATTER: not a valid DataBook: ${inputArg}`);

  // ── Build patch ───────────────────────────────────────────────────────────
  let patch = {};

  if (fileOpt) {
    if (!existsSync(fileOpt)) die(`patch file not found: ${fileOpt}`);
    const fileContent = readFileSync(fileOpt, 'utf8');
    const ext = extname(fileOpt).toLowerCase();
    try {
      patch = ext === '.yaml' || ext === '.yml'
        ? yaml.load(fileContent, { schema: yaml.JSON_SCHEMA })
        : JSON.parse(fileContent);
    } catch (e) {
      die(`E_HEAD_PATCH_PARSE: could not parse patch file '${fileOpt}': ${e.message}`);
    }
    if (typeof patch !== 'object' || Array.isArray(patch) || patch === null) {
      die(`E_HEAD_PATCH_TYPE: patch file must be a YAML/JSON object (got ${typeof patch})`);
    }
  }

  if (jsonOpt) {
    let jp;
    try { jp = JSON.parse(jsonOpt); } catch (e) { die(`E_HEAD_JSON_PARSE: ${e.message}`); }
    patch = deepMerge(patch, jp);
  }

  if (yamlOpt) {
    let yp;
    try { yp = yaml.load(yamlOpt, { schema: yaml.JSON_SCHEMA }); }
    catch (e) { die(`E_HEAD_YAML_PARSE: ${e.message}`); }
    patch = deepMerge(patch, yp);
  }

  for (const kv of (setOpts ?? [])) {
    const eqIdx = kv.indexOf('=');
    if (eqIdx < 0) die(`E_HEAD_SET_FORMAT: --set value '${kv}' must be in key=value form`);
    const key = kv.slice(0, eqIdx).trim();
    const raw = kv.slice(eqIdx + 1);
    const val = expandSetToken(raw);
    if (!key) die(`E_HEAD_SET_EMPTY_KEY: --set key cannot be empty in '${kv}'`);
    setDotPath(patch, key, val);
  }

  // ── Apply patch ───────────────────────────────────────────────────────────
  const newFrontmatter = replaceMode
    ? patch
    : deepMerge(db.frontmatter, patch);

  // ── Reconstruct document ──────────────────────────────────────────────────
  const newYaml = yaml.dump(newFrontmatter, {
    lineWidth:  100,
    noRefs:     true,
    quotingType: '"',
  });

  const newDoc = reconstructDocument(raw, newYaml, db);

  // ── Output ────────────────────────────────────────────────────────────────
  if (dryRun) {
    writeOutput(null, newDoc, enc);
    return;
  }

  const outPath = outputOpt ?? inputArg;
  atomicWriteEncoded(outPath, newDoc, enc);
  if (!quiet) {
    const keys = Object.keys(patch).join(', ');
    process.stderr.write(`info: frontmatter updated in ${outPath} (keys: ${keys || '(none)'})\n`);
  }
}

// ─── Document reconstruction ──────────────────────────────────────────────────

const RE_YAML_DELIM  = /^---\s*$/;
const RE_SCRIPT_OPEN = /^<script\s+language=["']application\/yaml["']\s*>\s*$/;
const RE_SCRIPT_CLOSE= /^<\/script>\s*$/;

/**
 * Replace the frontmatter section of a raw DataBook document with new YAML.
 * Converts legacy <script> form to canonical --- form in the process.
 * Preserves the body unchanged.
 *
 * @param {string} raw           - Full document text
 * @param {string} newYaml       - Replacement YAML string (already dumped)
 * @param {object} db            - Parsed DataBook (for form detection)
 * @returns {string}             - Reconstructed document
 */
function reconstructDocument(raw, newYaml, db) {
  const lines = raw.split('\n');

  // ── Canonical --- form ────────────────────────────────────────────────────
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;

  if (i < lines.length && RE_YAML_DELIM.test(lines[i])) {
    const fmOpen = i;
    i++;
    while (i < lines.length && !RE_YAML_DELIM.test(lines[i])) i++;
    const fmClose = i; // closing ---

    const header = `---\n${newYaml.trimEnd()}\n---`;
    const body   = lines.slice(fmClose + 1).join('\n');
    return header + '\n' + body;
  }

  // ── Legacy <script> form → rewrite as canonical ───────────────────────────
  for (let j = 0; j < lines.length; j++) {
    if (RE_SCRIPT_OPEN.test(lines[j].trim())) {
      for (let k = j + 1; k < lines.length; k++) {
        if (RE_SCRIPT_CLOSE.test(lines[k].trim())) {
          const header = `---\n${newYaml.trimEnd()}\n---`;
          const body   = lines.slice(k + 1).join('\n');
          return header + '\n' + body;
        }
      }
    }
  }

  // ── No frontmatter found — prepend new block ──────────────────────────────
  return `---\n${newYaml.trimEnd()}\n---\n` + raw;
}

// ─── Patch helpers ────────────────────────────────────────────────────────────

/**
 * Deep-merge two plain objects.  Arrays and primitives in `patch` overwrite `base`.
 * Nested objects are recursively merged.
 */
function deepMerge(base, patch) {
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return patch;
  const result = { ...base };
  for (const [k, v] of Object.entries(patch ?? {})) {
    result[k] =
      v !== null && typeof v === 'object' && !Array.isArray(v) &&
      typeof result[k] === 'object' && !Array.isArray(result[k]) && result[k] !== null
        ? deepMerge(result[k], v)
        : v;
  }
  return result;
}

/**
 * Set a value at a dot-separated path within an object.
 * Creates intermediate objects as needed.
 *
 * @param {object} obj
 * @param {string} path   - e.g. 'graph.triple_count' or 'version'
 * @param {*}      val
 */
function setDotPath(obj, path, val) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null || Array.isArray(cur[parts[i]])) {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}

/**
 * Expand built-in tokens and coerce type in --set values.
 *
 * Tokens:
 *   @now    → current UTC timestamp as ISO 8601 string (e.g. 2026-04-28T12:34:56.000Z)
 *   @today  → current date as YYYY-MM-DD
 *
 * Type coercion:
 *   'true' / 'false'  → boolean
 *   'null'            → null
 *   numeric strings   → number
 *   everything else   → string (unchanged)
 *
 * @param {string} raw
 * @returns {*}
 */
function expandSetToken(raw) {
  if (raw === '@now')   return new Date().toISOString();
  if (raw === '@today') return new Date().toISOString().slice(0, 10);
  if (raw === 'true')   return true;
  if (raw === 'false')  return false;
  if (raw === 'null')   return null;
  const n = Number(raw);
  if (raw !== '' && !isNaN(n)) return n;
  return raw;
}

// ─── Read-mode result builders ────────────────────────────────────────────────

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

// ─── Read-mode serialisation ──────────────────────────────────────────────────

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

  const namedBlocks = blocks.filter(b => b.id);
  const blockRefs = namedBlocks.map((b, i) =>
    databookId ? `<${databookId}#${b.id}>` : `_:block${i}`
  );
  if (blockRefs.length > 0) {
    triples.push(`    build:hasBlock   ${blockRefs.join(' ,\n                    ')} ;`);
  }

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
