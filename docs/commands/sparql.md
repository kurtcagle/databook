# databook sparql

Execute a SPARQL SELECT, CONSTRUCT, or ASK query against a triplestore.

## Synopsis

```
databook sparql [source] [options]
```

## Description

`sparql` sends a SPARQL query to a triplestore endpoint and returns the results. The query source must be specified in one of three ways:

- `source#block-id` — fragment addressing of an embedded `sparql` block
- `-i / --id <id>` — block id within the source DataBook
- `-Q / --query <file>` — external `.sparql` or `.rq` file

By default the result is wrapped in a new DataBook with a provenance process stamp. Use `--no-wrap` to emit raw results.

Query type (SELECT/CONSTRUCT/ASK/DESCRIBE) is auto-detected to determine the appropriate result format.

## Options

| Option | Description |
|---|---|
| `-i, --id <id>` | Embedded `sparql` block id in source DataBook (or use `source#id`) |
| `-Q, --query <file>` | External `.sparql`/`.rq` query file |
| `-s, --server <n>` | Named server from `processors.toml` |
| `-d, --dataset <n>` | Fuseki dataset shorthand |
| `-e, --endpoint <url>` | SPARQL query endpoint URL |
| `-g, --graph <iri>` | Restrict query to named graph (repeatable) |
| `--wrap` | Wrap results in a DataBook (default: on) |
| `--no-wrap` | Emit raw results without DataBook wrapping |
| `-f, --format <fmt>` | Output format: `json`, `turtle`, `trig`, `csv`, `tsv`, `markdown` |
| `-o, --output <file>` | Output file (default: stdout) |
| `-a, --auth <credential>` | Auth credential |
| `--dry-run` | Print query without sending |
| `-v, --verbose` | Log request details |
| `-q, --quiet` | Suppress warnings |
| `--encoding <enc>` | Output encoding: `utf8` (default), `utf8bom`, `utf16` |

## Examples

```bash
# Run an embedded SELECT query
databook sparql queries.databook.md#select-sensors -d ggsc

# Run an embedded query using --id flag
databook sparql queries.databook.md -i select-sensors -e http://localhost:3030/ds/sparql

# Run an external query, output as JSON
databook sparql -Q queries/all.sparql -d ggsc -f json

# Run a CONSTRUCT, emit raw Turtle
databook sparql queries.databook.md#construct-graph -d ggsc --no-wrap -o result.ttl

# Restrict query to a named graph
databook sparql queries.databook.md#select-all -d ggsc -g https://example.org/graphs/primary
```

## Related commands

- [`sparql-update`](sparql-update.md) — INSERT/DELETE/DROP operations
- [`pull`](pull.md) — fetch graphs with in-place block replacement
- [`shacl2sparql`](shacl2sparql.md) — auto-generate SPARQL from SHACL shapes
