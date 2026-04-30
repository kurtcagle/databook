# databook-cli Test Guide

All tests run from the `databook-cli/` root directory.
Tests marked **[dry-run]** need no running triplestore.
Tests marked **[live]** require Fuseki at `http://localhost:3030`.

---

## Test DataBooks

| File | Purpose |
|---|---|
| `test/observatory.databook.md` | Primary source — full block variety |
| `test/sensors-v1.databook.md` | Simpler source — 3 blocks |
| `test/queries.databook.md` | SPARQL query library (fragment refs) |
| `test/shapes.databook.md` | SHACL shapes library (fragment refs) |
| `test/pipeline.databook.md` | processor-registry pipeline (2-stage DAG) |
| `test/pre-v1.databook.md` | pre-v1.0 bare `---` frontmatter |
| `test/external-query.sparql` | External SPARQL file for `--query` mode |
| `test/params-sensor-type.json` | JSON params for VALUES injection |
| `test/params-by-type.yaml` | YAML params for VALUES injection |

---

## HEAD TESTS

### H-01 Default JSON output [dry-run]

```bash
node bin/databook.js head test/observatory.databook.md
```

**Expected:** JSON with `frontmatter` (id, title, type, version, created, author,
graph, process) and `blocks` array containing 5 entries:
`primary-graph (turtle)`, `observatory-shapes (shacl)`,
`sensor-construct (sparql)`, `typed-select (sparql)`,
`refresh-calibration (sparql-update)`.

---

### H-02 YAML output [dry-run]

```bash
node bin/databook.js head test/observatory.databook.md --format yaml
```

**Expected:** Same structure as H-01, serialised as YAML. `created` field
must be plain string `2026-04-22`, not a JavaScript Date object.

---

### H-03 XML output [dry-run]

```bash
node bin/databook.js head test/observatory.databook.md --format xml
```

**Expected:** XML envelope with `xmlns:db="https://w3id.org/databook/ns#"`.
`<db:frontmatter>` contains all fields as child elements. `<db:blocks>`
contains one `<db:block/>` per block with `id`, `label`, `role`,
`line_count`, `display_only` attributes.

---

### H-04 Turtle output [dry-run]

```bash
node bin/databook.js head test/observatory.databook.md --format turtle
```

**Expected:** Valid Turtle with `build:`, `dct:`, `xsd:` prefixes.
Subject is `<https://w3id.org/databook/test/observatory-v1>` typed as
`build:DataBook`. `build:hasBlock` links to five fragment IRIs:
`…#primary-graph`, `…#observatory-shapes`, `…#sensor-construct`,
`…#typed-select`, `…#refresh-calibration`. Each fragment is typed
`build:Block` with `build:blockLabel`, `build:lineCount`, etc.

---

### H-05 Block metadata mode — JSON [dry-run]

```bash
node bin/databook.js head test/observatory.databook.md --block-id primary-graph
```

**Expected:** Single JSON object:
```json
{
  "id": "primary-graph",
  "label": "turtle",
  "role": "primary",
  "line_count": 55,
  "comment_count": 1,
  "display_only": false,
  "all_meta": { "id": "primary-graph" }
}
```

Role should be `"primary"` because `process.inputs` declares `block_id: primary-graph`
with `role: primary`.

---

### H-06 Block metadata mode — YAML [dry-run]

```bash
node bin/databook.js head test/observatory.databook.md \
  --block-id observatory-shapes --format yaml
```

**Expected:** YAML object with `id: observatory-shapes`, `label: shacl`,
`role: constraint` (from `process.inputs`).

---

### H-07 Block metadata mode — Turtle [dry-run]

```bash
node bin/databook.js head test/observatory.databook.md \
  --block-id sensor-construct --format turtle
```

**Expected:** Single `build:Block` subject at
`<https://w3id.org/databook/test/observatory-v1#sensor-construct>`
with `build:blockLabel "sparql"`, `build:commentCount 1`.

