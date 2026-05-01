# databook push

Transfer RDF blocks from a DataBook to a SPARQL-compatible triplestore using the SPARQL 1.1 Graph Store Protocol (GSP).

## Synopsis

```
databook push <file> [options]
```

## Description

`push` uploads each pushable block in the DataBook (Turtle, TriG, JSON-LD, SHACL, and SPARQL Update blocks) to the triplestore as a discrete named graph. By default it uses GSP PUT (replace); `--merge` switches to GSP POST (merge/accumulate).

**Named graph assignment** (priority order):
1. Explicit `--graph <iri>` — only valid when a single block is being pushed
2. `graph.named_graph` in frontmatter — single-block convenience
3. Default graph (`?default`) — when neither of the above is provided

**Frontmatter metadata graph:** unless suppressed with `--no-meta`, a serialisation of the frontmatter is pushed to `{document.id}#meta` as a provenance record.

**SPARQL Update blocks** are sent to the update endpoint rather than via GSP, and do not receive a named graph assignment.

## Options

| Option | Description |
|---|---|
| `-s, --server <n>` | Named server from `processors.toml` (use `"list"` to show all) |
| `-d, --dataset <n>` | Fuseki dataset shorthand (`http://localhost:3030/<n>/sparql`) |
| `-e, --endpoint <url>` | SPARQL query endpoint URL |
| `--gsp-endpoint <url>` | Explicit GSP (data) endpoint URL |
| `-b, --block-id <id>` | Push only this block (repeatable) |
| `-g, --graph <iri>` | Override named graph IRI (single-block only) |
| `--meta` | Push frontmatter as `#meta` graph (default: on) |
| `--no-meta` | Suppress frontmatter meta graph push |
| `--merge` | Use GSP POST (merge) instead of PUT (replace) |
| `-a, --auth <credential>` | Auth credential (Basic/Bearer or bare base64) |
| `--dry-run` | Print requests without sending them |
| `-v, --verbose` | Log per-block status |

## Empty `--graph` guard

Passing `--graph ""` exits immediately with an error. Pass no `--graph` flag to use the default graph.

## Examples

```bash
# Push all blocks to a local Fuseki dataset
databook push onto.databook.md -d ggsc

# Push to an explicit endpoint, dry-run first
databook push onto.databook.md -e http://localhost:3030/ds/sparql --dry-run

# Push a single block to a specific named graph
databook push onto.databook.md -b primary-block -g https://example.org/graphs/primary

# Push two specific blocks
databook push onto.databook.md -b data-graph -b shapes-graph -d ggsc

# Push with authentication
DATABOOK_FUSEKI_AUTH="Basic YWRtaW46cGFzc3dvcmQ=" databook push onto.databook.md -e http://host/ds/sparql

# Push and merge (accumulate) rather than replace
databook push onto.databook.md -d ggsc --merge

# Push without the meta graph
databook push onto.databook.md -d ggsc --no-meta
```

## Related commands

- [`pull`](pull.md) — retrieve data back from a triplestore
- [`clear`](clear.md) — delete named graphs from a triplestore
- [`sparql-update`](sparql-update.md) — execute SPARQL INSERT/DELETE updates
