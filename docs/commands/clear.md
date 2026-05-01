# databook clear

Remove named graphs from a triplestore via GSP DELETE, or drop all graphs in a dataset.

## Synopsis

```
databook clear [file] [options]
```

## Description

`clear` deletes named graphs from a triplestore. When a DataBook file is provided, it determines the graph IRIs from the document's blocks and the `#meta` graph. Alternatively, specify a graph IRI directly with `--graph`.

`--all` issues a `DROP ALL` SPARQL Update, which removes every named graph in the dataset. This operation is destructive and prompts for confirmation unless `--force` is also given.

## Options

| Option | Description |
|---|---|
| `-s, --server <n>` | Named server from `processors.toml` |
| `-d, --dataset <n>` | Fuseki dataset shorthand |
| `-e, --endpoint <url>` | SPARQL query endpoint URL |
| `--gsp-endpoint <url>` | Explicit GSP (data) endpoint URL |
| `-g, --graph <iri>` | Explicit named graph IRI to delete (no DataBook required) |
| `-b, --block-id <id>` | Clear only this block's named graph |
| `--meta` | Also clear the `#meta` graph (default: on when file is given) |
| `--no-meta` | Suppress `#meta` graph deletion |
| `--all` | `DROP ALL` graphs in the dataset (destructive — prompts for confirmation) |
| `--force` | Skip confirmation when used with `--all` |
| `-a, --auth <credential>` | Auth credential |
| `--dry-run` | Print DELETE requests without sending them |
| `-v, --verbose` | Log per-graph status |

## Examples

```bash
# Clear all graphs associated with a DataBook
databook clear onto.databook.md -d ggsc

# Clear a specific named graph by IRI (no DataBook needed)
databook clear -d ggsc --graph https://example.org/graphs/primary

# Clear all graphs in the dataset (with confirmation)
databook clear -d ggsc --all

# Clear all graphs, skip confirmation prompt
databook clear -d ggsc --all --force

# Preview without sending
databook clear onto.databook.md -d ggsc --dry-run --verbose
```

## Related commands

- [`push`](push.md) — upload graphs (inverse of clear)
- [`sparql-update`](sparql-update.md) — fine-grained DELETE WHERE operations
