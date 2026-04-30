/**
 * databook insert — insert a data file as a named fenced block, or edit body
 * prose, in an existing DataBook.
 *
 * BLOCK MODE  (--id required, [file] required):
 *   Insert a data file as a named fenced block.
 *   - Fails with E_INSERT_ID_EXISTS if the id is already present unless
 *     --force is also supplied (overwrite mode).
 *   - Language is inferred from the file extension when --lang is omitted.
 *   - --markdown "text" | @path inserts a prose section immediately before
 *     the new fence.  --markdown-mode is ignored in block mode.
 *   - --before <id> / --after <id> control position; default is append.
 *   - --force replaces the existing fence range; any existing prose above
 *     the fence is preserved; --markdown prepends new prose before the fence.
 *
 * PROSE MODE  (--id absent, --markdown required, [file] ignored):
 *   Edit body prose without touching any data blocks.
 *   --markdown-mode controls placement:
 *     append   (default) Add prose after the last block, or at end of body.
 *     prepend            Insert prose immediately after the frontmatter,
 *                        before any existing body content.
 *     replace            Strip all non-block prose; reconstruct body as
 *                        new prose followed by all named blocks in order.
 *
 * Writes back to the source file by default; use -o to redirect.
 * --dry-run prints the resulting document to stdout without writing.
 */

import { readFileSync, existsSync } from 'fs';
import { extname }                  from 'path';
import { writeOutput, resolveEncoding, atomicWriteEncoded } from '../lib/encoding.js';
import { parseDataBook }            from '../lib/parser.js';

// ─── Extension → fence-language map ──────────────────────────────────────────

const EXT_LANG = {
  '.ttl':    'turtle',
  '.turtle': 'turtle',
  '.rq':     'sparql',
  '.sparql': 'sparql',
  '.shacl':  'shacl',
  '.json':   'json',
  '.jsonld': 'json-ld',
  '.yaml':   'yaml',
  '.yml':    'yaml',
  '.md':     'markdown',
  '.trig':   'trig',
  '.n3':     'turtle',
  '.nt':     'ntriples',
  '.xml':    'xml',
  '.csv':    'csv',
  '.tsv':    'tsv',
  '.txt':    'text',
  '.prompt': 'prompt',
};

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Run the `databook insert` command.
 *
 * BLOCK MODE opts (--id required):
 * @param {string|null} inputArg
 * @param {string|null} dataFile       - File to insert as a block
 * @param {object}      opts
 * @param {string}      opts.id              - Block ID (required in block mode)
 * @param {string}      [opts.lang]          - Fence language (inferred from ext)
 * @param {string}      [opts.before]        - Anchor block id: insert before
 * @param {string}      [opts.after]         - Anchor block id: insert after
 * @param {string}      [opts.markdown]      - Prose text or @filepath
 * @param {boolean}     [opts.force]         - Overwrite if id collides
 *
 * PROSE MODE opts (--id absent, --markdown required):
 * @param {string}      [opts.markdownMode]  - 'append' | 'prepend' | 'replace'
 *
 * SHARED opts:
 * @param {string}      [opts.output]
 * @param {boolean}     [opts.dryRun]
 * @param {string}      [opts.encoding]
 * @param {boolean}     [opts.quiet]
 */
