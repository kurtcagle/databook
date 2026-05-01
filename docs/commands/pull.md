# databook pull

Retrieve RDF content from a SPARQL-compatible triplestore into a DataBook.

## Synopsis

```
databook pull <file> [options]
```

## Description

`pull` reads from a triplestore and delivers the result either to stdout, a new file, or in-place into a block of an existing DataBook. It operates in three modes:

| Mode | Trigger | Protocol |
|---|---|---|
| **Named graph fetch** | Default | GSP GET |
| **Embedded query** | `-i / --id <id>` | SPARQL query POST |
| **External query** | `-Q / --query <file>` | SPARQL query POST |

The result can be wrapped in a new DataBook with full provenance frontmatter (`--wrap`, default) or emitted as raw content (`--no-wrap`).

`--replace-block` enables in-place block replacement: the result is written into a specific block of the source DataBook (requires `--output` or defaults to overwriting).

## Options

| Option | Description |
|---|---|
| `-s, --server <n>` | Named server from `processors.toml` |
| `-d, --dataset <n>` | Fuseki dataset shorthand |
| `-e, --endpoint <url>` | SPARQL query endpoint URL |
| `-g, --graph <iri>` | Named graph IRI to fetch (repeatable) |
| `-i, --id <id>` | `databook:id` of an embedded SPARQL block to execute |
| `-Q, --query <file>` | Path to external `.sparql`/`.rq` query file |
| `--replace-block <id>` | Block to replace with pull results |
| `--infer` | Use inference-enabled endpoint |
| `-f, --format <fmt>` | Output format: `turtle`, `trig`, `json`, `csv`, `tsv` |
| `--stats` | Recompute `graph.triple_count` and `graph.subjects` after pull |
| `--wrap` | Wrap result in a new DataBook with provenance (default: on) |
| `--no-wrap` | Emit raw content without DataBook wrapping |
| `-o, --output <file>` | Output file |
| `-a, --auth <credential>` | Auth credential |
| `--encoding <enc>` | Output encoding: `utf8` (default), `utf8bom`, `utf16` |
| `--dry-run` | Print requests without sending |
| `-v, --verbose` | Log endpoint, query, status, result size |

> **Note:** Options were renamed in v1.2.0: `--fragment` → `-i/--id`; `--out` → `--output`; `--block-id` → `--replace-block`.

## Examples

```bash
# Fetch a named graph
databook pull sensors.databook.md -d ggsc --graph https://example.org/sensors

# Execute an embedded SPARQL block and replace a block in-place
databook pull sensors.databook.md -e http://host/sparql \
  -i sensor-construct --replace-block sensor-graph --stats -o sensors.databook.md

# Execute an external query, output raw Turtle
databook pull onto.databook.md -e http://host/sparql -Q queries/extract.sparql -o result.ttl

# Fetch without DataBook wrapping
databook pull sensors.databook.md -d ggsc --graph https://example.org/sensors --no-wrap
```

## Related commands

- [`push`](push.md) — transfer data to a triplestore
- [`sparql`](sparql.md) — execute queries without in-place replacement
- [`describe`](describe.md) — retrieve individual resource descriptions
