#!/usr/bin/env node
/**
 * databook — CLI for DataBook semantic documents. v1.4.0
 */

import { program } from 'commander';
import { runHead }          from '../commands/head.js';
import { runInsert }        from '../commands/insert.js';
import { runDrop }          from '../commands/drop.js';
import { runExtract }       from '../commands/extract.js';
import { runCreate }        from '../commands/create.js';
import { runConvert }       from '../commands/convert.js';
import { runPush }          from '../commands/push.js';
import { runPull }          from '../commands/pull.js';
import { runProcess }       from '../commands/process.js';
import { runTransform }     from '../commands/transform.js';
import { runPrompt }        from '../commands/prompt.js';
import { runClear }         from '../commands/clear.js';
import { runFetch }         from '../commands/fetch.js';
import { runSparql }        from '../commands/sparql.js';
import { runSparqlUpdate }  from '../commands/sparql-update.js';
import { runValidate }      from '../commands/validate.js';
import { runDescribe }      from '../commands/describe.js';
import { runIngest }        from '../commands/ingest.js';

program
  .name('databook')
  .description('DataBook CLI — inspect, extract, push, pull, process, query, and validate DataBook semantic documents')
  .version('1.4.0');

// ─── databook head ────────────────────────────────────────────────────────────
program
  .command('head [input]')
  .description('Extract frontmatter / block metadata (read), or patch frontmatter in-place (update)')
  // ── Read-mode options ──────────────────────────────────────────────────────
  .option('--block-id <id>',       'Read mode: return metadata for a specific block only')
  .option('-f, --format <fmt>',    'Read mode output format: json (default), yaml, xml, turtle', 'json')
  // ── Update-mode options ────────────────────────────────────────────────────
  .option('--set <key=value>',     'Update mode: set a frontmatter key (dot-path; repeatable; @now/@today tokens)', collect, [])
  .option('--json <string>',       'Update mode: inline JSON patch object')
  .option('--yaml <string>',       'Update mode: inline YAML patch object')
  .option('--file <path>',         'Update mode: path to .json or .yaml patch file')
  .option('--replace',             'Update mode: replace entire frontmatter (default: deep merge)')
  .option('--dry-run',             'Update mode: print resulting document to stdout without writing')
  // ── Shared options ─────────────────────────────────────────────────────────
  .option('-o, --output <file>',   'Output file (read: default stdout; update: default overwrites input)')
  .option('--encoding <enc>',      'Output encoding: utf8 (default), utf8bom, utf16')
  .option('-q, --quiet',           'Suppress warnings and info messages')
  .addHelpText('after', `
READ MODE (default — no --set/--json/--yaml/--file):
  databook head source.databook.md
  databook head source.databook.md --format turtle
  databook head source.databook.md --block-id shapes-block --format yaml
  cat source.databook.md | databook head --format json

UPDATE MODE (--set / --json / --yaml / --file present):
  databook head source.databook.md --set version=1.3.0
  databook head source.databook.md --set modified=@now --set version=2.0.0
  databook head source.databook.md --set graph.triple_count=47
  databook head source.databook.md --json '{"license":"CC-BY-4.0"}'
  databook head source.databook.md --file patch.yaml --dry-run
  databook head source.databook.md --set version=2.0.0 -o updated.databook.md

Tokens (@now/@today): expand to ISO timestamp / YYYY-MM-DD date at time of execution.
Dot-paths: --set graph.triple_count=47 writes into nested frontmatter objects.
  `)
  .action(async (input, opts) => { await runHead(input ?? null, opts); });

