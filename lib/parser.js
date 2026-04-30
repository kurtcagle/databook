/**
 * DataBook parser
 * Extracts frontmatter and fenced blocks from DataBook (.databook.md) files.
 *
 * Frontmatter forms (in priority order):
 *   1. Canonical (v1.1+): bare --- YAML frontmatter at document start
 *   2. Legacy  (v1.0):    <script language="application/yaml"> ... </script> wrapper
 *
 * The <script> form is silently accepted for backwards compatibility.
 * New DataBooks should always use bare --- frontmatter.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import yaml from 'js-yaml';

// Regex patterns
const RE_SCRIPT_OPEN  = /^<script\s+language=["']application\/yaml["']\s*>\s*$/;
const RE_SCRIPT_CLOSE = /^<\/script>\s*$/;
const RE_FENCE_OPEN   = /^```([\w][\w.\-+]*)\s*$/;
const RE_FENCE_CLOSE  = /^```\s*$/;
const RE_META_COMMENT = /^<!--\s*databook:([\w-]+):\s*(.*?)\s*-->\s*$/;
const RE_YAML_DELIM   = /^---\s*$/;

// Block labels that are display-only by default (not RDF/SPARQL payloads)
const DISPLAY_ONLY_LABELS = new Set([
  'javascript', 'js', 'typescript', 'ts', 'python', 'py',
  'bash', 'sh', 'shell', 'zsh', 'fish',
  'html', 'css', 'sql', 'java', 'rust', 'go', 'ruby', 'php', 'c', 'cpp',
]);

// RDF-pushable block labels (for push command)
export const PUSHABLE_LABELS = new Set([
  'turtle', 'turtle12', 'trig', 'json-ld', 'shacl', 'sparql-update',
]);

// RDF-loadable labels (for process command)
export const RDF_LABELS = new Set([
  'turtle', 'turtle12', 'trig', 'json-ld', 'shacl',
]);

/**
 * Parse a DataBook from file path.
 * @param {string} filePath
 * @returns {{ frontmatter: object, blocks: Block[], rawBody: string, filePath: string }}
 */
export function loadDataBookFile(filePath) {
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch (e) {
    throw new Error(`file not found: ${filePath}`);
  }
  const db = parseDataBook(content, filePath);
  if (!db) throw new Error(`no DataBook frontmatter found in: ${filePath}`);
  return db;
}

/**
 * Parse a DataBook from string content.
 * @param {string} content
 * @param {string|null} filePath  Used for relative path resolution.
 * @returns {{ frontmatter: object, blocks: Block[], rawBody: string, filePath: string }|null}
 */
export function parseDataBook(content, filePath = null) {
  const lines = content.split('\n');

  const { frontmatter, bodyStart, form } = extractFrontmatter(lines);
  if (!frontmatter) return null;

  const bodyLines = lines.slice(bodyStart);
  const blocks = parseBlocks(bodyLines, frontmatter);

  return {
    frontmatter,
    blocks,
    rawBody: bodyLines.join('\n'),
    filePath,
    form,  // 'canonical' | 'legacy-script' | null
  };
}

/**
 * Extract YAML frontmatter from parsed lines.
 *
 * Priority:
 *   1. Canonical bare --- form (v1.1+) — checked first
 *   2. Legacy <script language="application/yaml"> form (v1.0) — silent fallback
 *
 * Returns { frontmatter, bodyStart, form } or { frontmatter: null }.
 */
