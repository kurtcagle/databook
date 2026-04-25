/**
 * commands/transform.js
 * DataBook CLI — transform command implementation
 *
 * Applies an XSLT stylesheet to XML content extracted from a DataBook
 * (or a plain XML/RDF file) and writes the result to stdout or a file.
 *
 * Processor priority (--processor auto):
 *   1. SAXON_JAR env var  →  java [JVM_ARGS] -jar $SAXON_JAR
 *   2. `saxon` on PATH
 *   3. `xsltproc` on PATH
 */

import fs               from 'fs';
import path             from 'path';
import os               from 'os';
import { execFileSync } from 'child_process';
import crypto           from 'crypto';

// ── Public entry point ─────────────────────────────────────────────────────

export async function runTransform(source, opts) {
  if (!source) die(1, 'Source file is required.');
  if (!opts.xslt) die(1, 'XSLT stylesheet is required (--xslt <file>).');

  const tempFiles = [];

  try {
    // 1. Resolve source XML ──────────────────────────────────────────────────
    if (!fs.existsSync(source)) die(1, `Source file not found: ${source}`);

    let sourcePath;
    if (isDataBook(source)) {
      const types   = ['xml', 'rdf-xml', 'xhtml', 'xhtml5'];
      const content = extractBlock(source, opts.blockId ?? null, types);
      sourcePath    = writeTmp(content, '.xml');
      tempFiles.push(sourcePath);
    } else {
      sourcePath = source;
    }

    // 2. Resolve XSLT stylesheet ─────────────────────────────────────────────
    if (!fs.existsSync(opts.xslt)) die(1, `XSLT file not found: ${opts.xslt}`);

    let xsltPath;
    if (isDataBook(opts.xslt)) {
      const types   = ['xslt', 'xsl', 'xml'];
      const content = extractBlock(opts.xslt, opts.xsltBlockId ?? null, types);
      xsltPath      = writeTmp(content, '.xslt');
      tempFiles.push(xsltPath);
    } else {
      xsltPath = opts.xslt;
    }

    // 3. Detect processor ────────────────────────────────────────────────────
    const proc = resolveProcessor(opts.processor ?? 'auto');

    // 4. Build args and execute ──────────────────────────────────────────────
    const params     = opts.param ?? [];
    const toFormat   = opts.to ?? 'auto';
    const outputPath = opts.output ?? null;

    let execCmd, execArgs;
    if (proc.type === 'saxon') {
      execCmd  = proc.cmd;
      execArgs = buildSaxonArgs(proc.preamble, xsltPath, sourcePath, outputPath, toFormat, params);
    } else {
      execCmd  = proc.cmd;
      execArgs = buildXsltprocArgs(toFormat, params, xsltPath, sourcePath, outputPath);
    }

    let result;
    try {
      result = execFileSync(execCmd, execArgs, {
        stdio: outputPath ? ['ignore', 'ignore', 'pipe'] : ['ignore', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch (err) {
      if (err.stderr) process.stderr.write(err.stderr);
      die(3, `XSLT processor exited with error (code ${err.status}).`);
    }

    // 5. Write output ────────────────────────────────────────────────────────
    if (!outputPath) {
      process.stdout.write(applyEncoding(result, opts.encoding ?? 'utf8'));
    } else if ((opts.encoding ?? 'utf8') !== 'utf8') {
      const raw = fs.readFileSync(outputPath);
      fs.writeFileSync(outputPath, applyEncoding(raw, opts.encoding));
    }

  } finally {
    for (const f of tempFiles) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
  }
}

// ── Block extraction ───────────────────────────────────────────────────────

function extractBlock(filePath, blockId, types) {
  const src     = fs.readFileSync(filePath, 'utf8');
  const fenceRe = /^```([\w-]+)\n([\s\S]*?)^```/gm;
  const candidates = [];
  let match;

  while ((match = fenceRe.exec(src)) !== null) {
    const label   = match[1];
    const content = match[2];
    if (!types.includes(label)) continue;

    const firstLine = content.split('\n')[0].trim();
    const idMatch   = firstLine.match(/<!--\s*databook:id:\s*([\w-]+)\s*-->/);
    candidates.push({ label, content, id: idMatch?.[1] ?? null });
  }

  if (candidates.length === 0) {
    die(2, `No fenced block with type [${types.join(', ')}] found in: ${filePath}`);
  }

  if (blockId) {
    const found = candidates.find(c => c.id === blockId);
    if (!found) die(2, `Block ID '${blockId}' not found in: ${filePath}`);
    return stripIdComment(found.content);
  }

  return stripIdComment(candidates[0].content);
}

function stripIdComment(content) {
  const lines = content.split('\n');
  if (lines[0].trim().startsWith('<!--') && lines[0].includes('databook:id:')) {
    return lines.slice(1).join('\n');
  }
  return content;
}

// ── Processor resolution ───────────────────────────────────────────────────

const DEBUG = !!process.env.DATABOOK_DEBUG;
function dbg(msg) { if (DEBUG) process.stderr.write(`[transform] ${msg}\n`); }

function resolveProcessor(mode) {
  if (mode === 'saxon' || mode === 'auto') {

    // ── 1. SAXON_JAR env var ──────────────────────────────────────────────
    const rawJar = process.env.SAXON_JAR;
    dbg(`SAXON_JAR raw value: ${JSON.stringify(rawJar)}`);

    if (rawJar) {
      // Strip surrounding quotes that Windows users commonly add
      const saxonJar = rawJar.trim().replace(/^["']|["']$/g, '');
      dbg(`SAXON_JAR resolved: ${saxonJar}`);
      dbg(`SAXON_JAR exists:   ${fs.existsSync(saxonJar)}`);

      if (!fs.existsSync(saxonJar)) {
        const msg = `SAXON_JAR is set but file not found: ${saxonJar}`;
        if (mode === 'saxon') die(1, msg);
        process.stderr.write(`databook transform: warning: ${msg}\n`);
      } else {
        // Verify java is on PATH before committing to this processor
        if (!commandExists('java')) {
          const msg = 'SAXON_JAR is set but `java` is not on PATH. Install a JRE and ensure java.exe is in PATH.';
          if (mode === 'saxon') die(1, msg);
          process.stderr.write(`databook transform: warning: ${msg}\n`);
        } else {
          const jvmArgs = (process.env.JVM_ARGS ?? '').split(/\s+/).filter(Boolean);
          dbg(`Using Saxon jar: ${saxonJar}, JVM_ARGS: ${JSON.stringify(jvmArgs)}`);
          return { type: 'saxon', cmd: 'java', preamble: [...jvmArgs, '-jar', toJenaPath(saxonJar)] };
        }
      }
    }

    // ── 2. `saxon` command on PATH ────────────────────────────────────────
    dbg(`Checking for 'saxon' on PATH: ${commandExists('saxon')}`);
    if (commandExists('saxon')) {
      return { type: 'saxon', cmd: 'saxon', preamble: [] };
    }

    if (mode === 'saxon') {
      die(1, [
        'Saxon not found. Tried:',
        `  SAXON_JAR env var: ${rawJar ? `set to "${rawJar}" (file not found or java missing)` : 'not set'}`,
        '  `saxon` on PATH:   not found',
        '',
        'Fix options:',
        '  1. Set SAXON_JAR=C:\\path\\to\\saxon-he-*.jar  (no quotes)',
        '     and ensure `java` is on PATH',
        '  2. Add a `saxon` wrapper script to PATH',
        '  Download Saxon HE: https://www.saxonica.com/download/java.xml',
      ].join('\n'));
    }
  }

  if (mode === 'xsltproc' || mode === 'auto') {
    dbg(`Checking for 'xsltproc' on PATH: ${commandExists('xsltproc')}`);
    if (commandExists('xsltproc')) {
      return { type: 'xsltproc', cmd: 'xsltproc', preamble: [] };
    }
    if (mode === 'xsltproc') {
      die(1, [
        'xsltproc not found.',
        '  macOS:   brew install libxslt',
        '  Linux:   apt install xsltproc  /  dnf install libxslt',
        '  Windows: choco install xsltproc',
      ].join('\n'));
    }
  }

  die(1, [
    'No XSLT processor found. Install one of:',
    '  Saxon HE (XSLT 2.0/3.0):  https://www.saxonica.com/download/java.xml',
    '    then: set SAXON_JAR=C:\\path\\to\\saxon-he-*.jar  (no quotes around path)',
    '          and ensure `java` is on PATH',
    '  xsltproc (XSLT 1.0):',
    '    Windows: choco install xsltproc',
    '    macOS:   brew install libxslt',
    '    Linux:   apt install xsltproc',
    '',
    'Run with DATABOOK_DEBUG=1 for detection details.',
  ].join('\n'));
}

function commandExists(cmd) {
  try {
    const which = process.platform === 'win32' ? 'where' : 'which';
    execFileSync(which, [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ── Argument builders ──────────────────────────────────────────────────────

function buildSaxonArgs(preamble, xsltPath, sourcePath, outputPath, toFormat, params) {
  const args = [
    ...preamble,
    `-xsl:${toJenaPath(xsltPath)}`,
    `-s:${toJenaPath(sourcePath)}`,
  ];
  if (outputPath)                    args.push(`-o:${toJenaPath(outputPath)}`);
  if (toFormat && toFormat !== 'auto') args.push(`-method:${toFormat}`);
  for (const p of params)            args.push(p);
  return args;
}

function buildXsltprocArgs(toFormat, params, xsltPath, sourcePath, outputPath) {
  const args = [];
  if (toFormat === 'html') args.push('--html');
  for (const p of params) {
    const eq = p.indexOf('=');
    if (eq === -1) die(1, `--param must be name=value, got: ${p}`);
    args.push('--stringparam', p.slice(0, eq), p.slice(eq + 1));
  }
  if (outputPath) args.push('--output', outputPath);
  args.push(xsltPath, sourcePath);
  return args;
}

// ── Encoding ───────────────────────────────────────────────────────────────

function applyEncoding(buf, enc) {
  if (enc === 'utf8bom') return Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), buf]);
  if (enc === 'utf16') {
    const bom  = Buffer.from([0xFF, 0xFE]);
    const body = Buffer.from(buf.toString('utf8'), 'utf16le');
    return Buffer.concat([bom, body]);
  }
  return buf;
}

// ── Utilities ──────────────────────────────────────────────────────────────

function isDataBook(p)  { return p.endsWith('.databook.md'); }

function toJenaPath(p)  { return process.platform === 'win32' ? p.replace(/\\/g, '/') : p; }

function writeTmp(content, suffix) {
  const p = path.join(os.tmpdir(), `databook-transform-${crypto.randomBytes(6).toString('hex')}${suffix}`);
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

function die(code, msg) {
  const err = new Error(msg);
  err.exitCode = code;
  throw err;
}
