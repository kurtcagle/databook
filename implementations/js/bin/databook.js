#!/usr/bin/env node
/**
 * databook — CLI for DataBook semantic documents.
 *
 * Commands implemented from spec:
 *   head     Extract and serialise DataBook frontmatter and block metadata
 *   push     Transfer RDF blocks to a SPARQL triplestore via GSP
 *   pull     Retrieve RDF from a SPARQL triplestore into a DataBook
 *   process  Execute a processor-registry pipeline DataBook
 *
 * Cross-cutting conventions:
 *   https://w3id.org/databook/specs/cli-conventions-v1
 */

import { program, Command } from 'commander';
import { runHead }    from '../commands/head.js';
import { runExtract } from '../commands/extract.js';
import { runCreate }  from '../commands/create.js';
import { runConvert } from '../commands/convert.js';
import { runPush }    from '../commands/push.js';
import { runPull }    from '../commands/pull.js';
import { runProcess }   from '../commands/process.js';
import { runTransform } from '../commands/transform.js';
import { runPrompt }    from '../commands/prompt.js';
import { runClear }     from '../commands/clear.js';
import { runFetch }     from '../commands/fetch.js';

program
  .name('databook')
  .description('DataBook CLI — inspect, extract, push, pull, and process DataBook semantic documents')
  .version('1.1.0');

// ─── databook head ────────────────────────────────────────────────────────────

program
  .command('head [input]')
  .description('Extract and serialise DataBook frontmatter and block metadata')
  .option('--block-id <id>',    'Return metadata for a specific block only')
  .option('-f, --format <fmt>', 'Output format: json (default), yaml, xml, turtle', 'json')
  .option('-o, --output <file>', 'Output file path (default: stdout)')
  .option('--encoding <enc>',       'Output encoding: utf8 (default), utf8bom, utf16')
  .option('-q, --quiet',        'Suppress warnings')
  .addHelpText('after', `
Examples:
  databook head source.databook.md
  databook head source.databook.md --format turtle
  databook head source.databook.md --block-id primary-block --format yaml
  cat source.databook.md | databook head --format json
  databook head source.databook.md --format json | jq '.blocks[] | select(.role == "primary") | .id'
  `)
  .action(async (input, opts) => {
    await runHead(input ?? null, opts);
  });

// ─── databook push ────────────────────────────────────────────────────────────


// ─── databook convert ─────────────────────────────────────────────────────────

program
  .command('convert [input]')
  .description('Convert a DataBook block to another format')
  .option('-b, --block-id <id>',  'Block to convert (overridden by #fragment syntax)')
  .option('--to <format>',        'Target format (required)')
  .option('--from <format>',      'Input format override (required for stdin)')
  .option('-o, --output <path>',  'Output file. "." to auto-name. Default: stdout')
  .option('--encoding <enc>',       'Output encoding: utf8 (default), utf8bom, utf16')
  .option('--list',               'List all blocks and their convertible target formats')
  .option('-q, --quiet',          'Suppress info and lossy-conversion warnings')
  .addHelpText('after', `
RDF input formats:  turtle, turtle12, trig, shacl, json-ld
RDF output formats: turtle, turtle12, ntriples, trig, json-ld, yaml-ld, xml-rdf, csv, tsv, markdown, yaml
SPARQL results:     csv, tsv, markdown, yaml, json

Fragment syntax: databook convert source.databook.md#block-id --to json-ld

Examples:
  # Turtle → JSON-LD
  databook convert source.databook.md#primary-graph --to json-ld

  # Turtle → Markdown table (lossy)
  databook convert source.databook.md#primary-graph --to markdown -o graph.md

  # SPARQL results → CSV
  databook convert results.databook.md#query-results --to csv

  # SPARQL results → Markdown table
  databook convert results.databook.md#query-results --to markdown

  # Turtle → RDF/XML (requires Jena riot in processors.toml)
  databook convert source.databook.md#primary-graph --to xml-rdf -o graph.rdf

  # Turtle → YAML-LD
  databook convert source.databook.md#primary-graph --to yaml-ld

  # From stdin
  cat graph.ttl | databook convert - --from turtle --to json-ld

  # List all blocks and their convertible formats
  databook convert source.databook.md --list
  `)
  .action(async (input, opts) => {
    await runConvert(input ?? null, opts);
  });

