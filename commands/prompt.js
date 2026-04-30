/**
 * commands/prompt.js
 * DataBook CLI — prompt command
 *
 * Sends a DataBook (or specific block) as context to an Anthropic LLM
 * along with a prompt, then either:
 *   (a) Writes the response into a new output DataBook [default — transform semantics]
 *   (b) Patches the response back into the source DataBook [--patch / --patch-block]
 *
 * Patch modes:
 *   --patch frontmatter.FIELD       Write response to a frontmatter field
 *   --patch-block BLOCK-ID          Replace or create a named block with the response
 *   --patch-mode merge|replace      For list frontmatter fields, merge (append) or replace
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 *
 * Usage:
 *   databook prompt source.databook.md --prompt "Summarise the class hierarchy"
 *   databook prompt source.databook.md --prompt-file query.txt --block-id primary-block
 *   databook prompt source.databook.md --prompt-block prompt-id -o response.databook.md
 *   databook prompt source.databook.md --prompt "Write abstract" --patch frontmatter.description
 *   databook prompt source.databook.md --prompt "Suggest splits" --patch-block split-report
 */

import fs                        from 'fs';
import path                      from 'path';
import crypto                    from 'crypto';
import yaml                      from 'js-yaml';
import { writeOutput,
         atomicWriteEncoded,
         resolveEncoding }       from '../lib/encoding.js';
import { loadDataBookFile,
         blockPayload,
         serializeAdjacentAnnotation,
         serializeInternalAnnotations } from '../lib/parser.js';

const DEFAULT_MODEL      = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 4096;
const API_URL            = 'https://api.anthropic.com/v1/messages';
const API_VERSION        = '2023-06-01';

// ── Public entry point ─────────────────────────────────────────────────────

export async function runPrompt(source, opts) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) die('ANTHROPIC_API_KEY environment variable is not set.', 1);

  let enc;
  try { enc = resolveEncoding(opts.encoding); } catch (e) { die(e.message, 2); }

  // ── Determine mode ────────────────────────────────────────────────────────
  const isPatch = !!(opts.patch || opts.patchBlock);

  // ── Load source DataBook (optional) ───────────────────────────────────────
  let db = null;
  if (source) {
    try { db = loadDataBookFile(source); } catch (e) { die(e.message, 2); }
  }

  // Validate: patch modes require a source file
  if (isPatch && !source)       die('--patch and --patch-block require a source DataBook file.', 2);
  if (opts.blockId && !source)  die('--block-id requires a source DataBook file.', 2);
  if (opts.promptBlock && !source) die('--prompt-block requires a source DataBook file.', 2);

  const fm = db?.frontmatter ?? {};

  // ── Resolve prompt text ───────────────────────────────────────────────────
  const promptText = resolvePrompt(opts, db);

  // ── Build LLM context ─────────────────────────────────────────────────────
  const context = buildContext(source, db, opts);

  // ── Call Anthropic API ────────────────────────────────────────────────────
  const model     = opts.model ?? DEFAULT_MODEL;
  const maxTokens = parseInt(opts.maxTokens ?? DEFAULT_MAX_TOKENS, 10);

  if (opts.dryRun) {
    log(`[prompt] Mode:       ${isPatch ? (opts.patch ? `patch frontmatter.${opts.patch.replace(/^frontmatter\./,'')}` : `patch-block ${opts.patchBlock}`) : 'transform'}`);
    log(`[prompt] Model:      ${model}`);
    log(`[prompt] Max tokens: ${maxTokens}`);
    log(`[prompt] Context:    ${context ? context.split('\n').length + ' lines' : '(none)'}`);
    log(`[prompt] Prompt:     ${promptText.slice(0, 120)}${promptText.length > 120 ? '…' : ''}`);
    log(`[prompt] [dry-run: API call skipped]`);
    process.exit(0);
  }

  if (opts.verbose) {
    log(`[prompt] POST ${API_URL}`);
    log(`[prompt] Model: ${model}, max_tokens: ${maxTokens}`);
  }

  const responseText = await callAnthropicApi(apiKey, model, maxTokens, context, promptText, opts.system);

  if (opts.verbose) {
    log(`[prompt] Response: ${responseText.split('\n').length} lines`);
  }

  // ── Route to patch or transform ───────────────────────────────────────────
  if (isPatch) {
    const sourceRaw = fs.readFileSync(source, 'utf8');
    const patched   = applyPatch(sourceRaw, db, responseText, opts);
    const outPath   = opts.output ?? source;  // default: patch in place
    atomicWriteEncoded(outPath, patched, enc);
    if (opts.verbose) log(`[prompt] Patched ${opts.patch ? 'frontmatter' : 'block'} written to ${outPath}`);
    return;
  }

  // ── Transform mode: build output DataBook ────────────────────────────────
  const outputDataBook = buildOutputDataBook({
    sourceId:    fm.id ?? (source ? `file://${path.resolve(source)}` : null),
    sourceTitle: fm.title ?? (source ? path.basename(source) : null),
    promptText,
    promptSource: describePromptSource(opts),
    model,
    responseText,
    blockId:    opts.blockId ?? null,
  });

  // ── Write output ──────────────────────────────────────────────────────────
  const outPath = opts.output ?? null;
  if (outPath) {
    atomicWriteEncoded(outPath, outputDataBook, enc);
    if (opts.verbose) log(`[prompt] Written to ${outPath}`);
  } else {
    writeOutput(null, outputDataBook, enc);
  }
}