// ─── databook insert ──────────────────────────────────────────────────────────
program
  .command('insert <databook> [file]')
  .description('Insert a data file as a named block, or edit body prose, in an existing DataBook')
  .option('--id <block-id>',            'ID for the new block (required in block mode; omit for prose mode)')
  .option('--lang <language>',          'Fence language label (inferred from file extension if omitted)')
  .option('--before <block-id>',        'Block mode: insert before this existing block (default: append)')
  .option('--after <block-id>',         'Block mode: insert after this existing block (default: append)')
  .option('--markdown <text|@path>',    'Prose to prepend before the new fence (block mode) or body prose to edit (prose mode)')
  .option('--markdown-mode <mode>',     'Prose mode placement: append (default) | prepend | replace', 'append')
  .option('--force',                    'Block mode: overwrite existing block if --id already exists')
  .option('-o, --output <file>',        'Output path (default: overwrites source DataBook)')
  .option('--dry-run',                  'Print resulting document to stdout without writing')
  .option('--encoding <enc>',           'Output encoding: utf8 (default), utf8bom, utf16')
  .option('-q, --quiet',                'Suppress info and warning messages')
  .addHelpText('after', `
BLOCK MODE  (--id required, [file] required):
  Insert [file] as a named fenced block.  Language inferred from extension.

  databook insert onto.databook.md shapes.ttl --id shapes-v2
  databook insert onto.databook.md shapes.ttl --id shapes-v2 --after ontology-block
  databook insert onto.databook.md shapes.ttl --id shapes-v2 \\
    --markdown "SHACL validation layer for schema v2."
  databook insert onto.databook.md shapes.ttl --id shapes-v2 --force

PROSE MODE  (--id absent, --markdown required, [file] ignored):
  Edit body prose without touching any data blocks.

  databook insert onto.databook.md --markdown "Updated overview text."
  databook insert onto.databook.md --markdown @intro.md --markdown-mode prepend
  databook insert onto.databook.md --markdown @new-body.md --markdown-mode replace

--markdown-mode values:
  append   (default)  Add prose after the last block, or end of body.
  prepend             Insert prose after frontmatter, before existing content.
  replace             Strip all non-block prose; new prose first, then blocks.

Language inference from extension:
  .ttl/.turtle → turtle    .rq/.sparql → sparql    .shacl → shacl
  .json        → json      .jsonld     → json-ld   .yaml/.yml → yaml
  .trig        → trig      .md         → markdown
  `)
  .action(async (databook, file, opts) => { await runInsert(databook, file ?? null, opts); });

// ─── databook drop ────────────────────────────────────────────────────────────
program
  .command('drop <databook>')
  .description('Remove one or more named blocks from a DataBook')
  .requiredOption('--id <block-id>',    'Block ID to remove (repeatable)', collect, [])
  .option('--remove-prose',             'Also remove the prose section preceding each dropped block')
  .option('--ignore-missing',           'Silently skip --id values that do not exist (default: error)')
  .option('-o, --output <file>',        'Output path (default: overwrites source DataBook)')
  .option('--dry-run',                  'Print resulting document to stdout without writing')
  .option('--encoding <enc>',           'Output encoding: utf8 (default), utf8bom, utf16')
  .option('-q, --quiet',                'Suppress info and warning messages')
  .addHelpText('after', `
Removes each named block — its adjacent annotation lines and fenced content —
from the document.  The frontmatter is not modified.

--remove-prose strips the entire prose section that precedes each dropped block
(from the end of the previous block, or the start of the body, up to the block's
first annotation line).  Use this to drop a block and its section heading together.

Multiple blocks can be dropped in one pass by repeating --id.  Blocks are removed
in reverse document order so line numbers stay consistent.

Consecutive blank lines left by removal are collapsed to at most two.

Examples:
  databook drop onto.databook.md --id shapes-v2
  databook drop onto.databook.md --id shapes-v2 --remove-prose
  databook drop onto.databook.md --id shapes-v2 --id old-queries --remove-prose
  databook drop onto.databook.md --id shapes-v2 --dry-run
  databook drop onto.databook.md --id shapes-v2 -o trimmed.databook.md
  databook drop onto.databook.md --id shapes-v2 --ignore-missing
  `)
  .action(async (databook, opts) => { await runDrop(databook, opts); });

// ─── databook convert ─────────────────────────────────────────────────────────
program
  .command('convert [input]')
  .description('Convert a DataBook block to another format')
  .option('-b, --block-id <id>',  'Block to convert (overridden by #fragment syntax)')
  .option('--to <format>',        'Target format (required)')
  .option('--from <format>',      'Input format override (required for stdin)')
  .option('-o, --output <path>',  'Output file. "." to auto-name. Default: stdout')
  .option('--encoding <enc>',     'Output encoding: utf8 (default), utf8bom, utf16')
  .option('--list',               'List all blocks and their convertible target formats')
  .option('-q, --quiet',          'Suppress info and lossy-conversion warnings')
  .addHelpText('after', `\nRDF input formats:  turtle, turtle12, trig, shacl, json-ld\nRDF output formats: turtle, turtle12, ntriples, trig, json-ld, yaml-ld, xml-rdf, csv, tsv, markdown, yaml\nSPARQL results:     csv, tsv, markdown, yaml, json\n\nExamples:\n  databook convert source.databook.md#primary-graph --to json-ld\n  cat graph.ttl | databook convert - --from turtle --to json-ld\n  databook convert source.databook.md --list\n  `)
  .action(async (input, opts) => { await runConvert(input ?? null, opts); });

