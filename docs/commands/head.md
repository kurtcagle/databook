# databook head

Read frontmatter and block metadata from a DataBook, or patch frontmatter fields in-place.

## Synopsis

```
databook head [input] [options]
```

## Description

In **read mode** (default), `head` extracts and serialises the frontmatter and block inventory of a DataBook, useful for inspecting a document without opening it.

In **update mode** (triggered by `--set`, `--json`, `--yaml`, or `--file`), `head` performs a deep-merge patch of the frontmatter and rewrites the document. Use `--replace` for a full replacement instead of a merge.

`input` accepts a file path or `-` for stdin. When reading from a pipe with no `-o`, output goes to stdout.

## Options

### Read mode

| Option | Description |
|---|---|
| `--block-id <id>` | Return metadata for a specific block only |
| `-f, --format <fmt>` | Output format: `json` (default), `yaml`, `xml`, `turtle` |

### Update mode

| Option | Description |
|---|---|
| `--set <key=value>` | Set a frontmatter key (dot-path notation; repeatable). Supports `@now` and `@today` tokens |
| `--json <string>` | Inline JSON patch object |
| `--yaml <string>` | Inline YAML patch object |
| `--file <path>` | Path to a `.json` or `.yaml` patch file |
| `--replace` | Replace entire frontmatter (default: deep merge) |
| `--dry-run` | Print resulting document to stdout without writing |

### Shared

| Option | Description |
|---|---|
| `-o, --output <file>` | Output file (read: default stdout; update: default overwrites input) |
| `--encoding <enc>` | Output encoding: `utf8` (default), `utf8bom`, `utf16` |
| `-q, --quiet` | Suppress warnings and info messages |

## Examples

```bash
# Read frontmatter as JSON (default)
databook head onto.databook.md

# Read as Turtle
databook head onto.databook.md --format turtle

# Read metadata for a specific block
databook head onto.databook.md --block-id primary-graph --format yaml

# Update a single field
databook head onto.databook.md --set version=2.0.0

# Update multiple fields
databook head onto.databook.md --set modified=@now --set version=2.0.0

# Update a nested field (dot-path)
databook head onto.databook.md --set graph.triple_count=47

# Patch with inline JSON
databook head onto.databook.md --json '{"license":"CC-BY-4.0"}'

# Patch from a YAML file, preview without writing
databook head onto.databook.md --file patch.yaml --dry-run

# Patch and write to a new file
databook head onto.databook.md --set version=2.0.0 -o updated.databook.md

# Read from stdin
cat onto.databook.md | databook head --format json
```

## Token expansion

`@now` expands to an ISO 8601 timestamp at the time of execution.  
`@today` expands to `YYYY-MM-DD`.

## Related commands

- [`extract`](extract.md) — emit raw block content
- [`insert`](insert.md) — add blocks to a DataBook
- [`create`](create.md) — create a DataBook from data files