// ── Patch application ──────────────────────────────────────────────────────

/**
 * Apply an LLM response as a targeted patch to a DataBook source string.
 * @param {string} sourceRaw   - raw document text
 * @param {object} db          - parsed DataBook (with _fenceOpenLine / _fenceCloseLine)
 * @param {string} responseText - LLM response to write
 * @param {object} opts        - { patch, patchBlock, patchMode }
 * @returns {string}           - patched document text
 */
function applyPatch(sourceRaw, db, responseText, opts) {
  if (opts.patch) {
    return applyFrontmatterPatch(sourceRaw, db, responseText, opts);
  }
  if (opts.patchBlock) {
    return applyBlockPatch(sourceRaw, db, responseText, opts);
  }
  throw new Error('applyPatch called without --patch or --patch-block');
}

/**
 * Patch a frontmatter field with the LLM response.
 * Supports dotted paths: "frontmatter.description", "frontmatter.graph.named_graph"
 * @param {string}  sourceRaw
 * @param {object}  db
 * @param {string}  responseText
 * @param {object}  opts   { patch: "frontmatter.FIELD", patchMode: "replace"|"merge" }
 */
function applyFrontmatterPatch(sourceRaw, db, responseText, opts) {
  // Strip leading "frontmatter." prefix if present
  const fieldPath = opts.patch.replace(/^frontmatter\./, '');
  const parts     = fieldPath.split('.');
  const mode      = opts.patchMode ?? 'replace';
  const lines     = sourceRaw.split('\n');

  // Deep-set into the parsed frontmatter object
  const fm = JSON.parse(JSON.stringify(db.frontmatter)); // deep clone
  let cursor = fm;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cursor[parts[i]] || typeof cursor[parts[i]] !== 'object') {
      cursor[parts[i]] = {};
    }
    cursor = cursor[parts[i]];
  }

  const leaf = parts[parts.length - 1];
  const existing = cursor[leaf];
  const trimmed = responseText.trim();

  if (mode === 'merge' && Array.isArray(existing)) {
    // Merge: append new items (split response by newline, filter blank lines)
    const newItems = trimmed.split('\n').map(s => s.trim()).filter(Boolean);
    cursor[leaf] = [...existing, ...newItems];
  } else {
    cursor[leaf] = trimmed;
  }

  // Re-serialise the frontmatter and splice it back in
  const newYaml = yaml.dump(fm, { lineWidth: 120, quotingType: '"', forceQuotes: false });

  // Find frontmatter boundaries in the raw lines
  let fmStart = -1, fmEnd = -1;
  let firstContent = 0;
  while (firstContent < lines.length && lines[firstContent].trim() === '') firstContent++;

  if (db.form === 'canonical') {
    fmStart = firstContent;     // the opening ---
    for (let i = fmStart + 1; i < lines.length; i++) {
      if (/^---\s*$/.test(lines[i])) { fmEnd = i; break; }
    }
    if (fmEnd < 0) die('Cannot locate frontmatter closing --- for patch.');
    // Replace lines[fmStart+1 .. fmEnd-1] with new YAML
    const before = lines.slice(0, fmStart + 1);
    const after  = lines.slice(fmEnd);
    const newYamlLines = newYaml.trimEnd().split('\n');
    return [...before, ...newYamlLines, ...after].join('\n');
  }

  if (db.form === 'legacy-script') {
    // Find inner --- delimiters inside the <script> block
    let scriptOpen = -1, innerStart = -1, innerEnd = -1;
    for (let i = 0; i < lines.length; i++) {
      if (RE_SCRIPT_OPEN.test(lines[i].trim())) { scriptOpen = i; break; }
    }
    if (scriptOpen < 0) die('Cannot locate legacy <script> block for patch.');
    for (let i = scriptOpen + 1; i < lines.length; i++) {
      if (/^---\s*$/.test(lines[i])) {
        if (innerStart < 0) innerStart = i;
        else { innerEnd = i; break; }
      }
    }
    if (innerStart < 0 || innerEnd < 0) die('Cannot locate YAML delimiters in legacy frontmatter for patch.');
    const before = lines.slice(0, innerStart + 1);
    const after  = lines.slice(innerEnd);
    const newYamlLines = newYaml.trimEnd().split('\n');
    return [...before, ...newYamlLines, ...after].join('\n');
  }

  die('Unknown frontmatter form — cannot patch.');
}

