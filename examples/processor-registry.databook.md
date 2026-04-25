---
id: https://w3id.org/databook/examples/processor-registry-v1
title: "DataBook Processor Registry — Development Environment"
type: processor-registry
version: 1.0.0
created: 2026-04-25

author:
  - name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator

license: CC-BY-4.0
domain: https://w3id.org/databook/ns#
subject:
  - processor registry
  - SPARQL endpoint
  - LLM processor
description: >
  A processor-registry DataBook cataloguing the named processing services
  available in a typical DataBook development environment: a local Jena Fuseki
  SPARQL endpoint and the Anthropic Claude Sonnet API. Process stamps reference
  processors symbolically by registry IRI, decoupling pipeline definitions from
  deployment details.

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

# DataBook Processor Registry — Development Environment

This DataBook is a `processor-registry` — a catalogue of named processing services used by DataBook pipelines. Instead of hardcoding endpoints in process stamps, pipelines reference processors symbolically by their fragment IRI. When endpoints change, only the registry needs updating.

## Processor Catalogue (RDF)

```processor-registry
<!-- databook:id: processor-catalogue -->
@prefix build: <https://w3id.org/databook/ns#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix reg:   <https://w3id.org/databook/examples/processor-registry-v1#> .

# ── SPARQL Triplestore ──────────────────────────────────────────────────────────

reg:jena-local a build:Processor ;
    build:processorType  "sparql" ;
    build:serviceIRI     <http://localhost:3030/ds/sparql> ;
    build:rdfVersion     "1.2" ;
    dct:title            "Apache Jena Fuseki 6.0 — local development"@en ;
    build:status         build:Active ;
    build:capabilityNote "Supports RDF 1.2 natively including Turtle 1.2 reification. GSP endpoint at http://localhost:3030/ds/data."@en .

reg:jena-staging a build:Processor ;
    build:processorType  "sparql" ;
    build:serviceIRI     <https://staging.example.org/sparql> ;
    build:rdfVersion     "1.2" ;
    dct:title            "Apache Jena Fuseki 6.0 — staging server"@en ;
    build:status         build:Active .

# ── LLM Processors ─────────────────────────────────────────────────────────────

reg:claude-sonnet a build:Processor ;
    build:processorType  "llm" ;
    build:serviceIRI     <https://api.anthropic.com/v1/messages> ;
    build:modelVersion   "claude-sonnet-4-6" ;
    dct:title            "Claude Sonnet 4.6 via Anthropic API"@en ;
    build:status         build:Active ;
    build:capabilityNote "Requires ANTHROPIC_API_KEY environment variable."@en .

reg:claude-opus a build:Processor ;
    build:processorType  "llm" ;
    build:serviceIRI     <https://api.anthropic.com/v1/messages> ;
    build:modelVersion   "claude-opus-4-6" ;
    dct:title            "Claude Opus 4.6 via Anthropic API"@en ;
    build:status         build:Active ;
    build:capabilityNote "Higher capability, higher cost. Use for complex ontology work."@en .

# ── Validation Service ──────────────────────────────────────────────────────────

reg:shacl-validator a build:Processor ;
    build:processorType  "shacl" ;
    build:serviceIRI     <http://localhost:3030/ds/shacl> ;
    dct:title            "Jena Fuseki SHACL validation endpoint"@en ;
    build:status         build:Active ;
    build:capabilityNote "POST shapes + data to /shacl. Returns SHACL validation report."@en .
```

## Registry Queries

### List all active processors

```sparql
<!-- databook:id: select-active-processors -->
PREFIX build: <https://w3id.org/databook/ns#>
PREFIX dct:   <http://purl.org/dc/terms/>

SELECT ?processor ?title ?type WHERE {
    ?processor a build:Processor ;
               dct:title ?title ;
               build:processorType ?type ;
               build:status build:Active .
}
ORDER BY ?type ?title
```

### Find processors by type

```sparql
<!-- databook:id: select-by-type -->
<!-- databook:param: processorType type=xsd:string default="sparql" -->
PREFIX build: <https://w3id.org/databook/ns#>
PREFIX dct:   <http://purl.org/dc/terms/> .

SELECT ?processor ?title ?serviceIRI WHERE {
    VALUES ?processorType { "sparql" }
    ?processor a build:Processor ;
               build:processorType ?processorType ;
               build:serviceIRI ?serviceIRI ;
               dct:title ?title ;
               build:status build:Active .
}
```

## Referencing in a Process Stamp

```yaml
process:
  transformer: "Apache Jena Fuseki 6.0 — local development"
  transformer_type: registry-processor
  transformer_iri: https://w3id.org/databook/examples/processor-registry-v1#jena-local
  inputs:
    - iri: https://w3id.org/databook/examples/colour-taxonomy-v1
      role: primary
```

> **Note:** When deploying to a different environment, point `transformer_iri` to the staging or production registry entry. The pipeline definition itself requires no changes.