---

### H-08 Pre-v1 fallback — warning emitted [dry-run]

```bash
node bin/databook.js head test/pre-v1.databook.md
```

**Expected:** Warning on stderr: `warn: W_HEAD_PRE_V1: frontmatter in bare --- form`.
JSON output on stdout with `id: https://w3id.org/databook/test/pre-v1-legacy`.
One block: `legacy-graph (turtle)`.

---

### H-09 Pre-v1 fallback — warning suppressed [dry-run]

```bash
node bin/databook.js head test/pre-v1.databook.md --quiet
```

**Expected:** No warning on stderr. Same JSON output as H-08.

---

### H-10 Block not found error [dry-run]

```bash
node bin/databook.js head test/observatory.databook.md --block-id nonexistent
```

**Expected exit 2:**
```
error: E_HEAD_BLOCK_NOT_FOUND: no block with id 'nonexistent'
```

---

### H-11 Invalid format error [dry-run]

```bash
node bin/databook.js head test/observatory.databook.md --format csv
```

**Expected exit 2:**
```
error: E_HEAD_FORMAT_UNKNOWN: --format must be one of: json, yaml, xml, turtle
```

---

### H-12 Head output to file [dry-run]

```bash
node bin/databook.js head test/observatory.databook.md \
  --format json --output /tmp/observatory-head.json
```

**Expected:** No stdout. File `/tmp/observatory-head.json` created with
valid JSON matching H-01 output.

---

### H-13 Stdin pipe [dry-run]

```bash
cat test/observatory.databook.md | node bin/databook.js head --format yaml --quiet
```

**Expected:** Same YAML output as H-02, no warnings.

---

### H-14 Pipeline: head feeds jq-style extraction [dry-run]

```bash
node bin/databook.js head test/observatory.databook.md --quiet --format json \
  | node -e "
    let s='';
    process.stdin.on('data',d=>s+=d);
    process.stdin.on('end',()=>{
      const j=JSON.parse(s);
      j.blocks.filter(b=>b.label==='sparql').forEach(b=>console.log(b.id));
    })"
```

**Expected output:**
```
sensor-construct
typed-select
```

---

## PUSH TESTS

### P-01 Push all blocks — dry-run [dry-run]

```bash
node bin/databook.js push test/observatory.databook.md \
  --endpoint http://localhost:3030/ds/sparql \
  --dry-run
```

**Expected stderr (order may vary):**
```
[push] PUT  http://localhost:3030/ds/data
[push]       ?graph=https://w3id.org/databook/test/observatory-v1#primary-graph
[push]       Content-Type: text/turtle
[push]       Status: [not sent]
[push] PUT  http://localhost:3030/ds/data
[push]       ?graph=https://w3id.org/databook/test/observatory-v1#observatory-shapes
[push]       Content-Type: text/turtle
[push]       Status: [not sent]
[push] PUT  http://localhost:3030/ds/data
[push]       ?graph=https://w3id.org/databook/test/observatory-v1#meta
[push]       Content-Type: text/turtle
[push]       Status: [not sent]
[push] 2 blocks pushed, 0 skipped, 0 failed  (1 meta graph)
```

Note: `sparql-update` block is pushable (executed as SPARQL Update);
`sparql` blocks are skipped silently.

---

### P-02 Push specific block [dry-run]

```bash
node bin/databook.js push test/observatory.databook.md \
  --block-id primary-graph \
  --endpoint http://localhost:3030/ds/sparql \
  --dry-run
```

**Expected:** Only one block PUT for `#primary-graph` + one PUT for `#meta`.

---

### P-03 Push with explicit graph IRI [dry-run]

```bash
node bin/databook.js push test/observatory.databook.md \
  --block-id primary-graph \
  --graph https://example.org/my-custom-graph \
  --endpoint http://localhost:3030/ds/sparql \
  --dry-run
```

