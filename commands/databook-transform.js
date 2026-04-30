#!/usr/bin/env node
/**
 * databook-transform.js
 * DataBook CLI — transform command
 *
 * Applies an XSLT stylesheet to XML content extracted from a DataBook
 * (or a plain XML file) and writes the result to stdout or a file.
 *
 * Processor priority (--processor auto):
 *   1. SAXON_JAR env var  →  java [JVM_ARGS] -jar $SAXON_JAR
 *   2. `saxon` on PATH
 *   3. `xsltproc` on PATH
 *
 * Usage:
 *   databook transform <source> --xslt <stylesheet> [options]
 */

'use strict';

const { Command }      = require('commander');
const fs               = require('fs');
const path             = require('path');
const os               = require('os');
const { execFileSync } = require('child_process');
const crypto           = require('crypto');
const yaml             = require('js-yaml');

// ── Commander setup ────────────────────────────────────────────────────────

const program = new Command();

program
  .name('databook transform')
  .description('Apply an XSLT stylesheet to XML content from a DataBook or plain XML file.')
  .argument('<source>', 'Source DataBook (.databook.md) or plain XML file')
  .requiredOption('--xslt <stylesheet>', 'XSLT DataBook or plain .xslt/.xsl file')
  .option('--block-id <id>',       'Block ID to extract from source DataBook')
  .option('--xslt-block-id <id>',  'Block ID to extract from XSLT DataBook')
  .option('--param <name=value>',  'XSLT parameter (repeatable)', collect, [])
  .option('--to <format>',         'Output method: html | xml | text (default: auto)')
  .option('--processor <mode>',    'Processor: auto | saxon | xsltproc (default: auto)', 'auto')
  .option('--encoding <enc>',      'Output encoding: utf8 | utf8bom | utf16 (default: utf8)', 'utf8')
  .option('-o, --output <file>',   'Write output to file instead of stdout')
  .action(runTransform);

program.parse(process.argv);

// ── Helpers ────────────────────────────────────────────────────────────────

/** Collect repeated --param flags into an array. */
function collect(val, acc) {
  acc.push(val);
  return acc;
}

/** Normalise a file path for Java on Windows (forward slashes). */
function toJenaPath(p) {
  return process.platform === 'win32' ? p.replace(/\\/g, '/') : p;
}

/** Generate a unique temp file path under os.tmpdir(). */
function tmpPath(suffix) {
  const rand = crypto.randomBytes(6).toString('hex');
  return path.join(os.tmpdir(), `databook-transform-${rand}${suffix}`);
}

/**
 * Extract a fenced block from a DataBook by block ID (or first matching type).
 * Returns the block content as a string.
 *
 * @param {string} filePath   - Path to the .databook.md file
 * @param {string|null} blockId - databook:id to look for, or null for first match
 * @param {string[]} types    - Accepted fence labels (e.g. ['xml','rdf-xml','xhtml'])
 * @returns {string}
 */
function extractBlock(filePath, blockId, types) {
  const src = fs.readFileSync(filePath, 'utf8');
  // Regex: ```<label>\n...content...\n```
  // We scan for all fenced blocks, then filter.
  const fenceRe = /^```([\w-]+)\n([\s\S]*?)^```/gm;
  let match;
  const candidates = [];

  while ((match = fenceRe.exec(src)) !== null) {
    const label   = match[1];
    const content = match[2];
    if (!types.includes(label)) continue;

    // Check databook:id comment on the first line
    const firstLine = content.split('\n')[0].trim();
    const idMatch   = firstLine.match(/<!--\s*databook:id:\s*([\w-]+)\s*-->/);
    const id        = idMatch ? idMatch[1] : null;

    candidates.push({ label, content, id });
  }

  if (candidates.length === 0) {
    const typeList = types.join(', ');
    die(2, `No fenced block with type [${typeList}] found in: ${filePath}`);
  }

  if (blockId) {
    const found = candidates.find(c => c.id === blockId);
    if (!found) {
      die(2, `Block ID '${blockId}' not found in: ${filePath}`);
    }
    // Strip the databook:id comment line from the extracted content
    return stripIdComment(found.content);
  }

  // Default: first candidate
  return stripIdComment(candidates[0].content);
}

