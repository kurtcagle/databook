# DataBook CLI — Test Guide

All tests run from the `implementations/js/` directory (the repo root for the CLI).
Tests marked **[dry-run]** require no running triplestore.
Tests marked **[live]** require Jena Fuseki at `http://localhost:3030`.

---

## Test Fixtures

| File | Purpose |
|---|---|
| `test/knowledge-graph.databook.md` | Primary fixture — 5 blocks (turtle, shacl, sparql × 2, sparql-update) |
| `test/pre-v1.databook.md` | v1.0 `<script>` form — backwards-compatibility test |
| `test/queries.databook.md` | Named SPARQL query library (fragment-ref pull tests) |
| `test/shapes.databook.md` | Standalone SHACL shapes (DESCRIBE tests) |
| `test/pipeline.databook.md` | 2-stage manifest (process command tests) |
| `test/external-query.sparql` | External SPARQL file for `--query` mode |
| `test/params-type.json` | JSON params for VALUES injection |
| `test/params-by-status.yaml` | YAML params for VALUES injection |

**Primary fixture block inventory** (`knowledge-graph.databook.md`):

| `databook:id` | Label | Role | Note |
|---|---|---|---|
| `primary-graph` | `turtle` | primary | 41 triples, 9 subjects |
| `project-shapes` | `shacl` | constraint | 3 NodeShapes |
| `construct-tasks` | `sparql` | — | CONSTRUCT; not directly pushable |
| `select-by-status` | `sparql` | — | SELECT with `<<db:inject>>`; not pushable |
| `close-task` | `sparql-update` | — | UPDATE; pushable |

---

## HEAD TESTS

### H-01 Default JSON output [dry-run]

```bash
node bin/databook.js head test/knowledge-graph.databook.md
```

**Expected:** JSON with `frontmatter` (id, title, type, version, created, author, graph, process) and `blocks` array containing 5 entries:
`primary-graph (turtle)`, `project-shapes (shacl)`, `construct-tasks (sparql)`, `select-by-status (sparql)`, `close-task (sparql-update)`.

---

### H-02 YAML output [dry-run]

```bash
node bin/databook.js head test/knowledge-graph.databook.md --format yaml
```

**Expected:** Same structure as H-01, serialised as YAML. `created` field must be plain string `2026-04-25`, not a JavaScript Date object.

---

### H-03 XML output [dry-run]

```bash
node bin/databook.js head test/knowledge-graph.databook.md --format xml
```

**Expected:** XML envelope with `xmlns:db="https://w3id.org/databook/ns#"`. `<db:frontmatter>` contains all fields as child elements. `<db:blocks>` contains one `<db:block/>` per block with `id`, `label`, `role`, `line_count`, `display_only` attributes.

---

### H-04 Turtle output [dry-run]

```bash
node bin/databook.js head test/knowledge-graph.databook.md --format turtle
```

**Expected:** Valid Turtle with `build:`, `dct:`, `xsd:` prefixes. Subject is `<https://w3id.org/databook/test/project-v1>` typed as `build:DataBook`. `build:hasBlock` links to five fragment IRIs: `…#primary-graph`, `…#project-shapes`, `…#construct-tasks`, `…#select-by-status`, `…#close-task`.

---

### H-05 Block metadata mode — JSON [dry-run]

```bash
node bin/databook.js head test/knowledge-graph.databook.md --block-id primary-graph
```

**Expected:**
```json
{
  "id": "primary-graph",
  "label": "turtle",
  "role": "primary",
  "line_count": 41,
  "comment_count": 1,
  "display_only": false,
  "all_meta": { "id": "primary-graph" }
}
```

Role is `"primary"` because `process.inputs` declares `block_id: primary-graph` with `role: primary`.

---

### H-06 Block metadata mode — YAML [dry-run]

```bash
node bin/databook.js head test/knowledge-graph.databook.md \
  --block-id project-shapes --format yaml
```

**Expected:** YAML object with `id: project-shapes`, `label: shacl`, `role: constraint` (from `process.inputs`).

---

### H-07 Block metadata mode — Turtle [dry-run]