function extractFrontmatter(lines) {
  // ── 1. Canonical: bare --- YAML frontmatter ────────────────────────────────
  // The document opens with --- on the very first non-empty line.
  let firstContent = 0;
  while (firstContent < lines.length && lines[firstContent].trim() === '') firstContent++;

  if (firstContent < lines.length && RE_YAML_DELIM.test(lines[firstContent])) {
    // Find closing ---
    let fmEnd = -1;
    for (let i = firstContent + 1; i < lines.length; i++) {
      if (RE_YAML_DELIM.test(lines[i])) { fmEnd = i; break; }
    }
    if (fmEnd > firstContent) {
      const yamlStr = lines.slice(firstContent + 1, fmEnd).join('\n');
      try {
        const frontmatter = yaml.load(yamlStr, { schema: yaml.JSON_SCHEMA });
        return { frontmatter, bodyStart: fmEnd + 1, form: 'canonical' };
      } catch { /* malformed YAML — fall through to legacy */ }
    }
  }

  // ── 2. Legacy: <script language="application/yaml"> wrapper (v1.0) ─────────
  for (let i = 0; i < lines.length; i++) {
    if (RE_SCRIPT_OPEN.test(lines[i].trim())) {
      for (let j = i + 1; j < lines.length; j++) {
        if (RE_SCRIPT_CLOSE.test(lines[j].trim())) {
          const innerLines = lines.slice(i + 1, j);
          const yamlStr = extractYamlFromBlock(innerLines);
          if (yamlStr !== null) {
            try {
              const frontmatter = yaml.load(yamlStr, { schema: yaml.JSON_SCHEMA });
              return { frontmatter, bodyStart: j + 1, form: 'legacy-script' };
            } catch { /* malformed YAML — fall through */ }
          }
          break;
        }
      }
    }
  }

  return { frontmatter: null, bodyStart: 0, form: null };
}

/**
 * Extract YAML string from inside a <script> block (handles inner --- delimiters).
 */
function extractYamlFromBlock(lines) {
  // Find --- ... --- inside the block
  let start = -1, end = -1;
  for (let i = 0; i < lines.length; i++) {
    if (RE_YAML_DELIM.test(lines[i])) {
      if (start < 0) start = i;
      else { end = i; break; }
    }
  }
  if (start >= 0 && end > start) {
    return lines.slice(start + 1, end).join('\n');
  }
  if (start >= 0) {
    return lines.slice(start + 1).join('\n');
  }
  return lines.join('\n');
}

/**
 * Parse fenced blocks from document body.
 * @returns {Block[]}
 *
 * @typedef {Object} Block
 * @property {string|null} id          - databook:id comment value
 * @property {string} label            - fence language label
 * @property {string|null} role        - from frontmatter process.inputs
 * @property {string} content          - full block content (all lines joined)
 * @property {string[]} contentLines   - content lines
 * @property {number} line_count       - non-comment content lines
 * @property {number} comment_count    - <!-- databook:... --> lines
 * @property {boolean} display_only    - true if display-only
 * @property {Object} all_meta         - all databook:key comment values
 */
export function parseBlocks(bodyLines, frontmatter = null) {
  // Build role lookup from process.inputs
  const roleMap = {};
  const inputsList = frontmatter?.process?.inputs ?? [];
  for (const inp of inputsList) {
    if (inp.block_id) roleMap[inp.block_id] = inp.role ?? null;
  }

  const blocks = [];
  let i = 0;

  while (i < bodyLines.length) {
    const fenceMatch = RE_FENCE_OPEN.exec(bodyLines[i]);
    if (!fenceMatch) { i++; continue; }

    const label = fenceMatch[1];
    i++;

    const contentLines = [];
    const allMeta = {};
    let commentCount = 0;

    while (i < bodyLines.length) {
      const line = bodyLines[i];
      if (RE_FENCE_CLOSE.test(line)) { i++; break; }

      const metaMatch = RE_META_COMMENT.exec(line);
      if (metaMatch) {
        allMeta[metaMatch[1]] = metaMatch[2].trim();
        commentCount++;
      }
      contentLines.push(line);
      i++;
    }

    const blockId = allMeta['id'] ?? null;
    const displayOnly = allMeta['display-only'] === 'true' || DISPLAY_ONLY_LABELS.has(label);
    const lineCount = contentLines.filter(l => !RE_META_COMMENT.test(l)).length;

    blocks.push({
      id:           blockId,
      label,
      role:         blockId ? (roleMap[blockId] ?? null) : null,
      content:      contentLines.join('\n'),
      contentLines,
      line_count:   lineCount,
      comment_count: commentCount,
      display_only: displayOnly,
      all_meta:     allMeta,
    });
  }

  return blocks;
}

