# databook-cli

**v1.4.0** — CLI toolchain for [DataBook](https://github.com/kurtcagle/databook) semantic documents.

A DataBook is a Markdown file that simultaneously serves as a human-readable document, a typed data container (Turtle, SPARQL, SHACL, JSON-LD, XSLT, …), and a self-describing semantic artefact with YAML provenance metadata. `databook-cli` provides nineteen commands covering the full data lifecycle: create, inspect, insert, query, validate, transform, push/pull to triplestores, and LLM-assisted analysis.

---

## Quick start

```bash
npm install && npm link
databook create ontology.ttl -o onto.databook.md
databook head onto.databook.md
databook push onto.databook.md -d myDataset
```

→ See [Installation](docs/installation.md) for full setup, optional dependencies, and `processors.toml` configuration.

---

## Commands

### Document composition

| Command | Description |
|---|---|
| [`create`](docs/commands/create.md) | Wrap data files into a new DataBook |
| [`insert`](docs/commands/insert.md) | Insert a data file as a named block, or edit prose, in an existing DataBook |
| [`drop`](docs/commands/drop.md) | Remove named blocks from a DataBook |
| [`ingest`](docs/commands/ingest.md) | Convert a plain Markdown document into a DataBook |

### Inspection and extraction

| Command | Description |
|---|---|
| [`head`](docs/commands/head.md) | Read or patch frontmatter and block metadata |
| [`extract`](docs/commands/extract.md) | Emit raw block content to stdout or a file |
| [`convert`](docs/commands/convert.md) | Convert a block between RDF/serialisation formats |

### Triplestore operations

| Command | Description |
|---|---|
| [`push`](docs/commands/push.md) | Transfer RDF blocks to a SPARQL triplestore via GSP |
| [`pull`](docs/commands/pull.md) | Retrieve RDF from a triplestore into a DataBook |
| [`sparql`](docs/commands/sparql.md) | Execute a SPARQL SELECT, CONSTRUCT, or ASK query |
| [`sparql-update`](docs/commands/sparql-update.md) | Execute a SPARQL INSERT, DELETE, or DROP update |
| [`describe`](docs/commands/describe.md) | Retrieve resource descriptions by IRI (SPARQL DESCRIBE) |
| [`clear`](docs/commands/clear.md) | Delete named graphs from a triplestore |

### Validation and shapes

| Command | Description |
|---|---|
| [`validate`](docs/commands/validate.md) | Run SHACL validation against DataBook RDF blocks |
| [`shacl2sparql`](docs/commands/shacl2sparql.md) | Compile SHACL shapes to SPARQL retrieval queries |

### Transformation and enrichment

| Command | Description |
|---|---|
| [`transform`](docs/commands/transform.md) | Apply an XSLT stylesheet to XML content from a DataBook |
| [`prompt`](docs/commands/prompt.md) | Send a DataBook as context to an LLM; write the response to an output DataBook |

### Pipeline and remote

| Command | Description |
|---|---|
| [`process`](docs/commands/process.md) | Execute a processor-registry DataBook as a DAG pipeline |
| [`fetch`](docs/commands/fetch.md) | Retrieve a DataBook or block from an HTTP URL or registry alias |

---

## Architectural principles

All commands follow four invariants:

1. **Pipeline immutability** — no command modifies its input file in place (unless explicitly asked with `--force` or update mode).
2. **Pipeline composability** — every command reads from stdin and writes to stdout; commands chain via POSIX pipes without intermediate files.
3. **Universal fragment addressing** — any block reference follows `{file}#{block-id}` syntax, consistently across all commands.
4. **Universal parameterisation** — all processor stages accept `--params` for template interpolation.

---

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | General error |
| 2 | Usage / argument error |
| 3 | Auth rejected (HTTP 401/403) |
| 4 | Endpoint unreachable |
| 5 | Resource not found (HTTP 404) |

---

## DataBook format

DataBook documents are Markdown files with a `---`-delimited YAML frontmatter block and named fenced code blocks. Supported fence labels: `turtle`, `turtle12`, `trig`, `shacl`, `sparql`, `sparql-update`, `json-ld`, `json`, `yaml`, `xml`, `xslt`, `prompt`, `manifest`, and more.

→ Full spec: [github.com/kurtcagle/databook](https://github.com/kurtcagle/databook)

---

## Licence

MIT © Kurt Cagle