// ─── databook extract ─────────────────────────────────────────────────────────
program
  .command('extract [input]')
  .description('Emit raw block content to stdout or a file')
  .option('-b, --block-id <id>',  'Block to extract (overridden by #fragment syntax)')
  .option('-o, --output <path>',  'Output file. Use "." to auto-name from block-id + label extension')
  .option('--with-metadata',      'Include <!-- databook:* --> comment lines in output')
  .option('--fence',              'Wrap output in fence markers (``` label ``` )')
  .option('--type',               'Print Content-Type to stderr')
  .option('--encoding <enc>',     'Output encoding: utf8 (default), utf8bom, utf16')
  .option('--to <format>',        'Convert extracted block to another format before output')
  .option('--list',               'List all named block ids and labels, then exit')
  .option('-q, --quiet',          'Suppress info messages to stderr')
  .addHelpText('after', `\nExamples:\n  databook extract source.databook.md#primary-graph | riot --syntax=turtle -\n  databook extract source.databook.md --block-id primary-graph -o graph.ttl\n  databook extract source.databook.md --list\n  `)
  .action(async (input, opts) => { await runExtract(input ?? null, opts); });

// ─── databook create ──────────────────────────────────────────────────────────
program
  .command('create [inputs...]')
  .description('Wrap data files into a DataBook document')
  .option('-C, --config <file>',    'Config YAML (metabindings, input annotations, template)')
  .option('--set <k=v>',            'Frontmatter NVP override (repeatable)', collect, [])
  .option('--template <file>',      'Markdown prose template (overrides config template:)')
  .option('--format <blocktype>',   'Global format fallback for unresolved inputs')
  .option('-o, --output <file>',    'Output path (default: {stem}.databook.md, "-" for stdout)')
  .option('--encoding <enc>',       'Output encoding: utf8 (default), utf8bom, utf16')
  .option('--force',                'Overwrite output if it exists')
  .option('--dry-run',              'Print resolved input plan without producing output')
  .option('--no-infer',             'Require explicit role annotation for all inputs')
  .option('--registry <file>',      'Additional plugin registry DataBook (repeatable)', collect, [])
  .option('-v, --verbose',          'Emit per-input handler resolution details')
  .option('-q, --quiet',            'Suppress warnings')
  .addHelpText('after', `\nTemplate resolution order: (1) --template flag, (2) config template: field, (3) built-in minimal.\n\nExamples:\n  databook create ontology.ttl\n  databook create ontology.ttl shapes.shacl.ttl -C project.yaml -o output.databook.md\n  databook create -C pipeline/stage1.yaml -o output/stage1.databook.md\n  `)
  .action(async (inputs, opts) => { await runCreate(inputs ?? [], opts); });

// ─── databook push ────────────────────────────────────────────────────────────
program
  .command('push <file>')
  .description('Transfer RDF blocks from a DataBook to a SPARQL triplestore via GSP')
  .option('-s, --server <n>',       'Named server from processors.toml (use "list" to show all)')
  .option('-d, --dataset <n>',      'Fuseki dataset name on localhost (shorthand for --endpoint http://localhost:3030/<n>/sparql)')
  .option('-e, --endpoint <url>',   'SPARQL query endpoint URL')
  .option('--gsp-endpoint <url>',   'Explicit GSP (data) endpoint URL')
  .option('-b, --block-id <id>',    'Push only this block (repeatable)', collect, [])
  .option('-g, --graph <iri>',      'Override named graph IRI (single-block only)')
  .option('--meta',                 'Push frontmatter as #meta graph (default: on)', true)
  .option('--no-meta',              'Suppress frontmatter meta graph push')
  .option('--merge',                'Use GSP POST (merge) instead of PUT (replace)')
  .option('-a, --auth <credential>','Auth credential (Basic/Bearer or bare base64)')
  .option('--dry-run',              'Print requests without sending them')
  .option('-v, --verbose',          'Log per-block status')
  .addHelpText('after', `\nExamples:\n  databook push ontology.databook.md -d ggsc\n  databook push ontology.databook.md -e http://localhost:3030/ds/sparql --dry-run\n  databook push ontology.databook.md -b primary-block -g https://example.org/my-graph\n  DATABOOK_FUSEKI_AUTH="Basic YWRtaW46cGFzc3dvcmQ=" databook push file.databook.md -e http://host/ds/sparql\n  `)
  .action(async (file, opts) => { await runPush(file, opts); });

