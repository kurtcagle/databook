---
id: https://w3id.org/databook/examples/transformer-library-v1
title: "SPARQL Transformer Library — Taxonomy Operations"
type: transformer-library
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
  - transformer library
  - SPARQL CONSTRUCT
  - named transforms
description: >
  A transformer-library DataBook cataloguing reusable SPARQL CONSTRUCT
  transforms for taxonomy operations. Each transform has a stable fragment IRI
  that process stamps can reference by IRI rather than embedding the transform
  inline, enabling independent versioning and reuse.

process:
  transformer: human
  transformer_type: human
  inputs: []
  timestamp: 2026-04-25T12:00:00Z
  agent:
    name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator
---

# Taxonomy Transformer Library

This DataBook is a `transformer-library` — a catalogue of named, reusable SPARQL CONSTRUCT transforms for SKOS taxonomy operations. Process stamps in pipeline DataBooks reference individual transforms by their fragment IRI (e.g., `…#extract-top-concepts`) rather than embedding the transform inline.

## Transform Catalogue (RDF)

```transformer-library
<!-- databook:id: transform-catalogue -->
@prefix build: <https://w3id.org/databook/ns#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix lib:   <https://w3id.org/databook/examples/transformer-library-v1#> .

lib:extract-top-concepts a build:NamedTransform ;
    build:transformerType "sparql" ;
    build:inputType  "turtle" ;
    build:outputType "turtle" ;
    dct:title        "Extract SKOS top concepts from a concept scheme"@en ;
    dct:created      "2026-04-25"^^xsd:date .

lib:flatten-hierarchy a build:NamedTransform ;
    build:transformerType "sparql" ;
    build:inputType  "turtle" ;
    build:outputType "turtle" ;
    dct:title        "Flatten SKOS hierarchy to direct skos:broader links only"@en ;
    dct:created      "2026-04-25"^^xsd:date .

lib:extract-labels-csv a build:NamedTransform ;
    build:transformerType "sparql" ;
    build:inputType  "turtle" ;
    build:outputType "csv" ;
    dct:title        "Extract concept IRIs and preferred labels as CSV"@en ;
    dct:created      "2026-04-25"^^xsd:date .

lib:add-skos-inscheme a build:NamedTransform ;
    build:transformerType "sparql" ;
    build:inputType  "turtle" ;
    build:outputType "turtle" ;
    dct:title        "Add missing skos:inScheme assertions via transitivity"@en ;
    dct:created      "2026-04-25"^^xsd:date .
```

## Transform Implementations

### `extract-top-concepts`

Constructs a subgraph containing only the concept scheme and its top-level concepts.

```sparql
<!-- databook:id: extract-top-concepts -->
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

CONSTRUCT {
    ?scheme a skos:ConceptScheme ;
            skos:prefLabel ?schemeLabel .
    ?concept a skos:Concept ;
             skos:prefLabel ?label ;
             skos:topConceptOf ?scheme .
}
WHERE {
    ?scheme a skos:ConceptScheme ;
            skos:prefLabel ?schemeLabel .
    ?concept skos:topConceptOf ?scheme ;
             skos:prefLabel ?label .
}
```

### `flatten-hierarchy`

Removes `skos:topConceptOf` and `skos:narrower` assertions, retaining only `skos:broader` as the hierarchy predicate.

```sparql
<!-- databook:id: flatten-hierarchy -->
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

CONSTRUCT {
    ?concept a skos:Concept ;
             skos:prefLabel ?label ;
             skos:inScheme ?scheme ;
             skos:broader ?broader .
}
WHERE {
    ?concept a skos:Concept ;
             skos:prefLabel ?label ;
             skos:inScheme ?scheme .
    OPTIONAL { ?concept skos:broader ?broader }
}
```

### `extract-labels-csv`

Produces a flat SELECT result (CSV-compatible) of concept IRIs and preferred labels.

```sparql
<!-- databook:id: extract-labels-csv -->
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

SELECT ?concept ?label ?scheme WHERE {
    ?concept a skos:Concept ;
             skos:prefLabel ?label ;
             skos:inScheme ?scheme .
}
ORDER BY ?scheme ?label
```

### `add-skos-inscheme`

Adds `skos:inScheme` assertions for any concept that has a `skos:topConceptOf` relationship but is missing the `skos:inScheme` triple.

```sparql
<!-- databook:id: add-skos-inscheme -->
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

CONSTRUCT {
    ?concept skos:inScheme ?scheme .
}
WHERE {
    ?concept skos:topConceptOf ?scheme .
    FILTER NOT EXISTS { ?concept skos:inScheme ?scheme }
}
```

## Referencing in a Process Stamp

```yaml
process:
  transformer: "Extract SKOS top concepts from a concept scheme"
  transformer_type: library-transform
  transformer_iri: https://w3id.org/databook/examples/transformer-library-v1#extract-top-concepts
  inputs:
    - iri: https://w3id.org/databook/examples/colour-taxonomy-v1
      role: primary
```
