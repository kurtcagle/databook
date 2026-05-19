---
id: https://w3id.org/databook/spec/v1.2/property-reference
title: "DataBook Property Reference v1.2"
type: databook
version: 1.0.0
created: 2026-05-19
description: >
  Reference specification for all DataBook YAML frontmatter properties,
  block comment annotation keys (databook:*), and block directive attributes,
  with accompanying SHACL shapes for programmatic validation.
  Applies to DataBook specification v1.2.
tags:
  - databook
  - specification
  - shacl
  - reference
process:
  transformer: "claude-sonnet-4-6"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-4-6
  timestamp: 2026-05-19T09:00:00Z
  inputs:
    - iri: https://github.com/kurtcagle/databook
      role: primary
      description: "DataBook specification v1.2 (kurtcagle/databook)"
  agent:
    name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: orchestrator
graph:
  named_graph: https://w3id.org/databook/spec/v1.2/property-reference#graph
  triple_count: 274
  subjects: 54
  rdf_version: "1.1"
shapes:
  - https://w3id.org/databook/spec/v1.2/property-reference#frontmatter-shapes
  - https://w3id.org/databook/spec/v1.2/property-reference#block-zone-shapes
---

---

# Databook Property Reference Guide

---

## Overview

This DataBook is the normative property reference for the DataBook specification v1.2. It documents every property defined in three zones of a DataBook document:

1. **YAML frontmatter** — the `---`-delimited metadata block that opens every DataBook, carrying identity, descriptive, graph, and provenance metadata.
2. **Block annotation keys** — `<!-- databook:key: value -->` HTML comment lines in the pre-fence zone immediately preceding a fenced data block.
3. **Block directive attributes** — `<!-- key=value -->` HTML comment lines in the same pre-fence zone, carrying processing instructions for DataBook-aware tools.

For each property the following are recorded: the YAML key (or comment syntax), its RDF representation as a `db:` namespace property, cardinality, datatype or node type, permitted values where constrained, and a prose description.

The document is self-describing: its own frontmatter is a conformant instance of the shapes it defines.

---

## 1. YAML Frontmatter Properties

The frontmatter is a single YAML document delimited by `---` ... `---` at the opening of the file. All keys are in `snake_case`. Their RDF equivalents use `camelCase` under the DataBook namespace (`https://w3id.org/databook/ns#`, prefix `db:`).

> **Important:** The `---` delimiters are plain YAML frontmatter. The `<script language="application/yaml">` wrapper form is accepted by parsers for backward compatibility with v1.0 documents but must never be written in new DataBooks.

### 1.1 Required Identity Fields

Every DataBook must carry these five fields. A document missing any of them is invalid.

| YAML key | RDF property | Datatype / Kind | Cardinality |
|---|---|---|---|
| `id` | `@id` | IRI (the document identity) | exactly 1 |
| `title` | `db:title` | `xsd:string` | exactly 1 |
| `type` | `rdf:type` | one of: `db:DataBook`, `db:TransformerLibrary`, `db:ProcessorRegistry` | exactly 1 |
| `version` | `db:version` | `xsd:string` — semver `MAJOR.MINOR.PATCH` | exactly 1 |
| `created` | `db:created` | `xsd:date` (`YYYY-MM-DD`) | exactly 1 |

**`id`** — A stable, globally unique IRI identifying this DataBook. Used as the subject IRI in all RDF representations of the document's metadata. Should remain stable across revisions; use versioned IRIs (`-v1`, `-v1.1`) for variant releases. Constructed from `https://w3id.org/databook/{slug}-v{version}` when no external IRI is available.

**`title`** — A human-readable name for the DataBook. Quote in YAML if the value contains a colon. Used as `rdfs:label` in graph representations.

**`type`** — Declares the document's structural role. Three values are defined:

| YAML value | RDF class | Purpose |
|---|---|---|
| `databook` | `db:DataBook` | Standard DataBook carrying domain data, queries, shapes, or prompts |
| `transformer-library` | `db:TransformerLibrary` | Catalogue of named, reusable transformer definitions |
| `processor-registry` | `db:ProcessorRegistry` | Catalogue of named processors with IRI and capability declarations |

**`version`** — A semantic version string following `MAJOR.MINOR.PATCH` convention. MAJOR increments on breaking schema changes; MINOR on additive changes; PATCH on corrections. Distinct from the DataBook spec version.

**`created`** — The calendar date on which this DataBook was authored or generated, in `YYYY-MM-DD` format. Not the same as the `process.timestamp`, which records the moment of transformer execution.

### 1.2 Recommended Descriptive Fields

These fields are optional but strongly recommended for DataBooks intended for catalogue or discovery use.

| YAML key | RDF property | Datatype / Kind | Cardinality |
|---|---|---|---|
| `description` | `db:description` | `xsd:string` | 0..1 |
| `author` | `db:author` | `db:AuthorStamp` (blank node) | 0..* |
| `license` | `db:license` | IRI or SPDX identifier string | 0..1 |
| `domain` | `db:domain` | IRI (primary ontology namespace) | 0..1 |
| `subject` | `db:subject` | `xsd:string` | 0..* |
| `tags` | `db:tag` | `xsd:string` | 0..* |
| `publisher` | `db:publisher` | `xsd:string` or IRI | 0..1 |
| `imports` | `db:imports` | IRI | 0..* |
| `shapes` | `db:shapes` | IRI | 0..* |

**`description`** — A one-paragraph abstract suitable for catalogue and discovery. Distinct from body prose — the description should stand alone without the document context.

**`author`** — A list of contributors. Each entry is a YAML mapping with three sub-keys:

| Sub-key | RDF property | Description |
|---|---|---|
| `name` | `db:authorName` | Full name of the contributor |
| `iri` | `db:authorIri` | Stable IRI identifying the contributor |
| `role` | `db:authorRole` | One of: `orchestrator`, `transformer`, `reviewer`, `editor`, `contributor` |

**`license`** — The licence under which the DataBook's content may be used. Either an SPDX identifier (e.g. `CC-BY-4.0`, `MIT`, `Apache-2.0`) or a full IRI. When absent, no licence is asserted and the content is assumed proprietary.

**`domain`** — The IRI of the primary ontology namespace that the data blocks in this DataBook instantiate. Enables namespace-aware tools to locate the governing ontology without inspecting block content.

**`subject`** — A list of free-text subject terms for catalogue indexing. No controlled vocabulary is required; human-readable terms are preferred.

