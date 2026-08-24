---
id: https://w3id.org/holon/databook#
title: "Holon DataBook Header Shapes (SHACL 1.2) — DataBook v2.0 Draft Module"
type: databook
version: 2.0.0-alpha.1
created: 2026-08-24
description: >
  SHACL 1.2 shapes mapping the DataBook YAML frontmatter (spec:
  github.com/kurtcagle/databook) onto RDF properties in a dedicated bridge
  namespace, https://w3id.org/holon/databook# (databook:) — not the core Holon
  Graph Architecture ontology namespace directly. The bridge namespace
  isolates DataBook-spec churn from the core ontology's term-space while
  the frontmatter — HGA context layer L3 — is lifted into an RDF 1.2
  databook:DataBookHeader node. Every property shape carries an IRI, sh:name,
  and sh:codeIdentifier (the literal YAML key path), and the shapes graph
  declares its namespace prefixes via sh:declare. Proposed as a candidate
  building block for DataBook v2.0, offered for review by the HCG DataBook
  WG; supersedes an earlier same-day draft published directly under the
  core holon: namespace (see process.inputs and process.note below).
domain: https://w3id.org/holon/databook#
subject:
  - SHACL 1.2
  - RDF 1.2
  - HGA context layer
  - DataBook v2.0
tags:
  - shacl
  - holon-bridge
  - databook
  - rdf12
  - v2-draft
shapes:
  - https://w3id.org/holon/databook#DataBookHeaderShape
  - https://w3id.org/holon/databook#ProcessStampShape
  - https://w3id.org/holon/databook#GraphMetadataShape
graph:
  namespace: https://w3id.org/holon/databook#
  named_graph: https://w3id.org/holon/databook#graph
  triple_count: 738
  subjects: 111
  rdf_version: "1.1"
  turtle_version: "1.1"
  reification: false
  validator_note: >
    Shapes conform to the SHACL 1.2 Core vocabulary (sh:codeIdentifier,
    sh:declare) but the Turtle serialisation itself uses no RDF 1.2
    reification syntax, so any RDF 1.1- or 1.2-compliant parser (rdflib,
    N3.js, Apache Jena) can load it without a workaround. Parsed and
    triple-counted with rdflib 7.x prior to publication.