**Expected:** PUT with `?graph=https://example.org/my-custom-graph`.

---

### P-04 --graph with multiple blocks is an error [dry-run]

```bash
node bin/databook.js push test/observatory.databook.md \
  --graph https://example.org/my-graph \
  --endpoint http://localhost:3030/ds/sparql \
  --dry-run
```

**Expected exit 2:**
```
error: --graph requires exactly one block; multiple blocks selected
```

---

### P-05 Push with merge (POST) [dry-run]

```bash
node bin/databook.js push test/observatory.databook.md \
  --block-id primary-graph \
  --merge \
  --endpoint http://localhost:3030/ds/sparql \
  --dry-run
```

**Expected:** `POST` method instead of `PUT` for data block.
`#meta` graph is always `PUT` regardless of `--merge`.

---

### P-06 Push without meta graph [dry-run]

```bash
node bin/databook.js push test/observatory.databook.md \
  --no-meta \
  --endpoint http://localhost:3030/ds/sparql \
  --dry-run
```

**Expected:** No `#meta` push. Summary: `(0 meta graphs)` or no meta note.

---

### P-07 GSP endpoint inference [dry-run]

```bash
node bin/databook.js push test/sensors-v1.databook.md \
  --endpoint http://localhost:3030/ds/query \
  --dry-run
```

**Expected:** GSP endpoint inferred as `http://localhost:3030/ds/data`
(`/query → /data` rule).

---

### P-08 Unreachable endpoint [live required — will fail]

```bash
node bin/databook.js push test/sensors-v1.databook.md \
  --endpoint http://localhost:3030/ds/sparql
```

**Expected exit 4:** `error: cannot reach endpoint: http://localhost:3030/ds/data`
(if Fuseki is not running).

---

### P-09 Auth via environment variable [dry-run]

```bash
DATABOOK_FUSEKI_AUTH="Basic dGVzdDpwYXNz" \
  node bin/databook.js push test/sensors-v1.databook.md \
  --endpoint http://localhost:3030/ds/sparql \
  --dry-run
```

**Expected:** Same dry-run output as P-01. Auth header is not printed
in dry-run output (never log credentials), but resolved internally.

---

### P-10 Push all blocks to live Fuseki [live]

```bash
node bin/databook.js push test/observatory.databook.md \
  --endpoint http://localhost:3030/ds/sparql \
  --verbose
```

**Expected:** HTTP 204 responses for each block. Verify in Fuseki UI at
`http://localhost:3030` that named graphs
`…#primary-graph`, `…#observatory-shapes`, `…#meta` are present.

---

## PULL TESTS

### PL-01 Named graph fetch — dry-run [dry-run]

```bash
node bin/databook.js pull test/observatory.databook.md \
  --endpoint http://localhost:3030/ds/sparql \
  --dry-run
```

**Expected:** GSP GET request for
`?graph=https://w3id.org/databook/test/observatory-v1#primary-graph`
(resolved from `graph.named_graph` in frontmatter). Status: `[not sent]`.

---

### PL-02 Named graph fetch with explicit IRI — dry-run [dry-run]

```bash
node bin/databook.js pull test/observatory.databook.md \
  --endpoint http://localhost:3030/ds/sparql \
  --graph https://w3id.org/databook/test/observatory-v1#observatory-shapes \
  --dry-run
```

**Expected:** GET for the shapes graph IRI.

---

### PL-03 Fragment-ref mode — dry-run [dry-run]

```bash
node bin/databook.js pull test/observatory.databook.md \
  --endpoint http://localhost:3030/ds/sparql \
  --fragment sensor-construct \
  --dry-run
```

**Expected stderr:**
```
[pull] Fragment 'sensor-construct' extracted (CONSTRUCT, N lines)
[pull] POST http://localhost:3030/ds/sparql
[pull]       Content-Type: application/sparql-query
[pull]       Accept: text/turtle
[pull]       [not sent]

Extracted SPARQL:
PREFIX sosa: ...
CONSTRUCT { ... }
```