**`tags`** — Short categorical labels, typically single words or kebab-case phrases. Distinct from `subject` in that tags are intended for faceted filtering while subjects are intended for full-text search.

**`publisher`** — The organisation or person responsible for publishing or distributing this DataBook. May be a string name or an IRI.

**`imports`** — A list of DataBook IRIs whose prefix declarations and namespace contexts this document inherits. Enables modular DataBook construction without duplicating prefix tables.

**`shapes`** — A list of SHACL shape IRIs that this DataBook's data is expected to conform to. Informational — not enforced at the DataBook level — but enables downstream validators to locate governing shapes without inspecting block content.

### 1.3 Graph Metadata

The optional `graph:` block carries metadata about the primary RDF graph payload of the DataBook. Required when the DataBook contains Turtle, JSON-LD, TriG, or other RDF blocks intended for loading into a triplestore.

| YAML key | RDF property | Datatype / Kind | Cardinality |
|---|---|---|---|
| `graph.namespace` | `db:namespace` | IRI | 0..1 |
| `graph.named_graph` | `db:namedGraph` | IRI | 0..1 |
| `graph.triple_count` | `db:tripleCount` | `xsd:integer` ≥ 0 | 0..1 |
| `graph.subjects` | `db:subjectCount` | `xsd:integer` ≥ 0 | 0..1 |
| `graph.rdf_version` | `db:rdfVersion` | `"1.1"` or `"1.2"` | 0..1 |
| `graph.turtle_version` | `db:turtleVersion` | `"1.1"` or `"1.2"` | 0..1 |
| `graph.reification` | `db:usesReification` | `xsd:boolean` | 0..1 |
| `graph.validator_note` | `db:validatorNote` | `xsd:string` | 0..1 |

**`graph.namespace`** — The primary ontology namespace IRI for the graph content. Typically the value of the default prefix in the Turtle blocks.

**`graph.named_graph`** — The named graph IRI under which this DataBook's content should be loaded in a quad-aware triplestore. Conventionally formed as `{document-id}#graph`. Block-level `databook:graph` keys override this value for specific blocks.

**`graph.triple_count`** — The total number of triples in the DataBook's primary data block(s). Used for integrity checking on load and for catalogue metadata. Should be accurate; update on every revision.

**`graph.subjects`** — The number of distinct subject IRIs across the DataBook's primary data block(s). Together with `triple_count` gives a quick density measure.

**`graph.rdf_version`** — The RDF version of the graph payload. Set to `"1.2"` when the payload uses RDF 1.2 features (reifiers, triple terms). Jena 6.0 is required for full RDF 1.2 support; rdflib requires a workaround.

**`graph.turtle_version`** — The Turtle serialisation version. Set to `"1.2"` when using Turtle 1.2 syntax (e.g. the `~` reifier shorthand). Set to `"1.1"` for standard Turtle.

**`graph.reification`** — Set to `true` when the graph uses RDF 1.2 `~` reification syntax. A shorthand for `rdf_version: "1.2"` combined with the syntactic flag that parsers need.

**`graph.validator_note`** — Free-text note for operators about validation prerequisites, known parser quirks, or triplestore configuration requirements. Not machine-readable; for human inspection only.

### 1.4 Process Stamp

The `process:` block records the provenance of the DataBook's content — who or what produced it, from what inputs, when, and in what form. Required when the DataBook was produced by any transformer (LLM, SPARQL, XSLT, human author, or pipeline). Maps directly to PROV-O: the document `id` is a `prov:Entity`; the `process` block is a `prov:Activity`; `inputs` items are `prov:used`; `transformer_iri` is `prov:wasAssociatedWith`.

| YAML key | RDF property | Datatype / Kind | Cardinality |
|---|---|---|---|
| `process.transformer` | `db:transformer` | `xsd:string` (display name) | 1 |
| `process.transformer_type` | `db:transformerType` | controlled vocabulary (see below) | 1 |
| `process.transformer_iri` | `db:transformerIri` | IRI | 0..1 |
| `process.timestamp` | `db:timestamp` | `xsd:dateTime` (ISO 8601) | 1 |
| `process.inputs` | `db:input` | `db:ProcessInput` (blank node list) | 1..* |
| `process.agent` | `db:agent` | `db:AgentStamp` (blank node) | 0..1 |
| `process.note` | `db:note` | `xsd:string` | 0..1 |
| `process.output_format` | `db:outputFormat` | fence-label string | 0..1 |
| `process.output_media_type` | `db:outputMediaType` | MIME type string | 0..1 |
| `process.output` | `db:output` | `db:OutputSpec` (blank node) | 0..1 |

**`process.transformer`** — The display name of the transformer that produced the DataBook's content. For LLMs, use the model name (e.g. `"claude-sonnet-4-6"`). For human authorship, use the person's name. For scripts, use the script name.

**`process.transformer_type`** — The category of transformer. Permitted values:

| Value | Deterministic | Description |
|---|---|---|
| `llm` | No | Large language model output |
| `human` | No | Direct human authorship |
| `script` | Yes | General scripting language (Python, Node, bash) |
| `xslt` | Yes | XSLT stylesheet transformation |
| `sparql` | Yes | SPARQL CONSTRUCT or UPDATE |
| `shacl` | Yes | SHACL Rules derivation |
| `service` | Varies | External web service call |
| `composite` | Varies | Orchestrated pipeline of multiple types |
| `library-transform` | Varies | Named transform from a `transformer-library` DataBook |
| `registry-processor` | Varies | Processor resolved from a `processor-registry` DataBook |

Non-deterministic transformers (`llm`, `human`) should be flagged in `process.note` when reproducibility is a concern.

**`process.transformer_iri`** — A stable IRI identifying the specific transformer instance. For LLMs, the API model endpoint IRI. For `library-transform`, the fragment IRI of the named transform within its library DataBook. For `registry-processor`, the fragment IRI of the registry entry.

**`process.timestamp`** — The moment of transformation in ISO 8601 combined date-time format (`YYYY-MM-DDTHH:MM:SSZ`). For LLM outputs, the time the response was received.

**`process.inputs`** — A list of source DataBooks or resources consumed by this transformation. Each input entry has three sub-keys:

| Sub-key | RDF property | Datatype | Description |
|---|---|---|---|
| `iri` | `db:sourceIri` | IRI | Stable IRI of the input resource |
| `role` | `db:role` | controlled string | Role of this input in the transformation |
| `description` | `db:description` | `xsd:string` | Human-readable note on what this input contributed |
| `block_id` | `db:blockId` | `xsd:string` | Fragment ID of a specific block within the input DataBook |

