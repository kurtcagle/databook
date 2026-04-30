/**
 * lib/convert.js — DataBlock format conversion engine.
 *
 * Conversion matrix:
 *
 * RDF inputs (turtle, turtle12, trig, shacl, json-ld):
 *   → turtle, turtle12, ntriples, trig   N3.js writer
 *   → json-ld                            N3.js parse + jsonld.fromRDF
 *   → yaml-ld                            JSON-LD → compact → YAML
 *   → xml-rdf                            Jena riot (processors.toml)
 *   → csv, markdown, yaml                N3.js → triple rows (lossy)
 *
 * SPARQL results (sparql-results JSON from SELECT/ASK):
 *   → csv, tsv, markdown, yaml, json     Pure JS
 *
 * All conversions return { content: string, label: string }.
 */

import { createRequire } from 'module';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { Parser as N3Parser, Writer as N3Writer, Store } from 'n3';
import { spawnSync } from 'child_process';
import yaml from 'js-yaml';
import { getProcessor } from './config.js';

const require = createRequire(import.meta.url);
const jsonld  = require('jsonld');

// ─── Format catalogue ─────────────────────────────────────────────────────────

// Canonical format names + aliases
const FORMAT_ALIASES = {
  'ttl':            'turtle',
  'turtle':         'turtle',
  'ttl12':          'turtle12',
  'turtle12':       'turtle12',
  'nt':             'ntriples',
  'ntriples':       'ntriples',
  'n-triples':      'ntriples',
  'trig':           'trig',
  'jsonld':         'json-ld',
  'json-ld':        'json-ld',
  'jsonld-compact': 'json-ld-compact',
  'yamlld':         'yaml-ld',
  'yaml-ld':        'yaml-ld',
  'rdfxml':         'xml-rdf',
  'rdf/xml':        'xml-rdf',
  'xml-rdf':        'xml-rdf',
  'xml/rdf':        'xml-rdf',
  'rdf':            'xml-rdf',
  'csv':            'csv',
  'tsv':            'tsv',
  'md':             'markdown',
  'markdown':       'markdown',
  'markdown-table': 'markdown',
  'yaml':           'yaml',
  'json':           'json',
};

export const RDF_INPUT_LABELS = new Set([
  'turtle', 'turtle12', 'trig', 'shacl', 'json-ld',
  'manifest', 'processor-registry', 'transformer-library',
]);

export const SPARQL_RESULT_LABELS = new Set([
  'sparql-results', 'json',
]);

// Valid target formats per input class
const RDF_TARGETS = [
  'turtle', 'turtle12', 'ntriples', 'trig',
  'json-ld', 'json-ld-compact', 'yaml-ld',
  'xml-rdf', 'csv', 'tsv', 'markdown', 'yaml',
];
const SPARQL_TARGETS = ['csv', 'tsv', 'markdown', 'yaml', 'json'];

/**
 * Resolve a format alias to its canonical name.
 * @param {string} fmt
 * @returns {string}
 */
export function resolveFormat(fmt) {
  const canonical = FORMAT_ALIASES[fmt.toLowerCase()];
  if (!canonical) throw new Error(`unknown format '${fmt}'. Valid formats: ${Object.keys(FORMAT_ALIASES).join(', ')}`);
  return canonical;
}

/**
 * List valid target formats for a given input label.
 */
export function validTargets(inputLabel) {
  if (RDF_INPUT_LABELS.has(inputLabel)) return RDF_TARGETS;
  if (SPARQL_RESULT_LABELS.has(inputLabel)) return SPARQL_TARGETS;
  return [];
}

/**
 * Fence label for a canonical format.
 */
export function labelForFormat(fmt) {
  const map = {
    'turtle':         'turtle',
    'turtle12':       'turtle12',
    'ntriples':       'turtle',   // store as turtle block
    'trig':           'trig',
    'json-ld':        'json-ld',
    'json-ld-compact':'json-ld',
    'yaml-ld':        'yaml',
    'xml-rdf':        'xml',
    'csv':            'csv',
    'tsv':            'csv',
    'markdown':       'markdown',
    'yaml':           'yaml',
    'json':           'json',
  };
  return map[fmt] ?? fmt;
}

