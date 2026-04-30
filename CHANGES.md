# CHANGES

## v1.4.0 (2026-04-28)

### New: `databook drop`

Remove one or more named blocks from a DataBook.

```
databook drop <databook> --id <block-id> [options]
```

| Option | Effect |
|--------|--------|
| `--id <id>` | Block ID to remove (required; repeatable) |
| `--remove-prose` | Also remove the prose section preceding each dropped block |
| `--ignore-missing` | Silently skip `--id` values that don't exist (default: error) |
| `-o, --output <file>` | Write to a different file (default: overwrites source) |
| `--dry-run` | Print result without writing |
| `-q, --quiet` | Suppress info/warning messages |

**Block removal** strips the adjacent annotation lines (`<!-- databook:* -->`)
and the fenced block together.  The frontmatter is not modified.

**`--remove-prose`** extends each removal backward to the end of the previous
block (or the start of the body), effectively removing the entire prose section
— heading, lead-in text, and all — that preceded the block.

**Multiple blocks** can be dropped in one pass by repeating `--id`.  Blocks
are removed in reverse document order so line indices stay consistent
across removals.

**Blank-line cleanup:** consecutive blank lines left by removal are collapsed
to at most two, preventing large gaps in the document.

**Error codes:**

| Code | Cause |
|------|-------|
| `E_DROP_NO_INPUT` | No DataBook file supplied |
| `E_DROP_NO_ID` | No `--id` supplied |
| `E_DROP_NOT_FOUND` | Named block does not exist; use `--ignore-missing` to suppress |

**Relationship to other commands:**

| Need | Command |
|------|---------|
| Remove a block from a document | `drop` |
| Remove a named graph from a triplestore | `clear` |
| Replace a block's content | `insert --force` |
| Edit prose without touching blocks | `insert --markdown` (prose mode) |

---

## v1.3.0 (2026-04-28)

### New: `templates/default.databook.md`

A bundled default template DataBook.  `databook create` now loads it when no
`--template` flag or `config.template:` field is supplied, instead of falling
back to the inline `buildDefaultTemplate()` builder.

The template body uses standard `{{variable}}` substitution:

| Marker | Expands to |
|--------|-----------|
| `{{title}}` | Frontmatter `title` |
| `{{version}}` | Frontmatter `version` |
| `{{created}}` | Frontmatter `created` |
| `{{description}}` | Frontmatter `description` (if set) |
| `{{blocks}}` | All data blocks in declaration order |

The file is a first-class DataBook (`type: template`) with its own frontmatter.
`create` strips the template's frontmatter before using it, so only the body
section appears in the output.

To customise, copy `templates/default.databook.md`, edit the body, and point to
it with `--template path/to/my-template.databook.md` or `template:` in a config
YAML.  Plain `.md` templates (no DataBook frontmatter) are also accepted.

**Template resolution order:**
1. `--template <file>` CLI flag
2. `config.template:` field
3. `templates/default.databook.md` (bundled — new)
4. Inline `buildDefaultTemplate()` builder (last resort if file is missing)

### New: `databook insert`

Insert any data file as a named fenced block into an existing DataBook.

```
databook insert <databook> <file> --id <block-id> [options]
```

**Key options:**

| Option | Effect |
|--------|--------|
| `--id <id>` | Block ID for the new fence (required; must be unique) |
| `--lang <lang>` | Fence language label (inferred from extension if omitted) |
| `--before <id>` | Insert before an existing named block |
| `--after <id>` | Insert after an existing named block |
| `--markdown <text\|@path>` | Prose section to prepend before the fence |
| `--force` | Overwrite existing block if `--id` already exists |
| `-o, --output <file>` | Write to a different file (default: overwrites source) |
| `--dry-run` | Print resulting document without writing |
| `-q, --quiet` | Suppress info/warning messages |

**Language inference table** (extension → fence label):

`.ttl/.turtle` → `turtle` | `.rq/.sparql` → `sparql` | `.shacl` → `shacl`  
`.json` → `json` | `.jsonld` → `json-ld` | `.yaml/.yml` → `yaml`  
`.trig` → `trig` | `.md` → `markdown` | anything else → `text`

**`--markdown` content** may be supplied as:
- Inline text: `--markdown "SHACL validation layer for v2 schema."`
- File reference: `--markdown @prose/intro.md`

Prose is inserted immediately before the fence. With `--force`, existing prose above the replaced fence is preserved; new `--markdown` content is prepended immediately before the fence.

**Error codes:**

