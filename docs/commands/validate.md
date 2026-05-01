# databook validate

Run SHACL validation against RDF blocks in a DataBook.

## Synopsis

```
databook validate <source> --shapes <ref> [options]
```

## Description

`validate` extracts RDF blocks from a DataBook and validates them against a SHACL shapes graph. By default it validates all pushable RDF blocks; use `--block-id` to restrict to a single block.

The shapes reference supports fragment addressing: `shapes.databook.md#person-shapes` extracts the named block from a DataBook, while a plain `.ttl` path loads the file directly.

**Engine resolution** (in priority order):
1. `JENA_HOME/bin/shacl` or `shacl` on PATH (Jena — recommended, supports SHACL 1.2)
2. `pyshacl` on PATH (Python fallback)

The output is a SHACL validation report wrapped in a new DataBook by default. Use `--no-wrap` for a raw Turtle report.

SHACL 1.2 severity levels in the report:
- `sh:Violation` — structural error
- `sh:Warning` — incomplete or non-conformant
- `sh:Info` — informational deviation

## Options

| Option | Description |
|---|---|
| `-b, --block-id <id>` | Validate only this block (default: all RDF blocks) |
| `--shapes <ref>` | SHACL shapes: `file#block-id` or plain `.ttl` file (required) |
| `-s, --server <n>` | Named server (for future remote SHACL endpoint) |
| `-e, --endpoint <url>` | Remote SHACL validation endpoint (not yet implemented) |
| `--wrap` | Wrap report in a DataBook (default: on) |
| `--no-wrap` | Emit raw SHACL report without DataBook wrapping |
| `-f, --format <fmt>` | Report format: `turtle` (default), `json-ld` |
| `--fail-on-violation` | Exit with code 1 if report contains any `sh:Violation` |
| `-o, --output <file>` | Output file (default: stdout) |
| `-a, --auth <credential>` | Auth credential (for remote endpoint) |
| `--dry-run` | Print plan without validating |
| `-v, --verbose` | Log engine resolution and block details |
| `-q, --quiet` | Suppress CONFORMS/VIOLATION summary line |
| `--encoding <enc>` | Output encoding: `utf8` (default), `utf8bom`, `utf16` |

## Examples

```bash
# Validate all RDF blocks using shapes from a DataBook block
databook validate data.databook.md --shapes shapes.databook.md#person-shapes

# Validate a specific block with shapes from a plain .ttl file
databook validate data.databook.md --block-id primary-graph --shapes shapes.ttl

# Fail the process on any violation (useful for CI/CD gates)
databook validate data.databook.md --shapes shapes.ttl --fail-on-violation --no-wrap

# Write the validation report to a new DataBook
databook validate data.databook.md --shapes shapes.databook.md#org-shapes -o report.databook.md

# Self-validation — shapes block lives in the same DataBook as the data
databook validate registry.databook.md --shapes registry.databook.md#paper-shapes
```

## Related commands

- [`shacl2sparql`](shacl2sparql.md) — compile SHACL shapes to SPARQL retrieval queries
- [`convert`](convert.md) — convert the validation report to RDF/XML or JSON-LD
- [`transform`](transform.md) — apply XSLT to the converted report for HTML/Markdown rendering
