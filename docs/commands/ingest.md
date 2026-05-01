# databook ingest

Convert a plain Markdown document into a DataBook by uplifting semantic fenced blocks and generating YAML frontmatter.

## Synopsis

```
databook ingest [input] [options]
```

## Description

`ingest` is a document conversion tool for bringing existing Markdown content into the DataBook ecosystem. It:

1. Parses the source Markdown front matter (if present) and maps known fields to DataBook frontmatter
2. Scans all fenced blocks and classifies them by label or adjacent `<!-- databook:* -->` annotations
3. Uplifts semantic blocks (Turtle, SPARQL, SHACL, JSON-LD, etc.) with DataBook metadata
4. Counts triples for RDF blocks to populate `graph.triple_count` and `graph.subjects`
5. Writes a well-formed `.databook.md` output

Non-semantic fenced blocks (JavaScript, Python, bash, etc.) are preserved verbatim as display-only content.

**Two-phase workflow:** Phase 1 (algorithmic) handles ~95% of conversion deterministically. Phase 2 (LLM enrichment) uses `databook prompt --patch frontmatter.description` to generate richer descriptions.

## Uplifted fence labels

`turtle`, `turtle12`, `trig`, `json-ld`, `shacl`, `sparql`, `sparql-update`, `prompt`, `manifest`

Display-only (not uplifted): `javascript`, `js`, `python`, `bash`, `html`, `css`, `sql`, and others.

## Options

| Option | Description |
|---|---|
| `-o, --output <file>` | Output path (default: `{stem}.databook.md`; use `-` for stdout) |
| `--base-iri <iri>` | Base IRI for RDF triple counting (default: `https://example.org/`) |
| `--namespace <iri>` | `graph.namespace` to inject into frontmatter |
| `--domain <iri>` | `domain` to inject into frontmatter |
| `--id <iri>` | Override generated document IRI |
| `--version <v>` | Override version (default: `1.0.0`) |
| `--source-iri <iri>` | Override source IRI in `process.inputs` |
| `--encoding <enc>` | Output encoding: `utf8` (default), `utf8bom`, `utf16` |
| `--dry-run` | Print block scan summary without writing output |
| `-v, --verbose` | Emit per-block classification details |
| `-q, --quiet` | Suppress progress messages |

## Examples

```bash
# Convert a Markdown article
databook ingest article.md -o article.databook.md

# Specify a base IRI for triple counting
databook ingest article.md --base-iri https://vocab.example.org/ -o article.databook.md

# Preview classification without writing
databook ingest article.md --dry-run --verbose

# Read from stdin
cat article.md | databook ingest - -o article.databook.md

# Phase 2 enrichment after ingestion
databook prompt article.databook.md \
  --prompt "Write a concise 2-sentence description of this DataBook" \
  --patch frontmatter.description
```

## Related commands

- [`create`](create.md) — build a DataBook from raw data files (not Markdown)
- [`insert`](insert.md) — add blocks to an existing DataBook
- [`prompt`](prompt.md) — LLM enrichment of frontmatter fields