// ─── Main conversion entry point ──────────────────────────────────────────────

/**
 * Convert block content to a target format.
 * @param {string} content      Raw block content (no databook:* comments)
 * @param {string} inputLabel   Fence label of the source block
 * @param {string} targetFmt    Canonical target format name
 * @param {object} opts
 * @param {string} [opts.tempDir]     Temp dir for Jena riot invocations
 * @param {boolean} [opts.compact]    Use compact JSON-LD context (json-ld output)
 * @param {string} [opts.baseIri]     Base IRI for serialisation
 * @returns {Promise<{ content: string, label: string, lossy: boolean }>}
 */
export async function convert(content, inputLabel, targetFmt, opts = {}) {
  const { tempDir = null, baseIri = 'https://example.org/' } = opts;

  // No-op: same format
  if (targetFmt === inputLabel ||
     (targetFmt === 'turtle' && inputLabel === 'shacl')) {
    return { content, label: labelForFormat(targetFmt), lossy: false };
  }

  // Route by input class
  if (RDF_INPUT_LABELS.has(inputLabel)) {
    return convertRdf(content, inputLabel, targetFmt, baseIri, tempDir);
  }

  if (inputLabel === 'sparql-results' ||
     (inputLabel === 'json' && looksLikeSparqlResults(content))) {
    return convertSparqlResults(content, targetFmt);
  }

  throw new Error(
    `cannot convert '${inputLabel}' to '${targetFmt}'.\n` +
    `  Supported inputs: ${[...RDF_INPUT_LABELS, ...SPARQL_RESULT_LABELS].join(', ')}`
  );
}

// ─── RDF conversion ───────────────────────────────────────────────────────────

async function convertRdf(content, inputLabel, targetFmt, baseIri, tempDir) {
  switch (targetFmt) {
    case 'turtle':
    case 'turtle12':
    case 'ntriples':
    case 'trig':
      return rdfToN3Format(content, inputLabel, targetFmt, baseIri);

    case 'json-ld':
    case 'json-ld-compact':
      return rdfToJsonLd(content, inputLabel, targetFmt === 'json-ld-compact', baseIri);

    case 'yaml-ld':
      return rdfToYamlLd(content, inputLabel, baseIri);

    case 'xml-rdf':
      return rdfToXmlRdf(content, inputLabel, tempDir);

    case 'csv':
      return rdfToCsv(content, inputLabel, false);

    case 'tsv':
      return rdfToCsv(content, inputLabel, true);

    case 'markdown':
      return rdfToMarkdown(content, inputLabel);

    case 'yaml':
      return rdfToYaml(content, inputLabel, baseIri);

    default:
      throw new Error(
        `unsupported target format '${targetFmt}' for RDF input.\n` +
        `  Supported: ${RDF_TARGETS.join(', ')}`
      );
  }
}

// ── RDF → N3 serialisation formats ───────────────────────────────────────────

async function rdfToN3Format(content, inputLabel, targetFmt, baseIri) {
  const store = await parseRdfToStore(content, inputLabel, baseIri);

  const n3Format = {
    'turtle':   'Turtle',
    'turtle12': 'Turtle',
    'ntriples': 'N-Triples',
    'trig':     'TriG',
  }[targetFmt];

  const result = await storeToString(store, n3Format, baseIri);
  return {
    content: result,
    label:   labelForFormat(targetFmt),
    lossy:   false,
  };
}

// ── RDF → JSON-LD ─────────────────────────────────────────────────────────────

async function rdfToJsonLd(content, inputLabel, compact, baseIri) {
  const store = await parseRdfToStore(content, inputLabel, baseIri);
  const nquads = await storeToString(store, 'N-Quads', baseIri);

  // Parse N-Quads into JSON-LD RDF dataset then convert to JSON-LD
  const doc = await jsonld.fromRDF(nquads, { format: 'application/n-quads' });

  let output;
  if (compact) {
    // Compact with a minimal context derived from prefixes in source
    const prefixes = extractPrefixes(content);
    const context = Object.fromEntries(
      Object.entries(prefixes).filter(([k]) => k)  // skip empty prefix
    );
    output = await jsonld.compact(doc, Object.keys(context).length > 0 ? context : baseIri);
  } else {
    output = doc;
  }

  return {
    content: JSON.stringify(output, null, 2),
    label:   'json-ld',
    lossy:   false,
  };
}