// ─── databook pull ────────────────────────────────────────────────────────────
program
  .command('pull <file>')
  .description('Retrieve RDF from a SPARQL triplestore into a DataBook')
  .option('-s, --server <n>',         'Named server from processors.toml (use "list" to show all)')
  .option('-d, --dataset <n>',        'Fuseki dataset name on localhost (shorthand for --endpoint http://localhost:3030/<n>/sparql)')
  .option('-e, --endpoint <url>',     'SPARQL query endpoint URL')
  .option('-g, --graph <iri>',        'Named graph IRI to fetch (repeatable)', collect, [])
  .option('-i, --id <id>',            'databook:id of an embedded SPARQL block to execute')
  .option('-Q, --query <file>',       'Path to external .sparql/.rq query file')
  .option('--replace-block <id>',     'Block to replace with pull results (requires --output)')
  .option('--infer',                  'Use inference-enabled endpoint')
  .option('-f, --format <fmt>',       'Output format: turtle, trig, json, csv, tsv')
  .option('--stats',                  'Recompute graph.triple_count and graph.subjects after pull')
  .option('--wrap',                   'Write result into a new output DataBook with full provenance')
  .option('--no-wrap',                'Emit raw content without DataBook wrapping')
  .option('-o, --output <file>',      'Output file (for raw output or in-place replacement)')
  .option('-a, --auth <credential>',  'Auth credential')
  .option('--encoding <enc>',         'Output encoding: utf8 (default), utf8bom, utf16')
  .option('--dry-run',                'Print requests without sending')
  .option('-v, --verbose',            'Log endpoint, query, status, result size')
  .addHelpText('after', `\nPull modes:\n  Default        Named graph fetch (GSP GET)\n  --id / -i      Execute embedded SPARQL block by id\n  --query / -Q   Execute external .sparql/.rq file\n\nNOTE: --fragment is now --id / -i; --out is now --output / -o; --block-id is now --replace-block\n\nExamples:\n  databook pull sensors.databook.md -d ggsc --graph https://example.org/sensors\n  databook pull sensors.databook.md -e http://host/sparql -i sensor-construct --replace-block sensor-graph --stats -o sensors.databook.md\n  databook pull onto.databook.md -e http://host/sparql -Q queries/extract.sparql -o result.ttl\n  databook pull sensors.databook.md -d ggsc --graph https://example.org/sensors --no-wrap\n  `)
  .action(async (file, opts) => { await runPull(file, opts); });

// ─── databook sparql ─────────────────────────────────────────────────────────
program
  .command('sparql [source]')
  .description('Execute a SPARQL SELECT, CONSTRUCT, or ASK query against a triplestore')
  .option('-i, --id <id>',          'Embedded sparql block id in source DataBook (or use source#id)')
  .option('-Q, --query <file>',     'External .sparql/.rq query file')
  .option('-s, --server <n>',       'Named server from processors.toml (use "list" to show all)')
  .option('-d, --dataset <n>',      'Fuseki dataset name on localhost')
  .option('-e, --endpoint <url>',   'SPARQL query endpoint URL')
  .option('-g, --graph <iri>',      'Restrict query to named graph (repeatable)', collect, [])
  .option('--wrap',                 'Wrap results in a DataBook (default: on)', true)
  .option('--no-wrap',              'Emit raw results without DataBook wrapping')
  .option('-f, --format <fmt>',     'Output format: json, turtle, trig, csv, tsv, markdown')
  .option('-o, --output <file>',    'Output file (default: stdout)')
  .option('-a, --auth <credential>','Auth credential')
  .option('--dry-run',              'Print query without sending')
  .option('-v, --verbose',          'Log request details')
  .option('-q, --quiet',            'Suppress warnings')
  .option('--encoding <enc>',       'Output encoding: utf8 (default), utf8bom, utf16')
  .addHelpText('after', `\nQuery source (one required): source#id  |  -i/--id <id>  |  -Q/--query <file>\n\nExamples:\n  databook sparql queries.databook.md#select-sensors -d ggsc\n  databook sparql queries.databook.md -i select-sensors -e http://localhost:3030/ds/sparql\n  databook sparql -Q queries/all.sparql -d ggsc -f json\n  databook sparql queries.databook.md#construct-graph -d ggsc --no-wrap -o result.ttl\n  `)
  .action(async (source, opts) => { await runSparql(source ?? null, opts); });

