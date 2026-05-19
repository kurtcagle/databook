# databook-cli

Node.js CLI for **DataBook** semantic documents — Markdown files that carry typed RDF/SPARQL/SHACL payloads alongside human-readable prose and self-describing YAML frontmatter.

Spec: [github.com/kurtcagle/databook](https://github.com/kurtcagle/databook) · Namespace: `https://w3id.org/databook/ns#`

---

## Installation

```bash
# From the package directory
npm install -g .

# Or run directly
node bin/databook.js <command>
```

**Requires Node.js ≥ 18.0.0** (uses native `fetch`).

---

## Commands

### `databook head` — Inspect a DataBook

Extracts frontmatter and block metadata. Never modifies input. Useful for pipeline inspection and conditional branching.

```bash
# Default: frontmatter + block summary as JSON
databook head source.databook.md

# Specific block metadata
databook head source.databook.md --block-id primary-block

# All output formats
databook head source.databook.md --format json     # default
databook head source.databook.md --format yaml
databook head source.databook.md --format xml
databook head source.databook.md --format turtle

# Pipeline use: extract block ids with role=primary
databook head source.databook.md --format json \
  | jq -r '.blocks[] | select(.role == "primary") | .id'

# Check triple count before processing
TRIPLE_COUNT=$(databook head source.databook.md --format json \
  | jq '.frontmatter.graph.triple_count')

# Stdin
cat source.databook.md | databook head --format yaml
```

---

### `databook push` — Send DataBook RDF to a triplestore

Pushes RDF blocks to a SPARQL-compatible triplestore via the SPARQL 1.1 Graph Store Protocol (GSP). Each block becomes a discrete named graph. Frontmatter provenance is pushed to a `#meta` graph by default.

**Pushable block types:** `turtle`, `turtle12`, `trig`, `json-ld`, `shacl`, `sparql-update`

```bash
# Push all RDF blocks to Fuseki
databook push ontology.databook.md \
  --endpoint http://localhost:3030/ds/sparql

# Push one block with an explicit graph IRI
databook push ontology.databook.md \
  --block-id primary-block \
  --graph https://example.org/my-graph \
  --endpoint http://localhost:3030/ds/sparql

# Merge (POST) instead of replace (PUT)
databook push ontology.databook.md --endpoint ... --merge

# Suppress meta graph
databook push ontology.databook.md --endpoint ... --no-meta

# Dry-run to see what would be sent
databook push ontology.databook.md --endpoint ... --dry-run

# Auth via env var (recommended for CI)
DATABOOK_FUSEKI_AUTH="Basic YWRtaW46cGFzc3dvcmQ=" \
  databook push file.databook.md --endpoint http://host/ds/sparql
```

**Named graph assignment** (priority order):
1. `--graph <iri>` (single-block only)
2. `frontmatter.graph.named_graph` (single-block documents only)
3. Fragment-addressing rule: `{document.id}#{block-id}`

**GSP endpoint inference:** `/sparql → /data`, `/query → /data`. Override with `--gsp-endpoint` for non-Fuseki stores.

---

### `databook pull` — Fetch RDF from a triplestore into a DataBook

Retrieves RDF from a SPARQL endpoint into a DataBook. Operates in three modes:

| Mode | Trigger | Protocol |
|---|---|---|
| Named graph fetch | Default | GSP GET |
| External query | `--query <file>` | SPARQL POST |
| Fragment-ref | `--fragment <block-id>` | SPARQL POST using embedded block |

```bash
# Fetch named graph to stdout
databook pull sensors.databook.md \
  --endpoint http://localhost:3030/ds/sparql

# Fetch specific graph IRI
databook pull sensors.databook.md \
  --endpoint http://localhost:3030/ds/sparql \
  --graph https://example.org/sensors

# Execute embedded SPARQL block and replace data block in-place
databook pull sensors.databook.md \
  --endpoint http://localhost:3030/ds/sparql \
  --fragment sensor-construct \
  --block-id sensor-graph \
  --stats \
  --out sensors.databook.md       # same path = atomic in-place update

# External .sparql/.rq file
databook pull onto.databook.md \
  --endpoint http://localhost:3030/ds/sparql \
  --query queries/extract.sparql \
  -o result.ttl

# Dry-run shows the extracted SPARQL query
databook pull sensors.databook.md \
  --fragment sensor-construct \
  --dry-run
```

`--stats` recomputes `graph.triple_count` and `graph.subjects` in frontmatter using N3.js after a successful Turtle/TriG pull.

---

### `databook process` — Execute a pipeline DataBook

Executes a `processor-registry` DataBook as a DAG pipeline against a source DataBook. Supports:

- **Full pipeline mode** (`-P <process-databook>`): Multi-stage DAG with `build:dependsOn` ordering
- **Single-operation shorthand**: `--sparql`, `--shapes`, `--xslt`, `--xquery`

**Supported processors** (configured via `processors.toml`):

| Type | Tool | processors.toml key |
|---|---|---|
| `sparql` | Apache Jena ARQ | `jena-sparql` |
| `shacl` | Apache Jena SHACL | `jena-shacl` |
| `xslt` | Saxon HE 12 | `saxon-xslt` |
| `xquery` | Saxon HE 12 | `saxon-xquery` |
| `sparql-anything` | SPARQL Anything 0.9 | `sparql-anything` |

```bash
# Full pipeline
databook process source.databook.md \
  -P pipeline.databook.md \
  -o output.databook.md

# Single SPARQL CONSTRUCT
databook process source.databook.md \
  --sparql queries.databook.md#construct-graph \
  -o output.databook.md

# Single SHACL validation
databook process source.databook.md \
  --shapes shapes.databook.md#person-shapes \
  -o report.databook.md

# With VALUES parameter injection
databook process source.databook.md \
  --sparql queries.databook.md#typed-query \
  --params '{"type":"ex:Person"}' \
  -o people.databook.md

# Dry-run shows execution plan
databook process source.databook.md -P pipeline.databook.md --dry-run
```

**DAG execution model:** Stages are topologically sorted by `build:dependsOn` edges. Within a topological layer, `build:order` is the tiebreaker.

---

## Configuration

### `processors.toml`

Declares deployment details for processors and endpoints. Three-layer discovery chain (later layers override earlier):

```
{package}/processors.default.toml     ← shipped template (read-only)
~/.config/databook/processors.toml    ← user-level
{project}/.databook/processors.toml   ← project-level
```

> **Do not commit `processors.toml` to version control.** Add it to `.gitignore`.

Example:

```toml
[default_endpoint]
sparql = "http://localhost:3030/ds/sparql"

[endpoints."http://localhost:3030"]
auth = "Basic YWRtaW46cGFzc3dvcmQ="

[processor."https://w3id.org/databook/plugins/core#jena-sparql"]
command   = "/usr/local/jena/bin/sparql"
version   = "6.0.0"
jvm_flags = "-Xmx4g"

[processor."https://w3id.org/databook/plugins/core#jena-shacl"]
command   = "/usr/local/jena/bin/shacl"
version   = "6.0.0"
jvm_flags = "-Xmx4g"

[processor."https://w3id.org/databook/plugins/core#saxon-xslt"]
jar       = "/usr/local/lib/saxon-he-12.jar"
version   = "12.0"
jvm_flags = "-Xmx2g"
```

See `processors.default.toml` for the full schema with all supported keys.

### Authentication

The auth credential is resolved in priority order:

1. `--auth <credential>` flag
2. `DATABOOK_FUSEKI_AUTH` environment variable
3. `processors.toml` `[endpoints."<url>"]` `.auth` or `.auth_env`

Credential forms: `Basic <base64>`, `Bearer <token>`, or bare `<base64>` (auto-prefixed with `Basic`).

---

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Runtime error (partial failure, processor error) |
| `2` | Usage / configuration error (bad args, missing flags) |
| `3` | Authentication failure (401 / 403) |
| `4` | Endpoint unreachable (connection refused, DNS failure) |
| `5` | Empty result — query succeeded but returned no triples/rows |

---

## POSIX Pipeline Compatibility

All commands are POSIX-composable:

```bash
# Inspect output of a process pipeline
databook process source.databook.md -P pipeline.databook.md \
  | databook head --format json

# Round-trip: push, transform in store, pull back
databook push sensors.databook.md --endpoint http://host/ds/sparql
# ... external store transformations ...
databook pull sensors.databook.md \
  --endpoint http://host/ds/sparql \
  --fragment sensor-construct \
  --block-id sensor-graph \
  --stats \
  --out sensors.databook.md
```

---

## Fragment Addressing

Any payload reference uses the form `{document}#{block-id}`:

```bash
# Relative path
--sparql queries.databook.md#construct-graph

# Absolute path
--sparql /data/queries.databook.md#construct-graph

# Current document (same-document fragment)
--fragment sensor-construct

# Full IRI
--sparql https://example.org/queries-v1#select-all
```

---

## Dependencies

| Package | Role |
|---|---|
| `commander` | CLI argument parsing |
| `js-yaml` | YAML frontmatter parsing |
| `@iarna/toml` | `processors.toml` parsing |
| `n3` | Turtle parsing for stats; process DataBook catalogue parsing |

Requires **Node.js ≥ 18** for native `fetch`.

---

## DataBook Spec References

- [Conventions](https://w3id.org/databook/specs/cli-conventions-v1) — stdin/stdout, fragment addressing, `processors.toml`, exit codes
- [head spec](https://w3id.org/databook/specs/cli-head-v1)
- [push spec](https://w3id.org/databook/specs/cli-push)
- [pull spec](https://w3id.org/databook/specs/cli-pull)
- [process spec](https://w3id.org/databook/specs/cli-process-v1)
