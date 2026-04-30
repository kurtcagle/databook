<script language="application/yaml">

---
id: https://w3id.org/databook/test/pipeline-v1
title: "GGSC Test: Observatory Validation Pipeline"
type: processor-registry
version: 1.0.0
created: 2026-04-22
author:
  - name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator
license: CC-BY-4.0
subject:
  - pipeline
  - SPARQL
  - SHACL
  - processor-registry
description: >
  Two-stage pipeline DataBook for databook process testing.
  Stage 1: SPARQL CONSTRUCT extracts a normalised sensor subgraph.
  Stage 2: SHACL validation of the constructed graph.
  The build:Target collects both outputs into the final DataBook.
  Configure Jena paths in processors.toml before live execution.
process:
  transformer: "Kurt Cagle"
  transformer_type: human
  inputs:
    - iri: urn:input:test-pipeline-2026-04-22
      role: primary
      description: "Manually authored pipeline definition"
  timestamp: 2026-04-22T12:00:00Z
---

</script>

# GGSC Test: Observatory Validation Pipeline

A two-stage process pipeline:

1. **Stage 1 — Construct** (`build:order 1`): SPARQL CONSTRUCT extracts
   all sensors and their observable properties from the source graph.
2. **Stage 2 — Validate** (`build:order 2`, `build:dependsOn` Stage 1):
   Jena SHACL validates the constructed graph against `sensor-shapes`.

The `build:Target` collects both results.

Use with:
```bash
databook process observatory.databook.md -P pipeline.databook.md --dry-run
databook process observatory.databook.md -P pipeline.databook.md -o output.databook.md
```

---

## Stage Catalogue

```processor-registry
<!-- databook:id: stage-catalogue -->
@prefix build: <https://w3id.org/databook/ns#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix core:  <https://w3id.org/databook/plugins/core#> .
@prefix pipe:  <https://w3id.org/databook/test/pipeline-v1#> .

# ── Processor declarations ─────────────────────────────────────────────────────

core:jena-sparql a build:Processor ;
    build:processorType "sparql" ;
    build:status        build:Active ;
    dct:title           "Apache Jena ARQ (SPARQL)"@en .

core:jena-shacl a build:Processor ;
    build:processorType "shacl" ;
    build:status        build:Active ;
    dct:title           "Apache Jena SHACL Validator"@en .

# ── Stage 1: CONSTRUCT ────────────────────────────────────────────────────────

pipe:stage-construct a build:Stage ;
    build:order         1 ;
    build:processorRef  core:jena-sparql ;
    build:payloadRef    <#extract-sensors-query> ;
    build:inputBlock    "primary-graph" ;
    build:outputBlock   "constructed-sensors" ;
    build:outputType    "turtle" ;
    dct:title           "Extract normalised sensor subgraph"@en .

# ── Stage 2: VALIDATE ─────────────────────────────────────────────────────────

pipe:stage-validate a build:Stage ;
    build:order         2 ;
    build:processorRef  core:jena-shacl ;
    build:shapesRef     <#sensor-validation-shapes> ;
    build:inputBlock    "constructed-sensors" ;
    build:outputBlock   "validation-report" ;
    build:outputType    "turtle" ;
    build:dependsOn     pipe:stage-construct ;
    dct:title           "Validate constructed sensor graph"@en .

# ── Pipeline Root ──────────────────────────────────────────────────────────────

pipe:pipeline-root a build:Target ;
    build:outputBlock   "pipeline-output" ;
    build:dependsOn     pipe:stage-validate ;
    dct:title           "Observatory sensor validation pipeline"@en .
```

---

## Extract Sensors Query

SPARQL CONSTRUCT payload for Stage 1.

```sparql
<!-- databook:id: extract-sensors-query -->
PREFIX sosa: <http://www.w3.org/ns/sosa/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX obs:  <https://w3id.org/databook/test/observatory-v1#>

CONSTRUCT {
  ?sensor a sosa:Sensor ;
          rdfs:label ?label ;
          sosa:isHostedBy ?platform ;
          sosa:observes ?prop ;
          obs:serialNumber ?serial ;
          obs:lastCalibrated ?cal .
}
WHERE {
  ?sensor a sosa:Sensor ;
          rdfs:label ?label ;
          sosa:isHostedBy ?platform ;
          sosa:observes ?prop .
  OPTIONAL { ?sensor obs:serialNumber ?serial . }
  OPTIONAL { ?sensor obs:lastCalibrated ?cal . }
}
```

---

## Sensor Validation Shapes

SHACL shapes payload for Stage 2.
Validates that every sensor has a label, platform, observable property,
and serial number.

```shacl
<!-- databook:id: sensor-validation-shapes -->
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix sosa: <http://www.w3.org/ns/sosa/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix obs:  <https://w3id.org/databook/test/observatory-v1#> .

obs:SensorValidationShape a sh:NodeShape ;
    sh:targetClass sosa:Sensor ;
    sh:property [
        sh:path rdfs:label ;
        sh:minCount 1 ;
        sh:message "Sensor must have a label"@en ;
    ] ;
    sh:property [
        sh:path sosa:isHostedBy ;
        sh:minCount 1 ;
        sh:message "Sensor must be hosted by a Platform"@en ;
    ] ;
    sh:property [
        sh:path sosa:observes ;
        sh:minCount 1 ;
        sh:message "Sensor must reference an observable property"@en ;
    ] ;
    sh:property [
        sh:path obs:serialNumber ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
        sh:message "Sensor must have a serial number for traceability"@en ;
    ] .
```
