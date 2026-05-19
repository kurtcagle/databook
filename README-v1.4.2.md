# DataBook CLI v1.4.2 — Patch Package

This package contains all changes from the v1.4.2 session, packaged for
one-command installation.

## What's included

```
drop-in/
  lib/
    parser.js      complete replacement (pre-fence annotation support)
    gsp.js         complete replacement (URL in errors, richer diagnostics)
    config.js      complete replacement (getDefaultNamedGraph() export)
  commands/
    list.js        new file (databook list command)

apply-all-patches.mjs    master patch script
CHANGES.md               full change log
README-v1.4.2.md         this file
```

## Installation

**Step 1** — Copy the drop-in files:

```powershell
# From your databook-cli root directory
Copy-Item path\to\drop-in\lib\parser.js  lib\parser.js
Copy-Item path\to\drop-in\lib\gsp.js     lib\gsp.js
Copy-Item path\to\drop-in\lib\config.js  lib\config.js
Copy-Item path\to\drop-in\commands\list.js  commands\list.js
```

**Step 2** — Run the master patch script:

```powershell
node path\to\apply-all-patches.mjs
```

This patches `commands/create.js`, `commands/push.js`, `commands/pull.js`,
and `bin/databook.js` in place.  The script is idempotent — re-running it
detects already-applied patches and skips them.

**Step 3** — Configure `processors.toml` (recommended):

```toml
# .databook/processors.toml
[default_endpoint]
sparql      = "http://localhost:3030/ds/sparql"
gsp         = "http://localhost:3030/ds/data"
# Uncomment to route all pushes to Jena's default graph:
# named_graph = "urn:x-arq:DefaultGraph"
```

## Quick verification

```powershell
# Block extraction should now work with pre-fence annotation format
databook extract sensors.databook.md#sensors-block

# Push/pull round-trip (uses fragment-addressing by default)
databook push sensors.databook.md -e http://localhost:3030/ds/sparql
databook pull sensors.databook.md -e http://localhost:3030/ds/sparql --wrap -o out.databook.md

# List all pushed DataBooks
databook list -e http://localhost:3030/ds/sparql
```

## Summary of changes

| File | Change |
|---|---|
| `lib/parser.js` | Pre-fence `<!-- databook:id -->` annotations now parsed correctly |
| `lib/gsp.js` | Error messages include the URL that failed; gspPut/gspPost return `url` |
| `lib/config.js` | `getDefaultNamedGraph()` reads `named_graph` from `[default_endpoint]` |
| `commands/list.js` | **New** — `databook list` catalogues all pushed DataBooks |
| `commands/create.js` | `renderBlock` emits annotation before fence (pre-fence canonical form) |
| `commands/push.js` | Meta graph respects `--merge`; fragment-addressing restored as default |
| `commands/pull.js` | `resolveGraphIris` checks `processors.toml named_graph` at step 3 |
| `bin/databook.js` | Version → 1.4.2; `runList` import + `list` command registered |
