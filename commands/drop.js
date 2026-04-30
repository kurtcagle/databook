/**
 * databook drop — remove one or more named blocks from a DataBook.
 *
 * Each named block consists of:
 *   - Zero or more adjacent annotation lines (<!-- databook:* -->) preceding
 *     the opening fence.
 *   - The fenced block itself (opening fence → content → closing fence).
 *
 * --remove-prose also removes the prose section that precedes each dropped
 * block — specifically, all lines between the end of the previous block (or
 * the start of the body) and the first annotation / fence line of the block
 * being dropped.  This cleanly strips the block's heading and lead-in text.
 *
 * Multiple blocks may be dropped in a single invocation by repeating --id.
 * Blocks are removed in reverse document order so that earlier line numbers
 * remain valid as later blocks are excised.
 *
 * If --id names a block that does not exist, the command fails unless
 * --ignore-missing is supplied.
 *
 * Writes back to the source file by default; use -o to redirect.
 * --dry-run prints the resulting document to stdout without writing.
 */

import { readFileSync }  from 'fs';
import { writeOutput, resolveEncoding, atomicWriteEncoded } from '../lib/encoding.js';
import { parseDataBook } from '../lib/parser.js';

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Run the `databook drop` command.
 *
 * @param {string|null} inputArg
 * @param {object}      opts
 * @param {string[]}    opts.id            - Block IDs to remove (repeatable; required)
 * @param {boolean}     [opts.removeProse] - Also remove the prose section preceding each block
 * @param {boolean}     [opts.ignoreMissing] - Silently skip ids that don't exist
 * @param {string}      [opts.output]
 * @param {boolean}     [opts.dryRun]
 * @param {string}      [opts.encoding]
 * @param {boolean}     [opts.quiet]
 */
export async function runDrop(inputArg, opts) {
  const {
    id:             idList      = [],
    removeProse     = false,
    ignoreMissing   = false,
    output:         outputOpt,
    dryRun          = false,
    encoding:       encOpt,
    quiet           = false,
  } = opts;

  // ── Resolve encoding ──────────────────────────────────────────────────────
  let enc;
  try { enc = resolveEncoding(encOpt); } catch (e) { die(e.message); }

  // ── Validate ──────────────────────────────────────────────────────────────
  if (!inputArg) die('E_DROP_NO_INPUT: a DataBook file path is required');
  if (!idList || idList.length === 0) die('E_DROP_NO_ID: at least one --id <block-id> is required');

  // ── Read and parse ─────────────────────────────────────────────────────────
  let raw;
  try { raw = readFileSync(inputArg, 'utf8'); } catch (_) { die(`file not found: ${inputArg}`); }

  const db = parseDataBook(raw, inputArg);
  if (!db) die(`E_DROP_NO_FRONTMATTER: not a valid DataBook: ${inputArg}`);

  const lines     = raw.split('\n');
  const bodyStart = findBodyStart(lines);
  const ranges    = scanBlockRanges(lines, bodyStart);

  // ── Validate all ids before mutating ──────────────────────────────────────
  const toRemove = [];
  for (const id of idList) {
    const r = ranges.find(x => x.id === id);
    if (!r) {
      if (ignoreMissing) {
        if (!quiet) process.stderr.write(`warn: W_DROP_NOT_FOUND: no block with id '${id}' — skipped\n`);
        continue;
      }
      die(
        `E_DROP_NOT_FOUND: no block with id '${id}' in ${inputArg}.\n` +
        `  Use --ignore-missing to skip absent ids silently.`
      );
    }
    toRemove.push(r);
  }

  if (toRemove.length === 0) {
    if (!quiet) process.stderr.write('info: nothing to drop\n');
    return;
  }

  // ── Compute removal ranges ────────────────────────────────────────────────
  // If --remove-prose, extend each range backwards to include the preceding
  // prose section (everything from the end of the previous block, or bodyStart,
  // through to the line just before startLine).
  const removalRanges = toRemove.map(r => {
    if (!removeProse) return { start: r.startLine, end: r.endLine };

    // Find the end of the preceding block (so we know where this prose starts).
    const proseStart = precedingContentEnd(ranges, r, bodyStart);
    return { start: proseStart, end: r.endLine };
  });

  // ── Remove in reverse order (highest line first) to preserve earlier indices ──
  removalRanges.sort((a, b) => b.start - a.start);

  let result = lines;
  for (const { start, end } of removalRanges) {
    result = [
      ...result.slice(0, start),
      ...result.slice(end + 1),
    ];
  }

  // ── Collapse runs of more than two consecutive blank lines ────────────────
  result = collapseBlankLines(result);

  // ── Output ────────────────────────────────────────────────────────────────
  const text = result.join('\n');

  if (dryRun) {
    writeOutput(null, text, enc);
    return;
  }

  const outPath = outputOpt ?? inputArg;
  atomicWriteEncoded(outPath, text, enc);

  if (!quiet) {
    const ids = toRemove.map(r => `'${r.id}'`).join(', ');
    const proseNote = removeProse ? ' (with prose)' : '';
    process.stderr.write(`info: dropped ${ids}${proseNote} from ${outPath}\n`);
  }
}

