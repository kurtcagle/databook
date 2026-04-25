---
id: https://w3id.org/databook/examples/rdf12-reification-v1
title: "RDF 1.2 Reification — Provenance Annotations Example"
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
  - RDF 1.2
  - reification
  - triple terms
  - provenance
description: >
  Demonstrates RDF 1.2 Turtle reification annotations (the ~ reifier {| ... |}
  syntax) for assertion-level provenance. Requires Jena 6.0 or another
  RDF 1.2-compliant parser. rdflib will load the base graph but silently
  ignore the reification annotations.

graph:
  namespace: https://example.org/taxonomy/colour/
  named_graph: https://w3id.org/databook/examples/rdf12-reification-v1#graph
  triple_count: 8
  subjects: 4
  rdf_version: "1.2"
  turtle_version: "1.2"
  reification: true
  validator_note: >
    Requires Jena 6.0 for full reification support.
    rdflib workaround: extract block, load as turtle (not turtle12) — base graph
    parses correctly, annotations are silently ignored.

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

# RDF 1.2 Reification — Provenance Annotations

This DataBook demonstrates RDF 1.2 Turtle reification annotations, which attach provenance metadata to individual triples without requiring cumbersome blank-node reification or named sub-graphs.

The `turtle12` fence label signals that a Turtle 1.2-capable parser is required for full fidelity. Parsers encountering the base graph without reification support will load the core triples successfully but will not see the annotation metadata.

## RDF 1.2 Annotated Data

The colour taxonomy from the DataBook examples, annotated with provenance metadata on selected triples:

```turtle12
<!-- databook:id: colour-taxonomy-annotated -->
<!-- databook:graph: https://w3id.org/databook/examples/rdf12-reification-v1#graph -->
@prefix skos:   <http://www.w3.org/2004/02/skos/core#> .
@prefix colour: <https://example.org/taxonomy/colour/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix prov:   <http://www.w3.org/ns/prov#> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .
@prefix rdfs:   <http://www.w3.org/2000/01/rdf-schema#> .

colour:ColourScheme a skos:ConceptScheme ;
    skos:prefLabel "Colour Terms"@en .

# ── Annotated top concept assertions ───────────────────────────────────────────

colour:WarmColour a skos:Concept ;
    skos:inScheme colour:ColourScheme ;
    skos:prefLabel "Warm Colour"@en .

colour:WarmColour skos:topConceptOf colour:ColourScheme
    ~ colour:ann-warm-top
    {|
        dcterms:date      "2026-04-25"^^xsd:date ;
        prov:wasAttributedTo <https://holongraph.com/people/chloe-shannon> ;
        rdfs:comment      "Established as top concept in taxonomy review 2026-04."@en
    |} .

colour:CoolColour a skos:Concept ;
    skos:inScheme colour:ColourScheme ;
    skos:prefLabel "Cool Colour"@en .

colour:CoolColour skos:topConceptOf colour:ColourScheme
    ~ colour:ann-cool-top
    {|
        dcterms:date      "2026-04-25"^^xsd:date ;
        prov:wasAttributedTo <https://holongraph.com/people/chloe-shannon> ;
        rdfs:comment      "Established as top concept in taxonomy review 2026-04."@en
    |} .

# ── Annotated narrower concept assertions ──────────────────────────────────────

colour:Red a skos:Concept ;
    skos:inScheme colour:ColourScheme ;
    skos:prefLabel "Red"@en .

colour:Red skos:broader colour:WarmColour
    ~ colour:ann-red-broader
    {|
        dcterms:date      "2026-04-25"^^xsd:date ;
        rdfs:comment      "Assigned to WarmColour category by colour wheel analysis."@en
    |} .

colour:Blue a skos:Concept ;
    skos:inScheme colour:ColourScheme ;
    skos:prefLabel "Blue"@en .

colour:Blue skos:broader colour:CoolColour
    ~ colour:ann-blue-broader
    {|
        dcterms:date      "2026-04-25"^^xsd:date ;
        rdfs:comment      "Assigned to CoolColour category by colour wheel analysis."@en
    |} .
```

## Querying Reification Annotations

With Jena 6.0, query annotation metadata using the `rdf:reifies` predicate:

```sparql
<!-- databook:id: select-annotations -->
PREFIX rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX prov:    <http://www.w3.org/ns/prov#>
PREFIX rdfs:    <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?triple ?predicate ?object ?date ?comment WHERE {
    ?reifier rdf:reifies ?triple ;
             dcterms:date ?date .
    ?triple rdf:subject ?subject ;
            rdf:predicate ?predicate ;
            rdf:object ?object .
    OPTIONAL { ?reifier rdfs:comment ?comment }
}
ORDER BY ?date ?predicate
```

## Parser Compatibility Notes

| Parser | Behaviour |
| --- | --- |
| Jena 6.0 | Full RDF 1.2 support. Load the block directly as Turtle 1.2. Query reification with `rdf:reifies`. |
| rdflib (Python) | Loads base graph only; reification annotations silently ignored. Strip the `~ reifier {| ... |}` syntax before passing to rdflib if needed. |
| Any RDF 1.1 parser | Will fail on the reification syntax. Pre-process to strip annotations or use the non-annotated example in `skos-taxonomy.databook.md`. |

> **Note:** The `turtle12` fence label in this block signals that a Turtle 1.2 parser is required. Tools that only recognise `turtle` will skip or display this block without loading it.