| Code | Cause |
|------|-------|
| `E_INSERT_NO_INPUT` | No DataBook file supplied |
| `E_INSERT_NO_DATA` | No data file supplied |
| `E_INSERT_NO_ID` | `--id` missing |
| `E_INSERT_ID_EXISTS` | Block ID collision; use `--force` to overwrite |
| `E_INSERT_ANCHOR_CONFLICT` | `--before` and `--after` supplied together |
| `E_INSERT_ANCHOR_NOT_FOUND` | Named anchor block does not exist |

**Example pipeline** (insert then stamp provenance in HEAD):

```bash
databook insert onto.databook.md shapes-v2.ttl --id shapes-v2 \
  --markdown "SHACL validation layer for schema v2."

databook head onto.databook.md \
  --set modified=@now \
  --set version=1.3.0 \
  --set graph.triple_count=214
```

---

### Updated: `databook head` — update mode

`databook head` now operates in two modes:

- **Read mode** (default): no change; emits frontmatter and block summary.
- **Update mode**: activated when any of `--set`, `--json`, `--yaml`, or `--file` are present; patches frontmatter in-place and rewrites the document.

**New update-mode options:**

| Option | Effect |
|--------|--------|
| `--set key=value` | Set a frontmatter key; repeatable; supports dot-path notation |
| `--json <string>` | Inline JSON patch object (deep-merged by default) |
| `--yaml <string>` | Inline YAML patch object (deep-merged by default) |
| `--file <path>` | Read patch from a `.json` or `.yaml` file |
| `--replace` | Replace entire frontmatter (default: deep merge) |
| `--dry-run` | Print result without writing |

**Dot-path notation** in `--set`:

```bash
# Sets { graph: { triple_count: 47 } } within existing frontmatter
databook head onto.databook.md --set graph.triple_count=47
```

**Built-in tokens** in `--set` values:

| Token | Expansion |
|-------|-----------|
| `@now` | Current UTC timestamp: `2026-04-28T12:34:56.000Z` |
| `@today` | Current date: `2026-04-28` |

**Type coercion** in `--set` values:

| Value | Coerced type |
|-------|-------------|
| `true` / `false` | Boolean |
| `null` | null |
| Numeric string | Number |
| Everything else | String |

**Legacy `<script>` frontmatter** is automatically converted to canonical `---` form when rewritten by update mode.

**Error codes:**

| Code | Cause |
|------|-------|
| `E_HEAD_UPDATE_STDIN` | Update mode requires a file path (no stdin) |
| `E_HEAD_PATCH_PARSE` | Patch file could not be parsed as JSON/YAML |
| `E_HEAD_PATCH_TYPE` | Patch file root is not a YAML/JSON object |
| `E_HEAD_JSON_PARSE` | `--json` value is not valid JSON |
| `E_HEAD_YAML_PARSE` | `--yaml` value is not valid YAML |
| `E_HEAD_SET_FORMAT` | `--set` value missing `=` separator |
| `E_HEAD_SET_EMPTY_KEY` | `--set` key is empty |

---

## v1.2.1 (2026-04-28) — patch

- **Fix `databook create`:** `enc is not defined` error on all output paths.
  `encoding` was never extracted from `opts` and `resolveEncoding` was never
  called in `runCreate`.  Added `encoding: encOpt` destructuring and
  `resolveEncoding(encOpt)` call immediately after opts destructure.
- **Fix `databook create`:** output DataBook still used legacy
  `<script language="application/yaml">` frontmatter wrapper.  `assembleDataBook()`
  now emits canonical `---` delimiters, consistent with the v1.1 spec.
- **Fix `databook create`:** `E_NO_INPUT` error when no positional inputs are
  supplied.  Zero-input mode is now valid: `databook create -o skeleton.databook.md`
  produces a skeleton DataBook from the default template with no data blocks.
  The only requirement is that `-o` (or `config.output:`) is present, since
  there is no input stem to infer an output filename from.

---

## v1.2.0 (2026-04-27)

- 16 commands: head, extract, create, convert, push, pull, sparql, sparql-update,
  validate, describe, ingest, process, transform, prompt, clear, fetch.
- `databook prompt` patch modes: `--patch frontmatter.FIELD`, `--patch-block`.

## v1.1.0 (2026-04-23)

- `databook transform` (XSLT).
- `databook ingest` (Markdown → DataBook uplifter).
- Encoding support: `utf8bom`, `utf16`.

## v1.0.0 (2026-04-22)

- Initial release: head, extract, create, push, pull, sparql, validate, process, prompt.
