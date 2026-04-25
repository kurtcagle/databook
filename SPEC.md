# DataBook Format Reference

**Version:** 1.1  
**Status:** Canonical specification  
**Authors:** Kurt Cagle, Chloe Shannon  
**Last revised:** 2026-04-25  
**Canonical namespace:** `https://w3id.org/databook/ns#`  
**Repository:** `https://github.com/kurtcagle/databook`

---

## Contents

1. [What a DataBook Is](#1-what-a-databook-is)
2. [When to Use a DataBook](#2-when-to-use-a-databook)
3. [File Conventions](#3-file-conventions)
4. [Document Structure](#4-document-structure)
5. [YAML Frontmatter — Full Property Reference](#5-yaml-frontmatter--full-property-reference)
6. [Fenced Data Blocks](#6-fenced-data-blocks)
7. [Block Identifiers and Addressability](#7-block-identifiers-and-addressability)
8. [Parameterised Queries](#8-parameterised-queries)
9. [Inline Markup](#9-inline-markup)
10. [The Process Stamp](#10-the-process-stamp)
11. [The Manifest and Dependency Graph Pattern](#11-the-manifest-and-dependency-graph-pattern)
12. [Transformer Libraries and Processor Registries](#12-transformer-libraries-and-processor-registries)
13. [Encryption Profile](#13-encryption-profile)
14. [PROV-O Alignment](#14-prov-o-alignment)
15. [Parser Behaviour and Graceful Degradation](#15-parser-behaviour-and-graceful-degradation)
16. [The Holonic Connection](#16-the-holonic-connection)
17. [Complete Annotated Example](#17-complete-annotated-example)
18. [Quick Reference](#18-quick-reference)
19. [Changelog](#19-changelog)

---

## 1. What a DataBook Is

A DataBook is a Markdown document structured to serve simultaneously as a human-readable document, a typed data container, and a self-describing semantic artifact. It is defined by three layers working in concert:

1. A **YAML frontmatter block** carrying document identity, processing instructions, and provenance metadata.
2. One or more **typed fenced blocks** carrying data payloads — graph data (Turtle, JSON-LD), queries (SPARQL), prompts, manifests, or other typed content.
3. **Prose sections** providing human-readable context, documentation, and explanation.

The combination is greater than the sum of its parts. A raw Turtle file is portable but not self-describing. A JSON-LD document is more structured but still mute about intent, authorship, and processing history. A SPARQL endpoint is powerful but heavyweight. The DataBook fills the gap: it travels with its own metadata, declares what it is for, carries its own provenance, and remains readable to both humans and machines without consulting an external registry.

The most useful frame for DataBooks is the **microdatabase** — a data container appropriate for content that is too small and too task-specific to warrant indexed triple-store infrastructure, but too structured and too important to be treated as a plain file.

DataBooks are not a replacement for triple stores, databases, or API endpoints. They are a design pattern for the large class of knowledge work that falls below the indexing threshold: pipeline intermediates, configuration graphs, validation shapes, taxonomy fragments, session records, and archival snapshots.

---

## 2. When to Use a DataBook

Use a DataBook when the data is:

- Small enough that loading it into a persistent triple store adds overhead that outweighs the query benefit
- Structured enough that a plain file loses important metadata or typing
- Intended to travel — to be passed between processes, stored, versioned, shared, or archived
- Valuable as a human-readable document as well as a machine-processable artifact

A rough scale heuristic:

| Data Scale | Appropriate Store | DataBook? |
| --- | --- | --- |
| < 10K triples, task-specific | DataBook | Yes |
| < 10K triples, persistent reference | DataBook or named graph | Probably |
| 10K–1M triples, frequently queried | Triple store | No |
| > 1M triples | Indexed triple store | No |
| Pipeline intermediate, any size | DataBook for stage output | Yes |
| Archival snapshot, infrequently queried | DataBook or graph archive | Yes |

The boundary is a design judgement about indexing overhead, not a hard rule. The key insight is that "not worth indexing" does not mean "not worth structuring." DataBooks provide structure without infrastructure.

Do not use a DataBook for: large-scale production graph data, real-time query endpoints, data requiring frequent partial updates, or content that will be consumed exclusively by systems that have no DataBook parser.

---

## 3. File Conventions

### 3.1 Extension

DataBooks use the `.databook.md` double extension. The `.md` suffix ensures compatibility with Markdown renderers (GitHub, Obsidian, VS Code). The `.databook` infix signals DataBook-aware tooling. Either component alone is acceptable in contexts where one interpretation is obvious, but the double extension is canonical.

```
my-ontology-fragment.databook.md   # canonical
my-ontology-fragment.md            # acceptable in markdown-first contexts
```

### 3.2 Naming

DataBook filenames should be kebab-case and should reflect the content identity, not the creation date. Versioning belongs in the frontmatter `version` field and, if needed, in the IRI; it should not be primary in the filename.

```
colour-taxonomy-v2.databook.md     # good
2026-04-25-notes.md                # avoid — date-as-name ages poorly
```

### 3.3 IRI identity

Every DataBook should carry a stable, dereferenceable IRI in the `id` frontmatter field. The file system path and the IRI are separate concerns. The IRI is the persistent identity; the filename is a local convenience.

### 3.4 Versioning semantics

The `version` field follows semantic versioning (`MAJOR.MINOR.PATCH`):

- **PATCH** — prose corrections, metadata updates, formatting changes. Block content and structure unchanged.
- **MINOR** — new blocks added; existing block IDs and content preserved. Downstream consumers referencing specific block fragment IRIs remain valid.
- **MAJOR** — breaking change. Existing `databook:id` values may be removed or renamed. Consumers pinning a specific version IRI should not silently upgrade across a major boundary.

When a DataBook is cited in another DataBook's `process.inputs`, the citing IRI should include the version if pinning is required:

```yaml
inputs:
  - iri: https://example.org/databooks/taxonomy-v2.1.0
    role: primary
```

### 3.5 Reference implementation

The canonical reference implementation of the DataBook format is the DataBook CLI, a Node.js command-line tool. Its source is maintained in the `implementations/js/` directory of the `https://github.com/kurtcagle/databook` repository. The CLI supports all commands documented in the accompanying CLI specification DataBooks.

---

## 4. Document Structure

A DataBook has two zones, in this order:

```
[YAML frontmatter block]
[Prose and fenced blocks, interleaved]
```

The frontmatter block is mandatory and must come first. The prose and fenced block zone is mandatory and must contain at least one fenced data block. Pure prose documents without a data block are not DataBooks; use plain Markdown.

### 4.1 The YAML frontmatter block

The canonical form uses a `---`-delimited YAML block at the start of the document — the standard Markdown frontmatter convention supported by GitHub, Obsidian, Jekyll, and most Markdown-aware tooling:

```markdown
---
id: https://example.org/databooks/my-databook-v1
title: "My DataBook Title"
type: databook
version: 1.0.0
created: 2026-04-25
---

## Overview

...
```

The `---` delimiter must appear on its own line. No whitespace or blank lines may precede the opening `---`. The YAML content is all content between the opening and closing `---` lines.

**Alternative form — `<script>` wrapper:** An alternative form wraps the `---`-delimited content in an HTML `<script language="application/yaml">` element. This was the canonical form in v1.0 and remains a fully supported alternative:

```markdown
<script language="application/yaml">

---
id: https://example.org/databooks/my-databook-v1
title: "My DataBook Title"
type: databook
version: 1.0.0
created: 2026-04-25
---

</script>
```

The `<script>` form may be preferred in environments where frontmatter should be suppressed from rendered display (some HTML renderers treat `<script>` content as inert). However, it does not render correctly in GitHub Markdown or Claude's Markdown renderer, and standard Markdown frontmatter parsers will not extract it. The bare `---` form is therefore canonical for v1.1 and later. Parsers must accept both forms.

### 4.2 Ordering conventions within the body

There are no mandatory ordering rules for prose and fenced blocks in the body zone. The following ordering is conventional and recommended:

1. **Overview prose** — what this DataBook contains, for whom, and why.
2. **Primary data block(s)** — the main payload (Turtle, JSON-LD, etc.).
3. **Query blocks** — SPARQL or other query language blocks for common operations on the primary data.
4. **Usage prose** — how to load, validate, query, or extend the data.
5. **Validation notes** — shape compliance, known constraints, edge cases.
6. **Manifest block** (if present) — dependency graph for pipeline use.

---

## 5. YAML Frontmatter — Full Property Reference

The frontmatter block is delimited by `---` on its own line at the start and end. All content between the delimiters must be well-formed YAML.

All properties are organised into three groups: **identity** (required), **descriptive** (recommended), and **operational** (situational).

### 5.1 Identity properties (required)

```yaml
id: https://example.org/databooks/my-databook-v1
title: "Human-readable title for the DataBook"
type: databook
version: 1.0.0
created: 2026-04-25
```

| Property | Type | Description |
| --- | --- | --- |
| `id` | URI/IRI | The stable identity IRI for this DataBook. Should be dereferenceable. Must be globally unique. |
| `title` | string | Human-readable title. Quote if it contains colons or special characters. |
| `type` | string | The DataBook document type. `databook` is the standard value. See Section 12 for `transformer-library` and `processor-registry`. |
| `version` | semver string | Semantic version of this DataBook instance. Use `1.0.0` for initial publication. |
| `created` | ISO date | Creation date in `YYYY-MM-DD` format. |

### 5.2 Descriptive properties (recommended)

```yaml
author:
  - name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator
  - name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: transformer

license: CC-BY-4.0

domain: https://example.org/ontology/
subject:
  - knowledge graph engineering
  - SHACL validation

description: >
  One or more sentences describing the scope, purpose, and
  intended audience of this DataBook.
```

| Property | Type | Description |
| --- | --- | --- |
| `author` | sequence | One or more author objects. Each should carry `name` (string), `iri` (IRI), and `role` (string). |
| `license` | string or IRI | SPDX identifier (e.g., `CC-BY-4.0`, `MIT`) or a full IRI pointing to the license document. |
| `domain` | IRI | The primary ontology or vocabulary namespace this DataBook extends or operates within. |
| `subject` | sequence of strings | Free-text subject tags for discovery. |
| `description` | string | Short abstract suitable for catalogue display. Distinct from body prose. |

#### Author role vocabulary

| Role | Meaning |
| --- | --- |
| `orchestrator` | The human or agent directing the overall production of the DataBook. |
| `transformer` | The process or agent that performed the primary data transformation. |
| `reviewer` | A human reviewer who validated the content after production. |
| `editor` | A human editor who revised prose or structure without changing the data. |
| `contributor` | Any other contributing role not covered above. |

### 5.3 Graph metadata (recommended when the DataBook contains graph data)

```yaml
graph:
  namespace: https://example.org/my-namespace/
  named_graph: https://example.org/databooks/my-databook-v1#graph
  triple_count: 127
  subjects: 18
  rdf_version: "1.2"
  turtle_version: "1.2"
  reification: true
  validator_note: >
    Optional human-readable note about parser requirements or
    known validation behaviour.
```

| Property | Type | Description |
| --- | --- | --- |
| `namespace` | IRI | The primary namespace of entities defined in the data block. |
| `named_graph` | IRI | The IRI of the named graph this block should be loaded into. By convention, `{document-id}#graph`. |
| `triple_count` | integer | Number of triples in the primary data block. Used for quick integrity verification. |
| `subjects` | integer | Number of distinct subject IRIs. |
| `rdf_version` | string | The RDF version of the data. `"1.1"` or `"1.2"`. |
| `turtle_version` | string | The Turtle serialisation version. `"1.1"` or `"1.2"`. RDF 1.2 introduces the `~ reifier {| ... |}` annotation syntax. |
| `reification` | boolean | `true` if the data block uses RDF 1.2 reification annotations. Signals that a 1.2-capable parser is required for full fidelity. |
| `validator_note` | string | Free-text note about validation requirements or known parser limitations. |

### 5.4 Shape compliance (situational)

```yaml
shapes:
  - https://example.org/shapes/PersonShape
  - https://example.org/shapes/OrganisationShape
```

`shapes` is a sequence of IRI strings identifying the SHACL NodeShapes that the data in this DataBook is expected to satisfy. This is informational (not enforced at the DataBook level) but enables downstream validators to locate the correct shapes without inspecting the data.

### 5.5 Process stamp (required when data was produced by any transformer)

See Section 10 for full documentation. Summary form:

```yaml
process:
  transformer: "Claude Sonnet 4.6"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-4-6
  inputs:
    - iri: https://example.org/databooks/source-v1
      role: primary
  timestamp: 2026-04-25T14:32:00Z
  agent:
    name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: orchestrator
  note: Optional human-readable note about the transformation.
```

### 5.6 Encryption manifest (situational — encryption profile)

See Section 13 for full documentation. The `encryption` key is reserved. Parsers that do not support the encryption profile must treat encrypted blocks as opaque and must not attempt to parse them.

### 5.7 Full frontmatter property table

| Property | Required | Type | Notes |
| --- | --- | --- | --- |
| `id` | Required | IRI | Stable document identity |
| `title` | Required | string | Human-readable title |
| `type` | Required | string | `databook`, `transformer-library`, or `processor-registry` |
| `version` | Required | semver | e.g., `1.0.0` |
| `created` | Required | ISO date | `YYYY-MM-DD` |
| `author` | Recommended | sequence | `name`, `iri`, `role` per entry |
| `license` | Recommended | string/IRI | SPDX or license IRI |
| `domain` | Recommended | IRI | Primary ontology namespace |
| `subject` | Recommended | string sequence | Free-text tags |
| `description` | Recommended | string | Short abstract |
| `graph` | Recommended | object | See §5.3; RDF DataBooks only |
| `graph.namespace` | Situational | IRI | Primary entity namespace |
| `graph.named_graph` | Situational | IRI | Target named graph IRI |
| `graph.triple_count` | Situational | integer | Integrity check |
| `graph.subjects` | Situational | integer | Entity count |
| `graph.rdf_version` | Situational | string | `"1.1"` or `"1.2"` |
| `graph.turtle_version` | Situational | string | `"1.1"` or `"1.2"` |
| `graph.reification` | Situational | boolean | `true` if RDF 1.2 reification used |
| `graph.validator_note` | Situational | string | Parser/validation notes |
| `shapes` | Situational | IRI sequence | SHACL shapes to validate against |
| `process` | Required if transformed | object | See §10 |
| `process.transformer` | Required in process | string | Human-readable name/label |
| `process.transformer_type` | Required in process | string | Vocabulary: see §10.3 |
| `process.transformer_iri` | Recommended in process | IRI | Specific model/tool IRI |
| `process.inputs` | Required in process | sequence | `iri` and `role` per entry |
| `process.output_format` | Optional | string | Fence-label vocabulary value for output format |
| `process.output_media_type` | Optional | string | MIME type when fence label is ambiguous |
| `process.output` | Optional | object | Output destination(s); absent means stdout |
| `process.output.graph` | Optional | IRI | Target named graph IRI |
| `process.output.url` | Optional | URL | HTTP upload endpoint |
| `process.output.file` | Optional | path | Filesystem path; relative to DataBook location |
| `process.outputs` | Optional | sequence | Multiple simultaneous destinations; overrides `output` |
| `process.timestamp` | Recommended in process | ISO datetime | Production time |
| `process.agent` | Recommended in process | object | `name`, `iri`, `role` |
| `process.note` | Optional | string | Free-text note |
| `encryption` | Situational | object | See §13; key reserved in core |
| `encryption.profile` | Required if encrypted | string | Encryption profile identifier |
| `encryption.key_id` | Required if encrypted | IRI | Key reference IRI |
| `encryption.scope` | Required if encrypted | string | `full`, `selective`, or `none` |
| `encryption.blocks` | Required if selective | sequence | Per-block encryption manifests |

Properties not listed here may be used freely. Parser implementations should ignore unrecognised frontmatter keys and should not raise errors on encountering them.

---

## 6. Fenced Data Blocks

Fenced data blocks carry typed content payloads. They use the standard Markdown triple-backtick fence syntax, extended with a type label after the opening fence:

````
```turtle
@prefix ex: <https://example.org/> .
ex:Thing a ex:Class .
```
````

The type label is the block's **media type hint** — it tells parsers and renderers how to interpret the block's content. It is not a MIME type string; it is a short label from the recognised vocabulary below.

### 6.1 Recognised block type labels

#### Graph data

| Label | Interpretation | MIME type |
| --- | --- | --- |
| `turtle` | RDF Turtle 1.1 | `text/turtle` |
| `turtle12` | RDF Turtle 1.2 (with reification annotation syntax) | `text/turtle; version=1.2` |
| `json-ld` | JSON-LD 1.1 | `application/ld+json` |
| `trig` | TriG (named graphs) | `application/trig` |
| `n-triples` | N-Triples | `application/n-triples` |
| `n-quads` | N-Quads | `application/n-quads` |

When a block uses RDF 1.2 reification annotations (`~ reifier {| ... |}`), use the `turtle12` label or set `graph.reification: true` in frontmatter, or both.

#### Query and constraint

| Label | Interpretation |
| --- | --- |
| `sparql` | SPARQL 1.1 / 1.2 query (SELECT, CONSTRUCT, ASK, DESCRIBE) |
| `sparql-update` | SPARQL 1.1 Update |
| `shacl` | SHACL shapes (typically Turtle serialisation) |

#### Transformation and configuration

| Label | Interpretation |
| --- | --- |
| `xslt` | XSLT 3.0 transformation |
| `xquery` | XQuery 3.1 |
| `jq` | jq transformation expression |

#### Prose and prompt

| Label | Interpretation |
| --- | --- |
| `prompt` | A prompt template intended for LLM consumption. May include `{{variable}}` interpolation markers. |
| `prompt-system` | A system prompt template. |
| `prompt-user` | A user turn template. |

#### Manifest and build

| Label | Interpretation |
| --- | --- |
| `manifest` | A build manifest — an RDF graph describing DataBook pipeline dependencies. See Section 11. |
| `transformer-library` | A catalogue of named, reusable transformer definitions as RDF. See Section 12.1. |
| `processor-registry` | A registry of named processors with IRI and capability declarations as RDF. See Section 12.2. |

#### Encrypted content (encryption profile)

| Label | Interpretation |
| --- | --- |
| `encrypted` | Opaque base64-encoded ciphertext. Media type given in `encryption.blocks[n].encrypted_media_type`. |
| `encrypted-turtle` | Encrypted Turtle block. |
| `encrypted-jsonld` | Encrypted JSON-LD block. |

Parsers not supporting the encryption profile must treat encrypted blocks as opaque and skip them without error.

#### Imperative code (display by default)

Standard code fence labels (`python`, `javascript`, `typescript`, `bash`, `r`, `sql`, etc.) are permitted and carry their normal Markdown meaning. They are **display blocks** by default — rendered for human reading but not treated as DataBook data payloads. To opt a code block into executable mode, set `databook:executable: true` (see §6.2).

> **Warning:** Executable imperative code is a meaningfully different security surface from declarative queries. DataBook runners must require explicit user confirmation before executing any imperative block and must sandbox execution where possible.

#### General / fallback

Any fence label not listed in this vocabulary is treated by a DataBook-aware parser as a **display block** — shown to human readers but not processed as a data payload. This ensures forward compatibility: future labels and extension labels render gracefully in existing parsers.

### 6.2 Block-level metadata via HTML comments

Additional metadata for a specific block is attached using HTML comment lines immediately following the opening fence:

````
```turtle
<!-- databook:id: capabilities-block -->
<!-- databook:graph: https://example.org/my-databook#capabilities -->
<!-- databook:label: Capabilities taxonomy fragment -->
@prefix ex: <https://example.org/> .
ex:Thing a ex:Class .
```
````

The `databook:` prefix on comment keys is the reserved namespace for DataBook block metadata. Comment lines using this prefix before any non-comment content in the block are metadata lines; they must not be passed to the block's parser. Any unrecognised `databook:` key must be ignored without error.

Recognised block-level comment keys:

| Key | Description |
| --- | --- |
| `databook:id` | Block identifier (see Section 7) |
| `databook:graph` | Named graph IRI for this block; overrides `graph.named_graph` in frontmatter |
| `databook:label` | Human-readable label for this specific block |
| `databook:base` | Base IRI for relative IRI resolution within this block |
| `databook:import` | IRI of another DataBook or graph whose namespace prefixes should be in scope |
| `databook:encoding` | Character encoding if not UTF-8 |
| `databook:executable` | `true` opts an imperative code block into executable mode |
| `databook:runtime` | Declares the execution environment required (e.g., `python>=3.11`, `node>=20`) |
| `databook:param` | Declares a substitutable parameter for query blocks (see §8) |

For encrypted blocks, additional keys are defined in the encryption profile (see Section 13):

| Key | Description |
| --- | --- |
| `databook:encrypted-media-type` | The MIME type of the plaintext content |
| `databook:key-ref` | IRI of the encryption key or key manifest entry |

---

## 7. Block Identifiers and Addressability

A DataBook is a single file. Individual blocks within it can be addressed independently using block identifiers.

### 7.1 Setting a block identifier

Set the identifier via the `databook:id` comment key in the block header:

````
```turtle
<!-- databook:id: taxonomy-block -->
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
...
```
````

Block identifiers are document-scoped strings. They must be unique within a DataBook. Use kebab-case.

### 7.2 Fragment addressing

A specific block within a DataBook is addressed by appending a fragment identifier to the DataBook's IRI:

```
https://example.org/databooks/my-databook-v1#taxonomy-block
```

This aligns with standard URL fragment semantics. A DataBook-aware client resolving this IRI should fetch the document and locate the block with the matching `databook:id`.

Fragment addressing enables DataBooks to function as **named query catalogs**: each `sparql` block with a `databook:id` is a stable, addressable query endpoint. A client resolves the document IRI, extracts the block matching the fragment, and executes it against a nominated data source.

### 7.3 Referencing blocks from frontmatter

The `process.inputs` sequence and the `encryption.blocks` sequence both reference blocks by their `databook:id` value. This is how the frontmatter coordinates with specific blocks when a DataBook contains more than one data payload.

### 7.4 Cross-document block references

The `databook:import` comment key allows a block to declare that it depends on content from another DataBook, identified by IRI. A parser may use this to pre-load prefix declarations or graph context:

````
```turtle
<!-- databook:id: instances-block -->
<!-- databook:import: https://example.org/databooks/base-shapes-v1 -->
ex:MyInstance a ex:MyClass .
```
````

---

## 8. Parameterised Queries

SPARQL blocks (and other query blocks that support variable binding) may declare substitutable parameters using the `databook:param` comment key. This enables DataBooks to function as **named query APIs**: clients resolve a block by fragment IRI, substitute parameter values, and execute — without modifying the DataBook itself.

### 8.1 The VALUES clause as parameter slot

The SPARQL `VALUES` clause is the natural parameter mechanism. A `VALUES` clause with a single binding serves as both the default value (valid SPARQL if unsubstituted) and the substitution target:

````
```sparql
<!-- databook:id: select-by-type -->
<!-- databook:param: entityType type=IRI default=ex:Person -->
PREFIX ex: <https://example.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?entity ?label WHERE {
    VALUES ?entityType { ex:Person }
    ?entity a ?entityType ;
            rdfs:label ?label .
}
ORDER BY ?label
```
````

### 8.2 `databook:param` syntax

```
<!-- databook:param: VARNAME [type=TYPE] [default=DEFAULT] [required] -->
```

| Field | Description |
| --- | --- |
| `VARNAME` | The SPARQL variable name (without `?`). Must match a `VALUES` clause in the query body. |
| `type` | Expected node kind: `IRI`, `xsd:string`, `xsd:integer`, `xsd:decimal`, `xsd:date`, `xsd:boolean`, or any XSD datatype. Optional; aids client-side validation. |
| `default` | The default value used when no substitution is provided. May be a prefixed name, a full IRI in angle brackets, or a quoted literal. |
| `required` | Flag indicating the parameter has no default and must be supplied by the caller. |

Multiple `databook:param` declarations are permitted, one per variable.

### 8.3 Required parameters

A parameter with no default is declared with the `required` flag and an empty VALUES binding set:

````
```sparql
<!-- databook:id: select-by-id -->
<!-- databook:param: resourceId type=IRI required -->
PREFIX ex: <https://example.org/>

SELECT ?p ?o WHERE {
    VALUES ?resourceId { }
    ?resourceId ?p ?o .
}
```
````

An empty `VALUES` binding produces no results when unsubstituted, signalling clearly that a value must be provided.

### 8.4 Client substitution

Parameter substitution is **text-level**: a client locates the `VALUES ?varname { ... }` clause and replaces the binding set with the caller-supplied value(s). The substituted query is then executed against the target endpoint. Clients must escape IRI and literal values appropriately before substitution.

Multi-valued parameters use the natural multi-binding VALUES syntax:

```sparql
VALUES ?entityType { ex:Person ex:Organisation }
```

### 8.5 Naming conventions for query blocks

By convention, SPARQL block `databook:id` values use a prefix that reflects the query role:

| Prefix | Role |
| --- | --- |
| `select-` | Documentation query (SELECT) |
| `describe-` | Documentation query (DESCRIBE) |
| `construct-` | Transformation specification (CONSTRUCT) |
| `validate-` | Integrity validator (ASK or SELECT) |
| `update-` | Lifecycle operation (sparql-update) |

These conventions are not normative but are relied upon by tools that auto-discover query blocks.

---

## 9. Inline Markup

DataBook prose supports standard Markdown inline markup. Three additional conventions apply within DataBook prose.

### 9.1 IRI references

Any IRI in prose that refers to an entity defined in an attached data block should be rendered as a code span for clarity and machine parseability:

```markdown
The concept `skos:ConceptScheme` is defined in the primary data block below.
```

### 9.2 Block cross-references

Reference a specific block within the same document using the fragment convention in a Markdown link:

```markdown
See the [taxonomy block](#taxonomy-block) for the full hierarchy.
```

Reference a block in another DataBook:

```markdown
This DataBook extends the [base shapes](https://example.org/databooks/base-shapes-v1#shapes-block).
```

### 9.3 Admonition blocks

DataBooks may use admonition-style blockquotes to flag important information for readers. The convention uses a bold keyword as the first word of the blockquote:

```markdown
> **Note:** RDF 1.2 reification syntax requires Jena 6.0 or equivalent.

> **Warning:** The `encryption.blocks` sequence must be complete before
> any encrypted block appears in the document body.

> **Deprecated:** The `holon:blockId` comment key was used in earlier
> drafts. Use `databook:id` in all new DataBooks.
```

Recognised admonition keywords: `Note`, `Warning`, `Deprecated`, `Example`, `See also`, `Important`.

---

## 10. The Process Stamp

The process stamp is the DataBook's provenance record. It documents what kind of process produced the data, what inputs it operated on, and who or what was responsible. It does not guarantee reproducibility — it provides the forensic trail needed to assess, audit, and if necessary re-run a pipeline stage.

The process stamp belongs in the `process` key of the YAML frontmatter. It is required whenever the DataBook was produced by any transformer (including human authoring). A DataBook without a process stamp is implicitly asserting that its provenance is unknown, which is worse than an imprecise stamp.

### 10.1 Full process stamp structure

```yaml
process:
  transformer: "Claude Sonnet 4.6"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-4-6
  inputs:
    - iri: https://example.org/databooks/source-taxonomy-v2
      role: primary
      description: "Source taxonomy fragment used as primary input"
    - iri: https://example.org/databooks/shacl-shapes-v1
      role: constraint
      description: "SHACL shapes constraining the output structure"
    - iri: urn:session:30ec792c-0e7c-44ca-8fd3-9cbee234d3bd
      role: evidence
      description: "Telemetry session used as evidence basis"
  output_format: turtle
  output_media_type: text/turtle
  output:
    graph: https://example.org/graphs/taxonomy-reshaped
    url: https://store.example.org/databook/upload
    file: ./build/taxonomy-reshaped.ttl
  timestamp: 2026-04-25T14:32:00Z
  agent:
    name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: orchestrator
  note: >
    Optional free-text note. Use for anything that aids interpretation
    of the stamp but doesn't fit the structured fields.
```

### 10.2 Process stamp properties

| Property | Required | Description |
| --- | --- | --- |
| `transformer` | Required | Human-readable name or label for the transformer. |
| `transformer_type` | Required | Controlled vocabulary value (see §10.3). |
| `transformer_iri` | Recommended | Stable IRI identifying the specific transformer instance. |
| `inputs` | Required | Sequence of input records. Each must carry `iri`. |
| `inputs[n].iri` | Required | The IRI of the input DataBook, graph, or resource. |
| `inputs[n].role` | Recommended | The role the input played. See §10.4. |
| `inputs[n].description` | Optional | Human-readable description of the input. |
| `output_format` | Optional | Fence-label vocabulary value for the format the transformer produces (e.g., `turtle`, `json-ld`, `shacl`). Defaults to `stdout` when absent. |
| `output_media_type` | Optional | MIME type of the output, for precision when the fence label alone is ambiguous. |
| `output` | Optional | Object declaring named destinations for the transformer output. Absent means stdout. |
| `output.graph` | Optional | IRI of the named graph into which the output should be loaded. |
| `output.url` | Optional | HTTP endpoint URL for output upload (e.g., SPARQL Graph Store Protocol endpoint). |
| `output.file` | Optional | Filesystem path for the output. Relative paths resolve against the DataBook's own location. |
| `outputs` | Optional | Sequence of `{format, media_type, graph, url, file}` objects for transformers producing multiple simultaneous outputs. When both `output` and `outputs` are present, `outputs` takes precedence. |
| `timestamp` | Recommended | ISO 8601 datetime indicating when the transformation was run. |
| `agent` | Recommended | Object identifying the human orchestrating the transformation. |
| `agent.name` | Required in agent | Full name string. |
| `agent.iri` | Recommended in agent | Stable IRI for the person. |
| `agent.role` | Required in agent | Role of the agent in the production. See §5.2. |
| `note` | Optional | Free-text note. |

### 10.3 Transformer type vocabulary

| Value | Meaning | Deterministic? |
| --- | --- | --- |
| `llm` | Large language model (any provider/model) | No |
| `xslt` | XSLT transformation | Yes |
| `sparql` | SPARQL CONSTRUCT, UPDATE, or inference rule | Yes |
| `shacl` | SHACL validation or rule application | Yes |
| `service` | External API or web service call | Varies |
| `human` | Human authoring or annotation | No |
| `composite` | Orchestrated pipeline of multiple transformer types | Varies |
| `script` | Custom code (Python, JavaScript, etc.) | Varies |
| `library-transform` | Named transform resolved from a `transformer-library` DataBook | Varies |
| `registry-processor` | Processor resolved by name from a `processor-registry` DataBook | Varies |

For `library-transform` and `registry-processor`, the `transformer_iri` field should point to the specific named entry within its library or registry DataBook, using fragment addressing (e.g., `https://example.org/databooks/transforms-v1#normalise-turtle`).

Non-deterministic transformer types (especially `llm` and `human`) make strict reproducibility impossible. The process stamp documents this honestly rather than concealing it.

### 10.4 Input role vocabulary

| Value | Meaning |
| --- | --- |
| `primary` | The principal data input being transformed or processed. |
| `constraint` | A SHACL shapes graph, schema, or other normative constraint the output must satisfy. |
| `context` | Background knowledge or contextual information used to inform the transformation. |
| `evidence` | Observational or empirical data from which assertions in the output are derived. |
| `reference` | A reference document consulted but not directly transformed. |
| `template` | A template or scaffold whose structure the output follows. |

Multiple inputs of the same role are permitted.

### 10.5 Output format and destination

The **default output destination is stdout** — if no `output` object is declared, a pipeline runner writes the transformer's result to standard output. This default keeps the common case simple for command-line usage.

When `output_format` is absent, the runner should attempt to infer it from the transformer type (e.g., a `sparql` CONSTRUCT defaults to `turtle`, a SELECT defaults to `application/sparql-results+json`) and should document its inference in the log.

### 10.6 Process stamp and PROV-O

See Section 14 for full PROV-O alignment details.

---

## 11. The Manifest and Dependency Graph Pattern

When a DataBook is the product of a pipeline, or is itself the specification of a pipeline, its dependencies can be represented as a fenced RDF block using the DataBook build vocabulary.

### 11.1 Build namespace

The DataBook build vocabulary uses the canonical namespace:

```turtle
@prefix build: <https://w3id.org/databook/ns#> .
```

Core build classes and properties:

| Term | Type | Description |
| --- | --- | --- |
| `build:Target` | Class | A DataBook that is a build goal — the intended output. |
| `build:Stage` | Class | An intermediate DataBook in a pipeline. |
| `build:Source` | Class | A DataBook that is a raw input with no DataBook-format dependencies. |
| `build:Manifest` | Class | The manifest DataBook itself. |
| `build:dependsOn` | Property | Links a Target or Stage to its input DataBook IRIs. |
| `build:transformer` | Property | Links a Stage to the transformer type string used to produce it. |
| `build:produces` | Property | Links a Stage to its output DataBook IRI. |
| `build:order` | Property | Integer ordering hint for stages without explicit dependency relationships. |
| `build:outputType` | Property | Declares the expected fence-label type of a Stage or Target's output. Enables type-compatibility validation across pipeline stages. |

### 11.2 Manifest block example

````
```manifest
<!-- databook:id: pipeline-manifest -->
@prefix build: <https://w3id.org/databook/ns#> .
@prefix db:    <https://example.org/databooks/> .

db:compiled-ontology-v1 a build:Target ;
    build:outputType "turtle" ;
    build:dependsOn db:inference-rules-v1,
                    db:shacl-shapes-v1 .

db:inference-rules-v1 a build:Stage ;
    build:transformer "sparql" ;
    build:outputType "turtle" ;
    build:dependsOn db:taxonomy-fragment-v1 .

db:shacl-shapes-v1 a build:Stage ;
    build:transformer "llm" ;
    build:outputType "shacl" ;
    build:dependsOn db:taxonomy-fragment-v1 .

db:taxonomy-fragment-v1 a build:Source ;
    build:outputType "turtle" .
```
````

### 11.3 Querying the manifest

Because the manifest is RDF, it is SPARQL-queryable:

```sparql
# Find all DataBooks that depend on a changed source
PREFIX build: <https://w3id.org/databook/ns#>
PREFIX db:    <https://example.org/databooks/>

SELECT ?affected WHERE {
    ?affected build:dependsOn+ db:taxonomy-fragment-v1 .
}
```

```sparql
# Validate type compatibility between stages
PREFIX build: <https://w3id.org/databook/ns#>

SELECT ?consumer ?producer ?consumerExpects ?producerOutputs WHERE {
    ?consumer build:dependsOn ?producer .
    ?consumer build:inputType ?consumerExpects .
    ?producer build:outputType ?producerOutputs .
    FILTER (?consumerExpects != ?producerOutputs)
}
```

### 11.4 Manifest DataBook as a first-class artifact

A manifest can be its own DataBook — a DataBook whose primary data block is a build manifest graph. This is the canonical pattern for book compilation: a Leanpub-style book is a manifest DataBook whose `build:dependsOn` triples point to chapter DataBooks, appendix DataBooks, and taxonomy DataBooks. The manifest is the holonic boundary that makes them a coherent whole.

---

## 12. Transformer Libraries and Processor Registries

Two specialised DataBook types extend the core `type: databook` value to address the needs of reusable pipeline infrastructure. Both use the same document structure as a standard DataBook but carry specialised `type` field values that signal their role to pipeline tooling.

### 12.1 Transformer Libraries (`type: transformer-library`)

A **transformer library** is a DataBook that catalogues a reusable collection of named transformers — SPARQL CONSTRUCT queries, XSLT stylesheets, SHACL rules, prompt templates, or custom scripts — each with a stable IRI, declared input/output types, and provenance.

**Frontmatter:**

```yaml
type: transformer-library
```

**RDF catalogue block:** A transformer library should include a `turtle` block carrying an RDF catalogue:

```turtle
@prefix build: <https://w3id.org/databook/ns#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix lib:   <https://example.org/databooks/transforms-v1#> .

lib:normalise-turtle a build:NamedTransform ;
    build:transformerType "sparql" ;
    build:inputType  "turtle" ;
    build:outputType "turtle" ;
    dct:title        "Normalise Turtle prefixes and blank nodes"@en ;
    dct:created      "2026-04-25"^^xsd:date .

lib:extract-shacl a build:NamedTransform ;
    build:transformerType "sparql" ;
    build:inputType  "turtle" ;
    build:outputType "shacl" ;
    dct:title        "Extract SHACL shapes from OWL class definitions"@en ;
    dct:created      "2026-04-25"^^xsd:date .
```

**Additional build vocabulary for transformer libraries:**

| Term | Type | Description |
| --- | --- | --- |
| `build:NamedTransform` | Class | A named, reusable transform entry in a transformer library. |
| `build:transformerType` | Property | The transformer type string for this named transform. Values as per §10.3. |
| `build:inputType` | Property | The expected fence-label type of this transform's input. |
| `build:outputType` | Property | The expected fence-label type of this transform's output. |

**Referencing a library transform in a process stamp:**

```yaml
process:
  transformer: "Normalise Turtle prefixes and blank nodes"
  transformer_type: library-transform
  transformer_iri: https://example.org/databooks/transforms-v1#normalise-turtle
  inputs:
    - iri: https://example.org/databooks/raw-taxonomy-v1
      role: primary
```

### 12.2 Processor Registries (`type: processor-registry`)

A **processor registry** is a DataBook that catalogues named processing services, tools, and models — SPARQL endpoints, LLM API endpoints, XSLT processors, validation services — each with a stable IRI, declared capability profile, and current availability status.

**Frontmatter:**

```yaml
type: processor-registry
```

**RDF catalogue block:**

```turtle
@prefix build: <https://w3id.org/databook/ns#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix reg:   <https://example.org/databooks/processors-v1#> .

reg:jena-endpoint a build:Processor ;
    build:processorType  "sparql" ;
    build:serviceIRI     <http://localhost:3030/ds/sparql> ;
    build:rdfVersion     "1.2" ;
    dct:title            "Apache Jena Fuseki 6.0 local endpoint"@en ;
    build:status         build:Active .

reg:claude-sonnet a build:Processor ;
    build:processorType  "llm" ;
    build:serviceIRI     <https://api.anthropic.com/v1/messages> ;
    build:modelVersion   "claude-sonnet-4-6" ;
    dct:title            "Claude Sonnet 4.6 via Anthropic API"@en ;
    build:status         build:Active .
```

**Additional build vocabulary for processor registries:**

| Term | Type | Description |
| --- | --- | --- |
| `build:Processor` | Class | A named processor entry in a registry. |
| `build:processorType` | Property | The transformer type string for this processor. Values as per §10.3. |
| `build:serviceIRI` | Property | The IRI of the processor's service endpoint or homepage. |
| `build:rdfVersion` | Property | The RDF version supported by this processor (for graph stores). |
| `build:modelVersion` | Property | The model version string (for LLM processors). |
| `build:status` | Property | Current availability status. Values: `build:Active`, `build:Inactive`, `build:Deprecated`. |
| `build:capabilityNote` | Property | Free-text note about processor capabilities, limitations, or access requirements. |

**Referencing a registry processor in a process stamp:**

```yaml
process:
  transformer: "Apache Jena Fuseki 6.0 local endpoint"
  transformer_type: registry-processor
  transformer_iri: https://example.org/databooks/processors-v1#jena-endpoint
  inputs:
    - iri: https://example.org/databooks/raw-taxonomy-v1
      role: primary
```

---

## 13. Encryption Profile

The DataBook core specification reserves the YAML `encryption` key and the `encrypted`, `encrypted-turtle`, and `encrypted-jsonld` fence labels for a designed-in encryption profile. The cryptographic implementation details are out of scope for the core specification; this section documents the interface points the core spec defines to enable the profile without requiring it.

### 13.1 Design principles

- Encryption is **selective by default**: a DataBook may contain both plaintext and encrypted blocks.
- Encrypted blocks are **opaque to non-encryption-aware parsers**: a parser that does not support the encryption profile must skip encrypted blocks without error.
- The `encryption` frontmatter key is **reserved** and must not be repurposed.
- The **manifest is in frontmatter, not in the block**: this allows a parser to determine what decryption is possible before streaming through the document body.
- Encryption is a **profile on top of core**, not a required feature.

### 13.2 Encryption frontmatter structure

```yaml
encryption:
  profile: rsa-oaep-256-aes-gcm
  key_id: https://example.org/keys/public/2026-04
  scope: selective
  blocks:
    - block_id: results-block
      encrypted_media_type: text/turtle
      iv: <base64-encoded IV>
      auth_tag: <base64-encoded GCM auth tag>
      encrypted_key: <base64-encoded RSA-wrapped AES session key>
```

### 13.3 Encrypted block structure

````
```encrypted-turtle
<!-- databook:id: results-block -->
T2xkSm9lQ3J5cHRvZ3JhcGh5V2FzSGVyZUJ1dE5vd1dlVXNlQUVTLTI1Ni1HQ00=
```
````

### 13.4 Parser contract for encrypted blocks

A parser supporting the encryption profile must:

1. Read and parse the full `encryption` frontmatter before processing any block.
2. Match each encrypted block's `databook:id` to its `encryption.blocks` entry.
3. Resolve `key_id` to retrieve the RSA key material.
4. Decrypt `encrypted_key` using RSA-OAEP to recover the AES session key.
5. Decrypt the block content using AES-256-GCM with the `iv` and verify against `auth_tag`. Abort and raise on authentication tag mismatch — this is a security-critical failure, not a recoverable error.
6. Parse the decrypted bytes as the `encrypted_media_type` in-memory only.
7. Zeroize the AES session key from memory after loading.

Encrypted blocks must never be written to disk in plaintext by the host system.

---

## 14. PROV-O Alignment

DataBooks are designed to participate in W3C PROV-O provenance infrastructure without requiring PROV-O to be loaded as a dependency. The YAML process stamp is a human-readable projection of the PROV graph that the DataBook represents.

### 14.1 PROV-O mapping table

| DataBook concept | PROV-O term | Notes |
| --- | --- | --- |
| The DataBook document | `prov:Entity` | The document IRI (`id` field) is the entity IRI. |
| Production activity | `prov:Activity` | Implicit, identified by timestamp and process block. |
| `process.transformer_iri` | `prov:wasAssociatedWith` | Links the activity to the software agent. |
| `process.agent.iri` | `prov:wasAssociatedWith` | Links the activity to the human agent. |
| `process.inputs[n].iri` | `prov:used` | The activity used these entities as inputs. |
| `process.output.graph` | `prov:generated` | Named graph entity produced. |
| `process.output.url` | `prov:generated` | Remote resource produced. |
| `process.output.file` | `prov:generated` | Local file entity produced. |
| `process.timestamp` | `prov:endedAtTime` | When the activity completed. |
| `created` | `prov:generatedAtTime` | When the entity (document) came into being. |
| One DataBook citing another | `prov:wasDerivedFrom` | When the output is derived from a specific input. |

### 14.2 Provenance chain traversal

Because `process.inputs[n].iri` values are themselves DataBook IRIs, and those DataBooks carry their own process stamps, provenance chains are graph-traversable:

```
DataBook-C  → process.inputs → DataBook-B
DataBook-B  → process.inputs → DataBook-A
DataBook-A  → process.inputs → (original source IRIs)
```

### 14.3 RDF 1.2 reification and in-graph provenance

Within the data blocks of a DataBook, individual triples may carry provenance annotations using RDF 1.2 Turtle reification syntax:

```turtle
ex:MyEntity ex:hasProperty "value"
    ~ ex:reifier-1
    {| dcterms:date "2026-04-25"^^xsd:date ;
       rdfs:comment "Derived from session telemetry."@en |} .
```

This is complementary to the document-level YAML process stamp. The YAML stamp covers the DataBook as a whole; in-graph reification covers individual assertion-level provenance where finer granularity is warranted.

---

## 15. Parser Behaviour and Graceful Degradation

A DataBook is designed to remain useful to parsers that understand only part of the specification.

### 15.1 Parser capability tiers

| Parser capability | Behaviour |
| --- | --- |
| Plain Markdown renderer | Renders the document as formatted prose. Fenced blocks are displayed as code. All body content is human-readable. |
| YAML frontmatter-aware renderer | Also extracts title, author, and description from the `---`-delimited frontmatter block. The `<script>`-wrapped form is not extracted by standard YAML frontmatter parsers. |
| DataBook-aware parser (core) | Extracts the `---`-delimited frontmatter (preferred) or the `<script language="application/yaml">` form (accepted). Extracts typed blocks, loads graph data, executes SPARQL blocks, resolves block identifiers. Ignores encrypted blocks gracefully. |
| DataBook-aware parser (encryption profile) | Also decrypts encrypted blocks and loads them into the session store under their named graph IRIs. |
| RDF 1.2 compliant parser (e.g., Jena 6.0) | Fully processes RDF 1.2 Turtle reification annotations. |
| RDF 1.1 parser (e.g., rdflib) | Processes the base graph. Reification annotation syntax may cause parse errors; strip or pre-filter if an 1.1 parser is required. |

### 15.2 Frontmatter detection

A DataBook-aware parser must detect the YAML metadata block as follows:

1. Scan the beginning of the document for a bare `---` delimiter on its own line with no preceding content. Extract content up to the closing `---`. Parse the enclosed YAML. This is the primary (canonical) form.
2. If no bare `---` block is found at the document start, check for a `<script language="application/yaml">` block (the v1.0 canonical form, now an accepted alternative). Extract content between the `<script>` and `</script>` tags, locate the enclosed `---` delimiters, and parse the YAML content.

In Node.js, minimal extraction for both forms:

```javascript
function extractYaml(text) {
  // Primary: bare --- frontmatter
  if (text.startsWith('---')) {
    const end = text.indexOf('\n---', 3);
    if (end !== -1) return text.slice(4, end).trim();
  }
  // Accepted alternative: <script language="application/yaml"> form
  const SCRIPT_OPEN  = /<script[^>]+language=["']application\/yaml["'][^>]*>/i;
  const start = text.search(SCRIPT_OPEN);
  if (start !== -1) {
    const end = text.indexOf('</script>', start);
    const inner = text.slice(text.indexOf('>', start) + 1, end);
    const parts = inner.split('---');
    return parts.length >= 3 ? parts[1].trim() : null;
  }
  return null;
}
```

In Python:

```python
import re, yaml

def extract_yaml(text):
    # Primary: bare --- frontmatter
    if text.startswith('---\n'):
        end = text.find('\n---', 4)
        if end != -1:
            return yaml.safe_load(text[4:end])
    # Accepted alternative: <script language="application/yaml"> form
    script_pat = re.compile(
        r'<script[^>]+language=["\']application/yaml["\'][^>]*>(.*?)</script>',
        re.DOTALL | re.IGNORECASE
    )
    m = script_pat.search(text)
    if m:
        parts = m.group(1).split('---')
        return yaml.safe_load(parts[1]) if len(parts) >= 3 else None
    return None
```

### 15.3 Required parser behaviours

A conformant DataBook core parser must:

- Extract and parse YAML metadata from either the bare `---` form or the `<script language="application/yaml">` form.
- Identify fenced blocks by their opening label and route them to the appropriate sub-parser.
- Treat unrecognised fence labels as display code blocks and not raise errors on encountering them.
- Treat `encrypted` family labels as opaque if the encryption profile is not supported.
- Ignore unrecognised YAML frontmatter keys without error.
- Ignore unrecognised `databook:` comment keys within block headers without error.
- Process `databook:id` comment keys and make blocks addressable by the resulting identifier.
- Require explicit user confirmation before executing any block marked `databook:executable: true`.

### 15.4 Error handling

| Condition | Required behaviour |
| --- | --- |
| Malformed YAML in metadata block | Raise parse error. The document is not a valid DataBook. |
| Missing `id`, `title`, `type`, or `version` | Raise validation error. These are required identity fields. |
| `type` field not a recognised DataBook type | The document is not a DataBook. Do not process as one. |
| Missing `process` stamp when data blocks are present | Emit a warning. The document is structurally valid but provenance-incomplete. |
| `graph.triple_count` mismatch | Emit a warning. Load the data. This is an informational field, not a hard constraint. |
| Block execution failure (non-update block) | Emit a warning. Skip the block. Continue with remaining blocks. |
| Block execution failure (sparql-update block) | Raise an error. Halt. Partial graph mutations are unsafe. |
| Encrypted block without matching frontmatter entry | Raise a validation error. The block cannot be safely identified. |
| Encryption auth tag mismatch | Raise an error. Do not load the block. This is a security-critical failure. |
| `databook:executable: true` without user confirmation | Refuse execution. Raise an error. |
| `databook:import` circular reference | Raise a parse error. |

---

## 16. The Holonic Connection

DataBooks are the practical instantiation of holonic boundary conditions in a knowledge graph architecture. Each DataBook is a holon in the Koestlerian sense: a whole unto itself (self-contained, self-describing, addressable) and a part of a larger whole (composable into pipelines, libraries, and manifests).

The three-layer structure of a DataBook maps directly onto the holonic graph model:

| DataBook layer | Holonic layer | Function |
| --- | --- | --- |
| YAML frontmatter | Context layer | Carries the metadata and boundary conditions that define the holon's identity and scope |
| Fenced data blocks | Domain layer | The structured content — the holon's internal graph reality |
| Prose | Scene layer | The human-facing projection — the surface accessible to unaided reading |

A pipeline of DataBooks is a holarchy: each stage is a holon that consumes parent holons and produces child holons. The manifest DataBook is the holonic boundary condition for the pipeline as a whole. Transformer libraries and processor registries are holonic infrastructure layers — reusable holons serving the pipeline's operational needs rather than carrying domain data directly.

---

## 17. Complete Annotated Example

The following is a complete DataBook demonstrating all core v1.1 conventions.

````markdown
---
id: https://example.org/databooks/colour-taxonomy-v1
title: "Colour Terms Taxonomy Fragment"
type: databook
version: 1.0.0
created: 2026-04-25

author:
  - name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator
  - name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: transformer

license: CC-BY-4.0
domain: https://example.org/taxonomy/colour/
subject:
  - colour taxonomy
  - SKOS
description: >
  A minimal SKOS taxonomy fragment for colour terms, demonstrating
  the DataBook v1.1 format conventions.

graph:
  namespace: https://example.org/taxonomy/colour/
  named_graph: https://example.org/databooks/colour-taxonomy-v1#graph
  triple_count: 14
  subjects: 4
  rdf_version: "1.1"
  turtle_version: "1.1"
  reification: false

shapes:
  - https://example.org/shapes/SkosConceptSchemeShape
  - https://example.org/shapes/SkosConceptShape

process:
  transformer: "Claude Sonnet 4.6"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-4-6
  inputs:
    - iri: https://github.com/kurtcagle/databook/blob/main/SPEC.md
      role: template
      description: "DataBook format reference used to structure this example"
  timestamp: 2026-04-25T12:00:00Z
  agent:
    name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: orchestrator
---

## Overview

This DataBook carries a small SKOS concept scheme for colour terms.
It is intended as an annotated example of the DataBook v1.1 format.

The `colour:ColourScheme` concept scheme contains two top concepts
(`colour:WarmColour` and `colour:CoolColour`) and two narrow concepts
(`colour:Red` and `colour:Blue`).

## Primary Data

```turtle
<!-- databook:id: colour-taxonomy-block -->
<!-- databook:graph: https://example.org/databooks/colour-taxonomy-v1#graph -->
@prefix rdf:    <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix skos:   <http://www.w3.org/2004/02/skos/core#> .
@prefix colour: <https://example.org/taxonomy/colour/> .

colour:ColourScheme a skos:ConceptScheme ;
    skos:prefLabel "Colour Terms"@en .

colour:WarmColour a skos:Concept ;
    skos:inScheme      colour:ColourScheme ;
    skos:prefLabel     "Warm Colour"@en ;
    skos:topConceptOf  colour:ColourScheme .

colour:CoolColour a skos:Concept ;
    skos:inScheme      colour:ColourScheme ;
    skos:prefLabel     "Cool Colour"@en ;
    skos:topConceptOf  colour:ColourScheme .

colour:Red a skos:Concept ;
    skos:inScheme  colour:ColourScheme ;
    skos:prefLabel "Red"@en ;
    skos:broader   colour:WarmColour .

colour:Blue a skos:Concept ;
    skos:inScheme  colour:ColourScheme ;
    skos:prefLabel "Blue"@en ;
    skos:broader   colour:CoolColour .
```

## Queries

Retrieve all concepts with their broader categories:

```sparql
<!-- databook:id: select-all-concepts -->
PREFIX skos:   <http://www.w3.org/2004/02/skos/core#>
PREFIX colour: <https://example.org/taxonomy/colour/>

SELECT ?concept ?label ?broader ?broaderLabel WHERE {
    ?concept skos:inScheme colour:ColourScheme ;
             skos:prefLabel ?label .
    OPTIONAL {
        ?concept skos:broader ?broader .
        ?broader skos:prefLabel ?broaderLabel .
    }
}
ORDER BY ?broaderLabel ?label
```

## Usage

> **Note:** Standard rdflib will not parse a `.databook.md` file directly.
> Extract the fenced block content first, then parse as Turtle.
> A DataBook-aware loader handles this automatically.
````

---

## 18. Quick Reference

### Minimum viable DataBook (v1.1)

```markdown
---
id: https://example.org/databooks/my-databook
title: "My DataBook"
type: databook
version: 1.0.0
created: 2026-04-25
process:
  transformer: human
  transformer_type: human
  inputs: []
  timestamp: 2026-04-25T12:00:00Z
---

## Overview

[Prose here.]

```turtle
<!-- databook:id: primary-block -->
@prefix ex: <https://example.org/> .
ex:Thing a ex:Class .
```
```

### Document type vocabulary

| `type` value | Meaning |
| --- | --- |
| `databook` | Standard DataBook carrying domain data, queries, or prompts |
| `transformer-library` | Catalogue of named, reusable transformer definitions |
| `processor-registry` | Catalogue of named processors with IRI and capability declarations |

### Fence label quick reference

#### Data payloads

| Label | Use for |
| --- | --- |
| `turtle` | RDF Turtle 1.1 |
| `turtle12` | RDF Turtle 1.2 (with reification annotations) |
| `json-ld` | JSON-LD |
| `trig` | Named graphs (TriG) |
| `n-triples` | N-Triples |
| `n-quads` | N-Quads |
| `json` | JSON data payload |
| `xml` | XML data payload |
| `yaml` | YAML data payload |
| `csv` | CSV tabular data |
| `html` | HTML document or fragment |
| `text` | Plain text payload |

#### Operations

| Label | Use for |
| --- | --- |
| `sparql` | SPARQL SELECT / CONSTRUCT / ASK / DESCRIBE |
| `sparql-update` | SPARQL Update |
| `shacl` | SHACL shapes |
| `xslt` | XSLT transformation |
| `xquery` | XQuery |
| `jq` | jq expression |
| `manifest` | Build dependency graph |
| `transformer-library` | Named transformer catalogue (RDF) |
| `processor-registry` | Named processor catalogue (RDF) |
| `prompt` | LLM prompt template |
| `prompt-system` | LLM system prompt |
| `prompt-user` | LLM user turn |

#### Visual specifications

| Label | Use for |
| --- | --- |
| `mermaid` | Mermaid diagram |
| `graphviz` | Graphviz DOT |
| `plantuml` | PlantUML |
| `d2` | D2 diagram |

#### Imperative code (display by default; `databook:executable: true` to opt in)

| Label | Use for |
| --- | --- |
| `python` | Python |
| `javascript` | JavaScript / Node.js |
| `typescript` | TypeScript |
| `bash` | Shell script |
| `r` | R |
| `sql` | SQL |

#### Encrypted (encryption profile)

| Label | Use for |
| --- | --- |
| `encrypted` | Generic encrypted payload |
| `encrypted-turtle` | Encrypted Turtle |
| `encrypted-jsonld` | Encrypted JSON-LD |

### Transformer type quick reference

| Value | Deterministic |
| --- | --- |
| `llm` | No |
| `xslt` | Yes |
| `sparql` | Yes |
| `shacl` | Yes |
| `service` | Varies |
| `human` | No |
| `composite` | Varies |
| `script` | Varies |
| `library-transform` | Varies |
| `registry-processor` | Varies |

### Input role quick reference

| Value | Meaning |
| --- | --- |
| `primary` | Principal data input |
| `constraint` | Schema or shapes graph |
| `context` | Background knowledge |
| `evidence` | Empirical basis |
| `reference` | Consulted but not transformed |
| `template` | Structural scaffold |

### Canonical namespace

```turtle
@prefix build: <https://w3id.org/databook/ns#> .
```

Used for all build vocabulary terms: `build:Target`, `build:Stage`, `build:Source`, `build:Manifest`, `build:NamedTransform`, `build:Processor`, `build:dependsOn`, `build:produces`, `build:transformer`, `build:outputType`, `build:inputType`, `build:order`, `build:transformerType`, `build:processorType`, `build:serviceIRI`, `build:rdfVersion`, `build:modelVersion`, `build:status`, `build:capabilityNote`, `build:Active`, `build:Inactive`, `build:Deprecated`.

### Reserved YAML keys

`id` · `title` · `type` · `version` · `created` · `author` · `license` · `domain` · `subject` · `description` · `graph` · `shapes` · `process` · `encryption`

### Reserved `databook:` comment keys

`databook:id` · `databook:graph` · `databook:label` · `databook:base` · `databook:import` · `databook:encoding` · `databook:executable` · `databook:runtime` · `databook:param` · `databook:encrypted-media-type` · `databook:key-ref`

---

## 19. Changelog

### v1.1 — 2026-04-25 *(current)*

**Frontmatter form**
- Bare `---`-delimited YAML frontmatter is now canonical. This is the standard Markdown frontmatter convention and renders correctly in GitHub, Claude, and all common Markdown tooling.
- The `<script language="application/yaml">` form (canonical in v1.0) is demoted to an accepted alternative. Parsers must continue to support it for backwards compatibility. The `<script>` form was found to render incorrectly in GitHub Markdown and in Claude's Markdown renderer, making it unsuitable as the primary convention.

**Restored from v0.9**
- §8 Parameterised Queries restored in full. The section was inadvertently dropped in v1.0 despite `databook:param` remaining in the reserved comment key list.
- `databook:param`, `databook:executable`, and `databook:runtime` restored to the reserved `databook:` comment key list (§18) and to the block-level metadata table (§6.2).
- `process.output_format`, `process.output_media_type`, `process.output`, `process.output.graph`, `process.output.url`, `process.output.file`, and `process.outputs` restored to the process stamp property table (§10.2). These were dropped from v1.0's table but are used by the reference CLI implementation.

**Other changes**
- §3.5 Reference Implementation added, noting the Node.js CLI in `implementations/js/` as the canonical reference.
- Naming examples in §3.2 genericised; project-specific filenames removed.
- Inline markup example in §9.1 genericised.
- Complete annotated example (§17) updated to use bare `---` frontmatter.
- Parser behaviour section (§15) restructured: bare `---` described as the primary detection path; `<script>` detection described as the fallback for v1.0 compatibility. Updated code examples for both Node.js and Python reflect this order.
- Error handling table (§15.4) expanded with `databook:executable` guard condition and `databook:import` circular reference condition.

---

### v1.0 — 2026-04-19 *(archived as `databook-1.0.md`)*

**Breaking / canonical changes**
- YAML metadata block wrapped in `<script language="application/yaml">` (now demoted to accepted alternative in v1.1).
- Canonical namespace changed from `https://databook.org/ns/build#` to `https://w3id.org/databook/ns#`.

**New features**
- `type` field extended: `transformer-library` and `processor-registry` document types added.
- New fence labels: `transformer-library` and `processor-registry`.
- New transformer types: `library-transform` and `registry-processor`.
- `build:outputType` property added to build vocabulary.
- Extended build vocabulary: `build:NamedTransform`, `build:Processor`, and associated properties.
- §11 Transformer Libraries and Processor Registries added.

---

### v0.9 — 2026-04-12 *(archived as `databook-0.9.md`)*

Initial internal consistency reference. Bare `---` YAML frontmatter. Namespace `https://databook.org/ns/build#`. Pre-publication draft.

---

*DataBook specification version 1.1. Canonical namespace: `https://w3id.org/databook/ns#`. Repository: `https://github.com/kurtcagle/databook`. For proposed amendments, open an issue at the repository.*
