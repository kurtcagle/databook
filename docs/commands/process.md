# databook process

Execute a processor-registry DataBook as a directed acyclic graph (DAG) pipeline.

## Synopsis

```
databook process [source] [options]
```

## Description

`process` runs a pipeline declared in a processor-registry DataBook. Each stage in the pipeline corresponds to a databook-cli command, and stages are executed in dependency order (DAG topological sort). The pipeline DataBook carries both the source data and the pipeline declaration as named blocks.

For single-operation SPARQL or SHACL work, use the dedicated `sparql` and `validate` commands directly. `process` is intended for multi-stage pipelines with explicit inter-stage dependencies.

Pipeline stages are declared as RDF in a `manifest` fenced block using the `build:` vocabulary.

## Options

| Option | Description |
|---|---|
| `-P, --process <file>` | Process DataBook declaring the pipeline |
| `--pipeline <id>` | `build:Target` IRI or fragment id to execute |
| `--params <source>` | Parameter source: inline JSON, `.json`/`.yaml` file, or fragment ref |
| `--interpolate` | Enable `{{variable}}` template interpolation in payloads |
| `--source-block <id>` | Use only this source block as input |
| `-C, --config <file>` | Config YAML for output DataBook frontmatter |
| `--set <k=v>` | Frontmatter NVP override (repeatable) |
| `-o, --output <file>` | Output DataBook path (default: `{source-stem}-output.databook.md`) |
| `--force` | Overwrite output if it exists |
| `--encoding <enc>` | Output encoding: `utf8` (default), `utf8bom`, `utf16` |
| `--to <format>` | Convert all output blocks to another format |
| `--dry-run` | Print execution plan without processing |
| `-v, --verbose` | Emit per-stage execution details |
| `-q, --quiet` | Suppress warnings |

## Examples

```bash
# Run a pipeline
databook process source.databook.md -P pipeline.databook.md -o output.databook.md

# Preview the execution plan
databook process source.databook.md -P pipeline.databook.md --dry-run

# Run with parameter injection
databook process source.databook.md -P pipeline.databook.md --params '{"type":"ex:Person"}'
```

## Related commands

- [`sparql`](sparql.md) — single SPARQL query
- [`validate`](validate.md) — single SHACL validation
- [`prompt`](prompt.md) — single LLM call
