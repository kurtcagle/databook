---
name: databook
description: >
  Create, parse, validate, and transform DataBook documents — Markdown files
  that function simultaneously as human-readable documents, typed data
  containers, and self-describing semantic artifacts. Use this skill whenever
  the user mentions DataBooks, .databook.md files, wants to wrap RDF/SPARQL/
  SHACL data in a structured document, needs to generate YAML metadata for
  semantic data, wants to extract fenced data blocks from a DataBook, needs to
  build a DataBook pipeline manifest, transformer library, or processor
  registry, or asks about the DataBook spec at
  https://github.com/kurtcagle/databook. Also trigger for requests to produce
  a "semantic document", "knowledge artifact", or "self-describing data file"
  in the context of RDF, SHACL, or holonic graph work.
---

# DataBook Skill

A DataBook is a Markdown document that works as three things at once:
1. **Human-readable document** — prose, headings, admonitions
2. **Typed data container** — fenced blocks carrying Turtle, SPARQL, SHACL, JSON-LD, prompts
3. **Self-describing semantic artifact** — YAML metadata with identity, provenance, and graph metadata

Spec: https://github.com/kurtcagle/databook (v1.1)  
Canonical extension: `.databook.md`  
Canonical namespace: `https://w3id.org/databook/ns#`

---

## Quick Orientation

When asked to work with DataBooks, determine the task type:

| Task | Action |
|---|---|
| Create a DataBook from data | → [Section: Creating DataBooks] |
| Generate / complete frontmatter | → [Section: Frontmatter Reference] |
| Extract blocks from an existing DataBook | → [Section: Parsing DataBooks] |
| Build a pipeline manifest | → [Section: Manifests] |
| Build a transformer library | → [Section: Transformer Libraries] |
| Build a processor registry | → [Section: Processor Registries] |
| Validate DataBook structure | → [Section: Validation] |
| Work with LLMs / use `databook prompt` | → [Section: LLM Integration] |

---

## Creating DataBooks

### Minimum viable DataBook (v1.1 canonical form)

Every DataBook needs:
- A `---`-delimited YAML frontmatter block with `id`, `title`, `type`, `version`, `created`, and `process`
- At least one fenced data block in the body

```markdown
---
id: https://example.org/databooks/my-databook-v1
title: "My DataBook Title"
type: databook
version: 1.0.0
created: 2026-04-19
process:
  transformer: "Claude Sonnet 4.6"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-4-6
  inputs:
    - iri: urn:input:source-description
      role: primary
      description: "Source material provided by user"
  timestamp: 2026-04-19T12:00:00Z
  agent:
    name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: orchestrator
---

## Overview

[Prose describing what this DataBook contains.]

## Data

```turtle
<!-- databook:id: primary-block -->
@prefix ex: <https://example.org/> .
ex:Thing a ex:Class .
```
```

> **Note:** The `---` delimiters are standard YAML frontmatter, visible in the rendered document. This is intentional — DataBook metadata is part of the readable content, not hidden infrastructure.

### Document type vocabulary

| `type` value | Meaning |
|---|---|
| `databook` | Standard DataBook carrying domain data, queries, or prompts |
| `transformer-library` | Catalogue of named, reusable transformer definitions (see §Transformer Libraries) |
| `processor-registry` | Catalogue of named processors with IRI and capability declarations (see §Processor Registries) |

### Standard creation workflow

1. **Establish identity** — ask for or generate a stable `id` IRI; if none provided, construct from `https://w3id.org/databook/{slug}-v{version}`
2. **Determine content type** — what fenced block types are needed? Which `type` value applies?
3. **Write data blocks first** — get the payload right before writing prose
4. **Count triples** — if Turtle/JSON-LD, count subjects and triples for `graph.triple_count` and `graph.subjects`
5. **Build metadata** — identity → descriptive → graph metadata → process stamp — as `---`-delimited YAML frontmatter
6. **Add prose sections** — overview, usage notes, validation notes
7. **Validate structure** — see Validation section

### Choosing fenced block labels

