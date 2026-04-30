/**
 * lib/parser.js
 * DataBook parser — v1.2
 *
 * Frontmatter forms (in priority order):
 *   1. Canonical (v1.1+): bare --- YAML frontmatter at document start
 *   2. Legacy  (v1.0):    <script language="application/yaml"> ... </script> wrapper
 *
 * Block annotation forms (both supported; external takes precedence on conflict):
 *   A. Adjacent external (v1.2, canonical): HTML comment on line immediately before
 *      the opening fence, no blank line between comment and fence.
 *      Supports single-key and multi-key (semicolon-separated) forms:
 *        <!-- databook:id: my-block -->
 *        <!-- databook:id: my-block; databook:content-type: text/turtle; databook:label: My Block -->
 *   B. Internal (v1.1, deprecated but accepted): HTML comment as first line(s)
 *      inside the fence:
 *        ```turtle
 *        <!-- databook:id: my-block -->
 *        ...content...
 *        ```
 *
 * Migration: `databook convert --upgrade-annotations` rewrites legacy internal
 * comments to external form. During the transition period both forms are parsed.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import yaml from 'js-yaml';

// ── Regex patterns ────────────────────────────────────────────────────────────

const RE_SCRIPT_OPEN  = /^<script\s+language=["']application\/yaml["']\s*>\s*$/;
const RE_SCRIPT_CLOSE = /^<\/script>\s*$/;
const RE_FENCE_OPEN   = /^```([\w][\w.\-+]*)\s*$/;
const RE_FENCE_CLOSE  = /^```\s*$/;
const RE_YAML_DELIM   = /^---\s*$/;

// Internal single-key comment (legacy, still accepted inside fences)
const RE_META_COMMENT_SINGLE = /^<!--\s*databook:([\w-]+):\s*(.*?)\s*-->\s*$/;

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
 * Parse a DataBook annotation comment line.
 * Handles both single-key and semicolon-separated multi-key forms.
 *
 * Returns an object of { key: value, ... } pairs, or null if the line
 * is not a databook annotation comment.
 *
 * Examples:
 *   <!-- databook:id: my-block -->
 *     → { id: 'my-block' }
 *   <!-- databook:id: prefixes; databook:content-type: text/turtle; databook:label: Prefixes -->
 *     → { id: 'prefixes', 'content-type': 'text/turtle', label: 'Prefixes' }
 *
 * @param {string} line
 * @returns {Object|null}
 */
