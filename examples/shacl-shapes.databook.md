---
id: https://w3id.org/databook/examples/shacl-shapes-v1
title: "SHACL Shapes Library — Person, Organisation, Project"
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
domain: https://example.org/shapes/
subject:
  - SHACL
  - validation shapes
  - NodeShape
description: >
  A standalone SHACL shapes library defining NodeShapes for Person,
  Organisation, and Project entities. Demonstrates the DataBook shapes pattern:
  a primary SHACL block, a companion SPARQL validation query, and an ASK
  conformance check.

graph:
  namespace: https://example.org/shapes/
  named_graph: https://w3id.org/databook/examples/shacl-shapes-v1#graph
  triple_count: 42
  subjects: 6

process:
  transformer: "Claude Sonnet 4.6"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-4-6
  inputs:
    - iri: https://github.com/kurtcagle/databook/blob/main/SPEC.md
      role: reference
  timestamp: 2026-04-25T12:00:00Z
  agent:
    name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: orchestrator
---

# SHACL Shapes Library

This DataBook carries SHACL NodeShapes for three common entity types used in the DataBook example suite: `Person`, `Organisation`, and `Project`. It demonstrates:

- A standalone SHACL block as the primary payload
- A diagnostic SELECT query to surface violations
- An ASK conformance check for pipeline integration

## Shapes

```shacl
<!-- databook:id: core-shapes -->
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix proj: <https://example.org/project/> .
@prefix ex:   <https://example.org/shapes/> .

# ── Person ─────────────────────────────────────────────────────────────────────

ex:PersonShape a sh:NodeShape ;
    sh:targetClass foaf:Person ;
    sh:property [
        sh:path rdfs:label ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
        sh:message "Person must have an rdfs:label."@en ;
    ] ;
    sh:property [
        sh:path foaf:mbox ;
        sh:maxCount 1 ;
        sh:message "Person may have at most one email address."@en ;
    ] .

# ── Organisation ───────────────────────────────────────────────────────────────

ex:OrganisationShape a sh:NodeShape ;
    sh:targetClass foaf:Organisation ;
    sh:property [
        sh:path rdfs:label ;
        sh:minCount 1 ;
        sh:message "Organisation must have a label."@en ;
    ] ;
    sh:property [
        sh:path foaf:homepage ;
        sh:maxCount 1 ;
        sh:nodeKind sh:IRI ;
        sh:message "Organisation homepage must be an IRI."@en ;
    ] .

# ── Project ────────────────────────────────────────────────────────────────────

ex:ProjectShape a sh:NodeShape ;
    sh:targetClass proj:Project ;
    sh:property [
        sh:path rdfs:label ;
        sh:minCount 1 ;
        sh:message "Project must have a label."@en ;
    ] ;
    sh:property [
        sh:path proj:status ;
        sh:minCount 1 ;
        sh:in ( proj:Active proj:Planning proj:Complete proj:Archived ) ;
        sh:message "Project status must be one of: Active, Planning, Complete, Archived."@en ;
    ] ;
    sh:property [
        sh:path proj:lead ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:class foaf:Person ;
        sh:message "Project must have exactly one lead Person."@en ;
    ] ;
    sh:property [
        sh:path dct:created ;
        sh:minCount 1 ;
        sh:datatype xsd:date ;
        sh:message "Project must have a creation date."@en ;
    ] .
```

## Validation Queries

### Diagnostic: Surface Constraint Violations

Load the data graph and shapes together into Jena with SHACL support, or run this SELECT after `sh:validate`:

```sparql
<!-- databook:id: select-violations -->
PREFIX sh: <http://www.w3.org/ns/shacl#>

SELECT ?focusNode ?resultPath ?message ?severity WHERE {
    ?result a sh:ValidationResult ;
            sh:focusNode ?focusNode ;
            sh:resultMessage ?message ;
            sh:resultSeverity ?severity .
    OPTIONAL { ?result sh:resultPath ?resultPath }
}
ORDER BY ?severity ?focusNode
```

### Conformance ASK

Returns `true` if all instances conform to the shapes; suitable for pipeline gate checks:

```sparql
<!-- databook:id: ask-conforms -->
PREFIX sh: <http://www.w3.org/ns/shacl#>

ASK {
    FILTER NOT EXISTS { ?r a sh:ValidationResult }
}
```

## Usage

Reference this DataBook's shapes block in a pipeline process stamp:

```yaml
inputs:
  - iri: https://w3id.org/databook/examples/shacl-shapes-v1#core-shapes
    role: constraint
    description: "SHACL shapes constraining Person, Organisation, and Project"
```

> **Note:** The shapes IRI `…#core-shapes` uses fragment addressing to point to the specific block within this DataBook.
