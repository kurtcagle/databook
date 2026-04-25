# DataBook CLI

The DataBook CLI is the reference implementation of the [DataBook format](../../SPEC.md) — a Markdown-based format for self-describing semantic documents carrying RDF/SPARQL/SHACL data alongside human-readable prose.

---

## Installation

**Requirements:** Node.js ≥ 18

```bash
cd implementations/js
npm install
npm link          # makes 'databook' available globally, or use 'node bin/databook.js'
```

**Configuration:** Copy `processors.default.toml` to `processors.toml` and set your default SPARQL endpoint and any API keys.

```bash
cp processors.default.toml processors.toml
# Edit processors.toml to set [default_endpoint] and [llm] settings
```

---

## Command Reference

All commands follow POSIX conventions: stdin is accepted when no file argument is given (or `-` is passed explicitly), stdout is the default output, and pipes compose cleanly.

### `head` — Inspect DataBook structure

Outputs the frontmatter and block inventory without loading block content.

```bash
databook head <file> [options]
```

| Option | Description |
| --- | --- |
| `--format` | Output format: `json` (default), `yaml`, `xml`, `turtle` |
| `--block-id <id>` | Return metadata for a single block only |
| `--output <path>` | Write to file instead of stdout |
| `--quiet` | Suppress warnings |

**Examples:**

```bash
# JSON summary of all blocks
databook head myfile.databook.md

# YAML format
databook head myfile.databook.md --format yaml

# Turtle RDF description
databook head myfile.databook.md --format turtle

# Single block metadata
databook head myfile.databook.md --block-id primary-graph

# Pipe to jq
databook head myfile.databook.md --quiet | jq '.blocks[] | select(.label == "sparql") | .id'
```

---

### `extract` — Extract a block's content

Extracts the raw content of a named block, stripping `databook:` comment metadata.

```bash
databook extract <file> [options]
```

| Option | Description |
| --- | --- |
| `--block-id <id>` | Block to extract (required) |
| `--format <label>` | Override output format label |
| `--output <path>` | Write to file instead of stdout |

**Examples:**

```bash
# Extract Turtle block to stdout (pipe to rdflib, Jena, etc.)
databook extract myfile.databook.md --block-id primary-graph

# Extract to file
databook extract myfile.databook.md --block-id primary-graph --output graph.ttl

# Pipe directly to Jena riot for validation
databook extract myfile.databook.md --block-id primary-graph | riot --syntax turtle -
```

---

### `push` — Push graph data to a SPARQL endpoint

Pushes pushable blocks (Turtle, SHACL, SPARQL Update) to a triplestore using the SPARQL Graph Store Protocol.

```bash
databook push <file> [options]
```

| Option | Description |
| --- | --- |
| `--endpoint <url>` | SPARQL endpoint URL (or set `[default_endpoint]` in `processors.toml`) |
| `--block-id <id>` | Push only this block (default: all pushable blocks) |
| `--graph <iri>` | Override named graph IRI (single block only) |
| `--merge` | POST (merge) instead of PUT (replace) |
| `--no-meta` | Suppress frontmatter reification to `#meta` graph |
| `--dry-run` | Log what would be sent without sending |
| `--auth <token>` | Bearer token for authentication |

**Examples:**

```bash
# Push all blocks
databook push myfile.databook.md --endpoint http://localhost:3030/ds/sparql

# Push specific block
databook push myfile.databook.md --block-id primary-graph --endpoint http://localhost:3030/ds/sparql

# Dry run to see what would be sent
databook push myfile.databook.md --endpoint http://localhost:3030/ds/sparql --dry-run

# Merge rather than replace
databook push myfile.databook.md --merge --endpoint http://localhost:3030/ds/sparql
```

---

### `pull` — Pull graph data from a SPARQL endpoint

Pulls RDF content from a SPARQL endpoint and writes it to a DataBook block or to stdout.

```bash
databook pull <file> [options]
```

**Modes:**

| Mode | Trigger | Protocol |
| --- | --- | --- |
| Named graph fetch | Default (no `--query`, no `--fragment`) | GSP GET |
| External query | `--query <sparql-file>` | SPARQL query POST |
| Fragment-ref | `--fragment <block-id>` | SPARQL query POST using embedded block |
| SHACL DESCRIBE | `--describe <iri> --shapes <ref>` | SPARQL CONSTRUCT |

| Option | Description |
| --- | --- |
| `--endpoint <url>` | SPARQL endpoint URL |
| `--graph <iri>` | Named graph IRI to fetch (default: `graph.named_graph` from frontmatter) |
| `--query <file>` | External SPARQL file to execute |
| `--fragment <block-id>` | Execute embedded SPARQL block by `databook:id` |
| `--describe <iri>` | IRI to DESCRIBE using SHACL-guided CONSTRUCT |
| `--shapes <ref>` | DataBook or block IRI containing SHACL shapes for DESCRIBE |
| `--block-id <id>` | Block in the DataBook to replace with pull results |
| `--output <path>` | Write to file instead of stdout |
| `--infer` | Request inference-enabled query endpoint |

**Examples:**