| Data type | Label | Notes |
|---|---|---|
| RDF Turtle 1.1 | `turtle` | Standard |
| RDF Turtle 1.2 (reification) | `turtle12` | Set `graph.reification: true` in frontmatter |
| JSON-LD | `json-ld` | |
| Named graphs | `trig` | |
| SPARQL query | `sparql` | SELECT, CONSTRUCT, ASK, DESCRIBE |
| SPARQL update | `sparql-update` | |
| SHACL shapes | `shacl` | Usually Turtle serialisation |
| Build manifest | `manifest` | Turtle with `build:` vocabulary |
| Transformer catalogue | `transformer-library` | RDF catalogue of named transforms |
| Processor catalogue | `processor-registry` | RDF catalogue of named processors |
| LLM prompt | `prompt` | May use `{{variable}}` interpolation |
| Encrypted content | `encrypted-turtle` / `encrypted-jsonld` | See encryption profile |

Python, JavaScript, bash, etc. are **display code blocks only** — not DataBook payloads.

### Block identifiers

Every data block should carry a `databook:id` comment key as the first line inside the fence:

```
```turtle
<!-- databook:id: primary-block -->
@prefix ex: <https://example.org/> .
```

Use kebab-case. Must be unique within the document. Enables fragment addressing: `{document-id}#primary-block`

Other recognised block-level comment keys:

| Key | Description |
|---|---|
| `databook:id` | Block identifier (required for addressability) |
| `databook:graph` | Named graph IRI; overrides `graph.named_graph` in frontmatter |
| `databook:label` | Human-readable label for this block |
| `databook:base` | Base IRI for relative IRI resolution |
| `databook:import` | IRI of another DataBook to import prefixes/context from |
| `databook:encoding` | Character encoding if not UTF-8 |
| `databook:executable` | `true` opts an imperative code block into executable mode |
| `databook:runtime` | Execution environment required (e.g., `python>=3.11`, `node>=20`) |
| `databook:param` | Declares a substitutable parameter for query blocks (see §Parameterised Queries) |
| `databook:encrypted-media-type` | MIME type of plaintext in an encrypted block |
| `databook:key-ref` | IRI of the encryption key |

---

## Frontmatter Reference

### Required identity fields

```yaml
id: https://example.org/databooks/my-databook-v1   # stable IRI, unique
title: "Human-Readable Title"                        # quote if contains colons
type: databook                                       # databook | transformer-library | processor-registry
version: 1.0.0                                       # semver
created: 2026-04-19                                  # YYYY-MM-DD
```

### Recommended descriptive fields

```yaml
author:
  - name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator          # orchestrator | transformer | reviewer | editor | contributor
  - name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: transformer

license: CC-BY-4.0             # SPDX identifier or full IRI
domain: https://ontologist.io/ns/holon#   # primary ontology namespace
subject:
  - holonic graph architecture
  - SHACL validation
description: >
  One-paragraph abstract for catalogue and discovery use.
  Distinct from body prose.
```

### Graph metadata (when DataBook contains graph data)

```yaml
graph:
  namespace: https://ontologist.io/ns/holon#
  named_graph: https://example.org/databooks/my-databook-v1#graph
  triple_count: 47          # count of triples in primary block
  subjects: 12              # count of distinct subject IRIs
  rdf_version: "1.2"        # "1.1" or "1.2"
  turtle_version: "1.2"     # "1.1" or "1.2"
  reification: true         # true if RDF 1.2 ~ reifier syntax used
  validator_note: >
    Requires Jena 6.0 for full RDF 1.2 reification support.
    rdflib workaround: load base graph, annotations ignored.
```

### Process stamp (required if data was produced by any transformer)

```yaml
process:
  transformer: "Claude Sonnet 4.6"
  transformer_type: llm
  # transformer_type values:
  #   llm | xslt | sparql | shacl | service | human | composite | script
  #   library-transform | registry-processor
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-4-6
  inputs:
    - iri: https://example.org/databooks/source-v1
      role: primary             # primary | constraint | context | evidence | reference | template
      description: "Source taxonomy used as input"
    - iri: https://example.org/shapes/my-shapes-v1
      role: constraint
      description: "SHACL shapes constraining output"
  timestamp: 2026-04-19T14:32:00Z
  agent:
    name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: orchestrator
  note: >
    Optional free-text note about the transformation.
  output_format: turtle         # fence-label of output (turtle | json-ld | shacl | sparql | etc.)
  output_media_type: text/turtle  # optional MIME type for precision
  output:                       # optional; absent = stdout
    graph: https://example.org/graphs/my-graph
    url: https://store.example.org/upload
    file: ./build/output.ttl
  # outputs: [{...}, {...}]    # multiple simultaneous destinations
```