Permitted `role` values: `primary`, `constraint`, `context`, `evidence`, `reference`, `template`.

**`process.agent`** — The person or system that orchestrated the transformation, when distinct from the transformer itself. Carries three sub-keys:

| Sub-key | RDF property | Datatype | Description |
|---|---|---|---|
| `name` | `db:agentName` | `xsd:string` | Display name |
| `iri` | `db:agentIri` | IRI | Stable IRI identifying the agent |
| `role` | `db:agentRole` | controlled string | One of: `orchestrator`, `contributor`, `reviewer`, `validator` |

**`process.note`** — Free-text note about the transformation: non-determinism warnings, known limitations, manual post-processing steps, or other provenance context.

**`process.output_format`** — The fence label of the primary output block type (e.g. `turtle`, `shacl`, `sparql`, `json-ld`). Enables pipeline validators to confirm type compatibility at planning time.

**`process.output_media_type`** — The MIME type of the primary output (e.g. `text/turtle`, `application/ld+json`). More precise than `output_format` for service-oriented consumers.

**`process.output`** — An optional output routing specification with sub-keys:

| Sub-key | Description |
|---|---|
| `graph` | Named graph IRI to load the output into |
| `url` | Upload endpoint URL for GSP or similar |
| `file` | Local filesystem path for the output file |

---

## 2. Block Comment Zone