```bash
node bin/databook.js head test/knowledge-graph.databook.md \
  --block-id construct-tasks --format turtle
```

**Expected:** Single `build:Block` subject at `<https://w3id.org/databook/test/project-v1#construct-tasks>` with `build:blockLabel "sparql"`, `build:lineCount` a positive integer.

---

### H-08 Legacy v1.0 `<script>` form — accepted without error [dry-run]

```bash
node bin/databook.js head test/pre-v1.databook.md
```

**Expected:** JSON output on stdout with `id: https://w3id.org/databook/test/pre-v1-legacy`. One block: `legacy-graph (turtle)`. Parser must accept the `<script language="application/yaml">` wrapper without error.

> **Note (v1.1):** The `<script>` form was canonical in DataBook v1.0. In v1.1, bare `---` frontmatter is canonical and the `<script>` form is an accepted alternative. The CLI currently emits a `W_HEAD_PRE_V1` warning for bare `---` form (the old "pre-v1" heuristic). A minor code update to flip the detection order is planned for the next CLI release to align with the v1.1 spec.

---

### H-09 Legacy form — warning suppressed [dry-run]

```bash
node bin/databook.js head test/pre-v1.databook.md --quiet
```

**Expected:** No warning on stderr. Same JSON output as H-08.

---

### H-10 Block not found error [dry-run]

```bash
node bin/databook.js head test/knowledge-graph.databook.md --block-id nonexistent
```

**Expected exit 2:**
```
error: E_HEAD_BLOCK_NOT_FOUND: no block with id 'nonexistent'
```

---

### H-11 Invalid format error [dry-run]

```bash
node bin/databook.js head test/knowledge-graph.databook.md --format csv
```

**Expected exit 2:**
```
error: E_HEAD_FORMAT_UNKNOWN: --format must be one of: json, yaml, xml, turtle
```

---

### H-12 Head output to file [dry-run]

```bash
node bin/databook.js head test/knowledge-graph.databook.md \
  --format json --output /tmp/kg-head.json
```

**Expected:** No stdout. File `/tmp/kg-head.json` created with valid JSON matching H-01 output.

---

### H-13 Stdin pipe [dry-run]

```bash
cat test/knowledge-graph.databook.md | node bin/databook.js head --format yaml --quiet
```

**Expected:** Same YAML output as H-02, no warnings.

---

### H-14 Pipeline: list SPARQL block IDs [dry-run]

```bash
node bin/databook.js head test/knowledge-graph.databook.md --quiet --format json \
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
construct-tasks
select-by-status
```

---

## PUSH TESTS

### P-01 Push all blocks — dry-run [dry-run]

```bash
node bin/databook.js push test/knowledge-graph.databook.md \
  --endpoint http://localhost:3030/ds/sparql \
  --dry-run
```

**Expected stderr (order may vary):**
```
[push] PUT  http://localhost:3030/ds/data
[push]       ?graph=https://w3id.org/databook/test/project-v1#primary-graph
[push]       Content-Type: text/turtle
[push]       Status: [not sent]
[push] PUT  http://localhost:3030/ds/data
[push]       ?graph=https://w3id.org/databook/test/project-v1#project-shapes
[push]       Content-Type: text/turtle
[push]       Status: [not sent]
[push] PUT  http://localhost:3030/ds/data
[push]       ?graph=https://w3id.org/databook/test/project-v1#meta
[push]       Content-Type: text/turtle
[push]       Status: [not sent]
[push] 2 blocks pushed, 0 skipped, 0 failed  (1 meta graph)
```

The `sparql-update` `close-task` block is NOT included in this count — it is pushed separately as a SPARQL Update (not as a named graph).

---

### P-02 Push specific block [dry-run]

```bash
node bin/databook.js push test/knowledge-graph.databook.md \
  --block-id primary-graph \
  --endpoint http://localhost:3030/ds/sparql \
  --dry-run
```

**Expected:** One PUT for `#primary-graph` + one PUT for `#meta`.

---

### P-03 Push with explicit graph IRI [dry-run]

```bash
node bin/databook.js push test/knowledge-graph.databook.md \
  --block-id primary-graph \
  --graph https://example.org/my-custom-graph \
  --endpoint http://localhost:3030/ds/sparql \
  --dry-run
```