// ─── databook sparql-update ───────────────────────────────────────────────────
program
  .command('sparql-update [source]')
  .description('Execute a SPARQL INSERT, DELETE, or DROP update against a triplestore')
  .option('-i, --id <id>',          'Embedded sparql-update block id in source DataBook (or use source#id)')
  .option('-Q, --query <file>',     'External .sparql/.ru update file')
  .option('-s, --server <n>',       'Named server from processors.toml (use "list" to show all)')
  .option('-d, --dataset <n>',      'Fuseki dataset name on localhost')
  .option('-e, --endpoint <url>',   'SPARQL update endpoint URL')
  .option('-a, --auth <credential>','Auth credential')
  .option('--dry-run',              'Print update without sending')
  .option('-v, --verbose',          'Log request details')
  .option('-q, --quiet',            'Suppress success summary line')
  .addHelpText('after', `\nUpdate source (one required): source#id  |  -i/--id <id>  |  -Q/--query <file>\n\nExamples:\n  databook sparql-update updates.databook.md#insert-labels -d ggsc\n  databook sparql-update -Q updates/correct-dates.ru -d ggsc\n  databook sparql-update updates.databook.md#delete-orphans -d ggsc --dry-run\n  `)
  .action(async (source, opts) => { await runSparqlUpdate(source ?? null, opts); });

// ─── databook validate ────────────────────────────────────────────────────────
program
  .command('validate <source>')
  .description('Run SHACL validation against RDF blocks in a DataBook')
  .option('-b, --block-id <id>',    'Validate only this block (default: all RDF blocks)')
  .requiredOption('--shapes <ref>', 'SHACL shapes: file#block-id or plain .ttl file')
  .option('-s, --server <n>',       'Named server (for future remote SHACL endpoint)')
  .option('-e, --endpoint <url>',   'Remote SHACL validation endpoint (not yet implemented)')
  .option('--wrap',                 'Wrap report in a DataBook (default: on)', true)
  .option('--no-wrap',              'Emit raw SHACL report without DataBook wrapping')
  .option('-f, --format <fmt>',     'Report format: turtle (default), json-ld', 'turtle')
  .option('--fail-on-violation',    'Exit code 1 if report contains sh:Violation')
  .option('-o, --output <file>',    'Output file (default: stdout)')
  .option('-a, --auth <credential>','Auth credential (for remote endpoint)')
  .option('--dry-run',              'Print plan without validating')
  .option('-v, --verbose',          'Log engine resolution and block details')
  .option('-q, --quiet',            'Suppress CONFORMS/VIOLATION summary line')
  .option('--encoding <enc>',       'Output encoding: utf8 (default), utf8bom, utf16')
  .addHelpText('after', `\nEngine resolution: (1) JENA_HOME/bin/shacl or 'shacl' on PATH, (2) 'pyshacl' on PATH\n\nExamples:\n  databook validate data.databook.md --shapes shapes.databook.md#person-shapes\n  databook validate data.databook.md --block-id primary-graph --shapes shapes.ttl\n  databook validate data.databook.md --shapes shapes.ttl --fail-on-violation --no-wrap\n  databook validate data.databook.md --shapes shapes.databook.md#org-shapes -o report.databook.md\n  `)
  .action(async (source, opts) => { await runValidate(source, opts); });

