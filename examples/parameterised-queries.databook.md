---
id: https://w3id.org/databook/examples/parameterised-queries-v1
title: "Parameterised Queries — DataBook Example"
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
  - parameterised queries
  - SPARQL VALUES substitution
  - databook:param
description: >
  Demonstrates the DataBook parameterised query pattern using databook:param
  comment keys and SPARQL VALUES clauses. Clients resolve a block by fragment
  IRI, substitute parameter values, and execute without modifying the document.

graph:
  namespace: https://example.org/taxonomy/colour/
  named_graph: https://w3id.org/databook/examples/parameterised-queries-v1#graph
  triple_count: 14
  subjects: 4
  rdf_version: "1.1"

process:
  transformer: "Claude Sonnet 4.6"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-4-6
  inputs:
    - iri: https://w3id.org/databook/examples/colour-taxonomy-v1
      role: primary
  timestamp: 2026-04-25T12:00:00Z
  agent:
    name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: orchestrator
---

# Parameterised Queries

This DataBook demonstrates the `databook:param` pattern. It carries the same colour taxonomy data as `skos-taxonomy.databook.md` but adds parameterised SPARQL blocks that clients can call like named APIs.

## Data

```turtle
<!-- databook:id: colour-taxonomy-block -->
@prefix skos:   <http://www.w3.org/2004/02/skos/core#> .
@prefix colour: <https://example.org/taxonomy/colour/> .

colour:ColourScheme a skos:ConceptScheme ;
    skos:prefLabel "Colour Terms"@en .

colour:WarmColour a skos:Concept ;
    skos:inScheme colour:ColourScheme ;
    skos:prefLabel "Warm Colour"@en ;
    skos:topConceptOf colour:ColourScheme .

colour:CoolColour a skos:Concept ;
    skos:inScheme colour:ColourScheme ;
    skos:prefLabel "Cool Colour"@en ;
    skos:topConceptOf colour:ColourScheme .

colour:Red a skos:Concept ;
    skos:inScheme colour:ColourScheme ;
    skos:prefLabel "Red"@en ;
    skos:broader colour:WarmColour .

colour:Blue a skos:Concept ;
    skos:inScheme colour:ColourScheme ;
    skos:prefLabel "Blue"@en ;
    skos:broader colour:CoolColour .
```

## Parameterised Queries

### Concepts by Broader Category

Returns all concepts within a given broader concept. The `broaderConcept` parameter defaults to `colour:WarmColour`. Override by replacing the `VALUES` binding.

```sparql
<!-- databook:id: select-by-broader -->
<!-- databook:param: broaderConcept type=IRI default=colour:WarmColour -->
PREFIX skos:   <http://www.w3.org/2004/02/skos/core#>
PREFIX colour: <https://example.org/taxonomy/colour/>

SELECT ?concept ?label WHERE {
    VALUES ?broaderConcept { colour:WarmColour }
    ?concept skos:broader ?broaderConcept ;
             skos:prefLabel ?label .
}
ORDER BY ?label
```

**Example substitution:**

```
# Original:   VALUES ?broaderConcept { colour:WarmColour }
# Substituted: VALUES ?broaderConcept { colour:CoolColour }
```

### Concept Detail — Required Parameter

Returns detail for a specific concept by IRI. The `conceptIRI` parameter is required — an empty VALUES clause returns no results until a value is provided.

```sparql
<!-- databook:id: describe-concept -->
<!-- databook:param: conceptIRI type=IRI required -->
PREFIX skos:   <http://www.w3.org/2004/02/skos/core#>

SELECT ?label ?broader ?broaderLabel WHERE {
    VALUES ?conceptIRI { }
    ?conceptIRI skos:prefLabel ?label .
    OPTIONAL {
        ?conceptIRI skos:broader ?broader .
        ?broader skos:prefLabel ?broaderLabel .
    }
}
```

### Multi-Valued Parameter

Returns concepts from multiple categories simultaneously.

```sparql
<!-- databook:id: select-by-multiple-broader -->
<!-- databook:param: broaderConcept type=IRI default=colour:WarmColour -->
PREFIX skos:   <http://www.w3.org/2004/02/skos/core#>
PREFIX colour: <https://example.org/taxonomy/colour/>

SELECT ?concept ?label ?broader WHERE {
    VALUES ?broader { colour:WarmColour }
    ?concept skos:broader ?broader ;
             skos:prefLabel ?label .
}
ORDER BY ?broader ?label
```

**Multi-value substitution:**

```
VALUES ?broader { colour:WarmColour colour:CoolColour }
```

## Usage

Clients resolve a parameterised block by its fragment IRI:

```
https://w3id.org/databook/examples/parameterised-queries-v1#select-by-broader
```

They then locate the `VALUES ?broaderConcept { ... }` clause and replace the binding before executing against the target endpoint.

> **Note:** Substitution is text-level. Clients must escape IRI and literal values appropriately to avoid injection vulnerabilities.
