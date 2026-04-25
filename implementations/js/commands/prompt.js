/**
 * commands/prompt.js
 * DataBook CLI — prompt command
 *
 * Sends a DataBook (or specific block) as context to an Anthropic LLM
 * along with a prompt, then writes the response into a new output DataBook
 * carrying a full provenance process stamp.
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 *
 * Usage:
 *   databook prompt source.databook.md --prompt "Summarise the class hierarchy"
 *   databook prompt source.databook.md --prompt-file query.txt --block-id primary-block
 *   databook prompt source.databook.md --prompt-block prompt-id -o response.databook.md
 */

import fs                        from 'fs';
import path                      from 'path';
import crypto                    from 'crypto';
import { writeOutput,
         atomicWriteEncoded,
         resolveEncoding }       from '../lib/encoding.js';
import { loadDataBookFile,
         blockPayload }          from '../lib/parser.js';

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

  // ── Load source DataBook (optional) ─────────────────────────────────────
  let db = null;
  if (source) {
    try { db = loadDataBookFile(source); } catch (e) { die(e.message, 2); }
  }

  // Validate: --block-id and --prompt-block require a source file
  if (opts.blockId    && !source) die('--block-id requires a source DataBook file.', 2);
  if (opts.promptBlock && !source) die('--prompt-block requires a source DataBook file.', 2);

  const fm = db?.frontmatter ?? {};

  // ── Resolve prompt text ──────────────────────────────────────────────────
  const promptText = resolvePrompt(opts, db);

  // ── Build LLM context ────────────────────────────────────────────────────
  const context = buildContext(source, db, opts);

  // ── Call Anthropic API ───────────────────────────────────────────────────
  const model     = opts.model ?? DEFAULT_MODEL;
  const maxTokens = parseInt(opts.maxTokens ?? DEFAULT_MAX_TOKENS, 10);

  if (opts.dryRun) {
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

  // ── Build output DataBook ────────────────────────────────────────────────
  const outputDataBook = buildOutputDataBook({
    sourceId:    fm.id ?? (source ? `file://${path.resolve(source)}` : null),
    sourceTitle: fm.title ?? (source ? path.basename(source) : null),
    promptText,
    promptSource: describePromptSource(opts),
    model,
    responseText,
    blockId:    opts.blockId ?? null,
  });

  // ── Write output ─────────────────────────────────────────────────────────
  const outPath = opts.output ?? null;
  if (outPath) {
    atomicWriteEncoded(outPath, outputDataBook, enc);
    if (opts.verbose) log(`[prompt] Written to ${outPath}`);
  } else {
    writeOutput(null, outputDataBook, enc);
  }
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

/**
 * Build the context string sent to the LLM.
 * Returns null when no source DataBook is provided (prompt-only mode).
 * If --block-id is set, sends only that block's content.
 * Otherwise sends the full DataBook source text.
 */
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

  // Full DataBook — read raw source text directly
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

// ── Output DataBook generation ─────────────────────────────────────────────

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
    '<script language="application/yaml">',
    '',
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
    '',
    '</script>',
  ].join('\n');

  const body = [
    '',
    '## Prompt',
    '',
    '```prompt',
    `<!-- databook:id: source-prompt -->`,
    promptText,
    '```',
    '',
    '## Response',
    '',
    '```markdown',
    `<!-- databook:id: prompt-response -->`,
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