---

### PL-04 External query file — dry-run [dry-run]

```bash
node bin/databook.js pull test/observatory.databook.md \
  --endpoint http://localhost:3030/ds/sparql \
  --query test/external-query.sparql \
  --dry-run
```

**Expected:** POST request, `Accept: text/turtle` (CONSTRUCT detected
from query file), Status: `[not sent]`.

---

### PL-05 --query and --fragment mutual exclusion [dry-run]

```bash
node bin/databook.js pull test/observatory.databook.md \
  --endpoint http://localhost:3030/ds/sparql \
  --query test/external-query.sparql \
  --fragment sensor-construct \
  --dry-run
```

**Expected exit 2:**
```
error: --query and --fragment are mutually exclusive
```

---

### PL-06 --block-id without --out is an error [dry-run]

```bash
node bin/databook.js pull test/observatory.databook.md \
  --endpoint http://localhost:3030/ds/sparql \
  --fragment sensor-construct \
  --block-id primary-graph
```

**Expected exit 2:**
```
error: --block-id requires --out
```

---

### PL-07 Fragment SELECT — JSON accept header [dry-run]

```bash
node bin/databook.js pull test/queries.databook.md \
  --endpoint http://localhost:3030/ds/sparql \
  --fragment sensor-summary \
  --dry-run
```

**Expected:** SELECT detected → `Accept: application/sparql-results+json`.
Output type would be `json`.

---

### PL-08 Cross-document fragment reference — dry-run [dry-run]

```bash
node bin/databook.js pull test/observatory.databook.md \
  --endpoint http://localhost:3030/ds/sparql \
  --query test/external-query.sparql \
  --dry-run
```

**Expected:** Reads external `.sparql` file, sends as POST SPARQL query.

---

### PL-09 Fragment-ref in-place replace — live [live]

```bash
# First push the data
node bin/databook.js push test/observatory.databook.md \
  --endpoint http://localhost:3030/ds/sparql

# Then pull back the sensor subgraph into the primary-graph block
node bin/databook.js pull test/observatory.databook.md \
  --endpoint http://localhost:3030/ds/sparql \
  --fragment sensor-construct \
  --block-id primary-graph \
  --stats \
  --out /tmp/observatory-refreshed.databook.md
```

**Expected:** `/tmp/observatory-refreshed.databook.md` is a valid DataBook
with `primary-graph` block replaced by the CONSTRUCT result in Turtle.
`graph.triple_count` and `graph.subjects` updated in frontmatter.
`process.timestamp` updated to current time. `process.transformer_type`
set to `service`.

---

### PL-10 Multiple graph fetch — dry-run [dry-run]

```bash
node bin/databook.js pull test/observatory.databook.md \
  --endpoint http://localhost:3030/ds/sparql \
  --graph https://w3id.org/databook/test/observatory-v1#primary-graph \
  --graph https://w3id.org/databook/test/observatory-v1#observatory-shapes \
  --dry-run
```

**Expected:** Two separate GET requests, one per graph IRI.

---

## PROCESS TESTS

### PR-01 Single SPARQL — dry-run [dry-run]

```bash
node bin/databook.js process test/observatory.databook.md \
  --sparql test/queries.databook.md#all-sensors \
  -o /tmp/sensors-out.databook.md \
  --dry-run
```

**Expected:**
```
[process] Execution plan:
  Stage 1: Single sparql operation
    Processor: sparql
    Input:     primary-graph
    Output:    output
```

---

### PR-02 Single SHACL — dry-run [dry-run]

```bash
node bin/databook.js process test/observatory.databook.md \
  --shapes test/shapes.databook.md#sensor-shapes \
  -o /tmp/validation-report.databook.md \
  --dry-run
```