// Regex needed inside applyFrontmatterPatch (for legacy form detection)
const RE_SCRIPT_OPEN = /^<script\s+language=["']application\/yaml["']\s*>\s*$/;

/**
 * Patch a named block's content with the LLM response.
 * If the block exists, replaces its content between the fences.
 * If the block ID is new, appends a new block at the end of the document.
 *
 * @param {string}  sourceRaw
 * @param {object}  db
 * @param {string}  responseText
 * @param {object}  opts   { patchBlock: "block-id", patchMode: "replace"|"merge" }
 */
function applyBlockPatch(sourceRaw, db, responseText, opts) {
  const blockId = opts.patchBlock;
  const mode    = opts.patchMode ?? 'replace';
  const block   = db.blocks.find(b => b.id === blockId);

  const lines = sourceRaw.split('\n');

  if (block) {
    // ── Replace existing block content ──────────────────────────────────────
    const openLine  = block._fenceOpenLine;
    const closeLine = block._fenceCloseLine;

    if (openLine < 0 || closeLine < 0) {
      die(`Cannot locate fence boundaries for block '${blockId}'.`);
    }

    // Determine response content
    let newContent;
    if (mode === 'merge') {
      // Merge: append response after existing payload (non-comment) content
      const existingPayload = blockPayload(block).trimEnd();
      newContent = existingPayload + '\n' + responseText.trimEnd();
    } else {
      newContent = responseText.trimEnd();
    }

    // Build annotation: preserve existing adjacent annotation if present,
    // otherwise preserve internal annotation style
    const before  = lines.slice(0, openLine + 1);  // includes the ``` label line
    const after   = lines.slice(closeLine);          // includes the closing ``` line

    // Re-emit internal annotation comments if the block had them
    const internalComments = block.hasAdjacentAnnot
      ? []  // adjacent style: annotation is before the fence (in `before` already)
      : serializeInternalAnnotations({ id: blockId, ...Object.fromEntries(
          Object.entries(block.allMeta).filter(([k]) => k !== 'id')
        )});

    const newBodyLines = [...internalComments, ...newContent.split('\n')];
    return [...before, ...newBodyLines, ...after].join('\n');
  }

  // ── Append new block at end of document ────────────────────────────────────
  // Infer fence label from LLM response heuristics, default to 'markdown'
  const inferredLabel = inferBlockLabel(responseText);
  const adjAnnot = serializeAdjacentAnnotation({ id: blockId, label: blockId });
  const newBlock = [
    '',
    adjAnnot,
    '```' + inferredLabel,
    responseText.trimEnd(),
    '```',
  ];
  return lines.join('\n') + newBlock.join('\n') + '\n';
}

/**
 * Heuristically infer a fence label from LLM response content.
 */
function inferBlockLabel(text) {
  const t = text.trim();
  if (t.startsWith('@prefix') || t.startsWith('PREFIX'))   return 'turtle';
  if (t.startsWith('SELECT') || t.startsWith('CONSTRUCT')) return 'sparql';
  if (/^sh:NodeShape|^sh:PropertyShape/.test(t))           return 'shacl';
  if (t.startsWith('{') || t.startsWith('['))              return 'json';
  return 'markdown';
}

// ── Prompt resolution ──────────────────────────────────────────────────────

function resolvePrompt(opts, db) {
  const sources = [opts.prompt, opts.promptFile, opts.promptBlock].filter(Boolean);
  if (sources.length === 0) die('One of --prompt, --prompt-file, or --prompt-block is required.', 2);
  if (sources.length > 1)   die('--prompt, --prompt-file, and --prompt-block are mutually exclusive.', 2);

  if (opts.prompt) {
    return opts.prompt;
  }

  if (opts.promptFile) {
    if (!fs.existsSync(opts.promptFile)) die(`Prompt file not found: ${opts.promptFile}`, 2);
    return fs.readFileSync(opts.promptFile, 'utf8').trim();
  }

  if (opts.promptBlock) {
    const block = db.blocks.find(b => b.id === opts.promptBlock);
    if (!block) die(`Prompt block '${opts.promptBlock}' not found in source DataBook.`, 2);
    if (block.label !== 'prompt') {
      process.stderr.write(`warn: block '${opts.promptBlock}' has label '${block.label}', expected 'prompt'\n`);
    }
    let text = blockPayload(block).trim();
    if (opts.interpolate && opts.param?.length) {
      text = interpolate(text, opts.param);
    }
    return text;
  }
}

function interpolate(text, params) {
  for (const p of params) {
    const eq  = p.indexOf('=');
    if (eq === -1) continue;
    const key = p.slice(0, eq);
    const val = p.slice(eq + 1);
    text = text.replaceAll(`{{${key}}}`, val);
  }
  return text;
}

function describePromptSource(opts) {
  if (opts.promptFile)  return `file:${opts.promptFile}`;
  if (opts.promptBlock) return `block:${opts.promptBlock}`;
  return 'inline';
}

// ── Context building ───────────────────────────────────────────────────────

function buildContext(sourcePath, db, opts) {
  if (!sourcePath || !db) return null;

  if (opts.blockId) {
    const block = db.blocks.find(b => b.id === opts.blockId);
    if (!block) die(`Block '${opts.blockId}' not found in source DataBook.`, 2);
    const label   = block.label;
    const payload = blockPayload(block).trim();
    return [
      `The following is a '${label}' block (id: ${opts.blockId}) extracted from the DataBook`,
      `"${db.frontmatter.title ?? sourcePath}":`,
      '',
      '```' + label,
      payload,
      '```',
    ].join('\n');
  }

  return [
    `The following is a DataBook — a structured Markdown document that combines`,
    `human-readable prose with typed semantic data blocks (RDF/Turtle, SPARQL, SHACL, etc.).`,
    `Source: ${sourcePath}`,
    '',
    fs.readFileSync(sourcePath, 'utf8'),
  ].join('\n');
}

// ── Anthropic API call ─────────────────────────────────────────────────────

async function callAnthropicApi(apiKey, model, maxTokens, context, promptText, systemPrompt) {
  const system = systemPrompt ??
    'You are an expert in semantic technologies, RDF, SPARQL, SHACL, and knowledge graph architecture. ' +
    'Respond clearly and accurately. When producing structured output, use Markdown.';

  const userContent = context
    ? `${context}\n\n---\n\n${promptText}`
    : promptText;

  const body = JSON.stringify({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userContent }],
  });

  let res;
  try {
    res = await fetch(API_URL, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': API_VERSION,
      },
      body,
    });
  } catch (e) {
    die(`API request failed: ${e.message}`, 3);
  }

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error?.message ?? ''; } catch { /* ignore */ }
    die(`Anthropic API error ${res.status}: ${detail || res.statusText}`, 3);
  }

  const data = await res.json();
  const textBlock = data.content?.find(b => b.type === 'text');
  if (!textBlock) die('API response contained no text content.', 3);
  return textBlock.text;
}

