---
id: https://w3id.org/databook/examples/colour-taxonomy-v1
title: "Colour Terms Taxonomy — SKOS Example"
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
  - concept scheme
description: >
  A small SKOS concept scheme for colour terms demonstrating the DataBook
  format with graph metadata, a primary Turtle block, and an associated
  SPARQL SELECT query. Taken from the DataBook 1.1 specification §17.

graph:
  namespace: https://example.org/taxonomy/colour/
  named_graph: https://w3id.org/databook/examples/colour-taxonomy-v1#graph
  triple_count: 14
  subjects: 4
  rdf_version: "1.1"
  turtle_version: "1.1"
  reification: false

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

# Colour Terms Taxonomy

This DataBook carries a small SKOS concept scheme for colour terms. It is the running example from the DataBook specification and demonstrates:

- Proper graph metadata (`graph.triple_count`, `graph.subjects`, etc.)
- `databook:id` block addressing
- An embedded SPARQL query operating on the same domain

## Primary Data

The concept scheme has two top concepts (`WarmColour`, `CoolColour`) each with one narrower concept (`Red`, `Blue`).

```turtle
<!-- databook:id: colour-taxonomy-block -->
<!-- databook:graph: https://w3id.org/databook/examples/colour-taxonomy-v1#graph -->
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

Retrieve all concepts with their broader category:

```sparql
<!-- databook:id: select-all-concepts -->
PREFIX skos:   <http://www.w3.org/2004/02/skos/core#>
PREFIX colour: <https://example.org/taxonomy/colour/>

SELECT ?concept ?label ?broaderLabel WHERE {
    ?concept skos:inScheme colour:ColourScheme ;
             skos:prefLabel ?label .
    OPTIONAL {
        ?concept skos:broader ?broader .
        ?broader skos:prefLabel ?broaderLabel .
    }
}
ORDER BY ?broaderLabel ?label
```

Construct the full hierarchy as a subgraph:

```sparql
<!-- databook:id: construct-hierarchy -->
PREFIX skos:   <http://www.w3.org/2004/02/skos/core#>
PREFIX colour: <https://example.org/taxonomy/colour/>

CONSTRUCT {
    ?concept a skos:Concept ;
             skos:prefLabel ?label ;
             skos:broader ?broader .
}
WHERE {
    ?concept skos:inScheme colour:ColourScheme ;
             skos:prefLabel ?label .
    OPTIONAL { ?concept skos:broader ?broader }
}
```

## Usage

> **Note:** Load into Jena, rdflib, or any RDF 1.1-compatible store. Extract the `colour-taxonomy-block` block content first if your tool cannot parse `.databook.md` files directly.