**Expected:**
```
[process] Execution plan:
  Stage 1: Single shacl operation
    Processor: shacl
    Input:     primary-graph
    Output:    output
```

---

### PR-03 Full pipeline — dry-run [dry-run]

```bash
node bin/databook.js process test/observatory.databook.md \
  -P test/pipeline.databook.md \
  -o /tmp/pipeline-out.databook.md \
  --dry-run
```

**Expected:**
```
[process] Execution plan:
  Stage 1: Extract normalised sensor subgraph
    Processor: sparql
    Input:     primary-graph
    Output:    constructed-sensors
  Stage 2: Validate constructed sensor graph
    Processor: shacl
    Input:     constructed-sensors
    Output:    validation-report
    Depends:   https://w3id.org/databook/test/pipeline-v1#stage-construct
```

---

### PR-04 Mode conflict error [dry-run]

```bash
node bin/databook.js process test/observatory.databook.md \
  --sparql test/queries.databook.md#all-sensors \
  -P test/pipeline.databook.md \
  --dry-run
```

**Expected exit 2:**
```
error: E_MODE_CONFLICT: single-operation flags ... cannot be combined with -P without --pipeline
```

---

### PR-05 Inline JSON params — dry-run [dry-run]

```bash
node bin/databook.js process test/observatory.databook.md \
  --sparql test/observatory.databook.md#typed-select \
  --params '{"type":"sosa:Sensor"}' \
  --dry-run
```

**Expected:** Dry-run plan shows the stage. Params would inject
`VALUES (?type) { sosa:Sensor }` at `<<db:inject>>` in the query payload
before execution.

---

### PR-06 JSON params file [dry-run]

```bash
node bin/databook.js process test/observatory.databook.md \
  --sparql test/queries.databook.md#sensors-by-property \
  --params test/params-sensor-type.json \
  --dry-run
```

**Expected:** Dry-run plan shown. `params-sensor-type.json` is loaded and
`observedProperty` key maps to the `<<db:inject>>` marker in the query.

---

### PR-07 YAML params file [dry-run]

```bash
node bin/databook.js process test/observatory.databook.md \
  --sparql test/observatory.databook.md#typed-select \
  --params test/params-by-type.yaml \
  --dry-run
```

**Expected:** Same as PR-06 but reads YAML params file.

---

### PR-08 Fragment reference for shapes — dry-run [dry-run]

```bash
node bin/databook.js process test/observatory.databook.md \
  --shapes test/shapes.databook.md#calibration-shapes \
  --dry-run
```

**Expected:** Stage plan showing shacl processor with shapes resolved from
`test/shapes.databook.md`, block `calibration-shapes`.

---

### PR-09 Full pipeline live execution [live]

Requires Jena installed with paths in `processors.toml`.

```bash
node bin/databook.js process test/observatory.databook.md \
  -P test/pipeline.databook.md \
  -o /tmp/pipeline-result.databook.md \
  --verbose
```

**Expected:** 
- Stage 1 executes `jena sparql`, produces `constructed-sensors` Turtle block.
- Stage 2 executes `jena shacl`, produces `validation-report` Turtle block.
- Output DataBook at `/tmp/pipeline-result.databook.md` with both blocks and
  a `process` stamp with `transformer_type: composite` and source + process
  DataBook IRIs in `process.inputs`.

---

### PR-10 Pipeline output DataBook structure [live, after PR-09]

```bash
node bin/databook.js head /tmp/pipeline-result.databook.md --format json
```

**Expected blocks:**
```json
[
  { "id": "constructed-sensors", "label": "turtle" },
  { "id": "validation-report",   "label": "turtle" }
]
```

`frontmatter.process.transformer_type` = `"composite"`.

---

## ROUND-TRIP TEST

Full `push → pull → head` round-trip verifying graph fidelity.

