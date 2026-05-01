# databook describe

Retrieve resource descriptions by IRI from a SPARQL triplestore (SPARQL DESCRIBE).

## Synopsis

```
databook describe [file] --iri <iri> [options]
```

## Description

`describe` issues a SPARQL DESCRIBE query for one or more IRIs and returns a Concise Bounded Description (CBD) of each resource. By default the result is wrapped in a new DataBook with provenance frontmatter.

Multiple IRIs can be described in a single call by repeating `--iri`.

**Note:** SHACL-guided CONSTRUCT (Phase 2, `--shapes`) is planned but not yet implemented; `--shapes` currently falls back to standard DESCRIBE behaviour.

## Options

| Option | Description |
|---|---|
| `--iri <iri>` | IRI to describe (required; repeatable) |
| `-s, --server <n>` | Named server from `processors.toml` |
| `-d, --dataset <n>` | Fuseki dataset shorthand |
| `-e, --endpoint <url>` | SPARQL query endpoint URL |
| `-g, --graph <iri>` | Restrict DESCRIBE to a named graph |
| `--shapes <ref>` | SHACL shapes for guided CONSTRUCT (Phase 2 — not yet implemented) |
| `--symmetric` | Document intent: symmetric CBD (Jena default behaviour) |
| `--wrap` | Wrap result in a DataBook (default: on) |
| `--no-wrap` | Emit raw Turtle/TriG without DataBook wrapping |
| `-f, --format <fmt>` | Output format: `turtle` (default), `trig`, `json-ld` |
| `-o, --output <file>` | Output file (default: stdout) |
| `-a, --auth <credential>` | Auth credential |
| `--dry-run` | Print query without sending |
| `-v, --verbose` | Log request details |
| `-q, --quiet` | Suppress warnings |
| `--encoding <enc>` | Output encoding: `utf8` (default), `utf8bom`, `utf16` |

## Examples

```bash
# Describe a single resource
databook describe -d ggsc --iri https://example.org/ns#Observatory

# Describe multiple resources
databook describe -d ggsc \
  --iri https://example.org/ns#Observatory \
  --iri https://example.org/ns#Station

# Restrict to a specific named graph
databook describe -d ggsc \
  --iri https://example.org/ns#Observatory \
  --graph https://example.org/graphs/geodetic

# Emit raw Turtle
databook describe -d ggsc --iri https://example.org/ns#Observatory --no-wrap

# Write result to a DataBook
databook describe data.databook.md -d ggsc \
  --iri https://example.org/ns#Observatory -o desc.databook.md
```

## Related commands

- [`sparql`](sparql.md) — arbitrary SELECT/CONSTRUCT queries
- [`pull`](pull.md) — fetch named graphs by IRI