export function parseMetaComment(line) {
  const RE_META_LINE = /^<!--\s*(.*?)\s*-->\s*$/;
  const match = RE_META_LINE.exec(line);
  if (!match) return null;

  const content = match[1];
  const result = {};

  // Split on '; databook:' boundaries to handle multi-key form
  const parts = content.split(/;\s*(?=databook:)/);
  for (const part of parts) {
    const kv = /^databook:([\w-]+):\s*(.*)$/.exec(part.trim());
    if (kv) {
      result[kv[1]] = kv[2].trim();
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

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
  // ── 1. Canonical: bare --- YAML frontmatter ────────────────────────────────
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

  // ── 2. Legacy: <script language="application/yaml"> wrapper (v1.0) ──────────
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

// ── Block parsing ─────────────────────────────────────────────────────────────

/**
 * Parse fenced blocks from document body.
 *
 * Supports two annotation forms (both yield identical block structure):
 *   External: HTML comment on line(s) immediately before the opening fence
 *   Internal: HTML comment as first line(s) inside the fence (legacy, deprecated)
 *
 * External annotations take precedence over internal on key conflicts.
 * Either signal (annotation present OR fence label is a known semantic type)
 * is sufficient to trigger block uplift.
 *
 * @returns {Block[]}
 *
 * @typedef {Object} Block
 * @property {string|null} id               - databook:id value
 * @property {string} label                 - fence language label
 * @property {string|null} role             - from frontmatter process.inputs
 * @property {string} content               - full block content (all lines joined)
 * @property {string[]} contentLines        - content lines (including internal meta comments)
 * @property {number} line_count            - non-comment content lines
 * @property {number} comment_count         - internal <!-- databook:... --> lines
 * @property {boolean} display_only         - true if display-only
 * @property {Object} all_meta              - merged databook:key comment values
 * @property {number} fenceOpenLine         - index in bodyLines of the ``` opening
 * @property {number} fenceCloseLine        - index in bodyLines of the ``` closing
 * @property {number[]} externalAnnotationLines - bodyLines indices of external annotation lines
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
    const fenceOpenLine = i;

    // ── Collect adjacent external annotations ────────────────────────────────
    // Walk backwards from the fence, collecting contiguous annotation comment
    // lines with no blank lines between them and the fence.
    const externalMeta = {};
    const externalAnnotationLines = [];
    let lookback = i - 1;
    while (lookback >= 0) {
      const prevLine = bodyLines[lookback];
      if (prevLine.trim() === '') break;           // blank line breaks adjacency
      const parsed = parseMetaComment(prevLine);
      if (parsed) {
        // Earlier (further from fence) lines have lower priority — assign first,
        // closer lines will overwrite on conflict
        Object.assign(externalMeta, parsed);
        externalAnnotationLines.unshift(lookback); // keep in document order
        lookback--;
      } else {
        break; // non-blank, non-annotation line breaks adjacency
      }
    }
    // Re-apply in reverse (closer to fence = higher priority) to get correct
    // precedence when multiple external annotation lines exist
    if (externalAnnotationLines.length > 1) {
      const reordered = {};
      for (let k = externalAnnotationLines.length - 1; k >= 0; k--) {
        const parsed = parseMetaComment(bodyLines[externalAnnotationLines[k]]);
        if (parsed) Object.assign(reordered, parsed);
      }
      Object.assign(externalMeta, reordered);
    }

    i++;

    // ── Collect internal annotation lines and content ─────────────────────────
    const contentLines = [];
    const internalMeta = {};
    let commentCount = 0;

    while (i < bodyLines.length) {
      const line = bodyLines[i];
      if (RE_FENCE_CLOSE.test(line)) { i++; break; }

      const metaParsed = parseMetaComment(line);
      if (metaParsed) {
        Object.assign(internalMeta, metaParsed);
        commentCount++;
      }
      contentLines.push(line);
      i++;
    }

    const fenceCloseLine = i - 1;

    // External takes precedence over internal on key conflicts (external = canonical)
    const allMeta = { ...internalMeta, ...externalMeta };

    const blockId     = allMeta['id'] ?? null;
    const displayOnly = allMeta['display-only'] === 'true' || DISPLAY_ONLY_LABELS.has(label);
    const lineCount   = contentLines.filter(l => parseMetaComment(l) === null).length;

    blocks.push({
      id:                     blockId,
      label,
      role:                   blockId ? (roleMap[blockId] ?? null) : null,
      content:                contentLines.join('\n'),
      contentLines,
      line_count:             lineCount,
      comment_count:          commentCount,
      display_only:           displayOnly,
      all_meta:               allMeta,
      // Line tracking for patch operations (indices in bodyLines):
      fenceOpenLine,
      fenceCloseLine,
      externalAnnotationLines,
    });
  }

  return blocks;
}

// ── Fragment resolution ───────────────────────────────────────────────────────

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
 * Get the payload content of a block, stripping databook:* annotation comment lines.
 * Works for both internal (inside fence) and external (outside fence) annotations
 * since external lines are never part of contentLines.
 */
export function blockPayload(block) {
  return block.contentLines
    .filter(l => parseMetaComment(l) === null)
    .join('\n');
}

/**
 * Serialise a DataBook from a (possibly modified) frontmatter object and raw body string.
 * Always emits the canonical bare --- frontmatter form.
 *
 * @param {object} frontmatter  - Frontmatter object
 * @param {string} rawBody      - Body text (lines after frontmatter)
 * @returns {string}
 */
export function serializeDataBook(frontmatter, rawBody) {
  const yamlStr = yaml.dump(frontmatter, {
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: false,
    noRefs: true,
  });
  // Ensure body starts with a newline
  const body = rawBody.startsWith('\n') ? rawBody : '\n' + rawBody;
  return `---\n${yamlStr}---\n${body}`;
}