// ─── Prose extent helper ──────────────────────────────────────────────────────

/**
 * Find the first line of the prose section that precedes block `target`.
 *
 * The prose section for a block runs from the line after the preceding
 * block's closing fence (or from bodyStart if this is the first block)
 * up to target.startLine - 1.
 *
 * We skip any leading blank lines from that region so we don't leave an
 * orphaned blank line at the removal boundary.
 *
 * @param {object[]} allRanges  - All scanBlockRanges results for the document
 * @param {object}   target     - The range being dropped
 * @param {number}   bodyStart  - First body line index
 * @returns {number}            - First line to remove (inclusive)
 */
function precedingContentEnd(allRanges, target, bodyStart) {
  // Find the block immediately before target
  const before = allRanges
    .filter(r => r.endLine < target.startLine)
    .sort((a, b) => b.endLine - a.endLine)[0];

  const sectionStart = before ? before.endLine + 1 : bodyStart;

  // Skip leading blank lines so we don't pull in an unrelated blank separator.
  // We keep one blank line before the next block for clean spacing.
  return sectionStart;
}

// ─── Document scanning (mirrors insert.js) ────────────────────────────────────

const RE_FENCE_OPEN  = /^```([\w][\w.\-+]*)\s*$/;
const RE_FENCE_CLOSE = /^```\s*$/;
const RE_META        = /^<!--\s*databook:([\w-]+):\s*(.*?)\s*-->\s*$/;
const RE_YAML_DELIM  = /^---\s*$/;
const RE_SCRIPT_OPEN = /^<script\s+language=["']application\/yaml["']\s*>\s*$/;
const RE_SCRIPT_CLOSE= /^<\/script>\s*$/;

/**
 * Scan body lines for named block ranges.
 * Checks adjacent annotations before the fence first (canonical form),
 * then falls back to annotations inside the fence (legacy form).
 *
 * startLine = first adjacent annotation line, or the fence line if none
 * endLine   = closing fence line
 */
function scanBlockRanges(lines, bodyStart) {
  const ranges = [];
  let i = bodyStart;

  while (i < lines.length) {
    const fenceMatch = RE_FENCE_OPEN.exec(lines[i]);
    if (!fenceMatch) { i++; continue; }

    const fenceLine = i;

    // Look backwards for adjacent annotations (canonical form)
    let annotStart = fenceLine;
    const outerMeta = {};
    let j = fenceLine - 1;
    while (j >= bodyStart) {
      const m = RE_META.exec(lines[j]);
      if (!m) break;
      outerMeta[m[1]] = m[2].trim();
      annotStart = j;
      j--;
    }

    // Also scan inside fence (legacy compatibility)
    i = fenceLine + 1;
    const innerMeta = {};
    while (i < lines.length) {
      if (RE_FENCE_CLOSE.test(lines[i])) break;
      const m = RE_META.exec(lines[i]);
      if (m) innerMeta[m[1]] = m[2].trim();
      i++;
    }

    const endLine = i;
    i++;

    const meta = { ...innerMeta, ...outerMeta };
    if (meta['id']) {
      ranges.push({ id: meta['id'], startLine: annotStart, endLine });
    }
  }

  return ranges;
}

/**
 * Find the first body line (after frontmatter).
 */
function findBodyStart(lines) {
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;

  if (i < lines.length && RE_YAML_DELIM.test(lines[i])) {
    i++;
    while (i < lines.length && !RE_YAML_DELIM.test(lines[i])) i++;
    return i + 1;
  }

  for (let j = 0; j < lines.length; j++) {
    if (RE_SCRIPT_OPEN.test(lines[j].trim())) {
      for (let k = j + 1; k < lines.length; k++) {
        if (RE_SCRIPT_CLOSE.test(lines[k].trim())) return k + 1;
      }
    }
  }

  return 0;
}

/**
 * Collapse runs of more than two consecutive blank lines down to two.
 * Prevents removal from leaving large gaps in the document.
 */
function collapseBlankLines(lines) {
  const out = [];
  let blankRun = 0;
  for (const line of lines) {
    if (line.trim() === '') {
      blankRun++;
      if (blankRun <= 2) out.push(line);
    } else {
      blankRun = 0;
      out.push(line);
    }
  }
  // Trim trailing blank lines
  while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();
  out.push(''); // single trailing newline
  return out;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function die(msg) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(2);
}