// ── Output DataBook generation (transform mode) ────────────────────────────

function buildOutputDataBook({ sourceId, sourceTitle, promptText, promptSource, model, responseText, blockId }) {
  const now       = new Date();
  const isoDate   = now.toISOString().slice(0, 10);
  const isoTs     = now.toISOString().replace(/\.\d+Z$/, 'Z');
  const slug      = crypto.randomBytes(4).toString('hex');
  const id        = `urn:databook:prompt-response:${slug}`;
  const shortPrompt = promptText.length > 72
    ? promptText.slice(0, 72).replace(/\s+\S*$/, '') + '…'
    : promptText;
  const title     = `Prompt Response: ${shortPrompt}`;
  const modelIri  = `https://api.anthropic.com/v1/models/${model}`;
  const inputIri  = sourceId
    ? (blockId ? `${sourceId}#${blockId}` : sourceId)
    : 'urn:input:none';
  const inputDesc = sourceId
    ? (blockId ? `Block '${blockId}' from DataBook: ${sourceTitle}` : `Full DataBook: ${sourceTitle}`)
    : '(no source DataBook)';

  const frontmatter = [
    '---',
    `id: ${id}`,
    `title: "${title.replace(/"/g, '\\"')}"`,
    'type: databook',
    'version: 1.0.0',
    `created: ${isoDate}`,
    '',
    'author:',
    '  - name: Kurt Cagle',
    '    iri: https://holongraph.com/people/kurt-cagle',
    '    role: orchestrator',
    '  - name: Chloe Shannon',
    '    iri: https://holongraph.com/people/chloe-shannon',
    '    role: transformer',
    '',
    'process:',
    `  transformer: "${model}"`,
    '  transformer_type: llm',
    `  transformer_iri: ${modelIri}`,
    '  inputs:',
    `    - iri: ${inputIri}`,
    '      role: primary',
    `      description: "${inputDesc}"`,
    `    - iri: urn:prompt:${promptSource}`,
    '      role: context',
    `      description: "${promptText.slice(0, 200).replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
    `  timestamp: ${isoTs}`,
    '  agent:',
    '    name: Chloe Shannon',
    '    iri: https://holongraph.com/people/chloe-shannon',
    '    role: transformer',
    '---',
  ].join('\n');

  const body = [
    '',
    '## Prompt',
    '',
    '<!-- databook:id: source-prompt -->',
    '```prompt',
    promptText,
    '```',
    '',
    '## Response',
    '',
    '<!-- databook:id: prompt-response -->',
    '```markdown',
    responseText.trimEnd(),
    '```',
  ].join('\n');

  return frontmatter + '\n' + body + '\n';
}

// ── Utilities ──────────────────────────────────────────────────────────────

function log(msg)           { process.stderr.write(msg + '\n'); }
function die(msg, code = 1) {
  const err     = new Error(msg);
  err.exitCode  = code;
  throw err;
}