// ─── databook extract ─────────────────────────────────────────────────────────

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
  .addHelpText('after', `
Input format detection:
  .ttl / .turtle → turtle    .trig → trig         .jsonld / .json-ld → json-ld
  .shacl → shacl             .sparql / .rq → sparql  .ru → sparql-update
  .json → json               .yaml / .yml → yaml   .xml → xml  .csv → csv
  .xsl / .xslt → xslt        .xq / .xquery → xquery
  .md → existing DataBook (blocks extracted)

Default roles (inferred from label):
  turtle / turtle12 / trig / json-ld → primary
  shacl → constraint        sparql / sparql-update → context
  json / yaml / xml / csv → reference

Config YAML schema (all fields optional):
  id, title, type, version, description, subject, author, license
  graph: { namespace, named_graph, validator_note }
  process: { transformer, transformer_type, transformer_iri, agent: { name, iri, role } }
  inputs: [{ path, role, block_id, format }]
  template: ./path/to/template.md

Examples:
  # Single Turtle file — all defaults
  databook create ontology.ttl

  # Multiple inputs with config
  databook create ontology.ttl shapes.shacl.ttl -C project.yaml -o output.databook.md

  # Config-only invocation (CI-friendly)
  databook create -C pipeline/stage1.yaml -o output/stage1.databook.md

  # Version bump
  databook create -C project.yaml --set version=1.2.0 -o releases/v1.2.0.databook.md

  # Dry-run to inspect format and role assignments
  databook create ontology.ttl shapes.shacl.ttl queries.sparql --dry-run

  # Force overwrite with explicit title
  databook create ontology.ttl --force --set title="My Ontology v2" -o ontology.databook.md
  `)
  .action(async (inputs, opts) => {
    await runCreate(inputs ?? [], opts);
  });


program
  .command('extract [input]')
  .description('Emit raw block content to stdout or a file')
  .option('-b, --block-id <id>',  'Block to extract (overridden by #fragment syntax)')
  .option('-o, --output <path>',  'Output file. Use "." to auto-name from block-id + label extension')
  .option('--with-metadata',      'Include <!-- databook:* --> comment lines in output')
  .option('--fence',              'Wrap output in fence markers (``` label ``` )')
  .option('--type',               'Print Content-Type to stderr')
  .option('--encoding <enc>',       'Output encoding: utf8 (default), utf8bom, utf16')
  .option('--to <format>',        'Convert extracted block to another format before output')
  .option('--list',               'List all named block ids and labels, then exit')
  .option('-q, --quiet',          'Suppress info messages to stderr')
  .addHelpText('after', `
Fragment syntax (shorthand for --block-id):
  databook extract source.databook.md#primary-graph

Examples:
  # Stdout — pipe directly to another tool
  databook extract source.databook.md#primary-graph | riot --syntax=turtle -
  databook extract source.databook.md --block-id sensor-construct | arq --query=-
  databook extract queries.databook.md#all-sensors \\
    | curl -X POST http://localhost:3030/ds/sparql \\
           -H 'Content-Type: application/sparql-query' --data-binary @-

  # Save to file (auto-extension from block label)
  databook extract source.databook.md --block-id primary-graph -o graph.ttl
  databook extract source.databook.md --block-id primary-graph -o .    # → primary-graph.ttl

  # Inspect available blocks before extracting
  databook extract source.databook.md --list

  # Fence-wrapped for copy-paste
  databook extract source.databook.md --block-id primary-graph --fence

  # Include MIME type on stderr (useful for curl -H)
  databook extract source.databook.md#sensor-construct --type
  `)
  .action(async (input, opts) => {
    await runExtract(input ?? null, opts);
  });


