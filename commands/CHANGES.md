# DataBook CLI — Patch Notes (v1.1 → v1.2)

## New files

| File | Description |
|---|---|
| `commands/sparql.js` | New command: `databook sparql` — SELECT/CONSTRUCT/ASK, wrap-by-default |
| `commands/sparql-update.js` | New command: `databook sparql-update` — INSERT/DELETE/DROP, stderr summary on success |
| `commands/validate.js` | New command: `databook validate` — SHACL validation, wrap-by-default |
| `commands/describe.js` | New command: `databook describe` — DESCRIBE by IRI, wrap-by-default, Phase 2 shapes hook |

## Modified files

### `bin/databook.js`

- Version bumped to `1.2.0`
- Registered four new commands: `sparql`, `sparql-update`, `validate`, `describe`
- **`pull`**: `--fragment` renamed to `--id` / `-i`; `--query` reassigned to `-Q`; `--out` renamed to `--output` / `-o`; `--no-wrap` added; `--replace-block` replaces ambiguous `--block-id` for in-place mutation; `-f` now correctly assigned to `--format`
- **`fetch`**: `-F, --format` normalised to `-f, --format`
- **`fetch`**: `--no-wrap` added
- **`process`**: `--sparql` and `--shapes` shorthand flags removed (use `databook sparql` / `databook validate`)
- **`prompt`**: `-q, --quiet` added to suppress spinner
- **`push`**: no flag changes; `--dataset` description clarified
- **`create`**: template resolution order documented in help text

### `commands/pull.js`

- `--fragment` → `--id` (opt key `id`)
- `--query` file → `-Q` (opt key `query`), no short flag conflict
- `--out` → `--output` (opt key `output`)
- Wrap-by-default: `wrap = true` by default; `--no-wrap` sets `wrap = false`
- `--replace-block` replaces `--block-id` for in-place mutation; `--block-id` no longer exists on `pull`
- Error messages for server resolution use `E_SERVER_NOT_FOUND`
- Success summary line to stderr even without `--verbose`

### `commands/push.js`

- `classifyPushError()` helper added — distinguishes `E_SERVER_NOT_FOUND`, `E_DATASET_UNREACHABLE`, `E_ENDPOINT_ERROR`
- Success summary line to stderr when not `--quiet` and not `--dry-run`
- `--dataset` clarification in verbose log

### `commands/prompt.js`

- Stderr spinner during API call (TTY-aware, degrades silently on non-TTY)
- Elapsed time and token counts reported on completion: `prompt: done (4.2s, 1847 tokens)`
- `-q, --quiet` suppresses spinner and summary line
- `callAnthropicApi()` now returns `{ responseText, inputTokens, outputTokens }` from `usage` field

## Global conventions introduced

### Wrap-by-default on retrieval commands

`pull`, `fetch`, `sparql`, `describe` all produce a DataBook by default.
Pass `--no-wrap` to receive raw content (Turtle/TriG for RDF results, CSV/JSON for SELECT).

### Normalised flag table

| Flag | Short | Universal meaning |
|---|---|---|
| `--output` | `-o` | Output file (all commands) |
| `--format`  | `-f` | Format selector (all commands) |
| `--quiet`   | `-q` | Suppress warnings/spinner (all commands) |
| `--verbose` | `-v` | Verbose stderr logging (all commands) |
| `--query`   | `-Q` | External SPARQL file (pull, sparql, sparql-update) |
| `--id`      | `-i` | Embedded block id for query execution (pull, sparql, sparql-update) |

### Success lines to stderr

Commands that produce no DataBook output (`push`, `clear`, `sparql-update`) now emit a
single summary line to stderr on success, even without `--verbose`.
Suppress with `-q`.

## Notes for testing

1. `pull --fragment <id>` calls will break — use `pull --id <id>` or `pull -i <id>`
2. `pull --out <file>` calls will break — use `pull --output <file>` or `pull -o <file>`
3. `pull --query <file>` is now `pull -Q <file>` (or `pull --query <file>` still works; short flag changed from `-q` to `-Q`)
4. `process --sparql` and `process --shapes` shortcuts have been removed — use `databook sparql` and `databook validate`
5. `fetch --format` short flag changed from `-F` to `-f`