export async function runInsert(inputArg, dataFile, opts) {
  const {
    id:             blockId,
    lang:           langOpt,
    before:         beforeId,
    after:          afterId,
    markdown:       markdownOpt,
    markdownMode:   markdownModeOpt = 'append',
    force          = false,
    output:         outputOpt,
    dryRun         = false,
    encoding:       encOpt,
    quiet          = false,
  } = opts;

  // ── Resolve encoding ──────────────────────────────────────────────────────
  let enc;
  try { enc = resolveEncoding(encOpt); } catch (e) { die(e.message); }

  // ── Route: prose mode vs block mode ──────────────────────────────────────
  if (!blockId) {
    return runProseInsert(inputArg, opts, enc);
  }

  // ════════════════════════════════════════════════════════════════════════
  // BLOCK MODE
  // ════════════════════════════════════════════════════════════════════════

  if (!inputArg) die('E_INSERT_NO_INPUT: a DataBook file path is required');
  if (!dataFile) die('E_INSERT_NO_DATA: a data file to insert is required (--id given but no [file] argument)');

  if (beforeId && afterId) {
    die('E_INSERT_ANCHOR_CONFLICT: --before and --after are mutually exclusive');
  }

  // ── Read the target DataBook ──────────────────────────────────────────────
  let raw;
  try { raw = readFileSync(inputArg, 'utf8'); } catch (_) { die(`file not found: ${inputArg}`); }

  const db = parseDataBook(raw, inputArg);
  if (!db) die(`E_INSERT_NO_FRONTMATTER: not a valid DataBook: ${inputArg}`);

  // ── ID collision check ────────────────────────────────────────────────────
  const collision = db.blocks.find(b => b.id === blockId);
  if (collision && !force) {
    die(
      `E_INSERT_ID_EXISTS: block id '${blockId}' already exists in ${inputArg}.\n` +
      `  Use --force to overwrite the existing block.`
    );
  }

  // ── Read data file ────────────────────────────────────────────────────────
  if (!existsSync(dataFile)) die(`data file not found: ${dataFile}`);
  const dataContent = readFileSync(dataFile, 'utf8');

  // ── Determine fence language ──────────────────────────────────────────────
  const lang = langOpt ?? EXT_LANG[extname(dataFile).toLowerCase()] ?? 'text';

  // ── Resolve optional markdown prose ──────────────────────────────────────
  const prose = resolveProse(markdownOpt);

  // ── Build block lines ─────────────────────────────────────────────────────
  // Annotations go BEFORE the opening fence (spec-canonical form).
  const blockLines = [
    `<!-- databook:id: ${blockId} -->`,
    `<!-- databook:source: ${dataFile} -->`,
    `\`\`\`${lang}`,
    dataContent.trimEnd(),
    '```',
  ];

  // ── Build prose lines ─────────────────────────────────────────────────────
  const proseLines = prose ? ['', prose, ''] : [];

  // ── Apply to document ─────────────────────────────────────────────────────
  const lines = raw.split('\n');
  const bodyStart = findBodyStart(lines);
  let result;

  if (collision && force) {
    result = overwriteBlock(lines, blockId, blockLines, proseLines, bodyStart, quiet);
  } else {
    result = spliceBlock(lines, blockLines, proseLines, db, beforeId, afterId, bodyStart);
  }

  // ── Output ────────────────────────────────────────────────────────────────
  writeResult(result, outputOpt ?? inputArg, dryRun, enc);
  if (!dryRun && !quiet) {
    const verb = collision ? 'replaced' : 'inserted';
    process.stderr.write(`info: block '${blockId}' ${verb} in ${outputOpt ?? inputArg}\n`);
  }
}

// ─── Prose mode ───────────────────────────────────────────────────────────────

const VALID_MARKDOWN_MODES = ['append', 'prepend', 'replace'];

/**
 * Prose-only insert: edit body prose without touching any data blocks.
 * Activated when --id is absent.
 */
async function runProseInsert(inputArg, opts, enc) {
  const {
    markdown:     markdownOpt,
    markdownMode: markdownModeOpt = 'append',
    output:       outputOpt,
    dryRun       = false,
    quiet        = false,
  } = opts;

  if (!inputArg) die('E_INSERT_NO_INPUT: a DataBook file path is required');

  if (!markdownOpt) {
    die(
      'E_INSERT_PROSE_NO_MARKDOWN: --id is absent (prose mode) but --markdown was not supplied.\n' +
      '  Provide --markdown "text" | @path, or supply --id to insert a block.'
    );
  }

  const mode = (markdownModeOpt ?? 'append').toLowerCase();
  if (!VALID_MARKDOWN_MODES.includes(mode)) {
    die(
      `E_INSERT_MARKDOWN_MODE: unknown --markdown-mode '${markdownModeOpt}'.\n` +
      `  Valid values: ${VALID_MARKDOWN_MODES.join(', ')}.`
    );
  }

  let raw;
  try { raw = readFileSync(inputArg, 'utf8'); } catch (_) { die(`file not found: ${inputArg}`); }

  const db = parseDataBook(raw, inputArg);
  if (!db) die(`E_INSERT_NO_FRONTMATTER: not a valid DataBook: ${inputArg}`);

  const prose = resolveProse(markdownOpt);
  const lines = raw.split('\n');
  const bodyStart = findBodyStart(lines);

  let result;
  switch (mode) {
    case 'prepend': result = proseModePrepend(lines, prose, bodyStart); break;
    case 'replace': result = proseModeReplace(lines, prose, bodyStart); break;
    default:        result = proseModeAppend(lines, prose, bodyStart);  break;
  }

  writeResult(result, outputOpt ?? inputArg, dryRun, enc);
  if (!dryRun && !quiet) {
    process.stderr.write(`info: prose ${mode}ed in ${outputOpt ?? inputArg}\n`);
  }
}

