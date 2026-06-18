/**
 * databook create — wrap one or more data files into a DataBook document.
 * Spec: https://w3id.org/databook/specs/cli-create-v1
 *
 * Wraps Turtle, SHACL, SPARQL, TriG, JSON-LD, JSON, YAML, CSV, XML files
 * into a well-formed DataBook with YAML frontmatter, typed fenced blocks,
 * auto-derived graph stats, and a process stamp.
 *
 * v1.4.2: renderBlock now emits <!-- databook:id --> BEFORE the opening
 *         fence (canonical v1.2+ placement) instead of as the first line
 *         inside the fence. Legacy inline annotations in block.content are
 *         stripped on output to prevent duplication when re-wrapping older
 *         DataBooks.
 */

import { readFileSync, existsSync } from 'fs';
import { writeOutput, resolveEncoding } from '../lib/encoding.js';
import { resolve, join, basename, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import yaml from 'js-yaml';
import { computeStats } from '../lib/stats.js';
import { loadDataBookFile, parseDataBook } from '../lib/parser.js';

// ─── Template resolution constants ──────────────────────────────────────────────

/** Absolute path to the bundled templates/ directory (ESM-safe). */
const TEMPLATES_DIR = join(fileURLToPath(import.meta.url), '..', '..', 'templates');

/** Default template path. */
const DEFAULT_TEMPLATE_PATH = join(TEMPLATES_DIR, 'default.databook.md');

// ─── Format detection ────────────────────────────────────────────────────────────

// Extension → fence label
const EXT_TO_LABEL = {
  // Double extensions (checked first in resolveExt)
  '.shacl.ttl':   'shacl',
  '.shapes.ttl':  'shacl',
  '.databook.md': 'databook',
  // Single extensions
  '.ttl':      'turtle',
  '.turtle':   'turtle',
  '.ttl12':    'turtle12',
  '.trig':     'trig',
  '.jsonld':   'json-ld',
  '.json-ld':  'json-ld',
  '.shacl':    'shacl',
  '.sparql':   'sparql',
  '.rq':       'sparql',
  '.ru':       'sparql-update',
  '.su':       'sparql-update',
  '.json':     'json',
  '.yaml':     'yaml',
  '.yml':      'yaml',
  '.xml':      'xml',
  '.csv':      'csv',
  '.tsv':      'csv',
  '.xsl':      'xslt',
  '.xslt':     'xslt',
  '.xq':       'xquery',
  '.xquery':   'xquery',
  '.txt':      'text',
  '.prompt':   'prompt',
  '.md':       'databook',   // existing DataBook — blocks extracted
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
    encoding:   encOpt,
    dryRun      = false,
    noInfer     = false,
    registry:   registryFiles = [],
    verbose     = false,
    quiet       = false,
    force       = false,
  } = opts;

  let enc;
  try { enc = resolveEncoding(encOpt); } catch (e) { die(e.message); }

  // ── Load config ───────────────────────────────────────────────────────────────
  let config = {};
  if (configFile) {
    try {
      const raw = readFileSync(configFile, 'utf8');
      config = yaml.load(raw, { schema: yaml.JSON_SCHEMA }) ?? {};
    } catch (e) {
      die(`E_CONFIG_PARSE: ${e.message}`);
    }
  }

  // ── Resolve input list (union of CLI args + config inputs:) ───────────────────
  const configInputs = config.inputs ?? [];
  const resolvedInputs = resolveInputList(inputArgs, configInputs,
                                          configFile, globalFormat, noInfer, verbose);

  // Zero inputs is valid: produces a skeleton DataBook from the template
  // with no data blocks. Requires -o (or a config output:) since there is
  // no input stem to infer the output filename from.
  if (resolvedInputs.length === 0 && !outputArg && !config.output) {
    die('E_NO_OUTPUT: no input files and no -o / --output specified.\n' +
        '  Supply at least one input file, or use -o <file> to create a skeleton DataBook.');
  }

  // ── Dry-run: print resolution plan ────────────────────────────────────────────
  if (dryRun) {
    if (resolvedInputs.length > 0) {
      log('\n[create] Resolved inputs:');
      for (const inp of resolvedInputs) {
        log(`  ${inp.path}`);
        log(`    label=${inp.label}  role=${inp.role}  block_id=${inp.blockId}  display_only=${inp.displayOnly}`);
      }
    } else {
      log('\n[create] No input files — skeleton DataBook mode.');
    }
    log('\n[create] Config merging chain:');
    log(`  auto-derived → config${configFile ? ` (${configFile})` : ''} → --set overrides`);
    const outPath = resolveOutputPath(outputArg, resolvedInputs[0]?.path, force);
    log(`\n[create] Output: ${outPath ?? 'stdout'}`);
    return;
  }

  // ── Load and process each input ───────────────────────────────────────────────
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
            label:        block.label,
            blockId:      block.id,
            role:         block.role ?? inp.role,
            content:      block.content,
            displayOnly:  block.display_only,
          });
        }
      } catch (e) {
        die(`cannot parse existing DataBook: ${inp.path}: ${e.message}`);
      }
      continue;
    }

    processedBlocks.push({
      label:        inp.label,
      blockId:      inp.blockId,
      role:         inp.role,
      content:      content.trimEnd(),
      displayOnly:  inp.displayOnly,
    });
  }

  // ── Count RDF triples ─────────────────────────────────────────────────────────
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

  // ── Detect RDF version ────────────────────────────────────────────────────────
  const hasTurtle12 = processedBlocks.some(b => b.label === 'turtle12');
  const hasReification = processedBlocks
    .filter(b => b.label === 'turtle' || b.label === 'turtle12')
    .some(b => /~\s*{|\|\s*}/.test(b.content) || /rdf:reifies/.test(b.content));
  const rdfVersion = (hasTurtle12 || hasReification) ? '1.2' : '1.1';

  // ── Build frontmatter ─────────────────────────────────────────────────────────
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
    const idStem = resolvedInputs.length > 0
      ? basename(resolvedInputs[0].path, extname(resolvedInputs[0].path))
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      : slugify(frontmatter.title ?? 'untitled');
    const generatedId = `https://w3id.org/databook/${idStem}-${randomUUID()}`;
    frontmatter.id = generatedId;
    if (!quiet) warn(`W_ID_GENERATED: no id provided; using generated IRI: ${generatedId}`);
  }
  if (!frontmatter.title) {
    if (resolvedInputs.length > 0) {
      const stems = resolvedInputs.map(i => basename(i.path, extname(i.path)));
      frontmatter.title = stems.length === 1 ? capitalize(stems[0]) : `DataBook: ${stems.join(', ')}`;
    } else {
      frontmatter.title = 'Untitled DataBook';
    }
  }
  if (frontmatter.process?.transformer_type == null && !quiet) {
    warn('W_TRANSFORMER_TYPE_DEFAULT: process.transformer_type defaulted to "script"');
  }

  // ── Load template ─────────────────────────────────────────────────────────────
  const templatePath = templateFile ?? config.template ?? null;
  let templateBody;

  if (templatePath) {
    // Explicit template supplied: load as DataBook (extract body) or plain markdown.
    try {
      templateBody = loadTemplateBody(resolve(templatePath));
    } catch (e) {
      die(`E_TEMPLATE_LOAD: ${e.message}`);
    }
  } else {
    // No explicit template: try bundled default, fall back to inline builder.
    templateBody = loadDefaultTemplateBody(processedBlocks, frontmatter, quiet);
  }

  // ── Assemble output ───────────────────────────────────────────────────────────
  const output = assembleDataBook(frontmatter, processedBlocks, templateBody, quiet);

  // ── Write output ──────────────────────────────────────────────────────────────
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
    ['.shacl.ttl',    'shacl'],
    ['.shapes.ttl',   'shacl'],
    ['.sparql.rq',    'sparql'],
    ['.update.ru',    'sparql-update'],
    ['.manifest.ttl', 'manifest'],
    ['.databook.md',  'databook'],
  ];
  for (const [suffix, label] of doublePairs) {
    if (name.endsWith(suffix)) return suffix;
  }
  return extname(filePath).toLowerCase();
}

// ─── Input resolution ────────────────────────────────────────────────────────────

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
      path:        absPath,
      label,
      role:        inp.role   ?? (noInfer ? null : DEFAULT_ROLES[label] ?? 'reference'),
      blockId:     inp.block_id ?? generateBlockId(absPath, seen),
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
      path:        absPath,
      label,
      role:        noInfer ? null : DEFAULT_ROLES[label] ?? 'reference',
      blockId:     generateBlockId(absPath, seen),
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
  // Short UUID hex suffix (8 chars) guarantees uniqueness without collision loops.
  const shortUuid = randomUUID().replace(/-/g, '').slice(0, 8);
  return `${stem}-${shortUuid}`;
}
// ─── Utilities ────────────────────────────────────────────────────────────────

function log(msg)         { process.stderr.write(msg + '\n'); }
function die(msg, code=1) { process.stderr.write(`error: ${msg}\n`); process.exit(code); }