**Transformer type key facts:**
- `llm` and `human` are non-deterministic — document this honestly
- `xslt`, `sparql`, `shacl` are deterministic
- `composite` = orchestrated pipeline of multiple types
- `library-transform` = named transform from a `transformer-library` DataBook; set `transformer_iri` to the fragment IRI of the named transform
- `registry-processor` = processor resolved from a `processor-registry` DataBook; set `transformer_iri` to the fragment IRI of the registry entry

**PROV-O alignment:** The process stamp maps directly to PROV-O. The document `id` is a `prov:Entity`, the `process` block is a `prov:Activity`, `inputs` become `prov:used`, `transformer_iri` is `prov:wasAssociatedWith`. Provenance chains are graph-traversable through `inputs[n].iri` values.

### SHACL shapes declaration (situational)

```yaml
shapes:
  - https://example.org/shapes/PersonShape
  - https://example.org/shapes/OrgShape
```

Informational — not enforced at the DataBook level. Enables downstream validators to locate shapes without inspecting data.

---

## Parsing DataBooks

When extracting content from an existing DataBook:

1. **Detect metadata block** — look for `---` at document start (v1.1+ canonical) or `<script language="application/yaml">` block (v1.0 form, accepted alternative)
2. **Parse YAML** — extract identity, graph metadata, process stamp
3. **Scan body for fenced blocks** — identify by ` ``` ` + label pattern
4. **For each fenced block:**
   - Read `databook:id` and other `databook:` keys from HTML comment lines at top of block (before non-comment content)
   - Ignore comment lines as part of the payload
   - Route block content by label (turtle → RDF parser, sparql → query engine, etc.)
5. **Extract prose sections** — content between fenced blocks

When generating Python extraction code, use this pattern:

```python
import re, yaml

def extract_frontmatter(text):
    """Extract and parse YAML frontmatter. Handles v1.1 bare --- form (primary)
    and v1.0 <script language="application/yaml"> form (accepted alternative)."""
    if text.startswith('---\n') or text.startswith('---\r\n'):
        parts = text.split('---', 2)
        return yaml.safe_load(parts[1]) if len(parts) >= 3 else None
    # Fallback: v1.0 <script> form
    m = re.search(r'<script[^>]+language=["\']application/yaml["\'][^>]*>(.*?)</script>',
                  text, re.DOTALL | re.IGNORECASE)
    if m:
        parts = m.group(1).split('---')
        return yaml.safe_load(parts[1]) if len(parts) >= 3 else None
    return None

def extract_body(text):
    """Extract body text (everything after the frontmatter block)."""
    if text.startswith('---\n') or text.startswith('---\r\n'):
        parts = text.split('---', 2)
        return parts[2] if len(parts) > 2 else ''
    # v1.0 <script> form
    end = text.find('</script>')
    return text[end + 9:] if end != -1 else text

BLOCK_PAT = re.compile(r'```(\w[\w-]*)\n(.*?)```', re.DOTALL)
COMMENT_PAT = re.compile(r'<!--\s*databook:(\S+):\s*(.+?)\s*-->')

def parse_databook(text):
    frontmatter = extract_frontmatter(text)
    body = extract_body(text)
    blocks = []
    for m in BLOCK_PAT.finditer(body):
        label, content = m.group(1), m.group(2)
        meta, payload_lines = {}, []
        for line in content.split('\n'):
            cm = COMMENT_PAT.match(line)
            if cm:
                meta[cm.group(1)] = cm.group(2)
            else:
                payload_lines.append(line)
        blocks.append({'label': label, 'meta': meta,
                       'content': '\n'.join(payload_lines)})
    return {'frontmatter': frontmatter, 'blocks': blocks}
```

For Node.js, use `js-yaml` for YAML and the same regex approach:

```javascript
const yaml = require('js-yaml');

const BLOCK_RE = /```(\w[\w-]*)\n([\s\S]*?)```/g;
const META_RE  = /<!--\s*databook:(\S+):\s*(.+?)\s*-->/;

