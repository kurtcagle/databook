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
 * Block annotation forms (both accepted):
 *   1. Pre-fence  (v1.2+, canonical): <!-- databook:id: block-id --> on the line
 *      immediately before the opening fence. Multiple annotation lines may appear
 *      consecutively. A single blank line between the annotations and the fence
 *      is tolerated (skipped) — there's no other block it could plausibly belong
 *      to, so this closes a common formatting trap without introducing ambiguity.
 *   2. Inline     (v1.1,  legacy):    <!-- databook:id: block-id --> as the first
 *      line(s) inside the fenced block. Still accepted for backwards compatibility.
 *
 * When both forms are present for the same key, pre-fence takes priority.
 *
 * Block directives (v1.2+): processing instructions in the same pre-fence
 * zone, written as un-namespaced key=value pairs:
 *   <!-- mode=printed -->
 *   <!-- mode=executed endpoint=<urn:jena:local> cache=true -->
 * One or more pairs per comment line; several directive lines may follow one
 * another. They are distinguished from databook: annotations by their shape
 * alone — no `databook:` prefix, `=` rather than `: ` — and are collected
 * into the block's `directives` map. Directive lines are accepted anywhere
 * in the pre-fence zone; by convention they come last (after databook:id and
 * the other databook: keys), which is exactly why the backward walk below
 * must not stop at them: a walk that halts on the first non-annotation line
 * would never reach databook:id on a conventionally-ordered block.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import yaml from 'js-yaml';