program
  .command('push <file>')
  .description('Transfer RDF blocks from a DataBook to a SPARQL triplestore via GSP')
  .option('-s, --server <name>',       'Named server from processors.toml (use "list" to show all)')
  .option('-d, --dataset <n>',   'Fuseki dataset name on localhost (shorthand for --endpoint http://localhost:3030/<n>/sparql)')
  .option('-e, --endpoint <url>',     'SPARQL query endpoint URL')
  .option('--gsp-endpoint <url>',     'Explicit GSP (data) endpoint URL')
  .option('-b, --block-id <id>',      'Push only this block (repeatable)', collect, [])
  .option('-g, --graph <iri>',        'Override named graph IRI (single-block only)')
  .option('--meta',                   'Push frontmatter as #meta graph (default: on)', true)
  .option('--no-meta',                'Suppress frontmatter meta graph push')
  .option('--merge',                  'Use GSP POST (merge) instead of PUT (replace)')
  .option('-a, --auth <credential>',  'Auth credential (Basic/Bearer or bare base64)')
  .option('--dry-run',                'Print requests without sending them')
  .option('-v, --verbose',            'Log per-block status')
  .addHelpText('after', `
Examples:
  databook push ontology.databook.md --endpoint http://localhost:3030/ds/sparql
  databook push ontology.databook.md -s local
  databook push ontology.databook.md -s ggsc
  databook push ontology.databook.md -d ggsc
  databook push ontology.databook.md -s list
  databook push ontology.databook.md -e http://localhost:3030/ds/sparql --dry-run
  databook push ontology.databook.md -b primary-block -g https://example.org/my-graph
  databook push ontology.databook.md --no-meta --merge
  DATABOOK_FUSEKI_AUTH="Basic YWRtaW46cGFzc3dvcmQ=" databook push file.databook.md -e http://host/ds/sparql
  `)
  .action(async (file, opts) => {
    await runPush(file, opts);
  });

// ─── databook pull ────────────────────────────────────────────────────────────

program
  .command('pull <file>')
  .description('Retrieve RDF from a SPARQL triplestore into a DataBook')
  .option('-s, --server <n>',       'Named server from processors.toml (use "list" to show all)')
  .option('-d, --dataset <name>',   'Fuseki dataset name on localhost (shorthand for --endpoint http://localhost:3030/<name>/sparql)')
  .option('-e, --endpoint <url>',     'SPARQL query endpoint URL')
  .option('-g, --graph <iri>',        'Named graph IRI to fetch (repeatable)', collect, [])
  .option('-f, --fragment <id>',      'databook:id of an embedded SPARQL block to execute')
  .option('-q, --query <file>',       'Path to external .sparql/.rq query file')
  .option('-b, --block-id <id>',      'Block to replace with pull results (requires --out)')
  .option('--infer',                  'Use inference-enabled endpoint')
  .option('--format <fmt>',           'Output format: turtle, trig, json, csv, tsv')
  .option('--stats',                  'Recompute graph.triple_count and graph.subjects after pull')
  .option('--wrap',                   'Write result into a new output DataBook with full provenance')
  .option('-o, --out <file>',         'Output file (for raw output or in-place replacement)')
  .option('-a, --auth <credential>',  'Auth credential')
  .option('--encoding <enc>',         'Output encoding: utf8 (default), utf8bom, utf16')
  .option('--dry-run',                'Print requests without sending')
  .option('-v, --verbose',            'Log endpoint, query, status, result size')
  .addHelpText('after', `
Pull modes:
  Default        Named graph fetch (GSP GET) — uses --graph or frontmatter graph.named_graph
  --query        Execute an external .sparql/.rq file
  --fragment     Execute an embedded SPARQL block from the DataBook by id

Examples:
  # Fetch named graph to stdout
  databook pull sensors.databook.md -e http://localhost:3030/ds/sparql --graph https://example.org/sensors
  databook pull sensors.databook.md -s ggsc --graph https://example.org/sensors
  databook pull sensors.databook.md -d ggsc --graph https://example.org/sensors

  # Execute embedded SPARQL block and replace data block in-place
  databook pull sensors.databook.md -e http://host/sparql \\
    --fragment sensor-construct --block-id sensor-graph --stats --out sensors.databook.md

  # Wrap result in a new DataBook with provenance
  databook pull sensors.databook.md -d ggsc \\
    --fragment sensor-construct --wrap -o pulled.databook.md

  # Wrap with stats recomputation
  databook pull sensors.databook.md -d ggsc \\
    --fragment sensor-construct --wrap --stats -o pulled.databook.md

  # External query, output to file
  databook pull onto.databook.md -e http://host/sparql --query queries/extract.sparql -o result.ttl
  `)
  .action(async (file, opts) => {
    await runPull(file, opts);
  });