```bash
# Fetch named graph (uses graph.named_graph from frontmatter)
databook pull myfile.databook.md --endpoint http://localhost:3030/ds/sparql

# Execute embedded SPARQL block
databook pull myfile.databook.md --fragment construct-tasks --endpoint http://localhost:3030/ds/sparql

# Execute external SPARQL file
databook pull myfile.databook.md --query test/external-query.sparql --endpoint http://localhost:3030/ds/sparql

# SHACL-guided DESCRIBE (CLI v1.1 feature)
databook pull myfile.databook.md \
  --describe https://w3id.org/databook/test/project-v1#AliceSmith \
  --shapes test/shapes.databook.md#project-shapes \
  --endpoint http://localhost:3030/ds/sparql
```

---

### `clear` — Remove named graphs from a triplestore

```bash
databook clear <file> [options]
```

| Option | Description |
| --- | --- |
| `--endpoint <url>` | SPARQL endpoint URL |
| `--graph <iri>` | Clear this named graph only |
| `--all` | Clear all named graphs listed in the DataBook |
| `--dry-run` | Log what would be deleted without deleting |

---

### `convert` — Convert a DataBook between serialisation formats

Converts DataBook content or block payloads between formats.

```bash
databook convert <file> [options]
```

| Option | Description |
| --- | --- |
| `--block-id <id>` | Convert this block only |
| `--from <format>` | Source format (inferred from block label if omitted) |
| `--to <format>` | Target format |
| `--output <path>` | Write to file instead of stdout |

---

### `process` — Run a pipeline defined in a manifest DataBook

Executes a pipeline defined in a manifest DataBook, running each stage in dependency order.

```bash
databook process <manifest-file> [options]
```

| Option | Description |
| --- | --- |
| `--endpoint <url>` | SPARQL endpoint for graph store operations |
| `--sparql <ref>` | Override the SPARQL block used for a stage |
| `--params <file>` | JSON or YAML file for VALUES injection |
| `--dry-run` | Resolve pipeline without executing stages |

**Examples:**

```bash
databook process pipeline.databook.md --endpoint http://localhost:3030/ds/sparql
databook process pipeline.databook.md --sparql queries.databook.md#construct-active-tasks
```

---

### `transform` — Apply a named transform to a DataBook

Applies a single named transform (SPARQL CONSTRUCT, XSLT, prompt) to a DataBook and produces a new DataBook.

```bash
databook transform <file> [options]
```

| Option | Description |
| --- | --- |
| `--sparql <ref>` | Fragment IRI of a SPARQL CONSTRUCT block |
| `--xslt <file>` | XSLT file to apply |
| `--output <path>` | Write to file instead of stdout |
| `--params <file>` | JSON or YAML parameter file |

---

### `prompt` — Execute a prompt block against an LLM

Executes a `prompt` block against the configured LLM, optionally injecting DataBook context.

```bash
databook prompt <file> [options]
```

| Option | Description |
| --- | --- |
| `--block-id <id>` | Prompt block to execute (default: first `prompt` block) |
| `--context <ref>` | DataBook or block IRI to inject as context |
| `--output <path>` | Write to file instead of stdout |
| `--model <model>` | Override model from processors.toml |

---

### `create` — Create a new DataBook from existing content

Scaffolds a new DataBook from data files, a spec, and optional metadata.

```bash
databook create [data-file...] [options]
```

| Option | Description |
| --- | --- |
| `-C <yaml-file>` | Frontmatter configuration YAML |
| `--id <iri>` | Document identity IRI |
| `--title <string>` | Document title |
| `--type <type>` | Document type: `databook`, `transformer-library`, `processor-registry` |
| `--output <path>` | Write to file instead of stdout |

**Example:**

```bash
databook create graph.ttl shapes.shacl -C project.yaml --output myfile.databook.md
```

---

## processors.toml Configuration

The `processors.toml` file at the implementation root configures default endpoints and credentials:

```toml
[default_endpoint]
sparql = "http://localhost:3030/ds/sparql"
gsp    = "http://localhost:3030/ds/data"

[llm]
provider = "anthropic"
model    = "claude-sonnet-4-6"
# api_key = set ANTHROPIC_API_KEY environment variable instead

[auth]
# bearer_token = "..."   # set per-endpoint if needed
```

---

## Test Fixtures

All test fixtures live in `test/`. See `test/TESTS.md` for the complete test guide.

| File | Purpose |
| --- | --- |
| `test/knowledge-graph.databook.md` | Primary fixture — full block variety (replaces `observatory.databook.md`) |
| `test/pre-v1.databook.md` | v1.0 `<script>` form backwards-compatibility test |
| `test/queries.databook.md` | Named SPARQL query library (fragment-ref pull tests) |
| `test/shapes.databook.md` | Standalone SHACL shapes (DESCRIBE tests) |
| `test/pipeline.databook.md` | 2-stage manifest (process command tests) |
| `test/external-query.sparql` | External SPARQL file for `--query` mode |
| `test/params-type.json` | JSON params for VALUES injection |
| `test/params-by-status.yaml` | YAML params for VALUES injection |

---

## Contributing

The DataBook CLI is the reference implementation of the DataBook format. For bug reports and feature requests, open an issue at `https://github.com/kurtcagle/databook`. For format specification changes, see `SPEC.md`.

**Authors:** Kurt Cagle, Chloe Shannon  
**Licence:** CC-BY-4.0
