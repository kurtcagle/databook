/**
 * databook convert — convert a DataBook block to another format.
 *
 * Usage:
 *   databook convert <file>[#block-id] --to <format>
 *   databook convert <file> --block-id <id> --to <format>
 *   cat block.ttl | databook convert - --from turtle --to json-ld
 *
 * Supported conversions: see lib/convert.js
 */

import { readFileSync } from 'fs';
import { writeOutput, resolveEncoding } from '../lib/encoding.js';
import { resolve, extname } from 'path';
import { loadDataBookFile, parseDataBook, blockPayload } from '../lib/parser.js';
import { convert, resolveFormat, validTargets, labelForFormat, RDF_INPUT_LABELS } from '../lib/convert.js';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const LABEL_EXTENSIONS = {
  'turtle':    '.ttl',
  'turtle12':  '.ttl',
  'ntriples':  '.nt',
  'trig':      '.trig',
  'json-ld':   '.jsonld',
  'yaml-ld':   '.yaml',
  'xml-rdf':   '.rdf',
  'csv':       '.csv',
  'tsv':       '.tsv',
  'markdown':  '.md',
  'yaml':      '.yaml',
  'json':      '.json',
};

/**
 * Run `databook convert`.
 */
export async function runConvert(inputArg, opts) {
  const {
    blockId:  blockIdOpt,
    to:       toFmt,
    from:     fromFmt,
    output:   outputArg,
    list:     listMode = false,
    quiet     = false,
    encoding: encOpt,
  } = opts;
  let enc;
  try { enc = resolveEncoding(encOpt); } catch (e) { die(e.message); }

  if (!toFmt && !listMode) die('--to <format> is required');

  // ── Parse fragment syntax ──────────────────────────────────────────────────
  let filePath = inputArg;
  let blockId  = blockIdOpt ?? null;

  if (inputArg && inputArg !== '-') {
    const hashIdx = inputArg.lastIndexOf('#');
    if (hashIdx > 0 && !inputArg.slice(0, hashIdx).match(/^https?:|^urn:/)) {
      filePath = inputArg.slice(0, hashIdx);
      blockId  = inputArg.slice(hashIdx + 1) || blockId;
    }
  }

  // ── Read input ─────────────────────────────────────────────────────────────
  let inputContent, inputLabel;

  if (!filePath || filePath === '-') {
    // Raw stdin — must specify --from
    if (!fromFmt && !listMode) {
      die('--from <format> is required when reading from stdin (e.g. --from turtle)');
    }
    const content = readFileSync(0, 'utf8');
    inputContent = content;
    inputLabel   = fromFmt;
  } else {
    // DataBook file — extract named block
    let db;
    try {
      db = loadDataBookFile(resolve(filePath));
    } catch (e) {
      die(e.message);
    }

    // --list mode: show what blocks exist and what they can convert to
    if (listMode) {
      const named = db.blocks.filter(b => b.id);
      if (named.length === 0) {
        process.stderr.write('warn: no named blocks found\n');
        return;
      }
      for (const b of named) {
        const targets = validTargets(b.label);
        process.stdout.write(
          `${b.id}\t${b.label} → ${targets.length > 0 ? targets.join(', ') : '(not convertible)'}\n`
        );
      }
      return;
    }

    // Resolve block id
    if (!blockId) {
      const named = db.blocks.filter(b => b.id);
      if (named.length === 1) {
        blockId = named[0].id;
        if (!quiet) process.stderr.write(`info: single named block — converting '${blockId}'\n`);
      } else {
        const ids = named.map(b => b.id).join(', ');
        die(`--block-id required (available: ${ids || 'none'})\n  Or use fragment syntax: databook convert ${filePath}#<block-id>`);
      }
    }

    const block = db.blocks.find(b => b.id === blockId);
    if (!block) {
      const ids = db.blocks.filter(b => b.id).map(b => b.id).join(', ');
      die(`no block with id '${blockId}'\n  Available: ${ids || 'none'}`);
    }

    inputContent = blockPayload(block);
    inputLabel   = fromFmt ?? block.label;
  }

  // ── Resolve target format ──────────────────────────────────────────────────
  let targetFmt;
  try {
    targetFmt = resolveFormat(toFmt);
  } catch (e) {
    die(e.message);
  }

  // ── Check convertibility ───────────────────────────────────────────────────
  const targets = validTargets(inputLabel);
  if (targets.length === 0) {
    die(
      `input format '${inputLabel}' is not convertible.\n` +
      `  Convertible formats: ${[...RDF_INPUT_LABELS, 'sparql-results'].join(', ')}`
    );
  }
  if (!targets.includes(targetFmt)) {
    die(
      `cannot convert '${inputLabel}' to '${targetFmt}'.\n` +
      `  Valid targets for '${inputLabel}': ${targets.join(', ')}`
    );
  }

  if (!quiet) {
    process.stderr.write(`[convert] '${blockId ?? 'stdin'}': ${inputLabel} → ${targetFmt}\n`);
  }

  // ── Execute conversion ─────────────────────────────────────────────────────
  const tempDir = mkdtempSync(join(tmpdir(), 'databook-conv-'));
  let result;
  try {
    result = await convert(inputContent, inputLabel, targetFmt, { tempDir });
  } catch (e) {
    die(e.message);
  }

  if (result.lossy && !quiet) {
    process.stderr.write(`warn: conversion to '${targetFmt}' is lossy — not all RDF information is preserved\n`);
  }

  // ── Write output ───────────────────────────────────────────────────────────
  let output = result.content;
  if (!output.endsWith('\n')) output += '\n';

  const outTarget = resolveOutputTarget(outputArg, blockId, targetFmt);
  if (!outTarget || outTarget === '-') {
    writeOutput(null, output, enc);
  } else {
    writeOutput(outTarget, output, enc);
    if (!quiet) process.stderr.write(`[convert] written to: ${outTarget}\n`);
  }
}

function resolveOutputTarget(outputArg, blockId, targetFmt) {
  if (!outputArg || outputArg === '-') return null;
  if (outputArg === '.') {
    const ext = LABEL_EXTENSIONS[labelForFormat(targetFmt)] ?? '.txt';
    return `${blockId ?? 'output'}${ext}`;
  }
  if (!extname(outputArg)) {
    return outputArg + (LABEL_EXTENSIONS[labelForFormat(targetFmt)] ?? '');
  }
  return outputArg;
}

function die(msg, code = 2) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}
