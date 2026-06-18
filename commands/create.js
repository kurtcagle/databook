/**
 * databook create — wrap one or more data files into a DataBook document.
 * Spec: https://w3id.org/databook/specs/cli-create-v1
 *
 * Wraps Turtle, SHACL, SPARQL, TriG, JSON-LD, JSON, YAML, CSV, XML files
 * into a well-formed DataBook with YAML frontmatter, typed fenced blocks,
 * auto-derived graph stats, and a process stamp.
 */

import { readFileSync, existsSync } from 'fs';
import { writeOutput, resolveEncoding } from '../lib/encoding.js';
import { resolve, basename, extname, dirname } from 'path';
import { randomUUID } from 'crypto';
import yaml from 'js-yaml';
import { computeStats } from '../lib/stats.js';
import { loadDataBookFile } from '../lib/parser.js';

// ─── Format detection ─────────────────────────────────────────────────────────

// Extension → fence label
const EXT_TO_LABEL = {
  // Double extensions (checked first in resolveExt)
  '.shacl.ttl':  'shacl',
  '.shapes.ttl': 'shacl',
  '.databook.md': 'databook',
  // Single extensions
  '.ttl':     'turtle',
  '.turtle':  'turtle',
  '.ttl12':   'turtle12',
  '.trig':    'trig',
  '.jsonld':  'json-ld',
  '.json-ld': 'json-ld',
  '.shacl':   'shacl',
  '.sparql':  'sparql',
  '.rq':      'sparql',
  '.ru':      'sparql-update',
  '.su':      'sparql-update',
  '.json':    'json',
  '.yaml':    'yaml',
  '.yml':     'yaml',
  '.xml':     'xml',
  '.csv':     'csv',
  '.tsv':     'csv',
  '.xsl':     'xslt',
  '.xslt':    'xslt',
  '.xq':      'xquery',
  '.xquery':  'xquery',
  '.txt':     'text',
  '.prompt':  'prompt',
  '.md':      'databook',   // existing DataBook — blocks extracted
};

// Default roles per label (when --no-infer is NOT set)
const DEFAULT_ROLES = {
  'turtle':          'primary',
  'turtle12':        'primary',
  'trig':            'primary',
  'json-ld':         'primary',
  'shacl':           'constraint',
  'sparql':          'context',
  'sparql-update':   'context',
  'json':            'reference',
  'yaml':            'reference',
  'xml':             'reference',
  'csv':             'reference',
  'xslt':            'context',
  'xquery':          'context',
  'text':            'reference',
  'prompt':          'context',
};

// Labels that are RDF-parseable for triple counting
const RDF_COUNTABLE = new Set(['turtle', 'turtle12', 'shacl', 'trig']);

// Labels that are display-only by default
const DISPLAY_ONLY_LABELS = new Set([
  'json', 'yaml', 'xml', 'csv', 'text', 'xslt', 'xquery', 'prompt',
]);

/**
 * Run `databook create`.
 * @param {string[]} inputArgs  Positional file path arguments
 * @param {object}   opts
 */