**Expected:** PUT with `?graph=https://example.org/my-custom-graph`.

---

### P-04 `--graph` with multiple blocks is an error [dry-run]

```bash
node bin/databook.js push test/knowledge-graph.databook.md \
  --graph https://example.org/my-graph \
  --endpoint http://localhost:3030/ds/sparql \
  --dry-run
```

**Expected exit 2:**
```
error: --graph requires exactly one block; multiple blocks selected
```

---

### P-05 Push SPARQL Update block [live]

```bash
node bin/databook.js push test/knowledge-graph.databook.md \
  --block-id close-task \
  --endpoint http://localhost:3030/ds/sparql
```

**Expected:** SPARQL Update executed. `proj:Task002 proj:status proj:Complete` asserted. No graph store PUT — SPARQL Update is executed directly against the query endpoint.

---

### P-06 Merge mode [dry-run]

```bash
node bin/databook.js push test/knowledge-graph.databook.md \
  --block-id primary-graph \
  --merge \
  --endpoint http://localhost:3030/ds/sparql \
  --dry-run
```

**Expected:** POST (not PUT) to the GSP endpoint.

---

## EXTRACT TESTS

### E-01 Extract Turtle block to stdout [dry-run]

```bash
node bin/databook.js extract test/knowledge-graph.databook.md --block-id primary-graph
```

**Expected:** Raw Turtle content on stdout, `databook:` comment lines stripped. Must include `proj:AliceSmith a foaf:Person`.

---

### E-02 Extract to file [dry-run]

```bash
node bin/databook.js extract test/knowledge-graph.databook.md \
  --block-id primary-graph --output /tmp/primary-graph.ttl
```

**Expected:** File `/tmp/primary-graph.ttl` created with valid Turtle. No stdout.

---

### E-03 Extract SHACL block [dry-run]

```bash
node bin/databook.js extract test/knowledge-graph.databook.md --block-id project-shapes
```

**Expected:** Valid Turtle SHACL shapes on stdout including `proj:PersonShape a sh:NodeShape`.

---

### E-04 Pipe extracted Turtle to rdflib/Jena [dry-run]

```bash
node bin/databook.js extract test/knowledge-graph.databook.md --block-id primary-graph \
  | python3 -c "
import rdflib, sys, io
g = rdflib.Graph()
g.parse(io.StringIO(sys.stdin.read()), format='turtle')
print(len(g), 'triples')"
```

**Expected output:** `41 triples`

---

## PULL TESTS

### PL-01 Named graph fetch [live]

Prerequisites: push `primary-graph` first (see P-01 or P-02).

```bash
node bin/databook.js pull test/knowledge-graph.databook.md \
  --endpoint http://localhost:3030/ds/sparql
```

**Expected:** Turtle content matching the pushed graph on stdout.

---

### PL-02 Fragment-ref pull — CONSTRUCT [live]

```bash
node bin/databook.js pull test/knowledge-graph.databook.md \
  --fragment construct-tasks \
  --endpoint http://localhost:3030/ds/sparql
```

**Expected:** Turtle output containing task instances with labels, assignees, and projects.

---

### PL-03 External query file [live]

```bash
node bin/databook.js pull test/knowledge-graph.databook.md \
  --query test/external-query.sparql \
  --endpoint http://localhost:3030/ds/sparql
```

**Expected:** SPARQL SELECT results in default format (JSON) with columns `task`, `taskLabel`, `assignee`, `assigneeLabel`, `project`, `projectLabel`.

---

### PL-04 In-place block replacement [live]

```bash
node bin/databook.js pull test/knowledge-graph.databook.md \
  --fragment construct-tasks \
  --block-id primary-graph \
  --endpoint http://localhost:3030/ds/sparql \
  --output /tmp/kg-updated.databook.md
```

**Expected:** `/tmp/kg-updated.databook.md` created with `primary-graph` block content replaced by CONSTRUCT results.

---

### PL-05 SHACL-guided DESCRIBE — Tier 1 [live]