// ─── databook describe ────────────────────────────────────────────────────────
program
  .command('describe [file]')
  .description('Retrieve resource descriptions by IRI from a SPARQL triplestore (SPARQL DESCRIBE)')
  .requiredOption('--iri <iri>',    'IRI to describe (repeatable)', collect, [])
  .option('-s, --server <n>',       'Named server from processors.toml (use "list" to show all)')
  .option('-d, --dataset <n>',      'Fuseki dataset name on localhost')
  .option('-e, --endpoint <url>',   'SPARQL query endpoint URL')
  .option('-g, --graph <iri>',      'Restrict DESCRIBE to a named graph')
  .option('--shapes <ref>',         'SHACL shapes for guided CONSTRUCT (Phase 2 — not yet implemented)')
  .option('--symmetric',            'Document intent: symmetric CBD (Jena default behaviour)')
  .option('--wrap',                 'Wrap result in a DataBook (default: on)', true)
  .option('--no-wrap',              'Emit raw Turtle/TriG without DataBook wrapping')
  .option('-f, --format <fmt>',     'Output format: turtle (default), trig, json-ld', 'turtle')
  .option('-o, --output <file>',    'Output file (default: stdout)')
  .option('-a, --auth <credential>','Auth credential')
  .option('--dry-run',              'Print query without sending')
  .option('-v, --verbose',          'Log request details')
  .option('-q, --quiet',            'Suppress warnings')
  .option('--encoding <enc>',       'Output encoding: utf8 (default), utf8bom, utf16')
  .addHelpText('after', `\nPhase 2 (SHACL-guided CONSTRUCT) is planned. --shapes currently falls back to standard DESCRIBE.\n\nExamples:\n  databook describe -d ggsc --iri https://example.org/ns#Observatory\n  databook describe -d ggsc --iri https://example.org/ns#Observatory --iri https://example.org/ns#Station\n  databook describe -d ggsc --iri https://example.org/ns#Observatory --graph https://example.org/graphs/geodetic\n  databook describe -d ggsc --iri https://example.org/ns#Observatory --no-wrap\n  databook describe data.databook.md -d ggsc --iri https://example.org/ns#Observatory -o desc.databook.md\n  `)
  .action(async (file, opts) => { await runDescribe(file ?? null, opts); });

// ─── databook ingest ──────────────────────────────────────────────────────────
program
  .command('ingest [input]')
  .description('Convert a plain Markdown document to a DataBook')
  .option('-o, --output <file>',    'Output path (default: {stem}.databook.md, "-" for stdout)')
  .option('--base-iri <iri>',       'Base IRI for RDF triple counting', 'https://example.org/')
  .option('--namespace <iri>',      'graph.namespace to inject into frontmatter')
  .option('--domain <iri>',         'domain to inject into frontmatter')
  .option('--id <iri>',             'Override generated document IRI')
  .option('--version <v>',          'Override version (default: 1.0.0)')
  .option('--source-iri <iri>',     'Override source IRI in process.inputs')
  .option('--encoding <enc>',       'Output encoding: utf8 (default), utf8bom, utf16')
  .option('--dry-run',              'Print block scan summary without writing output')
  .option('-v, --verbose',          'Emit per-block classification details')
  .option('-q, --quiet',            'Suppress progress messages')
  .addHelpText('after', `\nUplifted fence labels: turtle, turtle12, trig, json-ld, shacl, sparql, sparql-update, prompt, manifest\n\nPhase 2 enrichment:\n  databook prompt output.databook.md --prompt "Write a concise description" --patch frontmatter.description\n\nExamples:\n  databook ingest article.md -o article.databook.md\n  databook ingest article.md --base-iri https://vocab.example.org/ -o article.databook.md\n  databook ingest article.md --dry-run\n  cat article.md | databook ingest - -o article.databook.md\n  `)
  .action(async (input, opts) => { await runIngest(input ?? null, opts); });

