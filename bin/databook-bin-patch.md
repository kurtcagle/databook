# bin/databook.js patch notes

Two targeted changes to the existing bin/databook.js:

## 1. Add import for ingest command (after existing prompt import)

```js
import { runIngest }    from '../commands/ingest.js';
```

## 2. Extend `databook prompt` command with patch options

Add these three options to the `.command('prompt [source]')` block after the existing `--verbose` option:

```js
  .option('--patch <target>',            'Write LLM response to a frontmatter field (e.g. frontmatter.description)')
  .option('--patch-block <id>',          'Write LLM response as content of a named block (creates if absent)')
  .option('--patch-mode <mode>',         'Patch write mode: replace (default) or merge (append to list fields)', 'replace')
```

And update the addHelpText examples to include:

```
  # Patch frontmatter.description in-place
  databook prompt onto.databook.md \\
    --prompt "Write a one-paragraph abstract for this DataBook" \\
    --patch frontmatter.description

  # Patch a named block (replace content)
  databook prompt onto.databook.md \\
    --prompt "Validate the block annotations for consistency" \\
    --patch-block validation-report \\
    -o enriched.databook.md

  # Patch a list field with merge semantics
  databook prompt onto.databook.md \\
    --prompt "Suggest 3 additional subject tags" \\
    --patch frontmatter.subject \\
    --patch-mode merge
```

## 3. Register new `databook ingest` command (add after `databook prompt` block)

```js
// ─── databook ingest ──────────────────────────────────────────────────────────

program
  .command('ingest [input]')
  .description('Convert a plain Markdown document to a DataBook (Phase 1 algorithmic conversion)')
  .option('-o, --output <file>',    'Output DataBook path (default: {stem}.databook.md, "-" for stdout)')
  .option('--id <iri>',             'Override output DataBook IRI (default: urn:databook:{slug}-v{version})')
  .option('--base-iri <iri>',       'Base IRI for RDF triple counting (default: https://example.org/)')
  .option('--namespace <iri>',      'Primary ontology namespace for graph.namespace frontmatter field')
  .option('--domain <iri>',         'Primary domain IRI for domain frontmatter field')
  .option('--source-iri <iri>',     'Override source document IRI in process.inputs')
  .option('--version <semver>',     'Override version in generated DataBook (default: 1.0.0)')
  .option('--encoding <enc>',       'Output encoding: utf8 (default), utf8bom, utf16')
  .option('--dry-run',              'Print block classification plan without producing output')
  .option('-q, --quiet',            'Suppress info messages')
  .addHelpText('after', `
Annotation forms recognised:
  Adjacent (canonical v1.2+):
    <!-- databook:id: my-block; databook:content-type: text/turtle -->
    \`\`\`turtle
    @prefix ex: ...
    \`\`\`

  Uplift-by-label (no annotation required for known semantic labels):
    turtle, turtle12, trig, json-ld, shacl, sparql, sparql-update, prompt

  Display-only (never uplifted without annotation):
    javascript, python, bash, html, css, sql, java, typescript, ...

Phase 2 LLM enrichment (run after ingest):
  databook prompt output.databook.md \\
    --prompt "Write a one-paragraph abstract" \\
    --patch frontmatter.description

Examples:
  # Basic conversion
  databook ingest source.md -o output.databook.md

  # With namespace and domain metadata
  databook ingest gov-policy.md \\
    --namespace https://vocab.causalspark.ai/gov# \\
    --base-iri https://vocab.causalspark.ai/ \\
    -o gov-policy.databook.md

  # Dry-run to see block classification before committing
  databook ingest source.md --dry-run

  # From stdin
  cat source.md | databook ingest - -o output.databook.md
  `)
  .action(async (input, opts) => {
    await runIngest(input ?? null, opts);
  });
```