/** Remove the <!-- databook:id: ... --> first line if present. */
function stripIdComment(content) {
  const lines = content.split('\n');
  if (lines[0].trim().startsWith('<!--') && lines[0].includes('databook:id:')) {
    return lines.slice(1).join('\n');
  }
  return content;
}

/** Detect whether a file is a DataBook by extension. */
function isDataBook(filePath) {
  return filePath.endsWith('.databook.md');
}

/** Detect whether a file is a plain XSLT stylesheet. */
function isStylesheet(filePath) {
  return /\.(xslt|xsl)$/i.test(filePath);
}

/** Write a string to a temp file and return its path. */
function writeTmp(content, suffix) {
  const p = tmpPath(suffix);
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

/** Print to stderr and exit with given code. */
function die(code, msg) {
  process.stderr.write(`databook transform: ${msg}\n`);
  process.exit(code);
}

// ── Processor detection ────────────────────────────────────────────────────

/**
 * Returns { type: 'saxon'|'xsltproc', cmd: string, args: string[] preamble }
 * or exits with code 1.
 */
function resolveProcessor(mode) {
  if (mode === 'saxon' || mode === 'auto') {
    const saxonJar = process.env.SAXON_JAR;
    if (saxonJar && fs.existsSync(saxonJar)) {
      const jvmArgs = (process.env.JVM_ARGS || '').split(/\s+/).filter(Boolean);
      return { type: 'saxon', cmd: 'java', preamble: [...jvmArgs, '-jar', toJenaPath(saxonJar)] };
    }
    if (commandExists('saxon')) {
      return { type: 'saxon', cmd: 'saxon', preamble: [] };
    }
    if (mode === 'saxon') {
      die(1, [
        'Saxon not found. Set SAXON_JAR to the path of your Saxon HE/PE/EE jar,',
        'or add the `saxon` command to your PATH.',
        'Download: https://www.saxonica.com/download/java.xml',
      ].join('\n  '));
    }
  }

  if (mode === 'xsltproc' || mode === 'auto') {
    if (commandExists('xsltproc')) {
      return { type: 'xsltproc', cmd: 'xsltproc', preamble: [] };
    }
    if (mode === 'xsltproc') {
      die(1, [
        'xsltproc not found.',
        'macOS: brew install libxslt',
        'Linux: apt install xsltproc  /  dnf install libxslt',
      ].join('\n  '));
    }
  }

  die(1, [
    'No XSLT processor found. Install one of:',
    '  Saxon HE (XSLT 2.0/3.0): https://www.saxonica.com/download/java.xml',
    '    then set SAXON_JAR=/path/to/saxon-he-*.jar',
    '  xsltproc (XSLT 1.0):',
    '    macOS:  brew install libxslt',
    '    Linux:  apt install xsltproc',
  ].join('\n'));
}

/** Check if a command exists on PATH (cross-platform). */
function commandExists(cmd) {
  try {
    const which = process.platform === 'win32' ? 'where' : 'which';
    execFileSync(which, [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ── Build processor argument lists ─────────────────────────────────────────

/**
 * Build the full argv for a Saxon invocation.
 *
 * Saxon CLI: java -jar saxon.jar -xsl:<xslt> -s:<source> [-o:<out>]
 *            [-method:<html|xml|text>] [name=value ...]
 */
function buildSaxonArgs(preamble, xsltPath, sourcePath, outputPath, toFormat, params) {
  const args = [
    ...preamble,
    `-xsl:${toJenaPath(xsltPath)}`,
    `-s:${toJenaPath(sourcePath)}`,
  ];
  if (outputPath) {
    args.push(`-o:${toJenaPath(outputPath)}`);
  }
  if (toFormat && toFormat !== 'auto') {
    args.push(`-method:${toFormat}`);
  }
  for (const p of params) {
    args.push(p); // already in name=value form
  }
  return args;
}

/**
 * Build the full argv for an xsltproc invocation.
 *
 * xsltproc CLI: xsltproc [--html] [--stringparam name value ...]
 *               [--output <file>] <xslt> <source>
 */
function buildXsltprocArgs(toFormat, params, xsltPath, sourcePath, outputPath) {
  const args = [];
  if (toFormat === 'html') {
    args.push('--html');
  }
  for (const p of params) {
    const eqIdx = p.indexOf('=');
    if (eqIdx === -1) {
      die(1, `--param value must be in name=value form, got: ${p}`);
    }
    const name = p.slice(0, eqIdx);
    const val  = p.slice(eqIdx + 1);
    args.push('--stringparam', name, val);
  }
  if (outputPath) {
    args.push('--output', outputPath);
  }
  args.push(xsltPath, sourcePath);
  return args;
}

// ── Encoding helpers ────────────────────────────────────────────────────────

/**
 * Apply --encoding to a Buffer of processor output.
 * Returns a Buffer ready to write to file or stdout.
 */
function applyEncoding(buf, enc) {
  switch (enc) {
    case 'utf8bom': {
      const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
      return Buffer.concat([bom, buf]);
    }
    case 'utf16': {
      // Re-encode from UTF-8 to UTF-16LE with BOM
      const str    = buf.toString('utf8');
      const bom16  = Buffer.from([0xFF, 0xFE]);
      const body16 = Buffer.from(str, 'utf16le');
      return Buffer.concat([bom16, body16]);
    }
    case 'utf8':
    default:
      return buf;
  }
}

// ── Main action ────────────────────────────────────────────────────────────

function runTransform(sourceArg, opts) {
  const tempFiles = [];

  try {
    // ── 1. Resolve source file ──────────────────────────────────────────
    if (!fs.existsSync(sourceArg)) {
      die(1, `Source file not found: ${sourceArg}`);
    }

    let sourcePath;
    if (isDataBook(sourceArg)) {
      const types   = ['xml', 'rdf-xml', 'xhtml', 'xhtml5'];
      const content = extractBlock(sourceArg, opts.blockId || null, types);
      sourcePath    = writeTmp(content, '.xml');
      tempFiles.push(sourcePath);
    } else {
      sourcePath = sourceArg;
    }

    // ── 2. Resolve XSLT stylesheet ────────────────────────────────────
    if (!fs.existsSync(opts.xslt)) {
      die(1, `XSLT file not found: ${opts.xslt}`);
    }

    let xsltPath;
    if (isDataBook(opts.xslt)) {
      const types   = ['xslt', 'xsl', 'xml'];
      const content = extractBlock(opts.xslt, opts.xsltBlockId || null, types);
      xsltPath      = writeTmp(content, '.xslt');
      tempFiles.push(xsltPath);
    } else if (isStylesheet(opts.xslt)) {
      xsltPath = opts.xslt;
    } else {
      // Treat unknown extension as a plain stylesheet (let processor decide)
      xsltPath = opts.xslt;
    }

    // ── 3. Resolve output path ────────────────────────────────────────
    const outputPath = opts.output || null;

    // ── 4. Detect processor ───────────────────────────────────────────
    const proc = resolveProcessor(opts.processor);

    // ── 5. Build argument list ────────────────────────────────────────
    let execCmd, execArgs;

    if (proc.type === 'saxon') {
      execCmd  = proc.cmd;
      execArgs = buildSaxonArgs(
        proc.preamble, xsltPath, sourcePath, outputPath,
        opts.to || 'auto', opts.param
      );
    } else {
      // xsltproc
      execCmd  = proc.cmd;
      execArgs = buildXsltprocArgs(
        opts.to || 'auto', opts.param, xsltPath, sourcePath, outputPath
      );
    }

    // ── 6. Execute ────────────────────────────────────────────────────
    let result;
    try {
      result = execFileSync(execCmd, execArgs, {
        // If outputPath is set the processor writes the file itself;
        // otherwise capture stdout.
        stdio: outputPath ? ['ignore', 'ignore', 'pipe'] : ['ignore', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 * 1024, // 64 MB
      });
    } catch (err) {
      // Forward processor stderr
      if (err.stderr) process.stderr.write(err.stderr);
      die(3, `XSLT processor exited with error (code ${err.status}).`);
    }

    // ── 7. Write output (stdout path only) ───────────────────────────
    if (!outputPath) {
      const out = applyEncoding(result, opts.encoding);
      process.stdout.write(out);
    }
    // When outputPath is provided the processor wrote the file directly.
    // Encoding re-wrap for file output:
    else if (opts.encoding !== 'utf8') {
      const raw     = fs.readFileSync(outputPath);
      const encoded = applyEncoding(raw, opts.encoding);
      fs.writeFileSync(outputPath, encoded);
    }

  } finally {
    // ── 8. Clean up temp files ─────────────────────────────────────────
    for (const f of tempFiles) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
  }
}