```bash
# Step 1: Push observatory graph to Fuseki
node bin/databook.js push test/observatory.databook.md \
  --endpoint http://localhost:3030/ds/sparql --verbose

# Step 2: Pull it back into a new DataBook block
node bin/databook.js pull test/observatory.databook.md \
  --endpoint http://localhost:3030/ds/sparql \
  --fragment sensor-construct \
  --block-id primary-graph \
  --stats \
  --out /tmp/round-trip.databook.md

# Step 3: Inspect the result
node bin/databook.js head /tmp/round-trip.databook.md --format json
```

**Expected final head output:**
- `frontmatter.graph.triple_count` reflects actual CONSTRUCT result
- `frontmatter.process.transformer_type` = `"service"`
- `primary-graph` block label = `"turtle"` (updated by pull)
- `process.timestamp` updated to pull time

---

## PROCESSOR.TOML QUICK-START

Copy the template and configure Jena paths before running live tests:

```bash
mkdir -p .databook
cp processors.default.toml .databook/processors.toml
# Edit .databook/processors.toml with your local Jena and Saxon paths
```

Minimum for SPARQL + SHACL live tests:

```toml
[default_endpoint]
sparql = "http://localhost:3030/ds/sparql"

[endpoints."http://localhost:3030"]
auth = "Basic YWRtaW46cGFzc3dvcmQ="   # admin:password in base64

[processor."https://w3id.org/databook/plugins/core#jena-sparql"]
command   = "/path/to/apache-jena-6.0.0/bin/sparql"
version   = "6.0.0"
jvm_flags = "-Xmx4g"

[processor."https://w3id.org/databook/plugins/core#jena-shacl"]
command   = "/path/to/apache-jena-6.0.0/bin/shacl"
version   = "6.0.0"
jvm_flags = "-Xmx4g"
```

---

## EXTRACT TESTS

### E-01 List all named blocks [dry-run]

```bash
node bin/databook.js extract test/observatory.databook.md --list
```

**Expected stdout** (tab-separated, one per line):
```
primary-graph         turtle  →  .ttl       [primary]
observatory-shapes    shacl   →  .shacl.ttl [constraint]
sensor-construct      sparql  →  .sparql
typed-select          sparql  →  .sparql
refresh-calibration   sparql-update  →  .ru
```

---

### E-02 Fragment syntax — Turtle block to stdout [dry-run]

```bash
node bin/databook.js extract "test/observatory.databook.md#primary-graph" --quiet
```

**Expected stdout:** Raw Turtle starting with `@prefix obs:` etc.
**Expected stderr (without --quiet):**
```
[extract] 'primary-graph'  label=turtle  mime=text/turtle  lines=55
```

---

### E-03 --block-id flag — SHACL block [dry-run]

```bash
node bin/databook.js extract test/observatory.databook.md \
  --block-id observatory-shapes --quiet
```

**Expected stdout:** Raw Turtle SHACL starting with `@prefix sh:`.
No `<!-- databook:id: -->` comment in output (stripped by default).

---

### E-04 --with-metadata — preserves databook:id comment [dry-run]

```bash
node bin/databook.js extract test/observatory.databook.md \
  --block-id sensor-construct --with-metadata --quiet
```

**Expected:** First line of stdout is `<!-- databook:id: sensor-construct -->`,
followed by the SPARQL content.

---

### E-05 --fence — output wrapped in fence markers [dry-run]

```bash
node bin/databook.js extract test/observatory.databook.md \
  --block-id sensor-construct --fence --quiet
```

**Expected stdout:**
```
```sparql
<!-- databook:id: sensor-construct -->
PREFIX sosa: ...
CONSTRUCT { ... }
...
```
```
(Complete, ready to paste back into a DataBook.)

---

### E-06 --type — Content-Type on stderr [dry-run]

```bash
node bin/databook.js extract "test/observatory.databook.md#sensor-construct" --type --quiet
```

**Expected stderr before content:**
```
Content-Type: application/sparql-query
```