export async function runCreate(inputArgs, opts) {
  const {
    config:     configFile,
    set:        setOverrides = [],
    template:   templateFile,
    format:     globalFormat,
    output:     outputArg,
    dryRun      = false,
    noInfer     = false,
    registry:   registryFiles = [],
    verbose     = false,
    quiet       = false,
    force       = false,
  } = opts;

  // ── Load config ───────────────────────────────────────────────────────────
  let config = {};
  if (configFile) {
    try {
      const raw = readFileSync(configFile, 'utf8');
      config = yaml.load(raw, { schema: yaml.JSON_SCHEMA }) ?? {};
    } catch (e) {
      die(`E_CONFIG_PARSE: ${e.message}`);
    }
  }

  // ── Resolve input list (union of CLI args + config inputs:) ───────────────
  const configInputs = config.inputs ?? [];
  const resolvedInputs = resolveInputList(inputArgs, configInputs,
                                          configFile, globalFormat, noInfer, verbose);

  if (resolvedInputs.length === 0) {
    die('E_NO_INPUT: no inputs resolved from CLI args or config inputs:');
  }

  // ── Dry-run: print resolution plan ───────────────────────────────────────
  if (dryRun) {
    log('\n[create] Resolved inputs:');
    for (const inp of resolvedInputs) {
      log(`  ${inp.path}`);
      log(`    label=${inp.label}  role=${inp.role}  block_id=${inp.blockId}  display_only=${inp.displayOnly}`);
    }
    log('\n[create] Config merging chain:');
    log(`  auto-derived → config${configFile ? ` (${configFile})` : ''} → --set overrides`);
    const outPath = resolveOutputPath(outputArg, resolvedInputs[0]?.path, force);
    log(`\n[create] Output: ${outPath ?? 'stdout'}`);
    return;
  }

  // ── Load and process each input ───────────────────────────────────────────
  const processedBlocks = [];

  for (const inp of resolvedInputs) {
    if (verbose) log(`[create] Loading: ${inp.path} (${inp.label})`);

    let content;
    try {
      content = readFileSync(inp.path, 'utf8');
    } catch (e) {
      die(`cannot read input: ${inp.path}: ${e.message}`);
    }

    // Special case: existing DataBook — extract its blocks
    if (inp.label === 'databook') {
      try {
        const existingDb = loadDataBookFile(inp.path);
        for (const block of existingDb.blocks.filter(b => b.id)) {
          processedBlocks.push({
            label:       block.label,
            blockId:     block.id,
            role:        block.role ?? inp.role,
            content:     block.content,
            displayOnly: block.display_only,
          });
        }
      } catch (e) {
        die(`cannot parse existing DataBook: ${inp.path}: ${e.message}`);
      }
      continue;
    }

    processedBlocks.push({
      label:       inp.label,
      blockId:     inp.blockId,
      role:        inp.role,
      content:     content.trimEnd(),
      displayOnly: inp.displayOnly,
    });
  }

  // ── Count RDF triples ─────────────────────────────────────────────────────
  let totalTriples = 0, totalSubjects = 0;
  const hasRdf = processedBlocks.some(b => RDF_COUNTABLE.has(b.label));
  if (hasRdf) {
    for (const block of processedBlocks) {
      if (!RDF_COUNTABLE.has(block.label)) continue;
      try {
        const stats = await computeStats(stripDatabookComments(block.content));
        block._tripleCount  = stats.tripleCount;
        block._subjectCount = stats.subjectCount;
        totalTriples  += stats.tripleCount;
        totalSubjects += stats.subjectCount;
        if (verbose) log(`[create]   ${block.blockId}: ${stats.tripleCount} triples, ${stats.subjectCount} subjects`);
      } catch (e) {
        if (!quiet) warn(`W_TRIPLE_COUNT_FAILED: could not count triples in '${block.blockId}': ${e.message}`);
      }
    }
  }

  // ── Detect RDF version ────────────────────────────────────────────────────
  const hasTurtle12 = processedBlocks.some(b => b.label === 'turtle12');
  const hasReification = processedBlocks
    .filter(b => b.label === 'turtle' || b.label === 'turtle12')
    .some(b => /~\s*{|\|\s*}/.test(b.content) || /rdf:reifies/.test(b.content));
  const rdfVersion = (hasTurtle12 || hasReification) ? '1.2' : '1.1';

  // ── Build frontmatter ─────────────────────────────────────────────────────
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const timestamp = now.toISOString().replace(/\.\d+Z$/, 'Z');

  // Auto-derived defaults
  const defaults = {
    id:      null,  // will warn if not provided
    title:   null,
    type:    'databook',
    version: '1.0.0',
    created: today,
    process: {
      transformer:      'databook create',
      transformer_type: 'script',
      timestamp,
      agent: {
        name: 'databook-cli',
        iri:  'https://w3id.org/databook/cli',
        role: 'orchestrator',
      },
    },
  };
  if (hasRdf) {
    defaults.graph = {
      triple_count: totalTriples,
      subjects:     totalSubjects,
      rdf_version:  rdfVersion,
    };
    if (hasTurtle12 || hasReification) defaults.graph.reification = true;
  }

  // Build process.inputs from resolved input list
  defaults.process.inputs = resolvedInputs
    .filter(inp => inp.label !== 'databook')
    .map(inp => ({
      iri:         `file://${inp.path}`,
      role:        inp.role,
      block_id:    inp.blockId,
      description: `Input file: ${basename(inp.path)}`,
    }));

  // Deep-merge: defaults → config → --set
  const frontmatter = deepMerge(defaults, configFieldsOnly(config));
  applySetOverrides(frontmatter, setOverrides);

  // Validate protected fields not overwritten
  if (!frontmatter.id) {
    const generatedId = `https://w3id.org/databook/${slugify(frontmatter.title ?? 'untitled')}-v${frontmatter.version}`;
    frontmatter.id = generatedId;
    if (!quiet) warn(`W_ID_GENERATED: no id provided; using generated IRI: ${generatedId}`);
  }
  if (!frontmatter.title) {
    const stems = resolvedInputs.map(i => basename(i.path, extname(i.path)));
    frontmatter.title = stems.length === 1 ? capitalize(stems[0]) : `DataBook: ${stems.join(', ')}`;
  }
  if (frontmatter.process?.transformer_type == null && !quiet) {
    warn('W_TRANSFORMER_TYPE_DEFAULT: process.transformer_type defaulted to "script"');
  }

  // ── Load template ─────────────────────────────────────────────────────────
  const templatePath = templateFile ?? config.template ?? null;
  let templateBody = templatePath
    ? readFileSync(resolve(templatePath), 'utf8')
    : buildDefaultTemplate(processedBlocks, frontmatter);

  // ── Assemble output ───────────────────────────────────────────────────────
  const output = assembleDataBook(frontmatter, processedBlocks, templateBody, quiet);

  // ── Write output ──────────────────────────────────────────────────────────
  const outPath = resolveOutputPath(outputArg, resolvedInputs[0]?.path, force);

  if (!outPath || outPath === '-') {
    writeOutput(null, output, enc);
  } else {
    if (existsSync(outPath) && !force) {
      die(`E_OUTPUT_EXISTS: output file already exists: ${outPath}\n  Use --force to overwrite.`);
    }
    writeOutput(outPath, output, enc);
    if (!quiet) log(`[create] Written: ${outPath}`);
  }
}


