# databook prompt

Send a DataBook (or a specific block) as context to an Anthropic LLM and write the response to an output DataBook.

## Synopsis

```
databook prompt [source] [options]
```

## Description

`prompt` composes a context from a DataBook (all blocks or a named subset), prepends a user instruction, calls the Anthropic Messages API, and writes the response into a new output DataBook with full provenance metadata.

**Two output modes:**

- **Transform mode** (default): response is written into a new standalone DataBook
- **Patch mode** (`--patch` or `--patch-block`): response is written back into the source DataBook — either into a frontmatter field or as a named block

Requires `ANTHROPIC_API_KEY` environment variable.

## Options

| Option | Description |
|---|---|
| `-p, --prompt <text>` | Inline prompt text |
| `--prompt-file <file>` | Read prompt from a text file |
| `--prompt-block <id>` | Use a `prompt` fenced block from the source DataBook |
| `-b, --block-id <id>` | Send only this block as context (default: full DataBook) |
| `--param <name=value>` | Template interpolation parameter (repeatable) |
| `--interpolate` | Enable `{{variable}}` substitution in the prompt block |
| `--patch <field>` | Patch a frontmatter field with the response (e.g. `frontmatter.description`) |
| `--patch-block <id>` | Replace or create a named block with the response |
| `--patch-mode <mode>` | Patch strategy: `replace` (default) \| `merge` |
| `--model <model>` | Anthropic model (default: `claude-sonnet-4-6`) |
| `--max-tokens <n>` | Maximum response tokens (default: `4096`) |
| `--system <text>` | Override system prompt |
| `--encoding <enc>` | Output encoding: `utf8` (default), `utf8bom`, `utf16` |
| `-o, --output <file>` | Write output DataBook to file (default: stdout) |
| `--dry-run` | Print resolved context and prompt without calling the API |
| `-v, --verbose` | Log request details to stderr |
| `-q, --quiet` | Suppress spinner and completion summary |

## Examples

```bash
# Summarise a DataBook (transform mode)
databook prompt onto.databook.md --prompt "Summarise the class hierarchy" -o summary.databook.md

# Write abstract into frontmatter (patch mode)
databook prompt article.databook.md \
  --prompt "Write a concise 2-sentence description" \
  --patch frontmatter.description

# Generate SHACL shapes from data (patch block mode)
databook prompt data.databook.md \
  --prompt "Suggest SHACL shapes for this dataset" \
  --patch-block suggested-shapes

# Use a prompt block embedded in the DataBook
databook prompt analysis.databook.md --prompt-block analysis-prompt -o result.databook.md

# Preview context and prompt without calling the API
databook prompt onto.databook.md --prompt "Describe the ontology" --dry-run

# Use a specific model
databook prompt data.databook.md --prompt "Analyse the data" --model claude-opus-4-6 -o analysis.databook.md
```

## Related commands

- [`process`](process.md) — multi-stage pipelines that may include prompt stages
- [`head`](head.md) — inspect or patch frontmatter directly (without LLM)
- [`insert`](insert.md) — add blocks manually
