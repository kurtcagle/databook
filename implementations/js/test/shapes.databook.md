<script language="application/yaml">

---
id: https://w3id.org/databook/test/shapes-v1
title: "Project Graph SHACL Shapes Library — CLI Test Fixture"
type: databook
version: 1.0.0
created: 2026-04-25
author:
  - name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: transformer
license: CC-BY-4.0
domain: https://w3id.org/databook/test/project-v1#
subject:
  - SHACL shapes
  - validation
  - fragment addressing
description: >
  A standalone SHACL shapes library for the project management test graph.
  Mirrors the shapes block in knowledge-graph.databook.md but as an independent
  DataBook for testing fragment-IRI shape references and pull --describe.
process:
  transformer: "Chloe Shannon"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-4-6
  inputs:
    - iri: https://w3id.org/databook/test/project-v1
      role: primary
  timestamp: 2026-04-25T12:00:00Z
  agent:
    name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: orchestrator
---

</script>

# Project Graph SHACL Shapes Library

Standalone shapes library for the project management test graph. Used for `databook pull --describe --shapes` testing.

```shacl
<!-- databook:id: project-shapes -->
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix proj: <https://w3id.org/databook/test/project-v1#> .

proj:PersonShape a sh:NodeShape ;
    sh:targetClass foaf:Person ;
    sh:property [ sh:path rdfs:label ; sh:minCount 1 ] ;
    sh:property [ sh:path proj:role ; sh:minCount 1 ] ;
    sh:property [ sh:path proj:memberOf ; sh:minCount 1 ] .

proj:ProjectShape a sh:NodeShape ;
    sh:targetClass proj:Project ;
    sh:property [ sh:path rdfs:label ; sh:minCount 1 ] ;
    sh:property [ sh:path proj:status ; sh:minCount 1 ] ;
    sh:property [
        sh:path proj:lead ;
        sh:minCount 1 ; sh:maxCount 1 ;
        sh:class foaf:Person ;
    ] .

proj:TaskShape a sh:NodeShape ;
    sh:targetClass proj:Task ;
    sh:property [ sh:path rdfs:label ; sh:minCount 1 ] ;
    sh:property [ sh:path proj:assignedTo ; sh:minCount 1 ; sh:class foaf:Person ] ;
    sh:property [ sh:path proj:inProject ; sh:minCount 1 ; sh:class proj:Project ] ;
    sh:property [ sh:path proj:status ; sh:minCount 1 ] .
```