// Regex patterns
const RE_SCRIPT_OPEN  = /^<script\s+language=["']application\/yaml["']\s*>\s*$/;
const RE_SCRIPT_CLOSE = /^<\/script>\s*$/;
const RE_FENCE_OPEN   = /^```([\w][\w.\-+]*)\s*$/;
const RE_FENCE_CLOSE  = /^```\s*$/;
// Matches <!-- prefix:key: value --> for ANY prefix, not only `databook:`.
// A profile declared in frontmatter `profiles[]` may register a prefix of
// its own (S4.3 of the DataBook Specification Primer, e.g. `holon:` or
// `okf:`) via the sh:declare table on its PROF descriptor -- see
// lib/profiles.js. Storage convention, applied where matches are
// collected below: the core `databook:` prefix is stored under the bare
// key (`id`, not `databook:id`), matching every consumer's existing
// expectations; any other prefix is stored under the full `prefix:key`
// string, so `all_meta['holon:layer']` is distinguishable from a
// same-named core key and from another profile's `okf:layer`. A caller
// that wants to know whether a given prefix is one a declared profile
// actually registers -- rather than merely well-formed -- resolves
// frontmatter.profiles via lib/profiles.js and checks with its
// findUnregisteredPrefixes(); this regex only decides the syntactic
// question of "is this a prefix:key annotation at all."
const RE_META_COMMENT = /^<!--\s*([\w-]+):([\w-]+):\s*(.*?)\s*-->\s*$/;
// Block directive line: one or more un-namespaced key=value tokens.
// Values may not contain whitespace; IRIs are conventionally angle-bracketed.
const RE_DIRECTIVE    = /^<!--\s*((?:[\w-]+=\S+\s*)+)-->\s*$/;
const RE_YAML_DELIM   = /^---\s*$/;

// Block labels that are display-only by default (not RDF/SPARQL payloads)
const DISPLAY_ONLY_LABELS = new Set([
  'javascript', 'js', 'typescript', 'ts', 'python', 'py',
  'bash', 'sh', 'shell', 'zsh', 'fish',
  'html', 'css', 'sql', 'java', 'rust', 'go', 'ruby', 'php', 'c', 'cpp',
]);

// Directive `mode` values (S8.3 of the DataBook Specification Primer) that
// mean "not a live payload" in the same sense display-only always has here:
// printed (for reading, not execution), hidden (present but suppressed from
// rendered views), reference (surfaceable on demand, not shown by default).
// mode=executed and mode=rendered do NOT imply display-only -- an executed
// block IS the payload, and a rendered block's payload status is governed
// by its fence label exactly as before. This is additive to, not a
// replacement for, the ad hoc `databook:display-only: true` key below,
// which predates the spec's mode directive and remains accepted for
// backward compatibility; mode is the spec-aligned way to say the same
// thing going forward.
export const MODE_DISPLAY_ONLY_VALUES = new Set(['printed', 'hidden', 'reference']);

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
  // Normalise for cross-platform compatibility before any parsing.
  // Strip UTF-8 BOM (added by Windows Notepad / some editors) and
  // normalise CRLF / bare-CR line endings to LF.  This is necessary
  // because split('\n') on a CRLF file leaves \r attached to every
  // line, which can break YAML frontmatter detection and regex anchors
  // in edge cases (e.g. BOM + CRLF, bare \r, mixed endings).
  content = content.replace(/^\uFEFF/, '');
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

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
  // Normalise line endings here too so callers passing raw strings
  // (e.g. from HTTP responses or tests) get consistent behaviour.
  content = content.replace(/^\uFEFF/, '');
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
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
 *
 * Annotation look-up order for each block:
 *   1. Pre-fence: contiguous <!-- databook:key: value --> lines immediately
 *      before the opening fence (canonical v1.2+ placement). A single blank
 *      line between the annotations and the fence is tolerated (skipped).
 *   2. Inline: <!-- databook:key: value --> lines as the first content lines
 *      inside the fence (legacy v1.1 placement). Accepted for backwards
 *      compatibility. Pre-fence values take priority when both are present.
 *
 * @returns {Block[]}
 *
 * @typedef {Object} Block
 * @property {string|null} id           - databook:id comment value
 * @property {string} label             - fence language label
 * @property {string|null} role         - from frontmatter process.inputs
 * @property {string} content           - full block content (all lines joined)
 * @property {string[]} contentLines    - content lines
 * @property {number} line_count        - non-comment content lines
 * @property {number} comment_count     - <!-- databook:... --> lines inside the fence
 * @property {boolean} display_only     - true if display-only (label, `display-only` key, or `mode` -- see MODE_DISPLAY_ONLY_VALUES)
 * @property {Object} all_meta          - all databook:key comment values
 * @property {Object} directives        - pre-fence key=value directives (mode, endpoint, ...)
 * @property {string|null} mode         - shorthand for directives.mode
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
    const fenceLineIdx = i;
    i++;

    // ── Pre-fence annotations (canonical v1.2+ placement) ────────────────────
    // Walk backward from the line immediately before the fence opener.
    // Collect contiguous <!-- databook:key: value --> lines with no blank lines
    // between them and the fence. Stop at the first non-annotation line.
    const preFenceMeta = {};
    const directives = {};
    let lb = fenceLineIdx - 1;

    // Tolerate a single blank line between the annotation block and the
    // fence. There's no ambiguity here — nothing else could plausibly own
    // an annotation immediately preceding a fence — so skipping it costs
    // nothing and closes a common formatting trap: an annotation silently
    // orphaned by a stray blank line makes the block anonymous, which can
    // cause it to collide with other blocks on push (see commands/push.js,
    // resolveGraphIri / the destructive-PUT collision guard).
    if (lb >= 0 && bodyLines[lb].trim() === '') lb--;

    // The zone may interleave databook: annotations and directive lines in
    // any order; both kinds keep the walk going. Anything else ends it.
    // Walking backward means a later (lower) line wins on duplicate keys —
    // for directives that is reversed below so that the *first* occurrence
    // in reading order wins, matching how a forward-reading human sees it.
    const directiveLines = [];
    while (lb >= 0) {
      const line = bodyLines[lb];
      const m = RE_META_COMMENT.exec(line);
      if (m) {
        const [, prefix, key, value] = m;
        const storeKey = prefix === 'databook' ? key : `${prefix}:${key}`;
        preFenceMeta[storeKey] = value.trim();
        lb--;
        continue;
      }
      const d = RE_DIRECTIVE.exec(line);
      if (d) {
        directiveLines.unshift(d[1]);
        lb--;
        continue;
      }
      break;
    }
    for (const spec of directiveLines) {
      for (const token of spec.trim().split(/\s+/)) {
        const eq = token.indexOf('=');
        if (eq > 0) directives[token.slice(0, eq)] = token.slice(eq + 1);
      }
    }

    // ── Inside-fence content + legacy inline annotations ──────────────────────
    // Seed allMeta with pre-fence annotations (they take priority).
    const contentLines = [];
    const allMeta = { ...preFenceMeta };
    let commentCount = 0;

    while (i < bodyLines.length) {
      const line = bodyLines[i];
      if (RE_FENCE_CLOSE.test(line)) { i++; break; }

      const metaMatch = RE_META_COMMENT.exec(line);
      if (metaMatch) {
        const [, mPrefix, mKey, mValue] = metaMatch;
        const mStoreKey = mPrefix === 'databook' ? mKey : `${mPrefix}:${mKey}`;
        // Legacy inline annotation: only apply if key not already set by pre-fence.
        if (!(mStoreKey in preFenceMeta)) {
          allMeta[mStoreKey] = mValue.trim();
        }
        commentCount++;
      }
      contentLines.push(line);
      i++;
    }

    const blockId = allMeta['id'] ?? null;
    const displayOnly = allMeta['display-only'] === 'true'
      || DISPLAY_ONLY_LABELS.has(label)
      || MODE_DISPLAY_ONLY_VALUES.has(directives.mode);
    const lineCount = contentLines.filter(l => !RE_META_COMMENT.test(l)).length;

    blocks.push({
      id:             blockId,
      label,
      role:           blockId ? (roleMap[blockId] ?? null) : null,
      content:        contentLines.join('\n'),
      contentLines,
      line_count:     lineCount,
      comment_count:  commentCount,
      display_only:   displayOnly,
      all_meta:       allMeta,
      directives,
      mode:           directives.mode ?? null,
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
 * @param {string} ref       - Fragment reference string
 * @param {object|null} db   - Already-parsed DataBook (for same-document references)
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
  const [, prefix, key, value] = m;
  const storeKey = prefix === 'databook' ? key : `${prefix}:${key}`;
  return { [storeKey]: value.trim() };
}

/**
 * Parse a single pre-fence directive line (<!-- key=value ... -->) into a
 * map of key-value pairs. Returns null if the line is not a directive.
 * @param {string} line
 * @returns {Object|null}
 */
export function parseDirectiveLine(line) {
  const d = RE_DIRECTIVE.exec(line.trim());
  if (!d) return null;
  const out = {};
  for (const token of d[1].trim().split(/\s+/)) {
    const eq = token.indexOf('=');
    if (eq > 0) out[token.slice(0, eq)] = token.slice(eq + 1);
  }
  return out;
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