/**
 * Resolve fence label extension from a file path.
 * Handles double extensions like .shacl.ttl, .sparql.rq etc.
 */
function resolveExt(filePath) {
  const name = basename(filePath).toLowerCase();
  // Check double extensions (longest match wins)
  const doublePairs = [
    ['.shacl.ttl',   'shacl'],
    ['.shapes.ttl',  'shacl'],
    ['.sparql.rq',   'sparql'],
    ['.update.ru',   'sparql-update'],
    ['.manifest.ttl','manifest'],
    ['.databook.md', 'databook'],
  ];
  for (const [suffix, label] of doublePairs) {
    if (name.endsWith(suffix)) return suffix;
  }
  return extname(filePath).toLowerCase();
}

// ─── Input resolution ─────────────────────────────────────────────────────────

function resolveInputList(cliArgs, configInputs, configFile, globalFormat, noInfer, verbose) {
  const configDir = configFile ? dirname(resolve(configFile)) : process.cwd();
  const seen = new Map();  // canonical path → resolved input

  // 1. Config inputs: (in declaration order)
  for (const inp of configInputs) {
    const absPath = resolve(configDir, inp.path ?? inp.iri?.replace('file://', '') ?? '');
    if (!existsSync(absPath)) {
      die(`E_UNRESOLVED_INPUT: input file not found: ${absPath}`);
    }
    const ext   = resolveExt(absPath);
    const label = inp.format ?? EXT_TO_LABEL[ext] ?? globalFormat ?? null;
    if (!label) {
      die(`E_UNRESOLVED_INPUT: cannot detect format for ${absPath}; use --format or annotate in config`);
    }
    seen.set(absPath, {
      path:       absPath,
      label,
      role:       inp.role   ?? (noInfer ? null : DEFAULT_ROLES[label] ?? 'reference'),
      blockId:    inp.block_id ?? generateBlockId(absPath, seen),
      displayOnly: DISPLAY_ONLY_LABELS.has(label),
    });
  }

  // 2. CLI positional args (add only if not already in config)
  for (const arg of cliArgs) {
    const absPath = resolve(arg);
    if (seen.has(absPath)) continue;
    if (!existsSync(absPath)) die(`E_UNRESOLVED_INPUT: input file not found: ${absPath}`);
    const ext   = resolveExt(absPath);
    const label = EXT_TO_LABEL[ext] ?? globalFormat ?? null;
    if (!label && noInfer) {
      die(`E_UNRESOLVED_INPUT_NOINFER: no format annotation for ${absPath} and --no-infer is set`);
    }
    if (!label) {
      die(`E_UNRESOLVED_INPUT: cannot detect format for ${absPath}; use --format or specify in config`);
    }
    seen.set(absPath, {
      path:       absPath,
      label,
      role:       noInfer ? null : DEFAULT_ROLES[label] ?? 'reference',
      blockId:    generateBlockId(absPath, seen),
      displayOnly: DISPLAY_ONLY_LABELS.has(label),
    });
  }

  // Ensure only one 'primary' role
  const inputs = [...seen.values()];
  const primaries = inputs.filter(i => i.role === 'primary');
  if (primaries.length > 1) {
    primaries.slice(1).forEach((inp, i) => {
      inp.role = `primary-${i + 2}`;
    });
  }

  return inputs;
}