// ─── databook process ─────────────────────────────────────────────────────────
program
  .command('process [source]')
  .description('Execute a processor-registry DataBook as a DAG pipeline')
  .option('-P, --process <file>',      'Process DataBook declaring the pipeline')
  .option('--pipeline <id>',           'build:Target IRI or fragment id to execute')
  .option('--params <source>',         'Parameter source: inline JSON, .json/.yaml file, or fragment ref')
  .option('--interpolate',             'Enable {{variable}} template interpolation in payloads')
  .option('--source-block <id>',       'Use only this source block as input')
  .option('-C, --config <file>',       'Config YAML for output DataBook frontmatter')
  .option('--set <k=v>',               'Frontmatter NVP override (repeatable)', collect, [])
  .option('-o, --output <file>',       'Output DataBook path (default: {source-stem}-output.databook.md)')
  .option('--force',                   'Overwrite output if it exists')
  .option('--encoding <enc>',          'Output encoding: utf8 (default), utf8bom, utf16')
  .option('--to <format>',             'Convert all output blocks to another format')
  .option('--dry-run',                 'Print execution plan without processing')
  .option('-v, --verbose',             'Emit per-stage execution details')
  .option('-q, --quiet',               'Suppress warnings')
  .addHelpText('after', `\nFor single-operation SPARQL or SHACL, use dedicated commands:\n  databook sparql source.databook.md#construct-graph -d ggsc\n  databook validate source.databook.md --shapes shapes.databook.md#person-shapes\n\nExamples:\n  databook process source.databook.md -P pipeline.databook.md -o output.databook.md\n  databook process source.databook.md -P pipeline.databook.md --dry-run\n  databook process source.databook.md -P pipeline.databook.md --params '{"type":"ex:Person"}'\n  `)
  .action(async (source, opts) => { await runProcess(source ?? null, opts); });

// ─── databook transform ───────────────────────────────────────────────────────
program
  .command('transform [source]')
  .description('Apply an XSLT stylesheet to XML content from a DataBook or plain XML file')
  .requiredOption('--xslt <file>',      'XSLT DataBook or plain .xslt/.xsl stylesheet file')
  .option('-b, --block-id <id>',        'Block ID to extract from source DataBook')
  .option('--xslt-block-id <id>',       'Block ID to extract from XSLT DataBook')
  .option('--param <name=value>',       'XSLT parameter (repeatable)', collect, [])
  .option('--to <format>',              'Output method: html | xml | text (default: auto)')
  .option('--processor <mode>',         'Processor: auto | saxon | xsltproc (default: auto)', 'auto')
  .option('--encoding <enc>',           'Output encoding: utf8 (default), utf8bom, utf16')
  .option('-o, --output <file>',        'Write output to file instead of stdout')
  .addHelpText('after', `\nProcessor resolution (--processor auto):\n  1. SAXON_JAR env var → java [JVM_ARGS] -jar $SAXON_JAR\n  2. 'saxon' on PATH\n  3. 'xsltproc' on PATH\n  `)
  .action(async (source, opts) => { await runTransform(source ?? null, opts); });

// ─── databook prompt ──────────────────────────────────────────────────────────
program
  .command('prompt [source]')
  .description('Send a DataBook (or block) as context to an LLM and write the response to an output DataBook')
  .option('-p, --prompt <text>',         'Inline prompt text')
  .option('--prompt-file <file>',        'Read prompt from a text file')
  .option('--prompt-block <id>',         'Use a prompt fenced block from the source DataBook')
  .option('-b, --block-id <id>',         'Send only this block as context (default: full DataBook)')
  .option('--param <name=value>',        'Template interpolation parameter (repeatable)', collect, [])
  .option('--interpolate',               'Enable {{variable}} substitution in prompt block')
  .option('--patch <field>',             'Patch a frontmatter field with the response (e.g. frontmatter.description)')
  .option('--patch-block <id>',          'Replace or create a named block with the response')
  .option('--patch-mode <mode>',         'Patch strategy: replace (default) | merge', 'replace')
  .option('--model <model>',             'Anthropic model (default: claude-sonnet-4-6)', 'claude-sonnet-4-6')
  .option('--max-tokens <n>',            'Maximum response tokens (default: 4096)', '4096')
  .option('--system <text>',             'Override system prompt')
  .option('--encoding <enc>',            'Output encoding: utf8 (default), utf8bom, utf16')
  .option('-o, --output <file>',         'Write output DataBook to file (default: stdout)')
  .option('--dry-run',                   'Print resolved context and prompt without calling the API')
  .option('-v, --verbose',               'Log request details to stderr')
  .option('-q, --quiet',                 'Suppress spinner and completion summary')
  .addHelpText('after', `\nRequires: ANTHROPIC_API_KEY environment variable.\n\nPatch modes:\n  --patch frontmatter.FIELD       Write response to a frontmatter field\n  --patch-block BLOCK-ID          Replace or create a named block\n  --patch-mode merge|replace      For list fields / block content (default: replace)\n\nExamples:\n  databook prompt onto.databook.md --prompt "Summarise the class hierarchy" -o summary.databook.md\n  databook prompt article.databook.md --prompt "Write a concise 2-sentence description" --patch frontmatter.description\n  databook prompt data.databook.md --prompt "Suggest SHACL shapes" --patch-block suggested-shapes\n  `)
  .action(async (source, opts) => { await runPrompt(source ?? null, opts); });

