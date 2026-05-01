# databook drop

Remove one or more named blocks from a DataBook.

## Synopsis

```
databook drop <databook> --id <block-id> [options]
```

## Description

`drop` removes each named block — its adjacent `<!-- databook:* -->` annotation lines and fenced content — from the document. The frontmatter is not modified.

Multiple blocks can be removed in a single invocation by repeating `--id`. Blocks are removed in reverse document order so that line numbers remain consistent during deletion.

`--remove-prose` additionally strips the prose section immediately preceding each dropped block: all lines between the end of the previous block (or the start of the body) and the block's first annotation line. Use this to drop a block and its section heading together.

Consecutive blank lines left by removal are collapsed to at most two.

By default, the source DataBook is overwritten in place. Use `-o` to redirect.

## Options

| Option | Description |
|---|---|
| `--id <block-id>` | Block ID to remove (required; repeatable) |
| `--remove-prose` | Also remove the prose section preceding each dropped block |
| `--ignore-missing` | Silently skip `--id` values that do not exist (default: error) |
| `-o, --output <file>` | Output path (default: overwrites source DataBook) |
| `--dry-run` | Print resulting document to stdout without writing |
| `--encoding <enc>` | Output encoding: `utf8` (default), `utf8bom`, `utf16` |
| `-q, --quiet` | Suppress info and warning messages |

## Examples

```bash
# Remove a single block
databook drop onto.databook.md --id shapes-v2

# Remove a block and its preceding prose section
databook drop onto.databook.md --id shapes-v2 --remove-prose

# Remove multiple blocks
databook drop onto.databook.md --id shapes-v2 --id old-queries --remove-prose

# Preview without writing
databook drop onto.databook.md --id shapes-v2 --dry-run

# Write to a new file instead of overwriting
databook drop onto.databook.md --id shapes-v2 -o trimmed.databook.md

# Silently skip if block does not exist
databook drop onto.databook.md --id shapes-v2 --ignore-missing
```

## Related commands

- [`insert`](insert.md) — add blocks to a DataBook
- [`extract`](extract.md) — retrieve block content without modifying the DataBook
