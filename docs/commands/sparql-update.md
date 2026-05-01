# databook sparql-update

Execute a SPARQL INSERT, DELETE, or DROP update against a triplestore.

## Synopsis

```
databook sparql-update [source] [options]
```

## Description

`sparql-update` sends a SPARQL Update operation to a triplestore's update endpoint. The update source must be specified as a block reference, an `--id`, or an external file.

Query source (one required):
- `source#block-id` — fragment addressing of an embedded `sparql-update` block
- `-i / --id <id>` — block id within the source DataBook
- `-Q / --query <file>` — external `.sparql` or `.ru` file

## Options

| Option | Description |
|---|---|
| `-i, --id <id>` | Embedded `sparql-update` block id (or use `source#id`) |
| `-Q, --query <file>` | External `.sparql`/`.ru` update file |
| `-s, --server <n>` | Named server from `processors.toml` |
| `-d, --dataset <n>` | Fuseki dataset shorthand |
| `-e, --endpoint <url>` | SPARQL update endpoint URL |
| `-a, --auth <credential>` | Auth credential |
| `--dry-run` | Print update without sending |
| `-v, --verbose` | Log request details |
| `-q, --quiet` | Suppress success summary line |

## Examples

```bash
# Run an embedded INSERT update
databook sparql-update updates.databook.md#insert-labels -d ggsc

# Run an external update file
databook sparql-update -Q updates/correct-dates.ru -d ggsc

# Preview without sending
databook sparql-update updates.databook.md#delete-orphans -d ggsc --dry-run
```

## Related commands

- [`sparql`](sparql.md) — read-only SELECT/CONSTRUCT/ASK queries
- [`push`](push.md) — upload RDF blocks via GSP
- [`clear`](clear.md) — remove named graphs