// ─── databook clear ───────────────────────────────────────────────────────────
program
  .command('clear [file]')
  .description('Remove named graphs from a triplestore via GSP DELETE, or DROP ALL graphs in a dataset')
  .option('-s, --server <n>',       'Named server from processors.toml (use "list" to show all)')
  .option('-d, --dataset <n>',      'Fuseki dataset name on localhost (shorthand for --endpoint http://localhost:3030/<n>/sparql)')
  .option('-e, --endpoint <url>',   'SPARQL query endpoint URL')
  .option('--gsp-endpoint <url>',   'Explicit GSP (data) endpoint URL')
  .option('-g, --graph <iri>',      'Explicit named graph IRI to delete (no DataBook required)')
  .option('-b, --block-id <id>',    "Clear only this block's named graph")
  .option('--meta',                 'Also clear the #meta graph (default: on when file given)', true)
  .option('--no-meta',              'Suppress #meta graph deletion')
  .option('--all',                  'DROP ALL graphs in the dataset (destructive — prompts for confirmation)')
  .option('--force',                'Skip confirmation when used with --all')
  .option('-a, --auth <credential>','Auth credential (Basic/Bearer or bare base64)')
  .option('--dry-run',              'Print DELETE requests without sending them')
  .option('-v, --verbose',          'Log per-graph status')
  .addHelpText('after', `\nExamples:\n  databook clear test/observatory.databook.md -d ggsc\n  databook clear -d ggsc --graph https://w3id.org/databook/test/observatory-v1#primary-graph\n  databook clear test/observatory.databook.md -d ggsc --all --force\n  databook clear test/observatory.databook.md -d ggsc --dry-run --verbose\n  `)
  .action(async (file, opts) => { await runClear(file ?? null, opts); });

// ─── databook fetch ───────────────────────────────────────────────────────────
program
  .command('fetch <source>')
  .description('Retrieve a DataBook or block from an HTTP URL or registry alias')
  .option('-b, --block-id <id>',    'Extract only this block (overrides fragment in source IRI)')
  .option('-f, --format <type>',    'Output format when extracting a single block (turtle, sparql, shacl, ...)')
  .option('--wrap',                 'Wrap a fetched block in a new DataBook with provenance frontmatter')
  .option('--no-wrap',              'Emit raw content without DataBook wrapping')
  .option('--verify-id',            'Fail (not just warn) if returned document id does not match requested IRI')
  .option('-s, --server <n>',       'Named server from processors.toml for auth context')
  .option('-a, --auth <credential>','Bearer token or user:pass for HTTP auth')
  .option('--timeout <ms>',         'Request timeout in milliseconds (default: 30000)')
  .option('--no-cache',             'Bypass local DataBook cache and force fresh retrieval')
  .option('-o, --out <file>',       'Output path (default: inferred from document IRI slug, "-" for stdout)')
  .option('--encoding <enc>',       'Output encoding: utf8 (default), utf8bom, utf16')
  .option('-v, --verbose',          'Log fetch details to stderr')
  .addHelpText('after', `\nExamples:\n  databook fetch https://w3id.org/databook/specs/cli-conventions -o conventions.databook.md\n  databook fetch https://example.org/databooks/shapes-v1#person-shape --format turtle\n  databook fetch @my-shapes -o shapes.databook.md\n  databook fetch @cli-conventions --no-cache -o conventions.databook.md\n  `)
  .action(async (source, opts) => { await runFetch(source, opts); });

// ─── Helpers ──────────────────────────────────────────────────────────────────
function collect(val, acc) { acc.push(val); return acc; }

process.on('uncaughtException', (err) => {
  if (err.code === 'E_UNREACHABLE') { process.stderr.write(`error: ${err.message}\n`); process.exit(4); }
  if (err.exitCode) { process.stderr.write(`error: ${err.message}\n`); process.exit(err.exitCode); }
  process.stderr.write(`error: ${err.message}\n`);
  if (process.env.DATABOOK_DEBUG) process.stderr.write(err.stack + '\n');
  process.exit(1);
});

program.parseAsync(process.argv);