// ─── Prose placement strategies ───────────────────────────────────────────────

/**
 * Append: add prose after the last block (or at end of body if no blocks).
 */
function proseModeAppend(lines, prose, bodyStart) {
  return lines.join('\n').trimEnd() + '\n\n' + prose.trimEnd() + '\n';
}

/**
 * Prepend: insert prose immediately after the frontmatter, before any
 * existing body content.
 */
function proseModePrepend(lines, prose, bodyStart) {
  const header = lines.slice(0, bodyStart);
  const body   = lines.slice(bodyStart);

  // Trim any leading blank lines from the existing body to avoid double spacing.
  let bodyTrimStart = 0;
  while (bodyTrimStart < body.length && body[bodyTrimStart].trim() === '') bodyTrimStart++;

  return [
    ...header,
    '',
    prose.trimEnd(),
    '',
    ...body.slice(bodyTrimStart),
  ].join('\n').trimEnd() + '\n';
}

/**
 * Replace: strip all non-block prose; reconstruct body as new prose followed
 * by all named blocks in their original order.
 *
 * Named blocks include their adjacent annotation lines (<!-- databook:* -->)
 * immediately preceding the fence.
 */
function proseModeReplace(lines, prose, bodyStart) {
  const ranges = scanBlockRanges(lines, bodyStart);
  const header = lines.slice(0, bodyStart);

  const blockChunks = ranges.map(r =>
    lines.slice(r.startLine, r.endLine + 1).join('\n')
  );

  const newBody = blockChunks.length > 0
    ? prose.trimEnd() + '\n\n' + blockChunks.join('\n\n')
    : prose.trimEnd();

  return [...header, '', newBody, ''].join('\n');
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Resolve --markdown value: inline text or @path file reference.
 * Returns null if markdownOpt is falsy.
 */
function resolveProse(markdownOpt) {
  if (!markdownOpt) return null;
  if (markdownOpt.startsWith('@')) {
    const mdPath = markdownOpt.slice(1);
    try { return readFileSync(mdPath, 'utf8').trimEnd(); }
    catch (_) { die(`markdown file not found: ${mdPath}`); }
  }
  return markdownOpt.trimEnd();
}

/**
 * Write result to file or stdout; handles dry-run.
 */
function writeResult(result, outPath, dryRun, enc) {
  if (dryRun) {
    writeOutput(null, result, enc);
  } else {
    atomicWriteEncoded(outPath, result, enc);
  }
}

// ─── Document reconstruction ──────────────────────────────────────────────────

/**
 * Splice a new block into the document at the correct position.
 * Position is determined by --before, --after, or end-of-body (default).
 */
function spliceBlock(lines, blockLines, proseLines, db, beforeId, afterId, bodyStart) {
  const ranges = scanBlockRanges(lines, bodyStart);

  if (beforeId) {
    const r = ranges.find(x => x.id === beforeId);
    if (!r) die(`E_INSERT_ANCHOR_NOT_FOUND: no block with id '${beforeId}' (--before)`);
    const before = lines.slice(0, r.startLine);
    const after  = lines.slice(r.startLine);
    const insert = [...proseLines, ...blockLines, ''];
    return [...before, ...insert, ...after].join('\n');
  }

  if (afterId) {
    const r = ranges.find(x => x.id === afterId);
    if (!r) die(`E_INSERT_ANCHOR_NOT_FOUND: no block with id '${afterId}' (--after)`);
    const before = lines.slice(0, r.endLine + 1);
    const after  = lines.slice(r.endLine + 1);
    const insert = ['', ...proseLines, ...blockLines, ''];
    return [...before, ...insert, ...after].join('\n');
  }

  // Default: append at end of body
  const trailing = lines.join('\n').trimEnd();
  const insert = ['', ...proseLines, ...blockLines, ''].join('\n');
  return trailing + '\n' + insert;
}

/**
 * Overwrite an existing named block (--force).
 * Replaces from the first annotation line through the closing fence.
 * If proseLines are provided they are prepended immediately before the annotations.
 */
function overwriteBlock(lines, blockId, blockLines, proseLines, bodyStart, quiet) {
  const ranges = scanBlockRanges(lines, bodyStart);
  const r = ranges.find(x => x.id === blockId);
  if (!r) {
    die(`E_INSERT_BLOCK_NOT_FOUND: block '${blockId}' not found for overwrite`);
  }

  const before = lines.slice(0, r.startLine);
  const after  = lines.slice(r.endLine + 1);
  const insert = [...proseLines, ...blockLines];

  if (!quiet && proseLines.length > 0) {
    process.stderr.write(
      `warn: W_INSERT_FORCE_PROSE: --markdown content prepended before '${blockId}'; ` +
      `existing prose above the block is preserved.\n`
    );
  }

  return [...before, ...insert, '', ...after].join('\n');
}

// ─── Document scanning ────────────────────────────────────────────────────────

const RE_FENCE_OPEN  = /^```([\w][\w.\-+]*)\s*$/;
const RE_FENCE_CLOSE = /^```\s*$/;
const RE_META        = /^<!--\s*databook:([\w-]+):\s*(.*?)\s*-->\s*$/;
const RE_YAML_DELIM  = /^---\s*$/;
const RE_SCRIPT_OPEN = /^<script\s+language=["']application\/yaml["']\s*>\s*$/;
const RE_SCRIPT_CLOSE= /^<\/script>\s*$/;

/**
 * Scan body lines and return an array of { id, startLine, endLine }
 * for all named blocks.  Line numbers are absolute (0-indexed from document start).
 *
 * Annotations are now the spec-canonical form: <!-- databook:key: value -->
 * on lines immediately BEFORE the opening fence, not inside the block.
 *
 * For backwards compatibility, annotations inside the block (old format) are
 * also recognised and the block is still identified, but startLine in that
 * case points to the fence opener itself.
 *
 * startLine = first adjacent annotation line (or fence line if none)
 * endLine   = closing fence line
 */
function scanBlockRanges(lines, bodyStart) {
  const ranges = [];
  let i = bodyStart;

  while (i < lines.length) {
    const fenceMatch = RE_FENCE_OPEN.exec(lines[i]);
    if (!fenceMatch) { i++; continue; }

    const fenceLine = i;

    // ── Look backwards for adjacent annotations (canonical form) ───────────
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

    // ── Scan inside fence for annotations (legacy compatibility) ───────────
    i = fenceLine + 1;
    const innerMeta = {};
    while (i < lines.length) {
      if (RE_FENCE_CLOSE.test(lines[i])) break;
      const m = RE_META.exec(lines[i]);
      if (m) innerMeta[m[1]] = m[2].trim();
      i++;
    }

    const endLine = i; // closing ``` line
    i++;               // advance past closing fence

    // Outer annotations take precedence over inner ones
    const meta = { ...innerMeta, ...outerMeta };

    if (meta['id']) {
      ranges.push({ id: meta['id'], startLine: annotStart, endLine });
    }
  }

  return ranges;
}

/**
 * Find the 0-indexed line number of the first body line (after frontmatter).
 * Mirrors the logic in lib/parser.js.
 */
function findBodyStart(lines) {
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;

  if (i < lines.length && RE_YAML_DELIM.test(lines[i])) {
    i++;
    while (i < lines.length && !RE_YAML_DELIM.test(lines[i])) i++;
    return i + 1; // line after closing ---
  }

  for (let j = 0; j < lines.length; j++) {
    if (RE_SCRIPT_OPEN.test(lines[j].trim())) {
      for (let k = j + 1; k < lines.length; k++) {
        if (RE_SCRIPT_CLOSE.test(lines[k].trim())) return k + 1;
      }
    }
  }

  return 0; // no frontmatter: treat whole file as body
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function die(msg) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(2);
}