/**
 * Resolve a fragment reference to { filePath, blockId }.
 * @param {string} ref   - e.g. "queries.databook.md#block-id", "#block-id", or full IRI
 * @param {string|null} basePath - path of the referencing document for relative resolution
 */
export function resolveFragment(ref, basePath = null) {
  if (ref.startsWith('#')) {
    return { filePath: basePath, blockId: ref.slice(1) };
  }
  const hashIdx = ref.indexOf('#');
  if (hashIdx >= 0) {
    const fileRef = ref.slice(0, hashIdx);
    const blockId = ref.slice(hashIdx + 1);
    // Don't resolve IRIs as file paths
    if (fileRef.startsWith('https://') || fileRef.startsWith('http://')) {
      return { filePath: null, iri: fileRef, blockId };
    }
    const resolved = basePath
      ? resolve(dirname(basePath), fileRef)
      : resolve(fileRef);
    return { filePath: resolved, blockId };
  }
  // No fragment — just a file path
  if (ref.startsWith('https://') || ref.startsWith('http://')) {
    return { filePath: null, iri: ref, blockId: null };
  }
  const resolved = basePath
    ? resolve(dirname(basePath), ref)
    : resolve(ref);
  return { filePath: resolved, blockId: null };
}

/**
 * Fetch a block by id from a DataBook file or from an already-parsed DataBook.
 * @param {string} ref        - Fragment reference string
 * @param {object|null} db    - Already-parsed DataBook (for same-document references)
 * @returns {{ block: Block, db: object }}
 */
export function fetchFragmentBlock(ref, db = null) {
  const { filePath, blockId } = resolveFragment(ref, db?.filePath ?? null);

  let targetDb = db;
  if (filePath && filePath !== db?.filePath) {
    targetDb = loadDataBookFile(filePath);
  }
  if (!targetDb) throw new Error(`Cannot resolve fragment reference: ${ref}`);
  if (!blockId) throw new Error(`Fragment reference has no block id: ${ref}`);

  const block = targetDb.blocks.find(b => b.id === blockId);
  if (!block) throw new Error(`no block with id '${blockId}' in ${filePath ?? 'document'}`);
  return { block, db: targetDb };
}

/**
 * Get the content lines of a block (excluding databook:* comment lines).
 */
export function blockPayload(block) {
  return block.contentLines
    .filter(l => !RE_META_COMMENT.test(l))
    .join('\n');
}

// ─── Adjacent annotation helpers ──────────────────────────────────────────────
// Adjacent annotations are <!-- databook:key: value --> comment lines
// that appear immediately before a fenced block to attach metadata to it.

/**
 * Parse a single <!-- databook:key: value --> comment line into a key-value pair.
 * Returns { key: value } if the line is a databook annotation, or null otherwise.
 * @param {string} line
 * @returns {Object|null}
 */
export function parseAdjacentAnnotation(line) {
  const m = RE_META_COMMENT.exec(line.trim());
  if (!m) return null;
  return { [m[1]]: m[2].trim() };
}

/**
 * Serialise a metadata object to a single adjacent annotation line.
 * The id field is always primary; if no id, uses the first key present.
 * Returns a <!-- databook:id: value --> string, or null if meta is empty.
 * @param {Object} meta
 * @returns {string|null}
 */
export function serializeAdjacentAnnotation(meta) {
  if (!meta || Object.keys(meta).length === 0) return null;
  const key = 'id' in meta ? 'id' : Object.keys(meta)[0];
  const value = meta[key];
  if (value == null) return null;
  return `<!-- databook:${key}: ${value} -->`;
}

/**
 * Serialise a metadata object to an array of internal annotation comment lines,
 * one line per key. These are placed inside the fenced block, before the payload.
 * @param {Object} meta
 * @returns {string[]}
 */
export function serializeInternalAnnotations(meta) {
  if (!meta) return [];
  return Object.entries(meta)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `<!-- databook:${k}: ${v} -->`);
}
