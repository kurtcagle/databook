# DataBook CLI — Observatory Examples

Examples based on `test/observatory.databook.md`.

**DataBook facts at a glance:**

| Property | Value |
|---|---|
| Document ID | `https://w3id.org/databook/test/observatory-v1` |
| Named graph | `https://w3id.org/databook/test/observatory-v1#primary-graph` |
| Blocks | `primary-graph` (turtle), `observatory-shapes` (shacl), `sensor-construct` (sparql), `typed-select` (sparql), `refresh-calibration` (sparql-update) |

---

## push

### Push all blocks to the default local dataset

```powershell
databook push test/observatory.databook.md
```

Pushes `primary-graph`, `observatory-shapes`, and executes
`refresh-calibration` as a SPARQL UPDATE. Also writes a `#meta` graph
from frontmatter. Connects to `http://localhost:3030/ds/sparql` by default.

### Push to the GGSC dataset

```powershell
databook push test/observatory.databook.md -d ggsc
```

Targets `http://localhost:3030/ggsc/sparql` without spelling out the full URL.

### Push using a named server config

```powershell
databook push test/observatory.databook.md -s ggsc
```

Resolves endpoint, GSP URL, and auth from `[servers.ggsc]` in `processors.toml`.

### Push only the primary Turtle graph

```powershell
databook push test/observatory.databook.md -d ggsc --block-id primary-graph
```

### Push only the SHACL shapes

```powershell
databook push test/observatory.databook.md -d ggsc --block-id observatory-shapes
```

### Push to an explicit named graph IRI (override frontmatter)

```powershell
databook push test/observatory.databook.md -d ggsc `
  --block-id primary-graph `
  --graph https://w3id.org/databook/test/observatory-v1#primary-graph
```

### Merge into an existing graph instead of replacing it

```powershell
databook push test/observatory.databook.md -d ggsc --merge
```

Uses HTTP POST (merge) instead of PUT (replace) for all blocks.

### Push without the metadata graph

```powershell
databook push test/observatory.databook.md -d ggsc --no-meta
```

### Dry-run to inspect what would be sent

```powershell
databook push test/observatory.databook.md -d ggsc --dry-run --verbose
```

Prints each block's HTTP method, target graph IRI, content type, and line
count without sending anything.

---

## pull

### Fetch the primary named graph (uses frontmatter graph.named_graph)

```powershell
databook pull test/observatory.databook.md -d ggsc
```

Fetches `https://w3id.org/databook/test/observatory-v1#primary-graph`
via GSP GET and writes Turtle to stdout.

### Fetch to a file

```powershell
databook pull test/observatory.databook.md -d ggsc -o pulled-graph.ttl
```

### Fetch a specific named graph explicitly

```powershell
databook pull test/observatory.databook.md -d ggsc `
  --graph https://w3id.org/databook/test/observatory-v1#primary-graph
```

### Execute the embedded CONSTRUCT query and return Turtle

```powershell
databook pull test/observatory.databook.md -d ggsc --fragment sensor-construct
```

Extracts the `sensor-construct` SPARQL block and POSTs it to the endpoint,
returning a Turtle graph of all sensors with their labels, hosts, observed
properties, and serial numbers.

### Execute the CONSTRUCT and replace the primary-graph block in place

```powershell
databook pull test/observatory.databook.md -d ggsc `
  --fragment sensor-construct `
  --block-id primary-graph `
  --stats `
  --out test/observatory.databook.md
```

Overwrites `primary-graph` with the freshly fetched triples and recomputes
`graph.triple_count` and `graph.subjects` in the frontmatter.

### Execute the SELECT query and get JSON results

```powershell
databook pull test/observatory.databook.md -d ggsc `
  --fragment typed-select `
  --format json
```

### Execute an external SPARQL query file

```powershell
databook pull test/observatory.databook.md -d ggsc `
  --query queries/all-observations.sparql `
  --format csv `
  -o observations.csv
```

### Pull as N-Triples (useful for diff or triple count)

```powershell
databook pull test/observatory.databook.md -d ggsc --format ntriples | wc -l
```

### Dry-run showing what would be fetched

```powershell
databook pull test/observatory.databook.md -d ggsc --fragment sensor-construct --dry-run --verbose
```

---

## prompt

Requires `ANTHROPIC_API_KEY` to be set.

### Summarise the full DataBook

```powershell
databook prompt test/observatory.databook.md `
  --prompt "Summarise this knowledge graph: what observatory is described, what sensors are present, what properties do they observe, and what observations have been recorded?" `
  -o test/observatory-summary.databook.md
```

### Describe the SHACL shapes in plain English

```powershell
databook prompt test/observatory.databook.md `
  --block-id observatory-shapes `
  --prompt "Explain these SHACL shapes in plain English. What constraints apply to Platforms, Sensors, and Observations? What validation errors would they catch?" `
  -o test/shapes-explanation.databook.md
```

### Review the SPARQL CONSTRUCT query

```powershell
databook prompt test/observatory.databook.md `
  --block-id sensor-construct `
  --prompt "Review this SPARQL CONSTRUCT query. Does it correctly retrieve all sensor properties defined in the graph? What properties might be missing?" `
  -o test/construct-review.databook.md
```

### Generate a Markdown report from the primary graph

```powershell
databook prompt test/observatory.databook.md `
  --block-id primary-graph `
  --prompt "Generate a structured Markdown report from this RDF graph. Include sections for: the observatory metadata, a table of sensors with serial numbers and last calibration dates, observable properties with units, and a table of recorded observations with timestamps and values." `
  -o test/observatory-report.databook.md
```

### Suggest additional sensors for the observatory

```powershell
databook prompt test/observatory.databook.md `
  --prompt "Based on this geodetic observatory knowledge graph, suggest 3 additional sensor types that would complement the existing gravity, pressure, and tilt sensors. For each, provide: sensor type, manufacturer/model example, observable property, QUDT unit, and the Turtle triples to add to the graph." `
  --model claude-opus-4-6 `
  -o test/suggested-sensors.databook.md
```

### Check ontology alignment with SOSA/SSN

```powershell
databook prompt test/observatory.databook.md `
  --prompt "Audit this graph for alignment with the SOSA and SSN ontologies. Identify any missing required properties, incorrect class usage, or properties that should use standard SOSA/SSN terms rather than the obs: namespace." `
  -o test/sosa-audit.databook.md
```

### Dry-run to check context size before calling the API

```powershell
databook prompt test/observatory.databook.md `
  --prompt "Summarise this knowledge graph" `
  --dry-run
```

Prints the model, token budget, context line count, and truncated prompt
without making an API call — useful for checking that the right blocks
are in scope before incurring cost on a large DataBook.

### Using a prompt block with interpolation

Add a `prompt` block to the DataBook:

````markdown
```prompt
<!-- databook:id: analysis-prompt -->
Analyse the {{focus}} entities in this observatory graph.
List their key properties and identify any data quality issues.
```
````

Then invoke with parameter injection:

```powershell
databook prompt test/observatory.databook.md `
  --prompt-block analysis-prompt `
  --interpolate `
  --param focus=Sensor `
  -o test/sensor-analysis.databook.md
```
