# CHANGES

## v1.4.2 (2026-05-11)

### Bug fixes

#### `lib/parser.js` — Pre-fence block annotation support

`parseBlocks()` now recognises `<!-- databook:id: block-id -->` annotations placed
**before** the opening fence (canonical v1.2+ placement) as well as the legacy
inline placement (inside the fence as the first content lines).

**Before:** fragment addressing (`databook extract file.md#block-id`,
`databook push`, `databook pull`) silently found no block IDs because the
parser only scanned inside the fence.

**After:** both forms are accepted. Pre-fence annotations take priority when
both are present. Legacy DataBooks with inline annotations continue to work
unchanged.

#### `commands/create.js` — `renderBlock` pre-fence annotation output

`renderBlock()` now emits the `<!-- databook:id -->` annotation **before** the
opening fence instead of as the first line inside it. Legacy inline annotations
in existing block content are stripped during output to prevent duplication when
re-wrapping old DataBooks.

```
BEFORE:  ```turtle
         <!-- databook:id: sensors-block -->
         PREFIX rdfs: ...
         ```

AFTER:   <!-- databook:id: sensors-block -->
         ```turtle
         PREFIX rdfs: ...
         ```
```

#### `lib/gsp.js` — URL included in error messages

`gspPut()` and `gspPost()` now return `{ status, ok, url }` (the full GSP URL
that was called). `checkResponse()` includes the URL in 404/405/auth error
messages, making endpoint misconfiguration immediately diagnosable without
`--verbose`.

```
BEFORE:  error: not found (HTTP 404) — block 'sensors-block'
AFTER:   error: not found (HTTP 404) — block 'sensors-block' [http://localhost/ds/data?default]
```

#### `commands/push.js` — Meta graph respects `--merge` flag

The meta graph push (`{id}#meta`) always used `gspPut` (HTTP PUT) regardless of
the `--merge` flag. When a server accepts POST but not PUT (HTTP 405), `--merge`
fixed data block pushes but the meta graph push still failed.

**After:** meta graph uses `gspPost` when `--merge` is set, matching the
behaviour of data block pushes.

#### `commands/push.js` — Restored fragment-addressing as default named graph

The v1.4.1 patch changed `push` to default to the triplestore default graph
(`?default`) when no `--graph` flag or `graph.named_graph` frontmatter is
present. `pull` (Mode 1) continued to use fragment-addressing (`{id}#{block.id}`),
causing a push/pull mismatch.

**After:** `push` and `pull` share the same priority chain:

```
1. --graph <iri>                  explicit CLI override
2. graph.named_graph              per-document frontmatter
3. default_endpoint.named_graph   per-environment (processors.toml)  ← new
4. {id}#{block.id}                fragment-addressing                ← restored
5. null → GSP ?default            bare fallback
```

Push and pull are now symmetric by default without requiring `graph.named_graph`
in every DataBook frontmatter.

### New features

#### `lib/config.js` — `getDefaultNamedGraph()` export

New export reads `named_graph` from the `[default_endpoint]` section of
`processors.toml`. Consumed by both `push` (priority 3 in `resolveGraphIri`)
and `pull` (priority 3 in `resolveGraphIris`).

Configure Jena's default graph as the push/pull target without per-document
frontmatter:

```toml
# .databook/processors.toml
[default_endpoint]
sparql      = "http://localhost:3030/ds/sparql"
gsp         = "http://localhost:3030/ds/data"
named_graph = "urn:x-arq:DefaultGraph"
```

#### `commands/list.js` — `databook list` command (new)

Lists all DataBooks pushed to a triplestore by querying their `#meta` named
graphs. Meta graphs are written by `databook push --meta` (on by default) and
contain full Dublin Core / PROV-O provenance from the DataBook frontmatter.

```
Title                                 Ver       Created       Pushed                   Triples
────────────────────────────────────  ────────  ────────────  ───────────────────────  ────────
Sensors                               1.0.0     2026-04-23    2026-05-11 14:32:07Z     16
GGSC Observatory v1                   1.2.0     2026-04-15    2026-05-10 09:14:22Z     1149
```

Three output formats: `table` (default), `json` (machine-readable), `sparql`
(print the catalogue query and exit).

```powershell
databook list -e http://localhost:3030/ds/sparql
databook list -d ds --format json | jq '.[].id'
databook list --format sparql
```

#### `commands/pull.js` — processors.toml `named_graph` step in `resolveGraphIris`

Pull's graph resolution now checks `processors.toml default_endpoint.named_graph`
as step 3 (after frontmatter, before fragment-addressing), matching push.