// ─── databook process ─────────────────────────────────────────────────────────

program
  .command('process [source]')
  .description('Execute a processor-registry DataBook as a pipeline')
  .option('-P, --process <file>',      'Process DataBook declaring the pipeline')
  .option('--pipeline <id>',           'build:Target IRI or fragment id to execute')
  .option('--sparql <ref>',            'Single-op: SPARQL query via fragment reference')
  .option('--shapes <ref>',            'Single-op: SHACL shapes via fragment reference')
  .option('--xslt <ref>',              'Single-op: XSLT stylesheet via fragment reference')
  .option('--xquery <ref>',            'Single-op: XQuery script via fragment reference')
  .option('--params <source>',         'Parameter source: inline JSON, .json/.yaml file, or fragment ref')
  .option('--interpolate',             'Enable {{variable}} template interpolation in payloads')
  .option('--source-block <id>',       'Use only this source block as input')
  .option('-C, --config <file>',       'Config YAML for output DataBook frontmatter')
  .option('--set <k=v>',               'Frontmatter NVP override (repeatable)', collect, [])
  .option('-o, --output <file>',       'Output DataBook path (default: {source-stem}-output.databook.md)')
  .option('--force',                   'Overwrite output if it exists')
  .option('--encoding <enc>',       'Output encoding: utf8 (default), utf8bom, utf16')
  .option('--to <format>',             'Convert all output blocks to another format')
  .option('--dry-run',                 'Print execution plan without processing')
  .option('-v, --verbose',             'Emit per-stage execution details')
  .option('-q, --quiet',               'Suppress warnings')
  .addHelpText('after', `
Examples:
  # Full pipeline
  databook process source.databook.md -P pipeline.databook.md -o output.databook.md

  # Single SPARQL operation
  databook process source.databook.md --sparql queries.databook.md#construct-graph -o out.databook.md

  # Single SHACL validation
  databook process source.databook.md --shapes shapes.databook.md#person-shapes -o report.databook.md

  # Dry-run to see execution plan
  databook process source.databook.md -P pipeline.databook.md --dry-run

  # With parameter injection
  databook process source.databook.md --sparql queries.databook.md#typed-query \\
    --params '{"type":"ex:Person"}' -o people.databook.md
  `)
  .action(async (source, opts) => {
    await runProcess(source ?? null, opts);
  });

// ─── databook transform ───────────────────────────────────────────────────────

program
  .command('transform [source]')
  .description('Apply an XSLT stylesheet to XML content from a DataBook or plain XML file')
  .requiredOption('--xslt <file>',          'XSLT DataBook or plain .xslt/.xsl stylesheet file')
  .option('-b, --block-id <id>',            'Block ID to extract from source DataBook')
  .option('--xslt-block-id <id>',           'Block ID to extract from XSLT DataBook')
  .option('--param <name=value>',           'XSLT parameter (repeatable)', collect, [])
  .option('--to <format>',                  'Output method: html | xml | text (default: auto)')
  .option('--processor <mode>',             'Processor: auto | saxon | xsltproc (default: auto)', 'auto')
  .option('--encoding <enc>',               'Output encoding: utf8 (default), utf8bom, utf16')
  .option('-o, --output <file>',            'Write output to file instead of stdout')
  .addHelpText('after', `
Processor resolution (--processor auto):
  1. SAXON_JAR env var  →  java [JVM_ARGS] -jar $SAXON_JAR
  2. 'saxon' on PATH
  3. 'xsltproc' on PATH

Examples:
  # DataBook source + DataBook stylesheet (both blocks addressed by ID)
  databook transform source.databook.md \\
    --xslt stylesheets.databook.md \\
    --block-id hga-vocab-rdfxml \\
    --xslt-block-id rdfxml-to-html \\
    -o report.html

  # DataBook source + plain .xslt file
  databook transform source.databook.md \\
    --xslt rdfxml-to-html.xslt \\
    --block-id hga-vocab-rdfxml \\
    -o report.html

  # Plain XML input (no DataBook extraction step)
  databook transform vocab.rdf --xslt report.xslt -o report.html

  # Pass XSLT parameters
  databook transform source.databook.md \\
    --xslt report.xslt \\
    --param base-iri=https://w3id.org/holon/ns# \\
    --param theme=dark \\
    -o report.html

  # Force Saxon, write UTF-8 BOM
  databook transform source.databook.md \\
    --xslt report.xslt --processor saxon --encoding utf8bom -o report.html
  `)
  .action(async (source, opts) => {
    await runTransform(source ?? null, opts);
  });