process:
  transformer: "Claude Sonnet 5"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-5
  inputs:
    - iri: https://www.w3.org/TR/2026/WD-shacl12-core-20260803/
      role: constraint
      description: "SHACL 1.2 Core Working Draft — normative vocabulary for sh:codeIdentifier, sh:declare, and property-shape IRI conventions."
    - iri: https://github.com/kurtcagle/databook/blob/main/databook-property-reference.databook.md
      role: reference
      description: "Canonical db: namespace YAML frontmatter to RDF mapping — source field inventory for this databook: reprojection."
    - iri: https://ontologist.io/ns/holon/shapes/databook-header-v1
      role: reference
      description: "Prior same-day draft of this shapes module, published directly under the core holon: (ontologist.io/ns/holon#) namespace; superseded after a namespace-design discussion (see process.note)."
  timestamp: 2026-08-24T02:00:00Z
  agent:
    name: Kurt Cagle
    role: orchestrator
  note: >
    Reworked onto a dedicated bridge namespace, https://w3id.org/holon/databook#,
    following a design discussion: the core HGA ontology should stay free of
    DataBook-spec churn and generic term collisions (title, version, role,
    timestamp, etc.), and DataBook's own build: vocabulary
    (w3id.org/databook/ns#) is architecture-agnostic pipeline vocabulary, not
    HGA-context-layer semantics. Framed as the start of a DataBook v2.0 line,
    offered as a candidate module for the HCG DataBook WG (lead: Mark Hebert)
    alongside the Harmonization WG's cross-ontology consistency remit. Also
    fixed the version property shape's regex, which previously rejected
    semver pre-release tags like the one this very document now uses.
  output_format: shacl
  output_media_type: text/turtle
---

## Vocabulary Index

Classes and properties defined by the shapes below, sorted alphabetically
first by class, then by property. `Code Identifier` reproduces the
`sh:codeIdentifier` literal on the corresponding property shape verbatim.

| Class | Property | Code Identifier | Description |
|---|---|---|---|
| databook:AgentStamp | databook:agentIri | `process.agent.iri` | Stable IRI identifying the orchestrating agent, when distinct from the transformer itself. |
| databook:AgentStamp | databook:agentName | `process.agent.name` | Display name of the orchestrating agent, when distinct from the transformer itself. |
| databook:AgentStamp | databook:agentRole | `process.agent.role` | Role of the orchestrating agent: orchestrator, contributor, reviewer, or validator. |
| databook:AuthorStamp | databook:authorIri | `author[].iri` | Stable IRI identifying this contributor. |
| databook:AuthorStamp | databook:authorName | `author[].name` | Full name of this contributor. |
| databook:AuthorStamp | databook:authorRole | `author[].role` | Role of this contributor: orchestrator, transformer, reviewer, editor, or contributor. |
| databook:DataBookHeader | databook:author | `author[]` | List of contributors to the DataBook; each entry conforms to AuthorStamp. |
| databook:DataBookHeader | databook:created | `created` | Calendar date the DataBook was authored or generated (YYYY-MM-DD). |
| databook:DataBookHeader | databook:description | `description` | One-paragraph abstract for catalogue and discovery use. |
| databook:DataBookHeader | databook:domain | `domain` | IRI of the primary ontology namespace the data blocks instantiate. |
| databook:DataBookHeader | databook:graph | `graph` | Metadata about the primary RDF graph payload; conforms to GraphMetadata. |
| databook:DataBookHeader | databook:imports | `imports[]` | IRIs of other DataBooks whose prefix declarations and namespace context this document inherits. |
| databook:DataBookHeader | databook:license | `license` | SPDX identifier or IRI of the licence governing the DataBook's content. |
| databook:DataBookHeader | databook:process | `process` | Provenance stamp of the transformer that produced the DataBook; conforms to ProcessStamp. |
| databook:DataBookHeader | databook:publisher | `publisher` | Organisation or person responsible for publishing or distributing the DataBook. |
| databook:DataBookHeader | databook:shapes | `shapes[]` | IRIs of SHACL shapes this DataBook's data is expected to conform to (informational). |
| databook:DataBookHeader | databook:subject | `subject[]` | Free-text subject terms for catalogue indexing. |
| databook:DataBookHeader | databook:tag | `tags[]` | Short categorical labels for faceted filtering. |
| databook:DataBookHeader | databook:title | `title` | Human-readable name of the DataBook. |
| databook:DataBookHeader | rdf:type | `type` | Structural role of the document: databook, transformer-library, or processor-registry. |
| databook:DataBookHeader | databook:version | `version` | Semantic version string (MAJOR.MINOR.PATCH) of the DataBook. |
| databook:GraphMetadata | databook:namedGraph | `graph.named_graph` | Named graph IRI under which this DataBook's content should be loaded. |
| databook:GraphMetadata | databook:namespace | `graph.namespace` | Primary ontology namespace IRI for the graph content. |
| databook:GraphMetadata | databook:rdfVersion | `graph.rdf_version` | RDF version of the graph payload: "1.1" or "1.2". |
| databook:GraphMetadata | databook:subjectCount | `graph.subjects` | Number of distinct subject IRIs in the primary data block. |
| databook:GraphMetadata | databook:tripleCount | `graph.triple_count` | Total number of triples in the primary data block. |
| databook:GraphMetadata | databook:turtleVersion | `graph.turtle_version` | Turtle serialisation version used: "1.1" or "1.2". |
| databook:GraphMetadata | databook:usesReification | `graph.reification` | True if the graph uses RDF 1.2 reification syntax. |
| databook:GraphMetadata | databook:validatorNote | `graph.validator_note` | Free-text note on validation prerequisites or parser quirks. |
| databook:OutputSpec | databook:outputFile | `process.output.file` | Local filesystem path for the output file. |
| databook:OutputSpec | databook:outputGraph | `process.output.graph` | Named graph IRI to load the output into. |
| databook:OutputSpec | databook:outputUrl | `process.output.url` | Upload endpoint URL for GSP or a similar push target. |
| databook:ProcessInput | databook:blockId | `process.inputs[].block_id` | Fragment ID of a specific block within the input DataBook. |
| databook:ProcessInput | databook:description | `process.inputs[].description` | Human-readable note on what this input contributed to the transformation. |
| databook:ProcessInput | databook:role | `process.inputs[].role` | Role of this input: primary, constraint, context, evidence, reference, or template. |
| databook:ProcessInput | databook:sourceIri | `process.inputs[].iri` | Stable IRI of the input resource. |
| databook:ProcessorRegistryHeader | — | `—` | Subclass of DataBookHeader for type: processor-registry; inherits all DataBookHeader properties, no properties of its own. |
| databook:ProcessStamp | databook:agent | `process.agent` | Person or system that orchestrated the transformation, when distinct from the transformer; conforms to AgentStamp. |
| databook:ProcessStamp | databook:input | `process.inputs[]` | Source DataBooks or resources consumed by this transformation; conforms to ProcessInput. |
| databook:ProcessStamp | databook:note | `process.note` | Free-text note on non-determinism, limitations, or manual post-processing. |
| databook:ProcessStamp | databook:output | `process.output` | Output routing specification; conforms to OutputSpec. |
| databook:ProcessStamp | databook:outputFormat | `process.output_format` | Fence label of the primary output block type, e.g. turtle, shacl, sparql. |
| databook:ProcessStamp | databook:outputMediaType | `process.output_media_type` | MIME type of the primary output, e.g. text/turtle. |
| databook:ProcessStamp | databook:timestamp | `process.timestamp` | ISO 8601 dateTime of the transformation. |
| databook:ProcessStamp | databook:transformer | `process.transformer` | Display name of the transformer that produced the DataBook's content. |
| databook:ProcessStamp | databook:transformerIri | `process.transformer_iri` | Stable IRI identifying the specific transformer instance. |
| databook:ProcessStamp | databook:transformerType | `process.transformer_type` | Category of transformer: llm, human, script, xslt, sparql, shacl, service, composite, library-transform, or registry-processor. |
| databook:TransformerLibraryHeader | — | `—` | Subclass of DataBookHeader for type: transformer-library; inherits all DataBookHeader properties, no properties of its own. |

## Overview

This DataBook carries the SHACL 1.2 shapes graph that projects a DataBook's
YAML frontmatter onto a **dedicated bridge namespace**,
`https://w3id.org/holon/databook#` (prefix `databook:`) — deliberately *not* the
core Holon Graph Architecture ontology namespace
(`https://ontologist.io/ns/holon#`, prefix `holon:`). The frontmatter
describes DataBook document and provenance metadata, which is a different
kind of thing from the domain content the core ontology describes (scene,
event, and boundary graphs; containment and connection relations). Keeping
it in its own namespace means DataBook-spec churn — and generic names like
`title`, `version`, `role`, `timestamp` — never collide with core HGA terms,
while `databook:DataBookHeader` and friends still chain into PROV-O
(`rdfs:subClassOf prov:Entity`/`prov:Activity`/`prov:Agent`) as the
vocabulary-agnostic interop point. Once lifted, the header still serves the
same role as before: the HGA context/boundary layer (L3) of a
DataBook-backed holon.

This module is offered as a **candidate building block for DataBook v2.0**,
for review by the HCG DataBook WG. It supersedes an earlier same-day draft
published directly under the core `holon:` namespace — a design correction
made before anything consumed it, not a second coexisting version (see
`process.inputs` and `process.note` for the full account, and
`owl:priorVersion` in the shapes graph itself for the machine-readable
link).

The shapes graph itself is the primary data block below; its own
frontmatter here follows the same DataBook spec it describes.

Every `sh:PropertyShape` in the block is a named IRI (never a blank node)
and carries `sh:name` (human label) and `sh:codeIdentifier` (the literal
YAML key path — dot-notation for nested keys, a trailing `[]` for
sequences). A generic YAML→RDF mapper walks the shapes graph and resolves
each `sh:codeIdentifier` against the parsed frontmatter with a plain
path-get.

The one frontmatter key with no corresponding property shape is `id`
itself — it supplies the header node's own subject IRI rather than a
predicate value.

## SHACL Shapes

<!-- databook:id: holon-databook-header-shapes -->
<!-- databook:label: Holon DataBook Header Shapes (SHACL 1.2) -->
<!-- databook:graph: https://w3id.org/holon/databook# -->
<!-- mode=printed -->
```shacl
# =============================================================================
# Holon DataBook Header Shapes  (SHACL 1.2) — DataBook v2.0 draft module
# -----------------------------------------------------------------------------
# Maps the YAML frontmatter of a DataBook (spec: github.com/kurtcagle/databook,
# canonical build vocabulary https://w3id.org/databook/ns# prefix db:) onto RDF
# properties in a DEDICATED bridge namespace, https://w3id.org/holon/databook#
# (prefix databook:) — NOT the core Holon Graph Architecture ontology namespace
# (https://ontologist.io/ns/holon#, prefix holon:) directly.
#
# Why a separate namespace: this vocabulary describes DataBook document/
# provenance metadata (title, version, author, transformer stamp) so it can be
# lifted into the HGA context layer (L3); it does not describe holon domain
# content (scene/event/boundary graphs, containment/connection). Living in its
# own namespace keeps churn in the fast-moving DataBook spec (currently
# targeting v2.0) out of the core ontology's term-space, and keeps generic
# names like `title`/`version`/`role`/`timestamp` from ever colliding with
# core HGA terms. `databook:DataBookHeader` etc. still chain into PROV-O
# (rdfs:subClassOf prov:Entity/Activity/Agent) as the vocabulary-agnostic
# interop point; a formal join to a future `holon:ContextLayer` class, if the
# core ontology defines one, belongs here as a single deliberate
# rdfs:subClassOf assertion, not 44 properties sharing a term-space.
#
# Note the prefix `databook:` (this module, https://w3id.org/holon/databook#)
# is distinct from `db:` (DataBook's existing build/pipeline vocabulary,
# https://w3id.org/databook/ns# — build:Target, build:Stage, etc.). Both
# names derive from "DataBook" but address different concerns: `db:` is
# architecture-agnostic pipeline structure; `databook:` is this
# frontmatter-to-HGA-context-layer bridge.
#
# Status: proposed as a candidate building block for DataBook v2.0, offered
# for review by the HCG DataBook WG. Supersedes an earlier same-day draft
# published directly under the core holon: namespace (see owl:priorVersion
# below) — this reflects a design correction, not two coexisting versions.
#
# Every sh:PropertyShape below carries an IRI (never a blank node) and both
# sh:name (human-readable label) and sh:codeIdentifier — the literal YAML
# frontmatter key path exactly as it appears in the parsed header object.
# Dot-notation addresses nested mappings (`process.timestamp`); a trailing
# `[]` marks a YAML sequence whose members each become one value of sh:path,
# or one instance of the sh:node target shape for object-valued sequences
# (`author[]`, `process.inputs[]`). A generic YAML->RDF mapper walks this
# shapes graph, resolves each sh:codeIdentifier against the parsed
# frontmatter with a path-get (lodash.get / operator.attrgetter-style), and
# asserts sh:path with the converted value(s) on the header node (or on a
# fresh blank/IRI node for sh:node-typed properties, itself validated by the
# referenced shape).
#
# The YAML `id` field is the one frontmatter key with NO corresponding
# property shape below: it supplies the subject IRI of the header node
# itself (`@id` in JSON-LD terms), not a predicate value. `type` maps to
# rdf:type via the DataBookHeaderShape-type property shape, whose sh:in
# enumerates the three permitted target classes.
#
# Conformance: W3C SHACL 1.2 Core, Working Draft 03 August 2026
#   https://www.w3.org/TR/2026/WD-shacl12-core-20260803/
# Every sh:PropertyShape is its own dereferenceable IRI, following the
# ex:PersonShape-ssn convention shown in SHACL 1.2 Core §2.3. Inline
# blank-node shapes are used only as members of sh:or lists — standard SHACL
# practice, not itself a property shape.
# =============================================================================

@prefix databook:     <https://w3id.org/holon/databook#> .
@prefix db:      <https://w3id.org/databook/ns#> .
@prefix sh:      <http://www.w3.org/ns/shacl#> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .
@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:     <http://www.w3.org/2002/07/owl#> .
@prefix prov:    <http://www.w3.org/ns/prov#> .
@prefix dcterms: <http://purl.org/dc/terms/> .


# =============================================================================
# 0. Shapes graph identity + sh:declare prefix table
# -----------------------------------------------------------------------------
# sh:declare is defined by SHACL 1.2 SPARQL Extensions: a resource with
# values for sh:prefix (xsd:string) and sh:namespace (xsd:anyURI) is a
# prefix declaration; sh:declare on the shapes graph / owl:Ontology subject
# collects them. This lets any embedded SPARQL constraint in this graph
# auto-resolve prefixes, and gives non-SPARQL tooling a machine-readable
# prefix table without depending on the surrounding Turtle @prefix lines.
# =============================================================================

<https://w3id.org/holon/databook#>
    a owl:Ontology , sh:ShapesGraph ;
    rdfs:label "Holon DataBook Header Shapes"@en ;
    rdfs:comment "SHACL 1.2 shapes mapping DataBook YAML frontmatter onto a dedicated databook: bridge namespace, for RDF 1.2 conversion into the HGA context layer (L3). Distinct from the core Holon Graph Architecture ontology namespace."@en ;
    owl:versionInfo "2.0.0-alpha.1" ;
    owl:priorVersion <https://ontologist.io/ns/holon/shapes/databook-header-v1> ;
    owl:imports <http://www.w3.org/ns/shacl#> ;
    sh:declare
        [ a sh:PrefixDeclaration ; sh:prefix "databook" ; sh:namespace "https://w3id.org/holon/databook#"^^xsd:anyURI ] ,
        [ a sh:PrefixDeclaration ; sh:prefix "db"      ; sh:namespace "https://w3id.org/databook/ns#"^^xsd:anyURI ] ,
        [ a sh:PrefixDeclaration ; sh:prefix "xsd"     ; sh:namespace "http://www.w3.org/2001/XMLSchema#"^^xsd:anyURI ] ,
        [ a sh:PrefixDeclaration ; sh:prefix "rdf"     ; sh:namespace "http://www.w3.org/1999/02/22-rdf-syntax-ns#"^^xsd:anyURI ] ,
        [ a sh:PrefixDeclaration ; sh:prefix "rdfs"    ; sh:namespace "http://www.w3.org/2000/01/rdf-schema#"^^xsd:anyURI ] ,
        [ a sh:PrefixDeclaration ; sh:prefix "owl"     ; sh:namespace "http://www.w3.org/2002/07/owl#"^^xsd:anyURI ] ,
        [ a sh:PrefixDeclaration ; sh:prefix "sh"      ; sh:namespace "http://www.w3.org/ns/shacl#"^^xsd:anyURI ] ,
        [ a sh:PrefixDeclaration ; sh:prefix "prov"    ; sh:namespace "http://www.w3.org/ns/prov#"^^xsd:anyURI ] ,
        [ a sh:PrefixDeclaration ; sh:prefix "dcterms" ; sh:namespace "http://purl.org/dc/terms/"^^xsd:anyURI ] .


# =============================================================================
# 1. Classes
# =============================================================================

databook:DataBookHeader a owl:Class ;
    rdfs:label "DataBook Header"@en ;
    rdfs:comment "RDF projection of a DataBook's YAML frontmatter, addressed by the DataBook's own `id` IRI."@en ;
    rdfs:subClassOf prov:Entity .

databook:TransformerLibraryHeader a owl:Class ;
    rdfs:label "Transformer Library Header"@en ;
    rdfs:comment "Header of a DataBook whose YAML `type` is transformer-library."@en ;
    rdfs:subClassOf databook:DataBookHeader .

databook:ProcessorRegistryHeader a owl:Class ;
    rdfs:label "Processor Registry Header"@en ;
    rdfs:comment "Header of a DataBook whose YAML `type` is processor-registry."@en ;
    rdfs:subClassOf databook:DataBookHeader .

databook:AuthorStamp a owl:Class ;
    rdfs:label "Author Stamp"@en ;
    rdfs:comment "One entry of the YAML `author` sequence."@en ;
    rdfs:subClassOf prov:Agent .

databook:ProcessStamp a owl:Class ;
    rdfs:label "Process Stamp"@en ;
    rdfs:comment "RDF projection of the YAML `process` block — provenance of the transformer that produced the DataBook."@en ;
    rdfs:subClassOf prov:Activity .

databook:ProcessInput a owl:Class ;
    rdfs:label "Process Input"@en ;
    rdfs:comment "One entry of the YAML `process.inputs` sequence."@en ;
    rdfs:subClassOf prov:Entity .

databook:AgentStamp a owl:Class ;
    rdfs:label "Agent Stamp"@en ;
    rdfs:comment "RDF projection of the YAML `process.agent` block."@en ;
    rdfs:subClassOf prov:Agent .

databook:GraphMetadata a owl:Class ;
    rdfs:label "Graph Metadata"@en ;
    rdfs:comment "RDF projection of the YAML `graph` block."@en .

databook:OutputSpec a owl:Class ;
    rdfs:label "Output Spec"@en ;
    rdfs:comment "RDF projection of the YAML `process.output` block."@en .


# =============================================================================
# 2. Property vocabulary (owl:DatatypeProperty / owl:ObjectProperty)
# -----------------------------------------------------------------------------
# One RDF predicate per YAML key (camelCase, per HGA convention). Declared
# once here, with rdfs:comment as a general vocabulary-level description;
# the shapes in §4-§7 attach sh:name / sh:codeIdentifier /
# constraints to a distinct sh:PropertyShape IRI that has this predicate as
# its sh:path.
# =============================================================================

databook:title a owl:DatatypeProperty ;
    rdfs:domain databook:DataBookHeader ; rdfs:range xsd:string ;
    rdfs:comment "Human-readable name of the DataBook."@en .

databook:version a owl:DatatypeProperty ;
    rdfs:domain databook:DataBookHeader ; rdfs:range xsd:string ;
    rdfs:comment "Semantic version string (MAJOR.MINOR.PATCH) of the DataBook."@en .

databook:created a owl:DatatypeProperty ;
    rdfs:domain databook:DataBookHeader ; rdfs:range xsd:date ;
    rdfs:comment "Calendar date the DataBook was authored or generated (YYYY-MM-DD)."@en .

databook:description a owl:DatatypeProperty ;
    rdfs:range xsd:string ;
    rdfs:comment "A textual description. On DataBookHeader: a one-paragraph catalogue abstract. On ProcessInput: a note on what the input contributed to the transformation."@en .

databook:author a owl:ObjectProperty ;
    rdfs:domain databook:DataBookHeader ; rdfs:range databook:AuthorStamp ;
    rdfs:comment "A contributor to the DataBook, distinct from the transformation agent."@en .

databook:license a owl:AnnotationProperty ;
    rdfs:domain databook:DataBookHeader ;
    rdfs:comment "SPDX identifier or IRI of the licence governing the DataBook's content."@en .

databook:domain a owl:ObjectProperty ;
    rdfs:domain databook:DataBookHeader ;
    rdfs:comment "IRI of the primary ontology namespace the data blocks instantiate."@en .

databook:subject a owl:DatatypeProperty ;
    rdfs:domain databook:DataBookHeader ; rdfs:range xsd:string ;
    rdfs:comment "A free-text subject term for catalogue indexing."@en .

databook:tag a owl:DatatypeProperty ;
    rdfs:domain databook:DataBookHeader ; rdfs:range xsd:string ;
    rdfs:comment "A short categorical label for faceted filtering, distinct from subject (full-text search)."@en .

databook:publisher a owl:AnnotationProperty ;
    rdfs:domain databook:DataBookHeader ;
    rdfs:comment "Organisation or person responsible for publishing or distributing the DataBook."@en .

databook:imports a owl:ObjectProperty ;
    rdfs:domain databook:DataBookHeader ;
    rdfs:comment "IRI of another DataBook whose prefix declarations and namespace context this document inherits."@en .

databook:shapes a owl:ObjectProperty ;
    rdfs:domain databook:DataBookHeader ;
    rdfs:comment "IRI of a SHACL shape this DataBook's data is expected to conform to. Informational only; not enforced at the DataBook level."@en .

databook:graph a owl:ObjectProperty ;
    rdfs:domain databook:DataBookHeader ; rdfs:range databook:GraphMetadata ;
    rdfs:comment "Metadata about the primary RDF graph payload of the DataBook."@en .

databook:process a owl:ObjectProperty ;
    rdfs:domain databook:DataBookHeader ; rdfs:range databook:ProcessStamp ;
    rdfs:comment "Provenance stamp of the transformer that produced the DataBook."@en .

databook:authorName a owl:DatatypeProperty ;
    rdfs:domain databook:AuthorStamp ; rdfs:range xsd:string ;
    rdfs:comment "Full name of this contributor."@en .

databook:authorIri a owl:ObjectProperty ;
    rdfs:domain databook:AuthorStamp ;
    rdfs:comment "Stable IRI identifying this contributor."@en .

databook:authorRole a owl:DatatypeProperty ;
    rdfs:domain databook:AuthorStamp ; rdfs:range xsd:string ;
    rdfs:comment "Role of this contributor: orchestrator, transformer, reviewer, editor, or contributor."@en .

databook:namespace a owl:ObjectProperty ;
    rdfs:domain databook:GraphMetadata ;
    rdfs:comment "Primary ontology namespace IRI for the graph content."@en .

databook:namedGraph a owl:ObjectProperty ;
    rdfs:domain databook:GraphMetadata ;
    rdfs:comment "Named graph IRI under which this DataBook's content should be loaded in a quad-aware triplestore."@en .

databook:tripleCount a owl:DatatypeProperty ;
    rdfs:domain databook:GraphMetadata ; rdfs:range xsd:integer ;
    rdfs:comment "Total number of triples in the DataBook's primary data block(s)."@en .

databook:subjectCount a owl:DatatypeProperty ;
    rdfs:domain databook:GraphMetadata ; rdfs:range xsd:integer ;
    rdfs:comment "Number of distinct subject IRIs across the DataBook's primary data block(s)."@en .

databook:rdfVersion a owl:DatatypeProperty ;
    rdfs:domain databook:GraphMetadata ; rdfs:range xsd:string ;
    rdfs:comment "RDF version of the graph payload: \"1.1\" or \"1.2\"."@en .

databook:turtleVersion a owl:DatatypeProperty ;
    rdfs:domain databook:GraphMetadata ; rdfs:range xsd:string ;
    rdfs:comment "Turtle serialisation version used: \"1.1\" or \"1.2\"."@en .

databook:usesReification a owl:DatatypeProperty ;
    rdfs:domain databook:GraphMetadata ; rdfs:range xsd:boolean ;
    rdfs:comment "True when the graph uses RDF 1.2 reification (~) syntax."@en .

databook:validatorNote a owl:DatatypeProperty ;
    rdfs:domain databook:GraphMetadata ; rdfs:range xsd:string ;
    rdfs:comment "Free-text note on validation prerequisites or known parser quirks. Not machine-readable; for human inspection only."@en .

databook:transformer a owl:DatatypeProperty ;
    rdfs:domain databook:ProcessStamp ; rdfs:range xsd:string ;
    rdfs:comment "Display name of the transformer that produced the DataBook's content."@en .

databook:transformerType a owl:DatatypeProperty ;
    rdfs:domain databook:ProcessStamp ; rdfs:range xsd:string ;
    rdfs:comment "Category of transformer: llm, human, script, xslt, sparql, shacl, service, composite, library-transform, or registry-processor."@en .

databook:transformerIri a owl:ObjectProperty ;
    rdfs:domain databook:ProcessStamp ;
    rdfs:comment "Stable IRI identifying the specific transformer instance."@en .

databook:timestamp a owl:DatatypeProperty ;
    rdfs:domain databook:ProcessStamp ; rdfs:range xsd:dateTime ;
    rdfs:comment "The moment of transformation, in ISO 8601 combined date-time format."@en .

databook:input a owl:ObjectProperty ;
    rdfs:domain databook:ProcessStamp ; rdfs:range databook:ProcessInput ;
    rdfs:comment "A source DataBook or resource consumed by this transformation."@en .

databook:agent a owl:ObjectProperty ;
    rdfs:domain databook:ProcessStamp ; rdfs:range databook:AgentStamp ;
    rdfs:comment "The person or system that orchestrated the transformation, when distinct from the transformer itself."@en .

databook:note a owl:DatatypeProperty ;
    rdfs:range xsd:string ;
    rdfs:comment "Free-text note about a transformation: non-determinism warnings, known limitations, or manual post-processing steps."@en .

databook:outputFormat a owl:DatatypeProperty ;
    rdfs:domain databook:ProcessStamp ; rdfs:range xsd:string ;
    rdfs:comment "The fence label of the primary output block type, e.g. turtle, shacl, sparql, json-ld."@en .

databook:outputMediaType a owl:DatatypeProperty ;
    rdfs:domain databook:ProcessStamp ; rdfs:range xsd:string ;
    rdfs:comment "MIME type of the primary output, e.g. text/turtle. More precise than outputFormat for service-oriented consumers."@en .

databook:output a owl:ObjectProperty ;
    rdfs:domain databook:ProcessStamp ; rdfs:range databook:OutputSpec ;
    rdfs:comment "Output routing specification for the transformation result."@en .

databook:sourceIri a owl:ObjectProperty ;
    rdfs:domain databook:ProcessInput ;
    rdfs:comment "Stable IRI of the input resource."@en .

databook:role a owl:DatatypeProperty ;
    rdfs:range xsd:string ;
    rdfs:comment "Role of an input within a transformation: primary, constraint, context, evidence, reference, or template."@en .

databook:blockId a owl:DatatypeProperty ;
    rdfs:domain databook:ProcessInput ; rdfs:range xsd:string ;
    rdfs:comment "Fragment ID of a specific block within the input DataBook."@en .

databook:agentName a owl:DatatypeProperty ;
    rdfs:domain databook:AgentStamp ; rdfs:range xsd:string ;
    rdfs:comment "Display name of the orchestrating agent, when distinct from the transformer itself."@en .

databook:agentIri a owl:ObjectProperty ;
    rdfs:domain databook:AgentStamp ;
    rdfs:comment "Stable IRI identifying the orchestrating agent, when distinct from the transformer itself."@en .

databook:agentRole a owl:DatatypeProperty ;
    rdfs:domain databook:AgentStamp ; rdfs:range xsd:string ;
    rdfs:comment "Role of the orchestrating agent: orchestrator, contributor, reviewer, or validator."@en .

databook:outputGraph a owl:ObjectProperty ;
    rdfs:domain databook:OutputSpec ;
    rdfs:comment "Named graph IRI to load the transformation output into."@en .

databook:outputUrl a owl:ObjectProperty ;
    rdfs:domain databook:OutputSpec ;
    rdfs:comment "Upload endpoint URL for GSP or a similar push target."@en .

databook:outputFile a owl:DatatypeProperty ;
    rdfs:domain databook:OutputSpec ; rdfs:range xsd:string ;
    rdfs:comment "Local filesystem path for the output file."@en .

# =============================================================================
# 3. Property groups  (SHACL 1.2 Core §8.7 sh:group)
# =============================================================================

databook:IdentityPropertyGroup a sh:PropertyGroup ;
    sh:name "Identity"@en ; sh:order 1 .

databook:DescriptivePropertyGroup a sh:PropertyGroup ;
    sh:name "Descriptive"@en ; sh:order 2 .

databook:GraphPropertyGroup a sh:PropertyGroup ;
    sh:name "Graph Metadata"@en ; sh:order 3 .

databook:ProcessPropertyGroup a sh:PropertyGroup ;
    sh:name "Process Provenance"@en ; sh:order 4 .


# =============================================================================
# 4. databook:DataBookHeaderShape — top-level frontmatter shape
# -----------------------------------------------------------------------------
# Targets all three DataBook header classes. `id` has no property shape
# here (see file header note); `type` is mapped via rdf:type below.
# =============================================================================

databook:DataBookHeaderShape
    a sh:NodeShape ;
    rdfs:label "DataBook Header Shape"@en ;
    sh:targetClass databook:DataBookHeader , databook:TransformerLibraryHeader , databook:ProcessorRegistryHeader ;
    sh:property
        databook:DataBookHeaderShape-type ,
        databook:DataBookHeaderShape-title ,
        databook:DataBookHeaderShape-version ,
        databook:DataBookHeaderShape-created ,
        databook:DataBookHeaderShape-description ,
        databook:DataBookHeaderShape-author ,
        databook:DataBookHeaderShape-license ,
        databook:DataBookHeaderShape-domain ,
        databook:DataBookHeaderShape-subject ,
        databook:DataBookHeaderShape-tag ,
        databook:DataBookHeaderShape-publisher ,
        databook:DataBookHeaderShape-imports ,
        databook:DataBookHeaderShape-shapes ,
        databook:DataBookHeaderShape-graph ,
        databook:DataBookHeaderShape-process .

databook:DataBookHeaderShape-type
    a sh:PropertyShape ;
    sh:path rdf:type ;
    sh:name "document type"@en ;
    sh:codeIdentifier "type" ;
    sh:in ( databook:DataBookHeader databook:TransformerLibraryHeader databook:ProcessorRegistryHeader ) ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:group databook:IdentityPropertyGroup ;
    sh:order 10 ;
    sh:message "type must be one of databook, transformer-library, processor-registry (mapped to rdf:type)."@en .

databook:DataBookHeaderShape-title
    a sh:PropertyShape ;
    sh:path databook:title ;
    sh:name "title"@en ;
    sh:codeIdentifier "title" ;
    sh:datatype xsd:string ;
    sh:minLength 1 ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:group databook:IdentityPropertyGroup ;
    sh:order 20 ;
    sh:message "Every DataBook must have exactly one non-empty title."@en .

databook:DataBookHeaderShape-version
    a sh:PropertyShape ;
    sh:path databook:version ;
    sh:name "version"@en ;
    sh:codeIdentifier "version" ;
    sh:datatype xsd:string ;
    sh:pattern "^\\d+\\.\\d+\\.\\d+(-[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?(\\+[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?$" ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:group databook:IdentityPropertyGroup ;
    sh:order 30 ;
    sh:message "version must be a semantic version string (MAJOR.MINOR.PATCH)."@en .

databook:DataBookHeaderShape-created
    a sh:PropertyShape ;
    sh:path databook:created ;
    sh:name "created"@en ;
    sh:codeIdentifier "created" ;
    sh:datatype xsd:date ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:group databook:IdentityPropertyGroup ;
    sh:order 40 ;
    sh:message "Every DataBook must have a creation date (YYYY-MM-DD)."@en .

databook:DataBookHeaderShape-description
    a sh:PropertyShape ;
    sh:path databook:description ;
    sh:name "description"@en ;
    sh:codeIdentifier "description" ;
    sh:datatype xsd:string ;
    sh:maxCount 1 ;
    sh:group databook:DescriptivePropertyGroup ;
    sh:order 50 .

databook:DataBookHeaderShape-author
    a sh:PropertyShape ;
    sh:path databook:author ;
    sh:name "author"@en ;
    sh:codeIdentifier "author[]" ;
    sh:node databook:AuthorStampShape ;
    sh:group databook:DescriptivePropertyGroup ;
    sh:order 60 .

databook:DataBookHeaderShape-license
    a sh:PropertyShape ;
    sh:path databook:license ;
    sh:name "license"@en ;
    sh:codeIdentifier "license" ;
    sh:or ( [ sh:datatype xsd:string ] [ sh:nodeKind sh:IRI ] ) ;
    sh:maxCount 1 ;
    sh:group databook:DescriptivePropertyGroup ;
    sh:order 70 ;
    sh:message "license must be an SPDX identifier string or an IRI."@en .

databook:DataBookHeaderShape-domain
    a sh:PropertyShape ;
    sh:path databook:domain ;
    sh:name "domain namespace"@en ;
    sh:codeIdentifier "domain" ;
    sh:nodeKind sh:IRI ;
    sh:maxCount 1 ;
    sh:group databook:DescriptivePropertyGroup ;
    sh:order 80 .

databook:DataBookHeaderShape-subject
    a sh:PropertyShape ;
    sh:path databook:subject ;
    sh:name "subject"@en ;
    sh:codeIdentifier "subject[]" ;
    sh:datatype xsd:string ;
    sh:group databook:DescriptivePropertyGroup ;
    sh:order 90 .

databook:DataBookHeaderShape-tag
    a sh:PropertyShape ;
    sh:path databook:tag ;
    sh:name "tags"@en ;
    sh:codeIdentifier "tags[]" ;
    sh:datatype xsd:string ;
    sh:group databook:DescriptivePropertyGroup ;
    sh:order 100 .

databook:DataBookHeaderShape-publisher
    a sh:PropertyShape ;
    sh:path databook:publisher ;
    sh:name "publisher"@en ;
    sh:codeIdentifier "publisher" ;
    sh:or ( [ sh:datatype xsd:string ] [ sh:nodeKind sh:IRI ] ) ;
    sh:maxCount 1 ;
    sh:group databook:DescriptivePropertyGroup ;
    sh:order 110 .

databook:DataBookHeaderShape-imports
    a sh:PropertyShape ;
    sh:path databook:imports ;
    sh:name "imports"@en ;
    sh:codeIdentifier "imports[]" ;
    sh:nodeKind sh:IRI ;
    sh:group databook:DescriptivePropertyGroup ;
    sh:order 120 .

databook:DataBookHeaderShape-shapes
    a sh:PropertyShape ;
    sh:path databook:shapes ;
    sh:name "governing shapes"@en ;
    sh:codeIdentifier "shapes[]" ;
    sh:nodeKind sh:IRI ;
    sh:group databook:DescriptivePropertyGroup ;
    sh:order 130 ;
    sh:message "shapes is informational: IRIs of SHACL shapes this DataBook's data is expected to conform to."@en .

databook:DataBookHeaderShape-graph
    a sh:PropertyShape ;
    sh:path databook:graph ;
    sh:name "graph metadata"@en ;
    sh:codeIdentifier "graph" ;
    sh:node databook:GraphMetadataShape ;
    sh:maxCount 1 ;
    sh:group databook:GraphPropertyGroup ;
    sh:order 140 .

databook:DataBookHeaderShape-process
    a sh:PropertyShape ;
    sh:path databook:process ;
    sh:name "process stamp"@en ;
    sh:codeIdentifier "process" ;
    sh:node databook:ProcessStampShape ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:group databook:ProcessPropertyGroup ;
    sh:order 150 ;
    sh:message "Every DataBook must carry a process provenance stamp."@en .


# =============================================================================
# 5. databook:AuthorStampShape
# =============================================================================

databook:AuthorStampShape
    a sh:NodeShape ;
    rdfs:label "Author Stamp Shape"@en ;
    sh:targetClass databook:AuthorStamp ;
    sh:property
        databook:AuthorStampShape-name ,
        databook:AuthorStampShape-iri ,
        databook:AuthorStampShape-role .

databook:AuthorStampShape-name
    a sh:PropertyShape ;
    sh:path databook:authorName ;
    sh:name "name"@en ;
    sh:codeIdentifier "author[].name" ;
    sh:datatype xsd:string ;
    sh:minLength 1 ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Every author entry must carry a name."@en .

databook:AuthorStampShape-iri
    a sh:PropertyShape ;
    sh:path databook:authorIri ;
    sh:name "IRI"@en ;
    sh:codeIdentifier "author[].iri" ;
    sh:nodeKind sh:IRI ;
    sh:maxCount 1 .

databook:AuthorStampShape-role
    a sh:PropertyShape ;
    sh:path databook:authorRole ;
    sh:name "role"@en ;
    sh:codeIdentifier "author[].role" ;
    sh:datatype xsd:string ;
    sh:in ( "orchestrator" "transformer" "reviewer" "editor" "contributor" ) ;
    sh:maxCount 1 .


# =============================================================================
# 6. databook:GraphMetadataShape
# =============================================================================

databook:GraphMetadataShape
    a sh:NodeShape ;
    rdfs:label "Graph Metadata Shape"@en ;
    sh:targetClass databook:GraphMetadata ;
    sh:property
        databook:GraphMetadataShape-namespace ,
        databook:GraphMetadataShape-namedGraph ,
        databook:GraphMetadataShape-tripleCount ,
        databook:GraphMetadataShape-subjectCount ,
        databook:GraphMetadataShape-rdfVersion ,
        databook:GraphMetadataShape-turtleVersion ,
        databook:GraphMetadataShape-usesReification ,
        databook:GraphMetadataShape-validatorNote .

databook:GraphMetadataShape-namespace
    a sh:PropertyShape ;
    sh:path databook:namespace ;
    sh:name "namespace"@en ;
    sh:codeIdentifier "graph.namespace" ;
    sh:nodeKind sh:IRI ;
    sh:maxCount 1 .

databook:GraphMetadataShape-namedGraph
    a sh:PropertyShape ;
    sh:path databook:namedGraph ;
    sh:name "named graph"@en ;
    sh:codeIdentifier "graph.named_graph" ;
    sh:nodeKind sh:IRI ;
    sh:maxCount 1 .

databook:GraphMetadataShape-tripleCount
    a sh:PropertyShape ;
    sh:path databook:tripleCount ;
    sh:name "triple count"@en ;
    sh:codeIdentifier "graph.triple_count" ;
    sh:datatype xsd:integer ;
    sh:minInclusive 0 ;
    sh:maxCount 1 ;
    sh:message "triple_count must be a non-negative integer."@en .

databook:GraphMetadataShape-subjectCount
    a sh:PropertyShape ;
    sh:path databook:subjectCount ;
    sh:name "subject count"@en ;
    sh:codeIdentifier "graph.subjects" ;
    sh:datatype xsd:integer ;
    sh:minInclusive 0 ;
    sh:maxCount 1 .

databook:GraphMetadataShape-rdfVersion
    a sh:PropertyShape ;
    sh:path databook:rdfVersion ;
    sh:name "RDF version"@en ;
    sh:codeIdentifier "graph.rdf_version" ;
    sh:datatype xsd:string ;
    sh:in ( "1.1" "1.2" ) ;
    sh:maxCount 1 ;
    sh:message "rdf_version must be '1.1' or '1.2'."@en .

databook:GraphMetadataShape-turtleVersion
    a sh:PropertyShape ;
    sh:path databook:turtleVersion ;
    sh:name "Turtle version"@en ;
    sh:codeIdentifier "graph.turtle_version" ;
    sh:datatype xsd:string ;
    sh:in ( "1.1" "1.2" ) ;
    sh:maxCount 1 ;
    sh:message "turtle_version must be '1.1' or '1.2'."@en .

databook:GraphMetadataShape-usesReification
    a sh:PropertyShape ;
    sh:path databook:usesReification ;
    sh:name "uses RDF 1.2 reification"@en ;
    sh:codeIdentifier "graph.reification" ;
    sh:datatype xsd:boolean ;
    sh:maxCount 1 .

databook:GraphMetadataShape-validatorNote
    a sh:PropertyShape ;
    sh:path databook:validatorNote ;
    sh:name "validator note"@en ;
    sh:codeIdentifier "graph.validator_note" ;
    sh:datatype xsd:string ;
    sh:maxCount 1 .


# =============================================================================
# 7. databook:ProcessStampShape, databook:ProcessInputShape, databook:AgentStampShape,
#    databook:OutputSpecShape
# =============================================================================

databook:ProcessStampShape
    a sh:NodeShape ;
    rdfs:label "Process Stamp Shape"@en ;
    sh:targetClass databook:ProcessStamp ;
    sh:property
        databook:ProcessStampShape-transformer ,
        databook:ProcessStampShape-transformerType ,
        databook:ProcessStampShape-transformerIri ,
        databook:ProcessStampShape-timestamp ,
        databook:ProcessStampShape-input ,
        databook:ProcessStampShape-agent ,
        databook:ProcessStampShape-note ,
        databook:ProcessStampShape-outputFormat ,
        databook:ProcessStampShape-outputMediaType ,
        databook:ProcessStampShape-output .

databook:ProcessStampShape-transformer
    a sh:PropertyShape ;
    sh:path databook:transformer ;
    sh:name "transformer"@en ;
    sh:codeIdentifier "process.transformer" ;
    sh:datatype xsd:string ;
    sh:minLength 1 ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Process stamp must name the transformer."@en .

databook:ProcessStampShape-transformerType
    a sh:PropertyShape ;
    sh:path databook:transformerType ;
    sh:name "transformer type"@en ;
    sh:codeIdentifier "process.transformer_type" ;
    sh:datatype xsd:string ;
    sh:in ( "llm" "human" "script" "xslt" "sparql" "shacl"
            "service" "composite" "library-transform" "registry-processor" ) ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "transformer_type must be one of the defined vocabulary values."@en .

databook:ProcessStampShape-transformerIri
    a sh:PropertyShape ;
    sh:path databook:transformerIri ;
    sh:name "transformer IRI"@en ;
    sh:codeIdentifier "process.transformer_iri" ;
    sh:nodeKind sh:IRI ;
    sh:maxCount 1 .

databook:ProcessStampShape-timestamp
    a sh:PropertyShape ;
    sh:path databook:timestamp ;
    sh:name "timestamp"@en ;
    sh:codeIdentifier "process.timestamp" ;
    sh:datatype xsd:dateTime ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Process stamp must have an ISO 8601 dateTime timestamp."@en .

databook:ProcessStampShape-input
    a sh:PropertyShape ;
    sh:path databook:input ;
    sh:name "inputs"@en ;
    sh:codeIdentifier "process.inputs[]" ;
    sh:node databook:ProcessInputShape ;
    sh:minCount 1 ;
    sh:message "Process stamp must declare at least one input."@en .

databook:ProcessStampShape-agent
    a sh:PropertyShape ;
    sh:path databook:agent ;
    sh:name "agent"@en ;
    sh:codeIdentifier "process.agent" ;
    sh:node databook:AgentStampShape ;
    sh:maxCount 1 .

databook:ProcessStampShape-note
    a sh:PropertyShape ;
    sh:path databook:note ;
    sh:name "note"@en ;
    sh:codeIdentifier "process.note" ;
    sh:datatype xsd:string ;
    sh:maxCount 1 .

databook:ProcessStampShape-outputFormat
    a sh:PropertyShape ;
    sh:path databook:outputFormat ;
    sh:name "output format"@en ;
    sh:codeIdentifier "process.output_format" ;
    sh:datatype xsd:string ;
    sh:maxCount 1 .

databook:ProcessStampShape-outputMediaType
    a sh:PropertyShape ;
    sh:path databook:outputMediaType ;
    sh:name "output media type"@en ;
    sh:codeIdentifier "process.output_media_type" ;
    sh:datatype xsd:string ;
    sh:maxCount 1 .

databook:ProcessStampShape-output
    a sh:PropertyShape ;
    sh:path databook:output ;
    sh:name "output routing"@en ;
    sh:codeIdentifier "process.output" ;
    sh:node databook:OutputSpecShape ;
    sh:maxCount 1 .

databook:ProcessInputShape
    a sh:NodeShape ;
    rdfs:label "Process Input Shape"@en ;
    sh:targetClass databook:ProcessInput ;
    sh:property
        databook:ProcessInputShape-sourceIri ,
        databook:ProcessInputShape-role ,
        databook:ProcessInputShape-description ,
        databook:ProcessInputShape-blockId .

databook:ProcessInputShape-sourceIri
    a sh:PropertyShape ;
    sh:path databook:sourceIri ;
    sh:name "IRI"@en ;
    sh:codeIdentifier "process.inputs[].iri" ;
    sh:nodeKind sh:IRI ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Each process input must declare its source IRI."@en .

databook:ProcessInputShape-role
    a sh:PropertyShape ;
    sh:path databook:role ;
    sh:name "role"@en ;
    sh:codeIdentifier "process.inputs[].role" ;
    sh:datatype xsd:string ;
    sh:in ( "primary" "constraint" "context" "evidence" "reference" "template" ) ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Input role must be one of: primary, constraint, context, evidence, reference, template."@en .

databook:ProcessInputShape-description
    a sh:PropertyShape ;
    sh:path databook:description ;
    sh:name "description"@en ;
    sh:codeIdentifier "process.inputs[].description" ;
    sh:datatype xsd:string ;
    sh:maxCount 1 .

databook:ProcessInputShape-blockId
    a sh:PropertyShape ;
    sh:path databook:blockId ;
    sh:name "block ID"@en ;
    sh:codeIdentifier "process.inputs[].block_id" ;
    sh:datatype xsd:string ;
    sh:maxCount 1 .

databook:AgentStampShape
    a sh:NodeShape ;
    rdfs:label "Agent Stamp Shape"@en ;
    sh:targetClass databook:AgentStamp ;
    sh:property
        databook:AgentStampShape-name ,
        databook:AgentStampShape-iri ,
        databook:AgentStampShape-role .

databook:AgentStampShape-name
    a sh:PropertyShape ;
    sh:path databook:agentName ;
    sh:name "name"@en ;
    sh:codeIdentifier "process.agent.name" ;
    sh:datatype xsd:string ;
    sh:minLength 1 ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Agent stamp must carry a name."@en .

databook:AgentStampShape-iri
    a sh:PropertyShape ;
    sh:path databook:agentIri ;
    sh:name "IRI"@en ;
    sh:codeIdentifier "process.agent.iri" ;
    sh:nodeKind sh:IRI ;
    sh:maxCount 1 .

databook:AgentStampShape-role
    a sh:PropertyShape ;
    sh:path databook:agentRole ;
    sh:name "role"@en ;
    sh:codeIdentifier "process.agent.role" ;
    sh:datatype xsd:string ;
    sh:in ( "orchestrator" "contributor" "reviewer" "validator" ) ;
    sh:maxCount 1 .

databook:OutputSpecShape
    a sh:NodeShape ;
    rdfs:label "Output Spec Shape"@en ;
    sh:targetClass databook:OutputSpec ;
    sh:property
        databook:OutputSpecShape-graph ,
        databook:OutputSpecShape-url ,
        databook:OutputSpecShape-file .

databook:OutputSpecShape-graph
    a sh:PropertyShape ;
    sh:path databook:outputGraph ;
    sh:name "output graph"@en ;
    sh:codeIdentifier "process.output.graph" ;
    sh:nodeKind sh:IRI ;
    sh:maxCount 1 .

databook:OutputSpecShape-url
    a sh:PropertyShape ;
    sh:path databook:outputUrl ;
    sh:name "output URL"@en ;
    sh:codeIdentifier "process.output.url" ;
    sh:nodeKind sh:IRI ;
    sh:maxCount 1 .

databook:OutputSpecShape-file
    a sh:PropertyShape ;
    sh:path databook:outputFile ;
    sh:name "output file"@en ;
    sh:codeIdentifier "process.output.file" ;
    sh:datatype xsd:string ;
    sh:maxCount 1 .

# =============================================================================
# End of holon-databook-header-shapes.ttl
# =============================================================================

```

## Validation Notes

- Parsed cleanly with `rdflib` 7.x, Turtle grammar — 738 triples, 111 named
  subjects, no blank-node property shapes.
- All 46 `sh:PropertyShape` instances carry both `sh:name` and
  `sh:codeIdentifier`; all 44 OWL property declarations carry `rdfs:comment`.
- `sh:declare` on the shapes graph subject supplies 9 prefix declarations
  (`databook`, `db`, `xsd`, `rdf`, `rdfs`, `owl`, `sh`, `prov`, `dcterms`).
- The `id` field of a source DataBook has no matching property shape by
  design — it becomes the subject IRI of the `databook:DataBookHeader` node,
  not one of its predicate values.
- `owl:priorVersion` on the shapes graph subject points to the superseded
  `ontologist.io/ns/holon#`-based draft, for a machine-readable audit trail
  of the namespace rework.
- Fixed in this rework: `DataBookHeaderShape-version`'s `sh:pattern` was
  strict `MAJOR.MINOR.PATCH` with no pre-release/build-metadata support,
  which would have rejected this very document's own `2.0.0-alpha.1`
  version. Broadened to full semver.
