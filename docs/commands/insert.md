# databook insert

Insert a data file as a named fenced block, or edit body prose, in an existing DataBook.

## Synopsis

```
databook insert <databook> [file] [options]
```

## Description

`insert` operates in two modes:

**Block mode** (`--id` required, `[file]` required): inserts `[file]` as a named fenced block at the specified position within the DataBook. The fence language is inferred from the file extension unless overridden with `--lang`. By default, new blocks are appended; use `--before` or `--after` to control placement. Use `--force` to overwrite an existing block with the same id.

**Prose mode** (`--id` absent, `--markdown` required, `[file]` ignored): edits body prose without touching any data blocks. `--markdown-mode` controls where the prose is placed relative to existing content.

By default, the source DataBook is overwritten. Use `-o` to redirect output to a new file.

## Options

| Option | Description |
|---|---|
| `--id <block-id>` | ID for the new block (required in block mode; omit for prose mode) |
| `--lang <language>` | Fence language label (inferred from file extension if omitted) |
| `--before <block-id>` | Block mode: insert before this existing block (default: append) |
| `--after <block-id>` | Block mode: insert after this existing block (default: append) |
| `--markdown <text\|@path>` | Prose to prepend before the new fence (block mode), or body prose to edit (prose mode). Use `@path` to read from a file |
| `--markdown-mode <mode>` | Prose mode placement: `append` (default) \| `prepend` \| `replace` |
| `--force` | Block mode: overwrite existing block if `--id` already exists |
| `-o, --output <file>` | Output path (default: overwrites source DataBook) |
| `--dry-run` | Print resulting document to stdout without writing |
| `--encoding <enc>` | Output encoding: `utf8` (default), `utf8bom`, `utf16` |
| `-q, --quiet` | Suppress info and warning messages |

## Language inference from extension

| Extension | Label |
|---|---|
| `.ttl`, `.turtle`, `.n3` | `turtle` |
| `.rq`, `.sparql` | `sparql` |
| `.shacl` | `shacl` |
| `.json` | `json` |
| `.jsonld` | `json-ld` |
| `.yaml`, `.yml` | `yaml` |
| `.trig` | `trig` |
| `.md` | `markdown` |
| `.txt` | `text` |
| `.prompt` | `prompt` |

## Examples

```bash
# Block mode — append a SHACL block
databook insert onto.databook.md shapes.ttl --id shapes-v2

# Block mode — insert after an existing block
databook insert onto.databook.md shapes.ttl --id shapes-v2 --after ontology-block

# Block mode — with a prose section header
databook insert onto.databook.md shapes.ttl --id shapes-v2 \
  --markdown "## Validation Shapes\n\nThe following shapes define the person model."

# Block mode — overwrite an existing block
databook insert onto.databook.md shapes.ttl --id shapes-v2 --force

# Prose mode — append an overview paragraph
databook insert onto.databook.md --markdown "Updated to reflect schema v2."

# Prose mode — prepend from a file
databook insert onto.databook.md --markdown @intro.md --markdown-mode prepend

# Prose mode — replace all prose
databook insert onto.databook.md --markdown @new-body.md --markdown-mode replace

# Preview without writing
databook insert onto.databook.md shapes.ttl --id shapes-v2 --dry-run
```

## Related commands

- [`drop`](drop.md) — remove blocks from a DataBook
- [`create`](create.md) — build a DataBook from scratch
- [`extract`](extract.md) — emit raw block content
