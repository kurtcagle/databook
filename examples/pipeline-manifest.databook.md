---
id: https://w3id.org/databook/examples/pipeline-manifest-v1
title: "Taxonomy Compilation Pipeline — Manifest DataBook"
type: databook
version: 1.0.0
created: 2026-04-25

author:
  - name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator

license: CC-BY-4.0
domain: https://w3id.org/databook/ns#
subject:
  - pipeline
  - build manifest
  - dependency graph
description: >
  A manifest DataBook describing a three-stage taxonomy compilation pipeline.
  The manifest is expressed as RDF using the build: vocabulary, making the
  dependency graph SPARQL-queryable. Demonstrates build:Target, build:Stage,
  build:Source, build:dependsOn, and build:outputType.

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

# Taxonomy Compilation Pipeline

This DataBook specifies a three-stage pipeline that:

1. Ingests a raw CSV vocabulary as the **source**
2. Runs a SPARQL CONSTRUCT to produce a normalised Turtle **stage**
3. Applies LLM-generated SHACL shapes to produce the validated **target**

The manifest is expressed as RDF (using the `build:` vocabulary at `https://w3id.org/databook/ns#`), so the dependency graph is SPARQL-queryable. This makes it possible to ask questions like "which stages depend on a changed source?" before running the pipeline.

## Pipeline Manifest

```manifest
<!-- databook:id: pipeline-manifest -->
@prefix build: <https://w3id.org/databook/ns#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix db:    <https://w3id.org/databook/examples/> .

# ── Target ─────────────────────────────────────────────────────────────────────
# The final validated taxonomy DataBook

db:validated-taxonomy-v1 a build:Target ;
    dct:title    "Validated Colour Taxonomy"@en ;
    build:outputType "turtle" ;
    build:dependsOn db:normalised-taxonomy-v1,
                    db:shacl-shapes-v1 .

# ── Stages ─────────────────────────────────────────────────────────────────────
# Intermediate DataBooks produced during the pipeline run

db:normalised-taxonomy-v1 a build:Stage ;
    dct:title       "Normalised Colour Taxonomy (Turtle)"@en ;
    build:transformer "sparql" ;
    build:outputType  "turtle" ;
    build:dependsOn   db:raw-vocabulary-csv .

db:shacl-shapes-v1 a build:Stage ;
    dct:title       "SHACL Shapes for Colour Taxonomy"@en ;
    build:transformer "llm" ;
    build:outputType  "shacl" ;
    build:dependsOn   db:normalised-taxonomy-v1 .

# ── Source ─────────────────────────────────────────────────────────────────────
# Raw input: no DataBook-format dependencies

db:raw-vocabulary-csv a build:Source ;
    dct:title       "Raw Colour Vocabulary CSV"@en ;
    build:outputType "csv" .
```

## Manifest Queries

### Find all stages that depend on a changed source

```sparql
<!-- databook:id: select-dependents -->
<!-- databook:param: changedSource type=IRI default=db:raw-vocabulary-csv -->
PREFIX build: <https://w3id.org/databook/ns#>
PREFIX db:    <https://w3id.org/databook/examples/>

SELECT ?affected WHERE {
    VALUES ?changedSource { db:raw-vocabulary-csv }
    ?affected build:dependsOn+ ?changedSource .
}
```

### Compute full transitive dependency closure of the target

```sparql
<!-- databook:id: select-closure -->
PREFIX build: <https://w3id.org/databook/ns#>
PREFIX db:    <https://w3id.org/databook/examples/>

SELECT ?dep WHERE {
    db:validated-taxonomy-v1 build:dependsOn+ ?dep .
}
ORDER BY ?dep
```

### Validate type compatibility between stages

```sparql
<!-- databook:id: validate-type-compat -->
PREFIX build: <https://w3id.org/databook/ns#>

SELECT ?consumer ?producer ?expects ?produces WHERE {
    ?consumer build:dependsOn ?producer .
    ?consumer build:inputType ?expects .
    ?producer build:outputType ?produces .
    FILTER (?expects != ?produces)
}
```

## Pipeline Configuration

When running this pipeline with the DataBook CLI, point the `process` command at this manifest:

```bash
databook process pipeline-manifest.databook.md \
  --endpoint http://localhost:3030/ds/sparql
```

The CLI resolves the `build:dependsOn` graph, determines execution order, and runs each stage in dependency order, pushing outputs to the SPARQL endpoint between stages.
