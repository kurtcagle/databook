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
 *
 * Block annotation forms (both supported; adjacent is canonical going forward):
 *   1. Adjacent (v1.2+): <!-- databook:key: val; databook:key2: val2 --> on the line
 *      immediately before the opening fence, no blank line between them.
 *   2. Internal (v1.1):  <!-- databook:key: value --> as the first line(s) inside
 *      the fenced block. Retained for backward compatibility; internal wins on conflict.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import yaml from 'js-yaml';

// ── Regex patterns ────────────────────────────────────────────────────────────

const RE_SCRIPT_OPEN  = /^<script\s+language=["']application\/yaml["']\s*>\s*$/;
const RE_SCRIPT_CLOSE = /^<\/script>\s*$/;
const RE_FENCE_OPEN   = /^```([\w][\w.\-+]*)\s*$/;
const RE_FENCE_CLOSE  = /^```\s*$/;
// Matches a single databook:key: value pair (inside a fence, legacy form)
const RE_META_COMMENT = /^<!--\s*databook:([\w-]+):\s*(.*?)\s*-->\s*$/;
// Matches an adjacent annotation line (outside a fence, one or more k-v pairs)
const RE_ADJ_COMMENT  = /^<!--\s*databook:[\w-]+:.*?-->\s*$/;
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

// ── Public API ────────────────────────────────────────────────────────────────

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
  const blocks = parseBlocks(bodyLines, frontmatter, bodyStart);

  return {
    frontmatter,
    blocks,
    rawBody: bodyLines.join('\n'),
    rawLines: lines,         // full document lines (for patch operations)
    bodyStart,               // line index where body begins (for patch operations)
    filePath,
    form,  // 'canonical' | 'legacy-script' | null
  };
}

// ── Frontmatter extraction ────────────────────────────────────────────────────

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
  // ── 1. Canonical: bare --- YAML frontmatter ───────────────────────────────
  let firstContent = 0;
  while (firstContent < lines.length && lines[firstContent].trim() === '') firstContent++;

  if (firstContent < lines.length && RE_YAML_DELIM.test(lines[firstContent])) {
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

  // ── 2. Legacy: <script language="application/yaml"> wrapper (v1.0) ────────
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

// ── Adjacent annotation parsing ───────────────────────────────────────────────

/**
 * Parse an adjacent annotation line into a key-value object.
 *
 * Handles both single-pair and multi-pair formats:
 *   <!-- databook:id: my-block -->
 *   <!-- databook:id: my-block; databook:content-type: text/turtle; databook:label: My Block -->
 *
 * @param {string} line
 * @returns {object|null} parsed key-value pairs, or null if not an annotation line
 */
export function parseAdjacentAnnotation(line) {
  // Must match the outer structure
  const outer = line.match(/^<!--\s*(.*?)\s*-->\s*$/);
  if (!outer) return null;

  const inner = outer[1];
  const meta = {};

  // Split on '; databook:' boundaries (space before semicolon is optional)
  // This handles the multi-pair format while tolerating values that contain semicolons
  // (as long as the pattern '; databook:' doesn't appear in values — a documented constraint)
  const parts = inner.split(/;\s*databook:/);
  for (let i = 0; i < parts.length; i++) {
    let part = i === 0 ? parts[i].replace(/^databook:/, '') : parts[i];
    const colon = part.indexOf(':');
    if (colon < 0) continue;
    const key = part.slice(0, colon).trim();
    const val = part.slice(colon + 1).trim();
    if (key) meta[key] = val;
  }

  return Object.keys(meta).length > 0 ? meta : null;
}

// ── Block parsing ─────────────────────────────────────────────────────────────

/**
 * Parse fenced blocks from document body.
 * @param {string[]} bodyLines
 * @param {object|null} frontmatter
 * @param {number} bodyOffset  Absolute line number of the first body line (for patch ops).
 * @returns {Block[]}
 *
 * @typedef {Object} Block
 * @property {string|null} id              - databook:id value (from adjacent or internal annotation)
 * @property {string} label                - fence language label
 * @property {string|null} role            - from frontmatter process.inputs
 * @property {string} content              - full block content (all lines joined)
 * @property {string[]} contentLines       - content lines (between fences, incl. internal comments)
 * @property {number} line_count           - non-comment content lines
 * @property {number} comment_count        - <!-- databook:... --> lines found inside fence
 * @property {boolean} display_only        - true if display-only
 * @property {Object} allMeta              - all databook:key values (adjacent + internal merged)
 * @property {boolean} hasAdjacentAnnot    - true if annotation came from adjacent comment
 * @property {number} _fenceOpenLine       - absolute document line of the opening ``` (for patch)
 * @property {number} _fenceCloseLine      - absolute document line of the closing ``` (for patch)
 * @property {number|null} _adjAnnotLine   - absolute document line of adjacent annotation (if any)
 */
export function parseBlocks(bodyLines, frontmatter = null, bodyOffset = 0) {
  // Build role lookup from process.inputs
  const roleMap = {};
  const inputsList = frontmatter?.process?.inputs ?? [];
  for (const inp of inputsList) {
    if (inp.block_id) roleMap[inp.block_id] = inp.role ?? null;
  }

  const blocks = [];
  let i = 0;

  // Track pending adjacent annotations (accumulate across consecutive annotation lines)
  let pendingAdjMeta = {};
  let pendingAdjLine = null;  // absolute line of the last adjacent annotation
  let lastWasAnnotation = false;

  while (i < bodyLines.length) {
    const line = bodyLines[i];

    // ── Adjacent annotation line? ────────────────────────────────────────────
    if (RE_ADJ_COMMENT.test(line)) {
      const adjMeta = parseAdjacentAnnotation(line);
      if (adjMeta) {
        Object.assign(pendingAdjMeta, adjMeta);
        pendingAdjLine = bodyOffset + i;
      }
      lastWasAnnotation = true;
      i++;
      continue;
    }

    // ── Fence open? ──────────────────────────────────────────────────────────
    const fenceMatch = RE_FENCE_OPEN.exec(line);
    if (!fenceMatch) {
      // A blank line or non-annotation non-fence line clears pending adjacent meta
      if (line.trim() !== '' || !lastWasAnnotation) {
        pendingAdjMeta = {};
        pendingAdjLine = null;
      }
      lastWasAnnotation = false;
      i++;
      continue;
    }

    // Fence opens — capture adjacent meta before clearing
    const adjMeta      = { ...pendingAdjMeta };
    const adjAnnotLine = pendingAdjLine;
    const fenceOpenLine = bodyOffset + i;
    pendingAdjMeta = {};
    pendingAdjLine = null;
    lastWasAnnotation = false;

    const label = fenceMatch[1];
    i