// ─── databook prompt ─────────────────────────────────────────────────────────────────────────────

program
  .command('prompt [source]')
  .description('Send a DataBook (or block) as context to an LLM and write the response to an output DataBook')
  .option('-p, --prompt <text>',         'Inline prompt text')
  .option('--prompt-file <file>',        'Read prompt from a text file')
  .option('--prompt-block <id>',         'Use a prompt fenced block from the source DataBook')
  .option('-b, --block-id <id>',         'Send only this block as context (default: full DataBook)')
  .option('--param <name=value>',        'Template interpolation parameter (repeatable)', collect, [])
  .option('--interpolate',               'Enable {{variable}} substitution in prompt block')
  .option('--model <model>',             'Anthropic model (default: claude-sonnet-4-6)', 'claude-sonnet-4-6')
  .option('--max-tokens <n>',            'Maximum response tokens (default: 4096)', '4096')
  .option('--system <text>',             'Override system prompt')
  .option('--encoding <enc>',            'Output encoding: utf8 (default), utf8bom, utf16')
  .option('-o, --output <file>',         'Write output DataBook to file (default: stdout)')
  .option('--dry-run',                   'Print resolved context and prompt without calling the API')
  .option('-v, --verbose',               'Log request details to stderr')
  .addHelpText('after', `
Requires: ANTHROPIC_API_KEY environment variable.

Prompt sources (mutually exclusive):
  --prompt "text"          Inline prompt
  --prompt-file query.txt  Read from file
  --prompt-block <id>      Use a 'prompt' fenced block from the source DataBook

Examples:
  # Full DataBook as context, inline prompt
  databook prompt onto.databook.md \\
    --prompt "Summarise the class hierarchy" \\
    -o summary.databook.md

  # Single block as context
  databook prompt onto.databook.md \\
    --block-id hga-vocab-rdfxml \\
    --prompt "List all OWL classes and their superclasses as a Markdown table" \\
    -o classes.databook.md

  # Prompt from file, specific model
  databook prompt onto.databook.md \\
    --prompt-file queries/analysis.txt \\
    --model claude-opus-4-6 \\
    -o analysis.databook.md

  # Prompt block with parameter interpolation
  databook prompt onto.databook.md \\
    --prompt-block analysis-prompt \\
    --interpolate --param focus=BoundaryGraph \\
    -o analysis.databook.md

  # Dry-run to inspect context size before calling API
  databook prompt onto.databook.md \\
    --prompt "Describe the ontology" --dry-run
  `)
  .action(async (source, opts) => {
    await runPrompt(source ?? null, opts);
  });

// ─── databook clear ─────────────────────────────────────────────────────────────────────────────

