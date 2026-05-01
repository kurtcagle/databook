# databook create

Wrap one or more data files into a new DataBook document with auto-generated YAML frontmatter, typed fenced blocks, graph statistics, and a provenance process stamp.

## Synopsis

```
databook create [inputs...] [options]
```

## Description

`create` is the primary entry point for building a DataBook from raw data. It accepts one or more input files (Turtle, SHACL, SPARQL, JSON-LD, TriG, JSON, YAML, CSV, XML, XSLT, prompt files, or existing DataBooks), infers the fence label from each file extension, counts triples for RDF blocks, and emits a well-formed `.databook.md` document.

Input files may also be fragment references (`file.databook.md#block-id`) to extract individual blocks from existing DataBooks.

## Options

| Option | Description |
|---|---|
| `-C, --config <file>` | Config YAML supplying metabindings, per-input annotations, and optional template path |
| `--set <k=v>` | Frontmatter key-value override (repeatable; dot-path notation) |
| `--template <file>` | Markdown prose template to wrap the generated content |
| `--format <blocktype>` | Global format fallback for inputs where the extension is ambiguous |
| `-o, --output <file>` | Output path (default: `{stem}.databook.md`; use `-` for stdout) |
| `--encoding <enc>` | Output encoding: `utf8` (default), `utf8bom`, `utf16` |
| `--force` | Overwrite output file if it already exists |
| `--dry-run` | Print the resolved input plan without producing output |
| `--no-infer` | Require explicit role annotation for all inputs (suppress auto-detection) |
| `--registry <file>` | Additional plugin registry DataBook (repeatable) |
| `-v, --verbose` | Emit per-input handler resolution details |
| `-q, --quiet` | Suppress warnings |

## Template resolution

Templates are resolved in this order:
1. `--template` flag
2. `template:` field in config YAML
3. Built-in minimal template

## Extension → fence label mapping

| Extension | Label |
|---|---|
| `.ttl`, `.turtle` | `turtle` |
| `.ttl12` | `turtle12` |
| `.trig` | `trig` |
| `.shacl`, `.shacl.ttl`, `.shapes.ttl` | `shacl` |
| `.sparql`, `.rq` | `sparql` |
| `.ru`, `.su` | `sparql-update` |
| `.jsonld`, `.json-ld` | `json-ld` |
| `.json` | `json` |
| `.yaml`, `.yml` | `yaml` |
| `.xml` | `xml` |
| `.xsl`, `.xslt` | `xslt` |
| `.prompt` | `prompt` |
| `.md`, `.databook.md` | (existing DataBook — blocks extracted) |

## Examples

```bash
# Wrap a single Turtle file
databook create ontology.ttl

# Wrap multiple files with a config
databook create ontology.ttl shapes.shacl.ttl -C project.yaml -o output.databook.md

# Override frontmatter fields
databook create ontology.ttl --set version=2.0.0 --set author.name="Alice"

# Build from a config only (all inputs declared in config)
databook create -C pipeline/stage1.yaml -o output/stage1.databook.md

# Preview without writing
databook create ontology.ttl shapes.ttl --dry-run --verbose

# Assemble blocks from multiple existing DataBooks
databook create onto.databook.md#primary-graph shapes.databook.md#person-shapes -o combined.databook.md
```

## Related commands

- [`insert`](insert.md) — add blocks to an existing DataBook
- [`ingest`](ingest.md) — convert a plain Markdown document to a DataBook
- [`head`](head.md) — inspect or patch frontmatter
