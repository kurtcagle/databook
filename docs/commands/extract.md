# databook extract

Emit raw block content to stdout or a file.

## Synopsis

```
databook extract [input] [options]
```

## Description

`extract` retrieves the raw content of a named block from a DataBook, without wrapping or metadata. It is useful for feeding a block's content into another tool, writing it to a standalone file, or inspecting it directly.

Blocks are addressed by id using either the `--block-id` flag or the `#fragment` shorthand in the input path: `file.databook.md#my-block`.

Use `--list` to enumerate all named blocks without extracting content.

## Options

| Option | Description |
|---|---|
| `-b, --block-id <id>` | Block to extract (overridden by `#fragment` syntax in input path) |
| `-o, --output <path>` | Output file. Use `"."` to auto-name from block-id + label extension |
| `--with-metadata` | Include `<!-- databook:* -->` annotation comment lines in output |
| `--fence` | Wrap output in fence markers (` ``` label ``` `) |
| `--type` | Print the block's Content-Type to stderr |
| `--encoding <enc>` | Output encoding: `utf8` (default), `utf8bom`, `utf16` |
| `--to <format>` | Convert extracted content to another format before output |
| `--list` | List all named block ids and labels, then exit |
| `-q, --quiet` | Suppress info messages to stderr |

## Examples

```bash
# Extract to stdout (pipe to Apache Jena riot)
databook extract source.databook.md#primary-graph | riot --syntax=turtle -

# Extract to a named file
databook extract source.databook.md --block-id primary-graph -o graph.ttl

# Auto-name the output file from block-id and label extension
databook extract source.databook.md --block-id primary-graph -o .

# List all named blocks
databook extract source.databook.md --list

# Extract with metadata annotations preserved
databook extract source.databook.md#primary-graph --with-metadata

# Extract and convert in one step
databook extract source.databook.md#primary-graph --to json-ld -o graph.jsonld
```

## Related commands

- [`head`](head.md) — inspect frontmatter and block metadata
- [`convert`](convert.md) — convert between formats
- [`insert`](insert.md) — add blocks to a DataBook