```bash
node bin/databook.js pull test/knowledge-graph.databook.md \
  --describe https://w3id.org/databook/test/project-v1#AliceSmith \
  --shapes test/shapes.databook.md#project-shapes \
  --endpoint http://localhost:3030/ds/sparql
```

**Expected:** Turtle CONSTRUCT result describing `proj:AliceSmith` with all properties declared in `proj:PersonShape` (rdfs:label, proj:role, proj:memberOf).

---

## PROCESS TESTS

### PR-01 Manifest pipeline — dry-run [dry-run]

```bash
node bin/databook.js process test/pipeline.databook.md \
  --endpoint http://localhost:3030/ds/sparql \
  --dry-run
```

**Expected:** Stage execution plan logged to stderr (ordered by dependency). No SPARQL calls made.

---

### PR-02 Parameterised SELECT — JSON params [dry-run / live with endpoint]

```bash
node bin/databook.js process test/knowledge-graph.databook.md \
  --sparql test/knowledge-graph.databook.md#select-by-status \
  --params test/params-type.json \
  --endpoint http://localhost:3030/ds/sparql
```

**Expected:** VALUES clause `VALUES (?status) { <<db:inject>> }` replaced with `VALUES (?status) { proj:Active }` before execution. SELECT results returned.

---

### PR-03 Parameterised SELECT — YAML params [dry-run / live with endpoint]

```bash
node bin/databook.js process test/knowledge-graph.databook.md \
  --sparql test/knowledge-graph.databook.md#select-by-status \
  --params test/params-by-status.yaml \
  --endpoint http://localhost:3030/ds/sparql
```

**Expected:** VALUES replaced with `VALUES (?status) { proj:Planning }`. SELECT results returned.

---

## PROMPT TESTS

### PT-01 Prompt block execution [dry-run]

Requires a DataBook with at least one `prompt` block and a configured LLM in `processors.toml`.

```bash
node bin/databook.js prompt test/knowledge-graph.databook.md --block-id <prompt-block-id>
```

**Expected:** LLM response on stdout. Process stamp updated with `transformer_type: llm` and current timestamp.

---

## CONVERT TESTS

### CV-01 Turtle to JSON-LD [dry-run]

```bash
node bin/databook.js convert test/knowledge-graph.databook.md \
  --block-id primary-graph --from turtle --to json-ld
```

**Expected:** Valid JSON-LD on stdout representing the same graph as the primary-graph Turtle block.

---

## CLEAR TESTS

### CL-01 Clear named graph — dry-run [dry-run]

```bash
node bin/databook.js clear test/knowledge-graph.databook.md \
  --graph https://w3id.org/databook/test/project-v1#primary-graph \
  --endpoint http://localhost:3030/ds/sparql \
  --dry-run
```

**Expected:** Log message showing `DELETE` request that would be sent. No actual deletion.

---

## CREATE TESTS

### CR-01 Create from Turtle file [dry-run]

```bash
node bin/databook.js extract test/knowledge-graph.databook.md \
  --block-id primary-graph --output /tmp/graph.ttl

node bin/databook.js create /tmp/graph.ttl \
  --id https://example.org/test-create-v1 \
  --title "Test Create Output" \
  --output /tmp/created.databook.md
```

**Expected:** `/tmp/created.databook.md` created with valid v1.1 DataBook structure: `---` frontmatter, single `turtle` block with `databook:id`, `process` stamp with `transformer_type: human`.

---

## STDIN / PIPE TESTS

### SP-01 Stdin to head [dry-run]

```bash
cat test/knowledge-graph.databook.md | node bin/databook.js head --quiet
```

**Expected:** Same JSON output as H-01.

---

### SP-02 Extract → head pipeline [dry-run]

```bash
node bin/databook.js extract test/knowledge-graph.databook.md --block-id primary-graph \
  | wc -l
```

**Expected:** Line count matching the turtle block line count (approximately 41).

---

## EXIT CODE REFERENCE

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Runtime / unexpected error |
| 2 | Input validation error (bad args, block not found, format unknown) |
| 3 | Network / endpoint error |
| 4 | Authentication error |
| 5 | Parser error (malformed DataBook) |