// ── RDF → YAML-LD ─────────────────────────────────────────────────────────────

async function rdfToYamlLd(content, inputLabel, baseIri) {
  const { content: jsonLdStr } = await rdfToJsonLd(content, inputLabel, true, baseIri);
  const obj = JSON.parse(jsonLdStr);
  return {
    content: yaml.dump(obj, { lineWidth: 100 }),
    label:   'yaml',
    lossy:   false,
  };
}

// ── RDF → RDF/XML via Jena riot ───────────────────────────────────────────────

async function rdfToXmlRdf(content, inputLabel, tempDir) {
  const config = getProcessor('https://w3id.org/databook/plugins/core#jena-riot');
  if (!config?.command) {
    throw new Error(
      `xml-rdf conversion requires Jena riot.\n` +
      `  Add to .databook/processors.toml:\n` +
      `  [processor."https://w3id.org/databook/plugins/core#jena-riot"]\n` +
      `  command = "C:/Apache/apache-jena-6.0.0/bat/riot"\n` +
      `  version = "6.0.0"`
    );
  }

  if (!tempDir) {
    // Create a minimal temp dir for this conversion
    const { mkdtempSync } = await import('fs');
    const { tmpdir } = await import('os');
    tempDir = mkdtempSync(join(tmpdir(), 'databook-conv-'));
  }

  const inputExt  = { 'turtle': '.ttl', 'turtle12': '.ttl', 'shacl': '.ttl',
                      'trig': '.trig', 'json-ld': '.jsonld' }[inputLabel] ?? '.ttl';
  const inputFile = join(tempDir, `conv-input${inputExt}`);
  writeFileSync(inputFile, content, 'utf8');

  const resolvedCmd = resolveWindowsCommand(config.command);
  const isWindows   = process.platform === 'win32';
  const isBat       = resolvedCmd.match(/\.(bat|cmd)$/i);

  const args = [toJenaPath(inputFile), '--output=RDF/XML'];
  const spawnCmd  = (isWindows && isBat) ? 'cmd.exe' : resolvedCmd;
  const spawnArgs = (isWindows && isBat) ? ['/c', resolvedCmd, ...args] : args;

  const env = { ...process.env };
  if (config.jvm_flags) env.JVM_ARGS = config.jvm_flags;

  const result = spawnSync(spawnCmd, spawnArgs, { env, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Jena riot failed:\n${result.stderr}`);
  }

  return {
    content: result.stdout,
    label:   'xml',
    lossy:   false,
  };
}

// ── RDF → CSV / TSV (triples as rows, lossy) ──────────────────────────────────

async function rdfToCsv(content, inputLabel, tsv) {
  const store = await parseRdfToStore(content, inputLabel);
  const sep = tsv ? '\t' : ',';
  const lines = [['subject', 'predicate', 'object'].join(sep)];

  for (const quad of store) {
    const s = termToString(quad.subject, true);
    const p = termToString(quad.predicate, true);
    const o = termToString(quad.object, true);
    lines.push([csvEscape(s, sep), csvEscape(p, sep), csvEscape(o, sep)].join(sep));
  }

  return {
    content: lines.join('\n'),
    label:   'csv',
    lossy:   true,
  };
}

// ── RDF → Markdown table (triples as rows, lossy) ────────────────────────────

async function rdfToMarkdown(content, inputLabel) {
  const store = await parseRdfToStore(content, inputLabel);

  // Build subject → predicate → value(s) map for a nice subject-grouped table
  const bySubject = new Map();
  for (const quad of store) {
    const s = termToString(quad.subject);
    const p = termToString(quad.predicate);
    const o = termToString(quad.object);
    if (!bySubject.has(s)) bySubject.set(s, []);
    bySubject.get(s).push({ p, o });
  }

  const lines = [
    '| Subject | Predicate | Object |',
    '|---|---|---|',
  ];
  for (const [s, triples] of bySubject) {
    for (const { p, o } of triples) {
      lines.push(`| ${mdEscape(s)} | ${mdEscape(p)} | ${mdEscape(o)} |`);
    }
  }

  return {
    content: lines.join('\n'),
    label:   'markdown',
    lossy:   true,
  };
}

// ── RDF → YAML (nested subject→predicate→object map, lossy) ──────────────────

async function rdfToYaml(content, inputLabel, baseIri) {
  const store = await parseRdfToStore(content, inputLabel, baseIri);
  const obj = {};

  for (const quad of store) {
    const s = termToString(quad.subject);
    const p = termToString(quad.predicate);
    const o = termToString(quad.object);
    if (!obj[s]) obj[s] = {};
    if (!obj[s][p]) {
      obj[s][p] = o;
    } else if (Array.isArray(obj[s][p])) {
      obj[s][p].push(o);
    } else {
      obj[s][p] = [obj[s][p], o];
    }
  }

  return {
    content: yaml.dump(obj, { lineWidth: 120 }),
    label:   'yaml',
    lossy:   true,
  };
}

// ─── SPARQL results conversion ────────────────────────────────────────────────

async function convertSparqlResults(content, targetFmt) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`cannot parse input as SPARQL results JSON: ${e.message}`);
  }

  // ASK result: { "boolean": true }
  if (typeof parsed.boolean === 'boolean') {
    const val = String(parsed.boolean);
    switch (targetFmt) {
      case 'csv':      return { content: `result\n${val}`, label: 'csv', lossy: false };
      case 'tsv':      return { content: `result\n${val}`, label: 'csv', lossy: false };
      case 'markdown': return { content: `| result |\n|---|\n| ${val} |`, label: 'markdown', lossy: false };
      case 'yaml':     return { content: yaml.dump({ result: parsed.boolean }), label: 'yaml', lossy: false };
      case 'json':     return { content: JSON.stringify(parsed, null, 2), label: 'json', lossy: false };
      default: throw new Error(`cannot convert ASK result to '${targetFmt}'`);
    }
  }

  // SELECT result: { "results": { "bindings": [...] }, "head": { "vars": [...] } }
  const vars     = parsed?.head?.vars ?? [];
  const bindings = parsed?.results?.bindings ?? [];

  if (vars.length === 0) {
    throw new Error('SPARQL results JSON has no head.vars — cannot determine columns');
  }

  switch (targetFmt) {
    case 'csv':      return sparqlToCsv(vars, bindings, ',');
    case 'tsv':      return sparqlToCsv(vars, bindings, '\t');
    case 'markdown': return sparqlToMarkdown(vars, bindings);
    case 'yaml':     return sparqlToYaml(vars, bindings);
    case 'json':     return { content: JSON.stringify(parsed, null, 2), label: 'json', lossy: false };
    default:
      throw new Error(
        `cannot convert SPARQL results to '${targetFmt}'.\n` +
        `  Supported: ${SPARQL_TARGETS.join(', ')}`
      );
  }
}

function sparqlToCsv(vars, bindings, sep) {
  const header = vars.map(v => csvEscape(v, sep)).join(sep);
  const rows = bindings.map(row =>
    vars.map(v => {
      const cell = row[v];
      if (!cell) return '';
      return csvEscape(
        cell.type === 'uri' ? `<${cell.value}>` : cell.value,
        sep
      );
    }).join(sep)
  );
  return { content: [header, ...rows].join('\n'), label: 'csv', lossy: false };
}

function sparqlToMarkdown(vars, bindings) {
  const header = `| ${vars.join(' | ')} |`;
  const sep    = `| ${vars.map(() => '---').join(' | ')} |`;
  const rows   = bindings.map(row =>
    `| ${vars.map(v => {
      const cell = row[v];
      if (!cell) return '';
      const val = cell.type === 'uri' ? `\`${cell.value}\`` : mdEscape(cell.value);
      return val;
    }).join(' | ')} |`
  );
  return { content: [header, sep, ...rows].join('\n'), label: 'markdown', lossy: false };
}

function sparqlToYaml(vars, bindings) {
  const rows = bindings.map(row => {
    const obj = {};
    for (const v of vars) {
      const cell = row[v];
      obj[v] = cell ? cell.value : null;
    }
    return obj;
  });
  return { content: yaml.dump(rows, { lineWidth: 100 }), label: 'yaml', lossy: false };
}

// ─── N3 helpers ───────────────────────────────────────────────────────────────

async function parseRdfToStore(content, inputLabel, baseIri = 'https://example.org/') {
  return new Promise((resolve, reject) => {
    const store = new Store();

    // json-ld needs special handling
    if (inputLabel === 'json-ld') {
      jsonld.toRDF(JSON.parse(content), { format: 'application/n-quads', base: baseIri })
        .then(nquads => {
          const parser = new N3Parser({ format: 'N-Quads', baseIRI: baseIri });
          parser.parse(nquads, (err, quad) => {
            if (err) reject(err);
            else if (quad) store.add(quad);
            else resolve(store);
          });
        })
        .catch(reject);
      return;
    }

    const n3Format = inputLabel === 'trig' ? 'TriG' : 'Turtle';
    const parser = new N3Parser({ format: n3Format, baseIRI: baseIri });
    parser.parse(content, (err, quad) => {
      if (err) reject(new Error(`RDF parse error: ${err.message}`));
      else if (quad) store.add(quad);
      else resolve(store);
    });
  });
}

async function storeToString(store, format, baseIri = 'https://example.org/') {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const writer = new N3Writer({ format, baseIRI: baseIri });
    writer.addQuads([...store]);
    writer.end((err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function termToString(term, forCsv = false) {
  if (!term) return '';
  if (term.termType === 'NamedNode')    return term.value;
  if (term.termType === 'BlankNode')    return `_:${term.value}`;
  if (term.termType === 'Literal') {
    const val = term.value;
    if (forCsv) {
      // For CSV/TSV: return plain value with lang/datatype annotation stripped
      // (values will be CSV-escaped by the caller)
      if (term.language)  return `${val}@${term.language}`;
      if (term.datatype?.value) {
        const dt = term.datatype.value;
        const shortDt = dt.replace('http://www.w3.org/2001/XMLSchema#', 'xsd:');
        return shortDt === 'xsd:string' ? val : `${val} (${shortDt})`;
      }
      return val;
    }
    // For N-Triples / display: keep Turtle literal notation
    if (term.language)  return `"${val}"@${term.language}`;
    if (term.datatype?.value) {
      const dt = term.datatype.value;
      const shortDt = dt.replace('http://www.w3.org/2001/XMLSchema#', 'xsd:');
      return shortDt === 'xsd:string' ? val : `"${val}"^^${shortDt}`;
    }
    return val;
  }
  return String(term);
}

function extractPrefixes(turtleContent) {
  const prefixes = {};
  const re = /^@prefix\s+(\w*):\s*<([^>]+)>\s*\./gm;
  let m;
  while ((m = re.exec(turtleContent)) !== null) {
    prefixes[m[1]] = m[2];
  }
  return prefixes;
}

// ─── String escaping ──────────────────────────────────────────────────────────

function csvEscape(val, sep) {
  if (!val) return '';
  const s = String(val);
  if (s.includes(sep) || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function mdEscape(val) {
  return String(val ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

// ─── Windows path helpers ─────────────────────────────────────────────────────

function toJenaPath(p) {
  return p.replace(/\\/g, '/');
}

function resolveWindowsCommand(command) {
  if (process.platform !== 'win32') return command;
  if (command.match(/\.(bat|cmd|exe|com)$/i)) return command;
  const { accessSync } = require('fs');
  for (const ext of ['.bat', '.cmd', '.exe']) {
    try { accessSync(command + ext); return command + ext; } catch { /* try next */ }
  }
  return command;
}

function looksLikeSparqlResults(content) {
  try {
    const p = JSON.parse(content);
    return p && (p.head?.vars || typeof p.boolean === 'boolean');
  } catch { return false; }
}