program
  .command('clear [file]')
  .description('Remove named graphs from a triplestore via GSP DELETE, or DROP ALL graphs in a dataset')
  .option('-s, --server <n>',       'Named server from processors.toml (use "list" to show all)')
  .option('-d, --dataset <n>',      'Fuseki dataset name on localhost (shorthand for --endpoint http://localhost:3030/<n>/sparql)')
  .option('-e, --endpoint <url>',   'SPARQL query endpoint URL')
  .option('--gsp-endpoint <url>',   'Explicit GSP (data) endpoint URL')
  .option('-g, --graph <iri>',      'Explicit named graph IRI to delete (no DataBook required)')
  .option('-b, --block-id <id>',    'Clear only this block\'s named graph')
  .option('--meta',                 'Also clear the #meta graph (default: on when file given)', true)
  .option('--no-meta',              'Suppress #meta graph deletion')
  .option('--all',                  'DROP ALL graphs in the dataset (destructive — prompts for confirmation)')
  .option('--force',                'Skip confirmation when used with --all')
  .option('-a, --auth <credential>','Auth credential (Basic/Bearer or bare base64)')
  .option('--dry-run',              'Print DELETE requests without sending them')
  .option('-v, --verbose',          'Log per-graph status')
  .addHelpText('after', `
Examples:
  # Clear all pushable graphs derived from a DataBook (default dataset)
  databook clear test/observatory.databook.md

  # Clear against a named dataset
  databook clear test/observatory.databook.md -d ggsc

  # Clear a specific block\'s graph
  databook clear test/observatory.databook.md -d ggsc --block-id observatory-shapes

  # Clear by explicit graph IRI (no DataBook required)
  databook clear -d ggsc --graph https://w3id.org/databook/test/observatory-v1#primary-graph

  # Drop all graphs in the dataset (prompts for confirmation)
  databook clear test/observatory.databook.md -d ggsc --all

  # Drop all graphs, skip confirmation
  databook clear test/observatory.databook.md -d ggsc --all --force

  # Dry-run to see what would be deleted
  databook clear test/observatory.databook.md -d ggsc --dry-run --verbose
  `)
  .action(async (file, opts) => {
    await runClear(file ?? null, opts);
  });

// ─── databook fetch ──────────────────────────────────────────────────────────

program
  .command('fetch <source>')
  .description('Retrieve a DataBook or block from an HTTP URL or registry alias')
  .option('-b, --block-id <id>',    'Extract only this block (overrides fragment in source IRI)')
  .option('-F, --format <type>',    'Output format when extracting a single block (turtle, sparql, shacl, ...)')
  .option('--wrap',                 'Wrap a fetched block in a new DataBook with provenance frontmatter')
  .option('--verify-id',            'Fail (not just warn) if returned document id does not match requested IRI')
  .option('-s, --server <n>',       'Named server from processors.toml for auth context')
  .option('-a, --auth <credential>','Bearer token or user:pass for HTTP auth')
  .option('--timeout <ms>',         'Request timeout in milliseconds (default: 30000)')
  .option('--no-cache',             'Bypass local DataBook cache and force fresh retrieval')
  .option('-o, --out <file>',       'Output path (default: inferred from document IRI slug, "-" for stdout)')
  .option('--encoding <enc>',       'Output encoding: utf8 (default), utf8bom, utf16')
  .option('-v, --verbose',          'Log fetch details to stderr')
  .addHelpText('after', `
Sources:
  https://example.org/databooks/my-db-v1            Full document
  https://example.org/databooks/my-db-v1#block-id   Specific block
  @alias                                            Registry alias from processors.toml
  @alias#block-id                                   Registry alias + block fragment

Examples:
  # Fetch a full DataBook to a local file
  databook fetch https://w3id.org/databook/specs/cli-conventions -o conventions.databook.md

  # Fetch a specific block as raw Turtle
  databook fetch https://example.org/databooks/shapes-v1#person-shape --format turtle

  # Fetch a block, wrap in a new DataBook with provenance
  databook fetch https://example.org/databooks/queries-v1#construct-graph --wrap -o construct.databook.md

  # Use a registry alias defined in processors.toml
  databook fetch @my-shapes -o shapes.databook.md
  databook fetch @my-shapes#person-shape --format shacl | databook process source.databook.md --shapes -

  # Force fresh retrieval (bypass cache)
  databook fetch @cli-conventions --no-cache -o conventions.databook.md
  `)
  .action(async (source, opts) => {
    await runFetch(source, opts);
  });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Commander collector for repeatable options. */
function collect(val, acc) {
  acc.push(val);
  return acc;
}

// ─── Global error handler ─────────────────────────────────────────────────────

process.on('uncaughtException', (err) => {
  if (err.code === 'E_UNREACHABLE') {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(4);
  }
  if (err.exitCode) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(err.exitCode);
  }
  process.stderr.write(`error: ${err.message}\n`);
  if (process.env.DATABOOK_DEBUG) process.stderr.write(err.stack + '\n');
  process.exit(1);
});

program.parseAsync(process.argv);