The block comment zone is the region between a prose paragraph and an opening fence (` ``` `). It contains HTML comment lines parseable by DataBook-aware tools but invisible to standard Markdown renderers. Two distinct namespaces coexist in this zone.

### Parsing convention

A line in the pre-fence zone is routed by its comment structure:

- If the comment content begins with `databook:` — it is a **block annotation key**: `<!-- databook:key: value -->`
- If the comment content contains only `key=value` pairs — it is a **block directive**: `<!-- key=value key=value -->`

Parsers accumulate both from all comment lines in the pre-fence zone. Standard ordering convention: `databook:id` first, then other `databook:` keys, then directive keys.

### 2.1 Block Annotation Keys (`databook:*`)

Block annotation keys carry named metadata properties attached to the immediately following fenced block. All use the `<!-- databook:key: value -->` syntax with a colon-space separator.

| Comment key | RDF property | Kind | Cardinality | Description |
|---|---|---|---|---|
| `databook:id` | `db:blockId` | `xsd:string` (kebab-case) | 0..1 per block | Block identifier. Required for addressability. |
| `databook:graph` | `db:blockGraph` | IRI | 0..1 | Named graph IRI for this block; overrides `graph.named_graph` in frontmatter. |
| `databook:label` | `db:blockLabel` | `xsd:string` | 0..1 | Human-readable label for this block. |
| `databook:base` | `db:blockBase` | IRI | 0..1 | Base IRI for relative IRI resolution within this block. |
| `databook:import` | `db:blockImport` | IRI | 0..* | IRI of another DataBook to import prefixes and namespace context from. |
| `databook:encoding` | `db:blockEncoding` | `xsd:string` | 0..1 | Character encoding of block content if not UTF-8. |
| `databook:runtime` | `db:blockRuntime` | `xsd:string` | 0..1 | Execution environment required (e.g. `python>=3.11`, `node>=20`). |
| `databook:param` | `db:paramDeclaration` | `db:ParamDeclaration` | 0..* | Declares a substitutable parameter for query or prompt blocks. |
| `databook:encrypted-media-type` | `db:encryptedMediaType` | MIME type string | 0..1 | MIME type of the plaintext payload in an encrypted block. |
| `databook:key-ref` | `db:keyRef` | IRI | 0..1 | IRI of the encryption key for an encrypted block. |
| `databook:executable` | `db:blockExecutable` | `xsd:boolean` | 0..1 | **Deprecated in v1.2.** Use `mode=executed` directive instead. Accepted for backward compatibility. |

**`databook:id`** — The fragment identifier of this block within the DataBook. Must be unique within the document and in kebab-case. Enables fragment addressing: `{document-id}#{block-id}`. Required when the block is referenced from another DataBook or pipeline.

**`databook:graph`** — Overrides the document-level `graph.named_graph` for this specific block. Use when a DataBook carries content for multiple named graphs.

**`databook:param`** — Declares a substitutable parameter for SPARQL query or LLM prompt blocks. Syntax: `<!-- databook:param: VARNAME [type=TYPE] [default=DEFAULT] [required] -->`. May appear multiple times (once per parameter). Sub-attributes:

| Sub-attribute | Description |
|---|---|
| `VARNAME` | Parameter name (uppercase, matches the SPARQL `VALUES` clause variable) |
| `type=TYPE` | Optional type hint: `IRI`, `string`, `integer`, `boolean`, `date`, `dateTime` |
| `default=VALUE` | Default value when the parameter is not supplied by the caller |
| `required` | Flag indicating the parameter has no default and must be supplied |

The substitution target in the SPARQL block is the `VALUES ?VARNAME { ... }` clause. Clients locate the block by fragment IRI, substitute values, and execute without modifying the document.

### 2.2 Block Directives

Block directives are processing instructions in the pre-fence zone that control how DataBook-aware tools handle the immediately following block. They use unnamespaced `key=value` syntax within HTML comments.

| Directive key | RDF property | Kind | Cardinality | Description |
|---|---|---|---|---|
| `mode` | `db:blockMode` | controlled string | 0..1 | Primary processing mode for the block. |
| `endpoint` | `db:sparqlEndpoint` | IRI | 0..1 | SPARQL endpoint or execution environment IRI. |
| `cache` | `db:cacheEnabled` | `true`\|`false` | 0..1 | Whether to cache the execution result back into the DataBook. |
| `authority` | `db:assertingAuthority` | IRI | 0..1 | Named authority asserting the content of this block. |
| `version` | `db:blockVersion` | semver string | 0..1 | Block-level version; allows current and prior versions to coexist. |
| `result-iri` | `db:resultIri` | IRI | 0..1 | IRI of the output produced by this block's execution. Set by the processor after execution. |
| `expires` | `db:expires` | `xsd:dateTime` | 0..1 | DateTime after which a cached result is stale and must be re-executed. |

**`mode`** — Permitted values and their semantics:

| Value | Description |
|---|---|
| `executed` | Block is runnable. Submit to `endpoint` or declared runtime. Result may be appended as a new block with provenance. |
| `rendered` | Block content is a rendering specification. Hand to the renderer indicated by the fence language tag (Mermaid, GeoJSON, Vega-Lite, SVG). |
| `printed` | Pretty-print as syntax-highlighted code. The block is for reading, not execution. Default for display code blocks. |
| `hidden` | Block is present and accessible to processors and LLMs reading the DataBook, but suppressed from rendered views. For grounding data, provenance trails, and system metadata. |
| `reference` | Not displayed by default; surfaceable on demand. Distinguished from `hidden`: a client may expose reference blocks explicitly; hidden blocks are never surfaced. |

**`endpoint`** — The SPARQL endpoint or service IRI to submit the block against when `mode=executed`. Overrides any `process.output.url` in frontmatter for this block.

**`cache`** — When `true`, the processor stores the execution result back into the DataBook, appending a result block with provenance. When `false` (the default), the block is re-executed on every load.

**`authority`** — The IRI of the named authority that asserts the content of this block. Feeds into trust-weighted reasoning systems where different authorities may contribute blocks to the same DataBook with different credibility weights.

**`version`** — A block-level semantic version. Allows a DataBook to carry both the current and a prior version of a shape, query, or schema for migration and audit purposes.

**`result-iri`** — Set by the processor after execution of a `mode=executed` block. Records where the output landed (named graph, uploaded endpoint, or file). Not present in the authored document.

**`expires`** — An ISO 8601 dateTime after which a cached result block is considered stale. The processor should re-execute the source block when this threshold is passed.

---

## 3. RDF Representation Notes

When a DataBook is loaded into a triplestore, the YAML frontmatter is serialised to RDF triples with the document `id` as the subject. Block annotation keys serialise to triples on blank node subjects representing each block, linked from the document via `db:hasBlock`. Block directives serialise as additional properties on the same blank node.

The following prefix declarations apply throughout this document and all conformant DataBooks:

```
@prefix db:     <https://w3id.org/databook/ns#> .
@prefix rdf:    <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:   <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:    <http://www.w3.org/2002/07/owl#> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .
@prefix sh:     <http://www.w3.org/ns/shacl#> .
@prefix dcterms:<http://purl.org/dc/terms/> .
@prefix prov:   <http://www.w3.org/ns/prov#> .
```

PROV-O alignment:

| DataBook element | PROV-O class / property |
|---|---|
| Document `id` | `prov:Entity` |
| `process` block | `prov:Activity` |
| `process.inputs[n].iri` | `prov:used` |
| `process.transformer_iri` | `prov:wasAssociatedWith` |
| `process.timestamp` | `prov:endedAtTime` |
| `process.agent.iri` | `prov:wasAttributedTo` |

---

## 4. SHACL Shapes

The three blocks below define the normative SHACL shapes for DataBook validation. They are split by concern:

- **`class-vocabulary`** — OWL class and property declarations for the `db:` namespace.
- **`frontmatter-shapes`** — SHACL node shapes validating the YAML frontmatter structure.
- **`block-zone-shapes`** — SHACL node shapes validating block annotation and directive properties.

> **Note:** Block annotations and directives are parsed from HTML comments and are not intrinsically RDF. The shapes in `block-zone-shapes` apply when annotation metadata has been materialised as RDF triples (e.g. by a DataBook processor loading block metadata into a named graph).

<!-- databook:id: class-vocabulary -->
<!-- databook:label: DataBook namespace class and property declarations -->
<!-- mode=printed -->
```turtle
@prefix db:    <https://w3id.org/databook/ns#> .
@prefix rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix prov:  <http://www.w3.org/ns/prov#> .
@prefix dcterms: <http://purl.org/dc/terms/> .

# ── Ontology declaration ────────────────────────────────────────────────────

<https://w3id.org/databook/ns#> a owl:Ontology ;
    rdfs:label "DataBook Namespace Ontology" ;
    owl:versionInfo "1.2" .

# ── Document type classes ────────────────────────────────────────────────────

db:DataBook a owl:Class ;
    rdfs:label "DataBook" ;
    rdfs:comment "A standard DataBook carrying domain data, queries, shapes, or prompts." ;
    rdfs:subClassOf prov:Entity .

db:TransformerLibrary a owl:Class ;
    rdfs:label "Transformer Library" ;
    rdfs:comment "A DataBook serving as a catalogue of named, reusable transformer definitions." ;
    rdfs:subClassOf db:DataBook .

db:ProcessorRegistry a owl:Class ;
    rdfs:label "Processor Registry" ;
    rdfs:comment "A DataBook serving as a catalogue of named processors with IRI and capability declarations." ;
    rdfs:subClassOf db:DataBook .

# ── Process provenance classes ───────────────────────────────────────────────

db:ProcessStamp a owl:Class ;
    rdfs:label "Process Stamp" ;
    rdfs:comment "Provenance record of the transformation that produced a DataBook." ;
    rdfs:subClassOf prov:Activity .

db:ProcessInput a owl:Class ;
    rdfs:label "Process Input" ;
    rdfs:comment "A source resource consumed by a DataBook transformation." ;
    rdfs:subClassOf prov:Entity .

db:AgentStamp a owl:Class ;
    rdfs:label "Agent Stamp" ;
    rdfs:comment "The person or system that orchestrated a DataBook transformation." ;
    rdfs:subClassOf prov:Agent .

db:AuthorStamp a owl:Class ;
    rdfs:label "Author Stamp" ;
    rdfs:comment "A contributor to the DataBook's content, distinct from the transformation agent." ;
    rdfs:subClassOf prov:Agent .

# ── Graph metadata class ─────────────────────────────────────────────────────

db:GraphMetadata a owl:Class ;
    rdfs:label "Graph Metadata" ;
    rdfs:comment "Metadata about the primary RDF graph payload of a DataBook." .

# ── Block annotation classes ─────────────────────────────────────────────────

db:BlockAnnotation a owl:Class ;
    rdfs:label "Block Annotation" ;
    rdfs:comment "The materialised form of a DataBook block's pre-fence comment zone metadata." .

db:BlockDirective a owl:Class ;
    rdfs:label "Block Directive" ;
    rdfs:comment "The materialised form of processing directive key=value pairs in the pre-fence zone." .

db:ParamDeclaration a owl:Class ;
    rdfs:label "Parameter Declaration" ;
    rdfs:comment "A declared substitutable parameter on a SPARQL query or prompt block." .

# ── Document-level properties ────────────────────────────────────────────────

db:title a owl:DatatypeProperty ;
    rdfs:label "title" ; rdfs:domain db:DataBook ; rdfs:range xsd:string .

db:version a owl:DatatypeProperty ;
    rdfs:label "version" ; rdfs:domain db:DataBook ; rdfs:range xsd:string .

db:created a owl:DatatypeProperty ;
    rdfs:label "created" ; rdfs:domain db:DataBook ; rdfs:range xsd:date .

db:description a owl:DatatypeProperty ;
    rdfs:label "description" ; rdfs:range xsd:string .

db:license a owl:AnnotationProperty ;
    rdfs:label "license" ; rdfs:domain db:DataBook .

db:domain a owl:ObjectProperty ;
    rdfs:label "domain" ; rdfs:domain db:DataBook .

db:subject a owl:DatatypeProperty ;
    rdfs:label "subject" ; rdfs:domain db:DataBook ; rdfs:range xsd:string .

db:tag a owl:DatatypeProperty ;
    rdfs:label "tag" ; rdfs:domain db:DataBook ; rdfs:range xsd:string .

db:publisher a owl:AnnotationProperty ;
    rdfs:label "publisher" ; rdfs:domain db:DataBook .

db:imports a owl:ObjectProperty ;
    rdfs:label "imports" ; rdfs:domain db:DataBook .

db:shapes a owl:ObjectProperty ;
    rdfs:label "shapes" ; rdfs:domain db:DataBook .

db:process a owl:ObjectProperty ;
    rdfs:label "process" ; rdfs:domain db:DataBook ; rdfs:range db:ProcessStamp .

db:author a owl:ObjectProperty ;
    rdfs:label "author" ; rdfs:domain db:DataBook ; rdfs:range db:AuthorStamp .

db:graph a owl:ObjectProperty ;
    rdfs:label "graph" ; rdfs:domain db:DataBook ; rdfs:range db:GraphMetadata .

db:hasBlock a owl:ObjectProperty ;
    rdfs:label "hasBlock" ; rdfs:domain db:DataBook ; rdfs:range db:BlockAnnotation .

# ── Process stamp properties ─────────────────────────────────────────────────

db:transformer a owl:DatatypeProperty ;
    rdfs:label "transformer" ; rdfs:domain db:ProcessStamp ; rdfs:range xsd:string .

db:transformerType a owl:DatatypeProperty ;
    rdfs:label "transformerType" ; rdfs:domain db:ProcessStamp ; rdfs:range xsd:string .

db:transformerIri a owl:ObjectProperty ;
    rdfs:label "transformerIri" ; rdfs:domain db:ProcessStamp .

db:timestamp a owl:DatatypeProperty ;
    rdfs:label "timestamp" ; rdfs:domain db:ProcessStamp ; rdfs:range xsd:dateTime .

db:input a owl:ObjectProperty ;
    rdfs:label "input" ; rdfs:domain db:ProcessStamp ; rdfs:range db:ProcessInput .

db:agent a owl:ObjectProperty ;
    rdfs:label "agent" ; rdfs:domain db:ProcessStamp ; rdfs:range db:AgentStamp .

db:note a owl:DatatypeProperty ;
    rdfs:label "note" ; rdfs:range xsd:string .

db:outputFormat a owl:DatatypeProperty ;
    rdfs:label "outputFormat" ; rdfs:domain db:ProcessStamp ; rdfs:range xsd:string .

db:outputMediaType a owl:DatatypeProperty ;
    rdfs:label "outputMediaType" ; rdfs:domain db:ProcessStamp ; rdfs:range xsd:string .

# ── Process input properties ─────────────────────────────────────────────────

db:sourceIri a owl:ObjectProperty ;
    rdfs:label "sourceIri" ; rdfs:domain db:ProcessInput .

db:role a owl:DatatypeProperty ;
    rdfs:label "role" ; rdfs:range xsd:string .

db:blockId a owl:DatatypeProperty ;
    rdfs:label "blockId" ; rdfs:range xsd:string .

# ── Agent and author properties ───────────────────────────────────────────────

db:agentName a owl:DatatypeProperty ;
    rdfs:label "agentName" ; rdfs:range xsd:string .

db:agentIri a owl:ObjectProperty ;
    rdfs:label "agentIri" .

db:agentRole a owl:DatatypeProperty ;
    rdfs:label "agentRole" ; rdfs:range xsd:string .

db:authorName a owl:DatatypeProperty ;
    rdfs:label "authorName" ; rdfs:range xsd:string .

db:authorIri a owl:ObjectProperty ;
    rdfs:label "authorIri" .

db:authorRole a owl:DatatypeProperty ;
    rdfs:label "authorRole" ; rdfs:range xsd:string .

# ── Graph metadata properties ────────────────────────────────────────────────

db:namespace a owl:ObjectProperty ;
    rdfs:label "namespace" ; rdfs:domain db:GraphMetadata .

db:namedGraph a owl:ObjectProperty ;
    rdfs:label "namedGraph" ; rdfs:domain db:GraphMetadata .

db:tripleCount a owl:DatatypeProperty ;
    rdfs:label "tripleCount" ; rdfs:domain db:GraphMetadata ; rdfs:range xsd:integer .

db:subjectCount a owl:DatatypeProperty ;
    rdfs:label "subjectCount" ; rdfs:domain db:GraphMetadata ; rdfs:range xsd:integer .

db:rdfVersion a owl:DatatypeProperty ;
    rdfs:label "rdfVersion" ; rdfs:domain db:GraphMetadata ; rdfs:range xsd:string .

db:turtleVersion a owl:DatatypeProperty ;
    rdfs:label "turtleVersion" ; rdfs:domain db:GraphMetadata ; rdfs:range xsd:string .

db:usesReification a owl:DatatypeProperty ;
    rdfs:label "usesReification" ; rdfs:domain db:GraphMetadata ; rdfs:range xsd:boolean .

db:validatorNote a owl:DatatypeProperty ;
    rdfs:label "validatorNote" ; rdfs:domain db:GraphMetadata ; rdfs:range xsd:string .

# ── Block annotation properties ──────────────────────────────────────────────

db:blockGraph a owl:ObjectProperty ;
    rdfs:label "blockGraph" ; rdfs:domain db:BlockAnnotation .

db:blockLabel a owl:DatatypeProperty ;
    rdfs:label "blockLabel" ; rdfs:domain db:BlockAnnotation ; rdfs:range xsd:string .

db:blockBase a owl:ObjectProperty ;
    rdfs:label "blockBase" ; rdfs:domain db:BlockAnnotation .

db:blockImport a owl:ObjectProperty ;
    rdfs:label "blockImport" ; rdfs:domain db:BlockAnnotation .

db:blockEncoding a owl:DatatypeProperty ;
    rdfs:label "blockEncoding" ; rdfs:domain db:BlockAnnotation ; rdfs:range xsd:string .

db:blockRuntime a owl:DatatypeProperty ;
    rdfs:label "blockRuntime" ; rdfs:domain db:BlockAnnotation ; rdfs:range xsd:string .

db:blockExecutable a owl:DatatypeProperty ;
    rdfs:label "blockExecutable" ;
    rdfs:comment "Deprecated in v1.2. Use mode=executed directive instead." ;
    owl:deprecated "true"^^xsd:boolean ;
    rdfs:domain db:BlockAnnotation ; rdfs:range xsd:boolean .

db:paramDeclaration a owl:ObjectProperty ;
    rdfs:label "paramDeclaration" ;
    rdfs:domain db:BlockAnnotation ; rdfs:range db:ParamDeclaration .

db:encryptedMediaType a owl:DatatypeProperty ;
    rdfs:label "encryptedMediaType" ; rdfs:domain db:BlockAnnotation ; rdfs:range xsd:string .

db:keyRef a owl:ObjectProperty ;
    rdfs:label "keyRef" ; rdfs:domain db:BlockAnnotation .

# ── Block directive properties ────────────────────────────────────────────────

db:blockMode a owl:DatatypeProperty ;
    rdfs:label "blockMode" ; rdfs:domain db:BlockDirective ; rdfs:range xsd:string .

db:sparqlEndpoint a owl:ObjectProperty ;
    rdfs:label "sparqlEndpoint" ; rdfs:domain db:BlockDirective .

db:cacheEnabled a owl:DatatypeProperty ;
    rdfs:label "cacheEnabled" ; rdfs:domain db:BlockDirective ; rdfs:range xsd:boolean .

db:assertingAuthority a owl:ObjectProperty ;
    rdfs:label "assertingAuthority" ; rdfs:domain db:BlockDirective .

db:blockVersion a owl:DatatypeProperty ;
    rdfs:label "blockVersion" ; rdfs:domain db:BlockDirective ; rdfs:range xsd:string .

db:resultIri a owl:ObjectProperty ;
    rdfs:label "resultIri" ; rdfs:domain db:BlockDirective .

db:expires a owl:DatatypeProperty ;
    rdfs:label "expires" ; rdfs:domain db:BlockDirective ; rdfs:range xsd:dateTime .

# ── Parameter declaration properties ─────────────────────────────────────────

db:paramName a owl:DatatypeProperty ;
    rdfs:label "paramName" ; rdfs:domain db:ParamDeclaration ; rdfs:range xsd:string .

db:paramType a owl:DatatypeProperty ;
    rdfs:label "paramType" ; rdfs:domain db:ParamDeclaration ; rdfs:range xsd:string .

db:paramDefault a owl:DatatypeProperty ;
    rdfs:label "paramDefault" ; rdfs:domain db:ParamDeclaration ; rdfs:range xsd:string .

db:paramRequired a owl:DatatypeProperty ;
    rdfs:label "paramRequired" ; rdfs:domain db:ParamDeclaration ; rdfs:range xsd:boolean .
```

<!-- databook:id: frontmatter-shapes -->
<!-- databook:label: SHACL shapes for DataBook YAML frontmatter -->
<!-- mode=printed -->
```shacl
@prefix db:   <https://w3id.org/databook/ns#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

# ─────────────────────────────────────────────────────────────────────────────
# DataBook document shape  (applies to all three document types)
# ─────────────────────────────────────────────────────────────────────────────

db:DataBookShape
    a sh:NodeShape ;
    rdfs:label "DataBook Document Shape" ;
    sh:targetClass db:DataBook, db:TransformerLibrary, db:ProcessorRegistry ;

    # title — required, exactly one, non-empty string
    sh:property [
        sh:path     db:title ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:minLength 1 ;
        sh:message  "Every DataBook must have exactly one non-empty title." ;
        rdfs:label  "title"
    ] ;

    # version — required, semver pattern
    sh:property [
        sh:path     db:version ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:pattern  "^\\d+\\.\\d+\\.\\d+$" ;
        sh:message  "version must be a semantic version string (MAJOR.MINOR.PATCH)." ;
        rdfs:label  "version"
    ] ;

    # created — required, xsd:date
    sh:property [
        sh:path     db:created ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:date ;
        sh:message  "Every DataBook must have a creation date (YYYY-MM-DD)." ;
        rdfs:label  "created"
    ] ;

    # process — required, exactly one, must conform to ProcessStampShape
    sh:property [
        sh:path     db:process ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:node     db:ProcessStampShape ;
        sh:message  "Every DataBook must have a process provenance stamp." ;
        rdfs:label  "process"
    ] ;

    # description — optional, at most one
    sh:property [
        sh:path     db:description ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        rdfs:label  "description"
    ] ;

    # license — optional, at most one, IRI or string
    sh:property [
        sh:path     db:license ;
        sh:maxCount 1 ;
        rdfs:label  "license"
    ] ;

    # domain — optional, at most one, must be an IRI
    sh:property [
        sh:path     db:domain ;
        sh:maxCount 1 ;
        sh:nodeKind sh:IRI ;
        rdfs:label  "domain"
    ] ;

    # imports — optional, zero or more, each an IRI
    sh:property [
        sh:path     db:imports ;
        sh:nodeKind sh:IRI ;
        rdfs:label  "imports"
    ] ;

    # shapes — optional, zero or more, each an IRI
    sh:property [
        sh:path     db:shapes ;
        sh:nodeKind sh:IRI ;
        rdfs:label  "shapes"
    ] ;

    # graph metadata — optional, at most one
    sh:property [
        sh:path     db:graph ;
        sh:maxCount 1 ;
        sh:node     db:GraphMetadataShape ;
        rdfs:label  "graph"
    ] ;

    # author — optional, zero or more
    sh:property [
        sh:path db:author ;
        sh:node db:AuthorStampShape ;
        rdfs:label "author"
    ] .

# ─────────────────────────────────────────────────────────────────────────────
# Process stamp shape
# ─────────────────────────────────────────────────────────────────────────────

db:ProcessStampShape
    a sh:NodeShape ;
    rdfs:label "Process Stamp Shape" ;
    sh:targetClass db:ProcessStamp ;

    sh:property [
        sh:path     db:transformer ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:minLength 1 ;
        sh:message  "Process stamp must name the transformer." ;
        rdfs:label  "transformer"
    ] ;

    sh:property [
        sh:path     db:transformerType ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:in       ( "llm" "human" "script" "xslt" "sparql" "shacl"
                      "service" "composite" "library-transform" "registry-processor" ) ;
        sh:message  "transformerType must be one of the defined vocabulary values." ;
        rdfs:label  "transformer_type"
    ] ;

    sh:property [
        sh:path     db:transformerIri ;
        sh:maxCount 1 ;
        sh:nodeKind sh:IRI ;
        rdfs:label  "transformer_iri"
    ] ;

    sh:property [
        sh:path     db:timestamp ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:dateTime ;
        sh:message  "Process stamp must have an ISO 8601 dateTime timestamp." ;
        rdfs:label  "timestamp"
    ] ;

    sh:property [
        sh:path     db:input ;
        sh:minCount 1 ;
        sh:node     db:ProcessInputShape ;
        sh:message  "Process stamp must declare at least one input." ;
        rdfs:label  "inputs"
    ] ;

    sh:property [
        sh:path db:agent ;
        sh:maxCount 1 ;
        sh:node db:AgentStampShape ;
        rdfs:label "agent"
    ] ;

    sh:property [
        sh:path     db:note ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        rdfs:label  "note"
    ] ;

    sh:property [
        sh:path     db:outputFormat ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        rdfs:label  "output_format"
    ] ;

    sh:property [
        sh:path     db:outputMediaType ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        rdfs:label  "output_media_type"
    ] .

# ─────────────────────────────────────────────────────────────────────────────
# Process input shape
# ─────────────────────────────────────────────────────────────────────────────

db:ProcessInputShape
    a sh:NodeShape ;
    rdfs:label "Process Input Shape" ;
    sh:targetClass db:ProcessInput ;

    sh:property [
        sh:path     db:sourceIri ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:nodeKind sh:IRI ;
        sh:message  "Each process input must declare its source IRI." ;
        rdfs:label  "iri"
    ] ;

    sh:property [
        sh:path     db:role ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:in       ( "primary" "constraint" "context" "evidence" "reference" "template" ) ;
        sh:message  "Input role must be one of: primary, constraint, context, evidence, reference, template." ;
        rdfs:label  "role"
    ] ;

    sh:property [
        sh:path     db:description ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        rdfs:label  "description"
    ] ;

    sh:property [
        sh:path     db:blockId ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        rdfs:label  "block_id"
    ] .

# ─────────────────────────────────────────────────────────────────────────────
# Agent stamp shape
# ─────────────────────────────────────────────────────────────────────────────

db:AgentStampShape
    a sh:NodeShape ;
    rdfs:label "Agent Stamp Shape" ;
    sh:targetClass db:AgentStamp ;

    sh:property [
        sh:path     db:agentName ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:minLength 1 ;
        sh:message  "Agent stamp must carry a name." ;
        rdfs:label  "name"
    ] ;

    sh:property [
        sh:path     db:agentIri ;
        sh:maxCount 1 ;
        sh:nodeKind sh:IRI ;
        rdfs:label  "iri"
    ] ;

    sh:property [
        sh:path     db:agentRole ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:in       ( "orchestrator" "contributor" "reviewer" "validator" ) ;
        rdfs:label  "role"
    ] .

# ─────────────────────────────────────────────────────────────────────────────
# Author stamp shape
# ─────────────────────────────────────────────────────────────────────────────

db:AuthorStampShape
    a sh:NodeShape ;
    rdfs:label "Author Stamp Shape" ;
    sh:targetClass db:AuthorStamp ;

    sh:property [
        sh:path     db:authorName ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:minLength 1 ;
        sh:message  "Author stamp must carry a name." ;
        rdfs:label  "name"
    ] ;

    sh:property [
        sh:path     db:authorIri ;
        sh:maxCount 1 ;
        sh:nodeKind sh:IRI ;
        rdfs:label  "iri"
    ] ;

    sh:property [
        sh:path     db:authorRole ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:in       ( "orchestrator" "transformer" "reviewer" "editor" "contributor" ) ;
        rdfs:label  "role"
    ] .

# ─────────────────────────────────────────────────────────────────────────────
# Graph metadata shape
# ─────────────────────────────────────────────────────────────────────────────

db:GraphMetadataShape
    a sh:NodeShape ;
    rdfs:label "Graph Metadata Shape" ;
    sh:targetClass db:GraphMetadata ;

    sh:property [
        sh:path     db:namedGraph ;
        sh:maxCount 1 ;
        sh:nodeKind sh:IRI ;
        rdfs:label  "named_graph"
    ] ;

    sh:property [
        sh:path          db:tripleCount ;
        sh:maxCount      1 ;
        sh:datatype      xsd:integer ;
        sh:minInclusive  0 ;
        sh:message       "triple_count must be a non-negative integer." ;
        rdfs:label       "triple_count"
    ] ;

    sh:property [
        sh:path          db:subjectCount ;
        sh:maxCount      1 ;
        sh:datatype      xsd:integer ;
        sh:minInclusive  0 ;
        rdfs:label       "subjects"
    ] ;

    sh:property [
        sh:path     db:rdfVersion ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:in       ( "1.1" "1.2" ) ;
        sh:message  "rdf_version must be '1.1' or '1.2'." ;
        rdfs:label  "rdf_version"
    ] ;

    sh:property [
        sh:path     db:turtleVersion ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:in       ( "1.1" "1.2" ) ;
        sh:message  "turtle_version must be '1.1' or '1.2'." ;
        rdfs:label  "turtle_version"
    ] ;

    sh:property [
        sh:path     db:usesReification ;
        sh:maxCount 1 ;
        sh:datatype xsd:boolean ;
        rdfs:label  "reification"
    ] ;

    sh:property [
        sh:path     db:validatorNote ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        rdfs:label  "validator_note"
    ] .
```

<!-- databook:id: block-zone-shapes -->
<!-- databook:label: SHACL shapes for block annotation and directive properties -->
<!-- mode=printed -->
```shacl
@prefix db:   <https://w3id.org/databook/ns#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

# ─────────────────────────────────────────────────────────────────────────────
# Block annotation shape  (materialised form of databook:* comment keys)
# ─────────────────────────────────────────────────────────────────────────────

db:BlockAnnotationShape
    a sh:NodeShape ;
    rdfs:label "Block Annotation Shape" ;
    sh:targetClass db:BlockAnnotation ;

    # blockId — required, kebab-case, unique per document (uniqueness enforced
    # at the document level; the shape enforces format only)
    sh:property [
        sh:path     db:blockId ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:pattern  "^[a-z][a-z0-9-]*$" ;
        sh:message  "databook:id must be present, unique within the document, and in kebab-case." ;
        rdfs:label  "databook:id"
    ] ;

    sh:property [
        sh:path     db:blockGraph ;
        sh:maxCount 1 ;
        sh:nodeKind sh:IRI ;
        rdfs:label  "databook:graph"
    ] ;

    sh:property [
        sh:path     db:blockLabel ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        rdfs:label  "databook:label"
    ] ;

    sh:property [
        sh:path     db:blockBase ;
        sh:maxCount 1 ;
        sh:nodeKind sh:IRI ;
        rdfs:label  "databook:base"
    ] ;

    # blockImport — zero or more, each an IRI
    sh:property [
        sh:path     db:blockImport ;
        sh:nodeKind sh:IRI ;
        rdfs:label  "databook:import"
    ] ;

    sh:property [
        sh:path     db:blockEncoding ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        rdfs:label  "databook:encoding"
    ] ;

    sh:property [
        sh:path     db:blockRuntime ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        rdfs:label  "databook:runtime"
    ] ;

    # paramDeclaration — zero or more; each must conform to ParamDeclarationShape
    sh:property [
        sh:path db:paramDeclaration ;
        sh:node db:ParamDeclarationShape ;
        rdfs:label "databook:param"
    ] ;

    sh:property [
        sh:path     db:encryptedMediaType ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        rdfs:label  "databook:encrypted-media-type"
    ] ;

    sh:property [
        sh:path     db:keyRef ;
        sh:maxCount 1 ;
        sh:nodeKind sh:IRI ;
        rdfs:label  "databook:key-ref"
    ] ;

    # blockExecutable — deprecated; accepted but flagged
    sh:property [
        sh:path     db:blockExecutable ;
        sh:maxCount 1 ;
        sh:datatype xsd:boolean ;
        sh:message  "databook:executable is deprecated in v1.2. Use mode=executed directive instead." ;
        rdfs:label  "databook:executable (deprecated)"
    ] .

# ─────────────────────────────────────────────────────────────────────────────
# Block directive shape  (materialised form of mode=, endpoint=, etc.)
# ─────────────────────────────────────────────────────────────────────────────

db:BlockDirectiveShape
    a sh:NodeShape ;
    rdfs:label "Block Directive Shape" ;
    sh:targetClass db:BlockDirective ;

    sh:property [
        sh:path     db:blockMode ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:in       ( "executed" "rendered" "printed" "hidden" "reference" ) ;
        sh:message  "mode must be one of: executed, rendered, printed, hidden, reference." ;
        rdfs:label  "mode"
    ] ;

    sh:property [
        sh:path     db:sparqlEndpoint ;
        sh:maxCount 1 ;
        sh:nodeKind sh:IRI ;
        rdfs:label  "endpoint"
    ] ;

    sh:property [
        sh:path     db:cacheEnabled ;
        sh:maxCount 1 ;
        sh:datatype xsd:boolean ;
        rdfs:label  "cache"
    ] ;

    sh:property [
        sh:path     db:assertingAuthority ;
        sh:maxCount 1 ;
        sh:nodeKind sh:IRI ;
        rdfs:label  "authority"
    ] ;

    sh:property [
        sh:path     db:blockVersion ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:pattern  "^\\d+\\.\\d+\\.\\d+$" ;
        sh:message  "Block version must be a semantic version string (MAJOR.MINOR.PATCH)." ;
        rdfs:label  "version"
    ] ;

    sh:property [
        sh:path     db:resultIri ;
        sh:maxCount 1 ;
        sh:nodeKind sh:IRI ;
        rdfs:label  "result-iri"
    ] ;

    sh:property [
        sh:path     db:expires ;
        sh:maxCount 1 ;
        sh:datatype xsd:dateTime ;
        sh:message  "expires must be an ISO 8601 dateTime." ;
        rdfs:label  "expires"
    ] .

# ─────────────────────────────────────────────────────────────────────────────
# Co-occurrence constraint: endpoint requires mode=executed
# ─────────────────────────────────────────────────────────────────────────────

db:EndpointRequiresModeExecuted
    a sh:NodeShape ;
    rdfs:label "Endpoint Requires mode=executed" ;
    sh:targetClass db:BlockDirective ;
    sh:sparql [
        a sh:SPARQLConstraint ;
        rdfs:label "endpoint= must only appear with mode=executed" ;
        sh:message "A block directive with endpoint= must also declare mode=executed." ;
        sh:prefixes db: ;
        sh:select """
            PREFIX db: <https://w3id.org/databook/ns#>
            SELECT $this WHERE {
                $this db:sparqlEndpoint ?ep .
                FILTER NOT EXISTS { $this db:blockMode "executed" }
            }
        """
    ] .

# ─────────────────────────────────────────────────────────────────────────────
# Parameter declaration shape
# ─────────────────────────────────────────────────────────────────────────────

db:ParamDeclarationShape
    a sh:NodeShape ;
    rdfs:label "Parameter Declaration Shape" ;
    sh:targetClass db:ParamDeclaration ;

    sh:property [
        sh:path     db:paramName ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:pattern  "^[A-Z][A-Z0-9_]*$" ;
        sh:message  "Parameter name must be an uppercase identifier (VARNAME convention)." ;
        rdfs:label  "VARNAME"
    ] ;

    sh:property [
        sh:path     db:paramType ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:in       ( "IRI" "string" "integer" "boolean" "date" "dateTime" ) ;
        sh:message  "Parameter type must be one of: IRI, string, integer, boolean, date, dateTime." ;
        rdfs:label  "type"
    ] ;

    sh:property [
        sh:path     db:paramDefault ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        rdfs:label  "default"
    ] ;

    sh:property [
        sh:path     db:paramRequired ;
        sh:maxCount 1 ;
        sh:datatype xsd:boolean ;
        rdfs:label  "required"
    ] .
```

---

*End of document.*

*© 2026 Kurt Cagle / Chloe Shannon — HolonGraph. Licensed under CC-BY-4.0.*