function generateBlockId(absPath, seen) {
  const stem = basename(absPath, extname(absPath))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const base = `${stem}-block`;
  if (![...seen.values()].some(v => v.blockId === base)) return base;
  let n = 2;
  while ([...seen.values()].some(v => v.blockId === `${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// ─── Output DataBook assembly ─────────────────────────────────────────────────

function assembleDataBook(frontmatter, blocks, templateBody, quiet) {
  // Serialise frontmatter (strip null values)
  const cleanFm = removeNulls(frontmatter);
  const fmYaml  = yaml.dump(cleanFm, { lineWidth: 100, quotingType: '"' }).trimEnd();

  const fmBlock = [
    '<script language="application/yaml">',
    '',
    '---',
    fmYaml,
    '---',
    '',
    '</script>',
    '',
  ].join('\n');

  // Render template — substitute {{variable}} from frontmatter and
  // {{blocks}} / {{block:id}} markers
  let body = templateBody;
  body = body.replace(/\{\{(\w[\w.]*)\}\}/g, (_, key) => {
    const val = getNestedValue(cleanFm, key);
    return val != null ? String(val) : `{{${key}}}`;
  });

  // Substitute {{blocks}} — all blocks in order
  const allBlocksText = blocks.map(b => renderBlock(b)).join('\n\n');
  body = body.replace(/\{\{blocks\}\}/g, allBlocksText);

  // Substitute {{block:id}} — specific block by id
  body = body.replace(/\{\{block:([^}]+)\}\}/g, (_, id) => {
    const block = blocks.find(b => b.blockId === id);
    return block ? renderBlock(block) : `<!-- block '${id}' not found -->`;
  });

  // If template has no {{blocks}} marker, append blocks after template body
  if (!templateBody.includes('{{blocks}}') &&
      !blocks.some(b => templateBody.includes(`{{block:${b.blockId}}}`))) {
    body = body.trimEnd() + '\n\n' + allBlocksText;
  }

  const unresolved = (body.match(/\{\{[^}]+\}\}/g) ?? []);
  if (unresolved.length > 0 && !quiet) {
    unresolved.forEach(m => process.stderr.write(`warn: W_TEMPLATE_UNRESOLVED: ${m}\n`));
  }

  return fmBlock + '\n' + body.trimEnd() + '\n';
}

function renderBlock(block) {
  const lines = [
    `\`\`\`${block.label}`,
    `<!-- databook:id: ${block.blockId} -->`,
    block.content,
    '```',
  ];
  return lines.join('\n');
}

function buildDefaultTemplate(blocks, frontmatter) {
  const lines = [
    `# ${frontmatter.title ?? 'DataBook'}`,
    '',
    frontmatter.description
      ? frontmatter.description.trim() + '\n'
      : '',
  ];

  for (const block of blocks) {
    const sectionTitle = titleCase(block.blockId.replace(/-block$/, '').replace(/-/g, ' '));
    const roleNote = block.role ? ` *(${block.role})*` : '';
    lines.push(`## ${sectionTitle}${roleNote}`, '');
    if (block._tripleCount != null) {
      lines.push(`${block._tripleCount} triples, ${block._subjectCount} distinct subjects.`, '');
    }
    lines.push(`{{block:${block.blockId}}}`, '');
  }

  return lines.join('\n');
}

// ─── Output path resolution ───────────────────────────────────────────────────

function resolveOutputPath(outputArg, firstInputPath, force) {
  if (!outputArg) {
    if (!firstInputPath) return null;
    // Infer from first input: ontology.ttl → ontology.databook.md
    const stem = basename(firstInputPath, extname(firstInputPath));
    return `${stem}.databook.md`;
  }
  if (outputArg === '-') return null;  // stdout
  return outputArg;
}

// ─── Frontmatter helpers ──────────────────────────────────────────────────────

/** Strip config-only operational keys before merging into frontmatter. */
function configFieldsOnly(config) {
  const { inputs, template, plugins, ...rest } = config;
  return rest;
}

function deepMerge(base, override) {
  const result = { ...base };
  for (const [k, v] of Object.entries(override ?? {})) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'object' && !Array.isArray(v) &&
        typeof result[k] === 'object' && !Array.isArray(result[k])) {
      result[k] = deepMerge(result[k], v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

function applySetOverrides(obj, overrides) {
  for (const nvp of overrides) {
    const eqIdx = nvp.indexOf('=');
    if (eqIdx < 0) die(`E_SET_NEW_KEY: invalid --set value (no '='): ${nvp}`);
    const path  = nvp.slice(0, eqIdx).trim();
    const value = nvp.slice(eqIdx + 1).trim();
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = isFinite(parts[i]) ? Number(parts[i]) : parts[i];
      if (cur[part] == null) die(`E_SET_NEW_KEY: --set path '${path}' creates a new key`);
      cur = cur[part];
    }
    const lastPart = parts[parts.length - 1];
    if (isFinite(lastPart)) {
      if (!Array.isArray(cur)) die(`E_SET_NEW_KEY: --set path '${path}' indexes a non-array`);
      cur[Number(lastPart)] = parseSetValue(value);
    } else {
      if (cur[lastPart] === undefined) die(`E_SET_NEW_KEY: --set path '${path}' creates a new key`);
      if (cur[lastPart] !== null && typeof cur[lastPart] === 'object') die(`E_SET_PROTECTED: --set cannot replace object at '${path}'`);
      cur[lastPart] = parseSetValue(value);
    }
  }
}

function parseSetValue(v) {
  if (v === 'true')  return true;
  if (v === 'false') return false;
  if (v === 'null')  return null;
  if (/^\d+$/.test(v)) return parseInt(v, 10);
  if (/^\d+\.\d+$/.test(v)) return parseFloat(v);
  return v;
}

function getNestedValue(obj, dotPath) {
  return dotPath.split('.').reduce((cur, k) => cur?.[k], obj) ?? null;
}

function removeNulls(obj) {
  if (Array.isArray(obj)) return obj.map(removeNulls).filter(v => v != null);
  if (typeof obj === 'object' && obj !== null) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) continue;
      const cleaned = removeNulls(v);
      if (cleaned != null) out[k] = cleaned;
    }
    return out;
  }
  return obj;
}

function stripDatabookComments(content) {
  return content.replace(/^<!--\s*databook:[^>]*-->\s*\n?/gm, '');
}

// ─── String utilities ─────────────────────────────────────────────────────────

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function titleCase(s) {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function log(msg)  { process.stderr.write(msg + '\n'); }
function warn(msg) { process.stderr.write(`warn: ${msg}\n`); }
function die(msg, code = 2) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}
