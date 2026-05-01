# databook fetch

Retrieve a DataBook or block from an HTTP URL or registry alias.

## Synopsis

```
databook fetch <source> [options]
```

## Description

`fetch` retrieves a DataBook (or a specific block) from an HTTP(S) URL and writes it to a local file. The source can be:

- A full HTTP(S) URL: `https://example.org/databooks/shapes-v1`
- A URL with fragment: `https://example.org/databooks/shapes-v1#person-shape`
- A registry alias: `@my-shapes` (resolved via local registry)

By default the fetched document is written to a file named from the URL slug. Use `-o -` to write to stdout.

## Options

| Option | Description |
|---|---|
| `-b, --block-id <id>` | Extract only this block (overrides fragment in source IRI) |
| `-f, --format <type>` | Output format when extracting a single block |
| `--wrap` | Wrap a fetched block in a new DataBook with provenance frontmatter |
| `--no-wrap` | Emit raw content without DataBook wrapping |
| `--verify-id` | Fail (not just warn) if returned document `id` does not match requested IRI |
| `-s, --server <n>` | Named server from `processors.toml` for auth context |
| `-a, --auth <credential>` | Bearer token or `user:pass` for HTTP auth |
| `--timeout <ms>` | Request timeout in milliseconds (default: `30000`) |
| `--no-cache` | Bypass local DataBook cache and force fresh retrieval |
| `-o, --out <file>` | Output path (default: inferred from document IRI slug; `"-"` for stdout) |
| `--encoding <enc>` | Output encoding: `utf8` (default), `utf8bom`, `utf16` |
| `-v, --verbose` | Log fetch details to stderr |

## Examples

```bash
# Fetch a DataBook by URL
databook fetch https://w3id.org/databook/specs/cli-conventions -o conventions.databook.md

# Fetch a specific block as Turtle
databook fetch https://example.org/databooks/shapes-v1#person-shape --format turtle

# Fetch a registry alias
databook fetch @my-shapes -o shapes.databook.md

# Force fresh retrieval (bypass cache)
databook fetch @cli-conventions --no-cache -o conventions.databook.md
```

## Related commands

- [`pull`](pull.md) — fetch data from a SPARQL triplestore (not HTTP)
- [`create`](create.md) — build a DataBook from local files