function parseDatabook(text) {
  let yamlStr, body;
  if (text.startsWith('---\n') || text.startsWith('---\r\n')) {
    // v1.1+ canonical: bare --- form
    const parts = text.split('---');
    yamlStr = parts[1];
    body = parts.slice(2).join('---');
  } else {
    // v1.0 accepted alternative: <script language="application/yaml"> form
    const sm = text.match(/<script[^>]+language=["']application\/yaml["'][^>]*>([\s\S]*?)<\/script>/i);
    if (sm) {
      const inner = sm[1].split('---');
      yamlStr = inner[1] || '';
      body = text.slice(text.indexOf('</script>') + 9);
    } else {
      return { frontmatter: null, blocks: [] };
    }
  }
  const frontmatter = yaml.load(yamlStr);
  const blocks = [];
  let m;
  BLOCK_RE.lastIndex = 0;
  while ((m = BLOCK_RE.exec(body)) !== null) {
    const meta = {}, payloadLines = [];
    for (const line of m[2].split('\n')) {
      const cm = line.match(META_RE);
      cm ? (meta[cm[1]] = cm[2]) : payloadLines.push(line);
    }
    blocks.push({ label: m[1], meta, content: payloadLines.join('\n') });
  }
  return { frontmatter, blocks };
}
```

**rdflib loading note:** rdflib cannot parse `.databook.md` files directly. Extract the Turtle block content first, then parse:

```python
import rdflib, io
db = parse_databook(open('my.databook.md').read())
turtle_blocks = [b for b in db['blocks'] if b['label'] in ('turtle', 'turtle12')]
g = rdflib.Graph()
for block in turtle_blocks:
    g.parse(io.StringIO(block['content']), format='turtle')
```

**Jena loading note:** Jena 6.0 (reference triplestore) handles RDF 1.2 natively. Use the `riot` command or the Jena API after extracting the block content.

---

## Manifests

A manifest DataBook describes a pipeline's dependency graph as RDF using the `build:` vocabulary.

### Build vocabulary

```turtle
@prefix build: <https://w3id.org/databook/ns#> .

# Classes
build:Target    # the desired pipeline output
build:Stage     # an intermediate DataBook
build:Source    # raw input with no DataBook dependencies
build:Manifest  # the manifest document itself

# Properties
build:dependsOn    # links Target/Stage to input DataBook IRIs
build:transformer  # links Stage to transformer type string
build:produces     # links Stage to output DataBook IRI
build:order        # integer ordering hint
build:outputType   # declares expected fence-label type of stage output (e.g. "turtle", "shacl")
build:inputType    # declares expected fence-label type of stage input
```

`build:outputType` enables pipeline validators to confirm type compatibility between stages at planning time. Always set it on `build:Stage` and `build:Target` nodes.

### Manifest block example

```
```manifest
<!-- databook:id: pipeline-manifest -->
@prefix build: <https://w3id.org/databook/ns#> .
@prefix db:    <https://example.org/databooks/> .

db:output-ontology-v1 a build:Target ;
    build:outputType "turtle" ;
    build:dependsOn db:shapes-v1, db:inference-rules-v1 .

db:shapes-v1 a build:Stage ;
    build:transformer "llm" ;
    build:outputType "shacl" ;
    build:dependsOn db:source-taxonomy-v1 .

db:inference-rules-v1 a build:Stage ;
    build:transformer "sparql" ;
    build:outputType "turtle" ;
    build:dependsOn db:source-taxonomy-v1 .

db:source-taxonomy-v1 a build:Source ;
    build:outputType "turtle" .
```
```

### Querying a manifest (SPARQL)

```sparql
PREFIX build: <https://w3id.org/databook/ns#>
SELECT ?affected WHERE {
    ?affected build:dependsOn+ <https://example.org/databooks/source-v1> .
}
```

---

## Transformer Libraries

A `transformer-library` DataBook catalogues named, reusable transforms (SPARQL CONSTRUCTs, XSLT stylesheets, prompt templates, etc.) each with a stable fragment IRI. Process stamps reference transforms by fragment IRI rather than embedding them inline.

### Frontmatter

```yaml
type: transformer-library
```

All other frontmatter fields are as for a standard DataBook.

### RDF catalogue block

```
```transformer-library
<!-- databook:id: transform-catalogue -->
@prefix build: <https://w3id.org/databook/ns#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix lib:   <https://example.org/databooks/transforms-v1#> .

lib:normalise-turtle a build:NamedTransform ;
    build:transformerType "sparql" ;
    build:inputType  "turtle" ;
    build:outputType "turtle" ;
    dct:title "Normalise Turtle prefixes and blank nodes"@en ;
    dct:created "2026-04-19"^^xsd:date .

lib:extract-shacl a build:NamedTransform ;
    build:transformerType "sparql" ;
    build:inputType  "turtle" ;
    build:outputType "shacl" ;
    dct:title "Extract SHACL shapes from OWL class definitions"@en ;
    dct:created "2026-04-19"^^xsd:date .
```
```

### Referencing a library transform in a process stamp

```yaml
process:
  transformer: "Normalise Turtle prefixes and blank nodes"
  transformer_type: library-transform
  transformer_iri: https://example.org/databooks/transforms-v1#normalise-turtle
```

### Additional build vocabulary for transformer libraries

| Term | Type | Description |
|---|---|---|
| `build:NamedTransform` | Class | A named, reusable transform entry |
| `build:transformerType` | Property | Transformer type string (values as per process stamp vocabulary) |
| `build:inputType` | Property | Expected fence-label type of input |
| `build:outputType` | Property | Expected fence-label type of output |

---

## Processor Registries

A `processor-registry` DataBook catalogues named processing services — SPARQL endpoints, LLM APIs, validation services — each with a stable fragment IRI and capability declaration. Process stamps reference processors symbolically, decoupling pipeline definitions from deployment details.

### Frontmatter

```yaml
type: processor-registry
```

### RDF catalogue block

```
```processor-registry
<!-- databook:id: processor-catalogue -->
@prefix build: <https://w3id.org/databook/ns#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix reg:   <https://example.org/databooks/processors-v1#> .

reg:jena-endpoint a build:Processor ;
    build:processorType "sparql" ;
    build:serviceIRI    <http://localhost:3030/ds/sparql> ;
    build:rdfVersion    "1.2" ;
    dct:title           "Apache Jena Fuseki 6.0 local endpoint"@en ;
    build:status        build:Active .

reg:claude-sonnet a build:Processor ;
    build:processorType "llm" ;
    build:serviceIRI    <https://api.anthropic.com/v1/messages> ;
    build:modelVersion  "claude-sonnet-4-6" ;
    dct:title           "Claude Sonnet 4.6 via Anthropic API"@en ;
    build:status        build:Active .
```
```

### Referencing a registry processor in a process stamp

```yaml
process:
  transformer: "Apache Jena Fuseki 6.0 local endpoint"
  transformer_type: registry-processor
  transformer_iri: https://example.org/databooks/processors-v1#jena-endpoint
```

### Additional build vocabulary for processor registries

| Term | Type | Description |
|---|---|---|
| `build:Processor` | Class | A named processor entry |
| `build:processorType` | Property | Transformer type string |
| `build:serviceIRI` | Property | IRI of the service endpoint or homepage |
| `build:rdfVersion` | Property | RDF version supported (for graph stores) |
| `build:modelVersion` | Property | Model version string (for LLM processors) |
| `build:status` | Property | `build:Active` / `build:Inactive` / `build:Deprecated` |
| `build:capabilityNote` | Property | Free-text note on capabilities or access requirements |

---

## Validation

Check these before finalising a DataBook:

**Metadata block structure:**
- [ ] Document opens with `---` on the first line
- [ ] YAML frontmatter closes with `---` before the first prose or heading
- [ ] No content before the opening `---`

**Required fields present:**
- [ ] `id` — stable IRI
- [ ] `title` — quoted if contains colons
- [ ] `type` — one of `databook`, `transformer-library`, `processor-registry`
- [ ] `version` — semver
- [ ] `created` — YYYY-MM-DD
- [ ] `process` block (if data was produced by a transformer)
- [ ] At least one fenced data block in body

**Graph metadata consistency:**
- [ ] `graph.triple_count` matches actual triple count in Turtle block
- [ ] `graph.rdf_version: "1.2"` set if any `~ reifier` syntax used
- [ ] `graph.reification: true` set if any reification annotations used

**Block conventions:**
- [ ] Each data block has a `<!-- databook:id: kebab-case -->` as first line
- [ ] Block IDs are unique within the document
- [ ] Encrypted blocks have matching entries in `encryption.blocks`
- [ ] Manifest/library/registry blocks use `build:` prefix with canonical namespace `https://w3id.org/databook/ns#`

**Parser compatibility notes to include in `graph.validator_note` when relevant:**
- If using RDF 1.2 reification: "Requires Jena 6.0 for full reification support. rdflib: load base graph, annotations silently ignored."
- If using `turtle12` label: signal that RDF 1.2 parser required

**Common errors:**
- Content appearing before the opening `---` → frontmatter not detected by parsers
- Missing closing `---` after frontmatter → body content parsed as YAML
- YAML special characters in `title` not quoted → frontmatter parse error
- `type` value not a recognised DataBook type → parsers will not identify document class
- `databook:id` comment not on first line of block → may not be parsed as metadata
- Old namespace `https://databook.org/ns/build#` in manifest/library/registry blocks → update to `https://w3id.org/databook/ns#`
- `<script language="application/yaml">` wrapper (canonical in v1.0; demoted to accepted alternative in v1.1) → both forms are valid; parsers must accept both. Bare `---` is canonical for v1.1+ and renders correctly in GitHub and Claude.

---

## Admonitions

DataBook prose uses blockquote admonitions with bold keywords:

```markdown
> **Note:** Standard parsers need the block content extracted before loading.

> **Warning:** Encryption auth tag mismatch is a security failure — do not load.

> **Deprecated:** `holon:blockId` is deprecated. Use `databook:id` instead.

> **Important:** Each `---` delimiter must be on its own line with no trailing whitespace.
```

Recognised keywords: `Note`, `Warning`, `Deprecated`, `Example`, `See also`, `Important`

---

## Parameterised Queries

SPARQL blocks may declare substitutable parameters with `databook:param`, enabling DataBooks to function as named query APIs. Clients resolve a block by fragment IRI, substitute parameter values, and execute without modifying the document.

### `databook:param` syntax

```
<!-- databook:param: VARNAME [type=TYPE] [default=DEFAULT] [required] -->
```

The SPARQL `VALUES` clause is the substitution target — it also serves as the default when no value is supplied:

````
```sparql
<!-- databook:id: select-by-type -->
<!-- databook:param: entityType type=IRI default=ex:Person -->
PREFIX ex:   <https://example.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?entity ?label WHERE {
    VALUES ?entityType { ex:Person }
    ?entity a ?entityType ;
            rdfs:label ?label .
}
ORDER BY ?label
```
````

Required parameters use the `required` flag with an empty VALUES clause:

```
<!-- databook:param: resourceId type=IRI required -->
VALUES ?resourceId { }
```

**Substitution is text-level:** client locates `VALUES ?varname { ... }` and replaces the binding set. Multiple values use normal multi-binding VALUES syntax.

**Block naming convention:**

| Prefix | Role |
|---|---|
| `select-` | SELECT documentation query |
| `describe-` | DESCRIBE documentation query |
| `construct-` | CONSTRUCT transformation spec |
| `validate-` | ASK/SELECT integrity check |
| `update-` | SPARQL Update lifecycle operation |

---

## LLM Integration

DataBooks are natively legible and producible by large language models. This section covers both directions: consuming a DataBook as LLM input, and producing a DataBook as LLM output.

### Why DataBooks Work Well as LLM Input

A raw RDF serialisation (Turtle, N-Triples, JSON-LD) gives a model the data but no map for it. A DataBook gives a model:

- **Prose context** — what this data represents, why it exists, how it should be used
- **SHACL shapes** — what valid data looks like, enabling the model to validate and correct
- **Provenance stamp** — who produced the data, when, and how — enabling the model to reason about trustworthiness
- **Parameterised queries** — standing queries the model can execute or adapt without modifying the document

Always pass the full DataBook, not just an extracted block, when asking a model to reason about the data. The prose and metadata are load-bearing context, not decoration.

### The `prompt` Command

`databook prompt` sends a DataBook (or a specific block within it) to the Anthropic API and wraps the response in a new, provenance-stamped output DataBook.

```bash
# Send the full DataBook as context
databook prompt source.databook.md --prompt "Analyse the sensor readings for anomalies" -o analysis.databook.md

# Send a specific block as context
databook prompt source.databook.md --prompt-block analysis-prompt -o analysis.databook.md

# Bare prompt — no source DataBook required
databook prompt --prompt "Generate a SHACL shapes graph for blood pressure readings" -o bp-shapes.databook.md

# With variable interpolation from a prompt block
databook prompt source.databook.md --prompt-block sensor-query --interpolate --param sensorType=temperature -o result.databook.md
```

**Key flags:**

| Flag | Description |
|---|---|
| `--prompt "..."` | Inline prompt string |
| `--prompt-file path` | Read prompt from a plain text file |
| `--prompt-block id` | Use a fenced `prompt` block from the source DataBook (supports `{{variable}}` interpolation) |
| `--interpolate` | Enable `{{variable}}` substitution in prompt blocks |
| `--param name=value` | Supply interpolation values (repeatable) |
| `--model` | Override model (default: `claude-sonnet-4-6`) |
| `--max-tokens` | Override token limit (default: 4096) |
| `-o path` | Output DataBook path |

Requires `ANTHROPIC_API_KEY` environment variable.

### Structure of the Output DataBook

The output DataBook from `databook prompt` has a full provenance process stamp recording the LLM interaction:

```yaml
process:
  transformer: "claude-sonnet-4-6"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-4-6
  timestamp: 2026-04-25T14:32:00Z
  inputs:
    - iri: <source DataBook IRI>
      block_id: <block addressed, if any>
      role: primary
  agent:
    name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: orchestrator
```

The response block label is inferred from content type: `turtle` for RDF graph output, `sparql` for query output, `shacl` for shapes output, `text` for prose output.

### Producing DataBooks as LLM Output

When asked to *generate* a DataBook (rather than analyse an existing one), follow this sequence:

1. **Write the data blocks first** — get the payload right before writing metadata
2. **Count triples if Turtle** — populate `graph.triple_count` and `graph.subjects` accurately
3. **Build the frontmatter** — use the full required field set: `id`, `title`, `type`, `version`, `created`, `process`
4. **Set `transformer_type: llm`** and `transformer_iri` to the current model's API IRI in the process stamp
5. **Add prose sections** — overview, usage notes, validation notes around the blocks
6. **Run the validation checklist** before finalising

The `id` IRI should be stable and unique. If not supplied, construct from `urn:databook:{slug}:{date}` or `https://w3id.org/databook/{slug}-v{version}`.

### Bidirectional Pipeline Pattern

The full LLM-integrated DataBook pipeline is:

```
databook create   source.databook.md           # ingest raw data
databook push     source.databook.md -d ds     # load to triplestore
databook pull     source.databook.md#query -d ds --wrap -o result.databook.md
databook prompt   result.databook.md --prompt "Analyse this" -o analysis.databook.md
```

Each step produces a DataBook. Each DataBook carries a provenance stamp. The chain from raw data to LLM analysis is fully traceable without any out-of-band logging.

### Writing `prompt` Blocks in DataBooks

A fenced `prompt` block embedded in a DataBook serves as a standing, reusable LLM query — analogous to a SPARQL query block but targeting a language model rather than a triplestore.

````markdown
```prompt
<!-- databook:id: anomaly-analysis -->
<!-- databook:param: sensorType type=string default=temperature -->
You are analysing sensor readings from a {{sensorType}} sensor array.
Identify any readings that fall outside the expected range defined in
the accompanying SHACL shapes block (shapes#sensor-constraints).
Return your findings as a structured list with IRI, observed value,
and constraint violated.
```
````

Prompt blocks support the same `databook:id` fragment addressing as data blocks, enabling `databook prompt source.md --prompt-block anomaly-analysis`.

---

## HGA Integration Notes

DataBooks are the portable artifact layer of the Holonic Graph Architecture:

| DataBook layer | HGA layer |
|---|---|
| YAML metadata block | Context layer (L3) — boundary conditions and identity |
| Fenced data blocks | Domain layer (L2) — the graph reality |
| Prose | Scene layer (L1) — human projection |

A pipeline of DataBooks is a holarchy: each DataBook is a holon consuming parent holons and producing child holons. The manifest DataBook is the holonic boundary condition for the pipeline as a whole. Transformer libraries and processor registries are holonic infrastructure layers — reusable holons serving the pipeline's operational needs rather than carrying domain data directly.

Key namespace for HGA DataBooks: `https://ontologist.io/ns/holon#`  
Module prefixes: `holon:`, `portal:`, `agent:`, `session:`