Useful for constructing curl commands:
```bash
CTYPE=$(node bin/databook.js extract test/observatory.databook.md#sensor-construct \
          --type --quiet 2>&1 >/dev/null | head -1 | cut -d' ' -f2)
```

---

### E-07 Save to file — explicit path [dry-run]

```bash
node bin/databook.js extract test/observatory.databook.md \
  --block-id primary-graph -o /tmp/graph.ttl
```

**Expected:** File `/tmp/graph.ttl` written with raw Turtle content.
Stderr: `[extract] written to: /tmp/graph.ttl`.

---

### E-08 Save to file — auto-name with "." [dry-run]

```bash
cd /tmp && node /path/to/databook-cli/bin/databook.js extract \
  /path/to/test/observatory.databook.md --block-id sensor-construct -o .
```

**Expected:** File `sensor-construct.sparql` written in current directory.

---

### E-09 Save without extension — extension appended from label [dry-run]

```bash
node bin/databook.js extract test/observatory.databook.md \
  --block-id primary-graph -o /tmp/my-graph
```

**Expected:** File `/tmp/my-graph.ttl` created (`.ttl` appended because
label is `turtle` and output path had no extension).

---

### E-10 Single-block document — implicit block id [dry-run]

```bash
node bin/databook.js extract test/pre-v1.databook.md --quiet
```

**Expected:** Content of `legacy-graph` block emitted without specifying
`--block-id`, because it is the only named block. Info message emitted if
`--quiet` not set: `info: single named block — extracting 'legacy-graph'`.

---

### E-11 Block not found — helpful error [dry-run]

```bash
node bin/databook.js extract test/observatory.databook.md#does-not-exist
```

**Expected exit 2:**
```
error: no block with id 'does-not-exist'
  Available block ids: primary-graph, observatory-shapes, sensor-construct, ...
```

---

### E-12 Missing block-id with multiple blocks — helpful error [dry-run]

```bash
node bin/databook.js extract test/observatory.databook.md
```

**Expected exit 2:**
```
error: --block-id is required when document has multiple named blocks.
  Available: primary-graph, observatory-shapes, ...
  Or use fragment syntax: databook extract test/observatory.databook.md#<block-id>
```

---

### E-13 Cross-document query library — extract and pipe [dry-run / live]

```bash
# Extract a named query from a separate query library DataBook
node bin/databook.js extract test/queries.databook.md#all-sensors --quiet

# Pipe directly to Fuseki (live)
node bin/databook.js extract test/queries.databook.md#all-sensors --quiet \
  | curl -s -X POST http://localhost:3030/ds/sparql \
         -H 'Content-Type: application/sparql-query' \
         -H 'Accept: text/turtle' \
         --data-binary @-
```

**Expected:** Clean SPARQL CONSTRUCT query on stdout, no metadata comment,
ready for direct consumption by any SPARQL processor.

---

### E-14 Pipeline composition with head [dry-run]

```bash
# Extract a block, validate it with riot (if installed), then check stats
node bin/databook.js extract test/observatory.databook.md#primary-graph --quiet \
  | riot --syntax=turtle --validate -

# Or feed directly to arq for a quick test query
node bin/databook.js extract test/observatory.databook.md#primary-graph --quiet \
  > /tmp/graph.ttl
arq --data /tmp/graph.ttl --query test/external-query.sparql
```

---

### E-15 SPARQL-update block extraction [dry-run]

```bash
node bin/databook.js extract test/observatory.databook.md \
  --block-id refresh-calibration --quiet
```

**Expected stdout:** Raw SPARQL Update (DELETE/INSERT/WHERE) starting with
`PREFIX obs:`. Label is `sparql-update`, MIME type is
`application/sparql-update`.

---

### E-16 Stdin pipe [dry-run]

```bash
cat test/observatory.databook.md \
  | node bin/databook.js extract - --block-id sensor-construct --quiet
```

**Expected:** Same content as E-03, read from stdin rather than a file.
