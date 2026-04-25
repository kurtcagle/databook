/**
 * lib/encoding.js — encoding support for DataBook CLI output.
 *
 * Three modes:
 *   utf8      Plain UTF-8, no BOM (default, POSIX-friendly)
 *   utf8bom   UTF-8 with BOM (0xEF 0xBB 0xBF) — preferred by Excel and some Windows tools
 *   utf16     UTF-16 LE with BOM (0xFF 0xFE) — required by some Windows-native applications
 *
 * Applies to file output (-o / --out / --output) and stdout.
 * Internal temp files used by Jena/Saxon invocations always stay UTF-8.
 */

import { writeFileSync, mkdtempSync, renameSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const UTF8_BOM  = Buffer.from([0xEF, 0xBB, 0xBF]);
const UTF16_BOM = Buffer.from([0xFF, 0xFE]);

/**
 * Resolve and validate an encoding option string.
 * @param {string|undefined} enc
 * @returns {'utf8'|'utf8bom'|'utf16'}
 */
export function resolveEncoding(enc) {
  if (!enc) return 'utf8';
  const normalised = enc.toLowerCase().replace(/[-_+]/g, '');
  const map = {
    'utf8':        'utf8',
    'utf8bom':     'utf8bom',
    'utf8withbom': 'utf8bom',
    'utf16':       'utf16',
    'utf16le':     'utf16',
    'utf16lebom':  'utf16',
  };
  const resolved = map[normalised];
  if (!resolved) {
    throw new Error(
      `unknown encoding '${enc}'. Valid values: utf8 (default), utf8bom, utf16`
    );
  }
  return resolved;
}

/**
 * Encode a string to a Buffer according to the resolved encoding.
 * @param {string} content
 * @param {'utf8'|'utf8bom'|'utf16'} encoding
 * @returns {Buffer}
 */
export function encodeContent(content, encoding) {
  switch (encoding) {
    case 'utf8bom':
      return Buffer.concat([UTF8_BOM, Buffer.from(content, 'utf8')]);
    case 'utf16':
      return Buffer.concat([UTF16_BOM, Buffer.from(content, 'utf16le')]);
    case 'utf8':
    default:
      return Buffer.from(content, 'utf8');
  }
}

/**
 * Write content to a file path with the given encoding.
 * @param {string} filePath
 * @param {string} content
 * @param {'utf8'|'utf8bom'|'utf16'} encoding
 */
export function writeEncoded(filePath, content, encoding) {
  writeFileSync(filePath, encodeContent(content, encoding));
}

/**
 * Write content to stdout with the given encoding.
 * Uses process.stdout.write with a Buffer to correctly emit BOM bytes.
 * @param {string} content
 * @param {'utf8'|'utf8bom'|'utf16'} encoding
 */
export function writeEncodedStdout(content, encoding) {
  process.stdout.write(encodeContent(content, encoding));
}

/**
 * Write content to a file or stdout, applying encoding.
 * @param {string|null} filePath  null or '-' → stdout
 * @param {string}      content
 * @param {'utf8'|'utf8bom'|'utf16'} encoding
 */
export function writeOutput(filePath, content, encoding = 'utf8') {
  if (!filePath || filePath === '-') {
    writeEncodedStdout(content, encoding);
  } else {
    writeEncoded(filePath, content, encoding);
  }
}

/**
 * Atomic write — write to temp then rename, preserving encoding.
 * Used by pull for in-place DataBook block replacement.
 */
export function atomicWriteEncoded(targetPath, content, encoding) {
  const tmpDir  = mkdtempSync(join(tmpdir(), 'databook-enc-'));
  const tmpFile = join(tmpDir, 'out.tmp');
  writeEncoded(tmpFile, content, encoding);
  renameSync(tmpFile, targetPath);
}
