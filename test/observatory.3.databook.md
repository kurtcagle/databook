---
id: https://w3id.org/databook/test/observatory-v1
title: "GGSC Test: Geodetic Observatory Knowledge Graph v1"
type: databook
version: 1.0.0
created: 2026-04-22
author:
  - name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator
  - name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: transformer
license: CC-BY-4.0
domain: https://w3id.org/databook/test/observatory-v1#
subject:
  - geodetic observatory
  - GGSC
  - sensor ontology
  - SOSA
description: >
  Full-featured test DataBook for databook-cli validation.
  Contains a primary Turtle graph (observatory + sensors), a SHACL
  shapes block, a SPARQL CONSTRUCT query, a SPARQL SELECT query,
  and a SPARQL UPDATE block. Covers all push-eligible block types
  and all pull modes.
graph:
  namespace: https://w3id.org/databook/test/observatory-v1#
  named_graph: https://w3id.org/databook/test/observatory-v1#primary-graph
  triple_count: 38
  subjects: 9
  rdf_version: "1.1"
process:
  transformer: "Chloe Shannon"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-4-6
  inputs:
    - iri: urn:input:ggsc-design-2026-04-22
      role: primary
      block_id: primary-graph
      description: "Observatory graph — manually authored for testing"
    - iri: https://w3id.org/databook/test/shapes-v1#observatory-shapes
      role: constraint
      block_id: observatory-shapes
      description: "SHACL shapes constraining observatory entities"
  timestamp: 2026-04-22T12:00:00Z
  agent:
    name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: orchestrator
---


# GGSC Test: Geodetic Observatory Knowledge Graph

This DataBook carries the core observatory knowledge graph used for
`databook-cli` integration testing. It exercises every pushable block
type and provides embedded SPARQL blocks for pull testing.

---

## Primary Graph

Observatory, instruments, and observations as RDF 1.1 Turtle.

```turtle
<!-- databook:id: primary-graph -->
@prefix obs:   <https://w3id.org/databook/test/observatory-v1#> .
@prefix sosa:  <http://www.w3.org/ns/sosa/> .
@prefix ssn:   <http://www.w3.org/ns/ssn/> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix geo:   <http://www.w3.org/2003/01/geo/wgs84_pos#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix qudt:  <http://qudt.org/schema/qudt/> .

# ── Observatory ────────────────────────────────────────────────────────────────

obs:RoyalObservatory a sosa:Platform ;
    rdfs:label       "Royal Observatory Greenwich"@en ;
    geo:lat           51.4778 ;
    geo:long         -0.0015 ;
    dct:description  "Primary geodetic reference station"@en ;
    dct:created      "1675-10-22"^^xsd:date ;
    obs:icaoCode     "EGLL" .

# ── Sensors ───────────────────────────────────────────────────────────────────

obs:GravitySensor a sosa:Sensor ;
    rdfs:label       "Absolute Gravity Sensor FG5-X"@en ;
    sosa:isHostedBy  obs:RoyalObservatory ;
    sosa:observes    obs:GravitationalAcceleration ;
    ssn:hasProperty  obs:CalibrationStatus ;
    obs:serialNumber "FG5X-0042" ;
    obs:lastCalibrated "2026-01-15"^^xsd:date .

obs:PressureSensor a sosa:Sensor ;
    rdfs:label       "Vaisala PTB330 Barometer"@en ;
    sosa:isHostedBy  obs:RoyalObservatory ;
    sosa:observes    obs:AtmosphericPressure ;
    obs:serialNumber "PTB330-117" ;
    obs:lastCalibrated "2026-02-01"^^xsd:date .

obs:TiltSensor a sosa:Sensor ;
    rdfs:label       "Lippmann Tiltmeter LT-3"@en ;
    sosa:isHostedBy  obs:RoyalObservatory ;
    sosa:observes    obs:EarthTilt ;
    obs:serialNumber "LT3-2088" .

# ── Observable Properties ──────────────────────────────────────────────────────

obs:GravitationalAcceleration a sosa:ObservableProperty ;
    rdfs:label  "Gravitational acceleration"@en ;
    qudt:unit   <http://qudt.org/vocab/unit/M-PER-SEC2> .

obs:AtmosphericPressure a sosa:ObservableProperty ;
    rdfs:label  "Atmospheric pressure"@en ;
    qudt:unit   <http://qudt.org/vocab/unit/HectoPA> .

obs:EarthTilt a sosa:ObservableProperty ;
    rdfs:label  "Earth tilt / polar motion"@en ;
    qudt:unit   <http://qudt.org/vocab/unit/MicroRAD> .

# ── Observations ──────────────────────────────────────────────────────────────

obs:Obs20260422T0900Z a sosa:Observation ;
    sosa:madeBySensor obs:GravitySensor ;
    sosa:observedProperty obs:GravitationalAcceleration ;
    sosa:resultTime "2026-04-22T09:00:00Z"^^xsd:dateTime ;
    sosa:hasSimpleResult "9.81185"^^xsd:decimal .

obs:Obs20260422T0901Z a sosa:Observation ;
    sosa:madeBySensor obs:PressureSensor ;
    sosa:observedProperty obs:AtmosphericPressure ;
    sosa:resultTime "2026-04-22T09:01:00Z"^^xsd:dateTime ;
    sosa:hasSimpleResult "1013.2"^^xsd:decimal .
```

---

## SHACL Validation Shapes

Shapes constraining observatory and sensor entities.

```shacl
<!-- databook:id: observatory-shapes -->
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix sosa: <http://www.w3.org/ns/sosa/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix geo:  <http://www.w3.org/2003/01/geo/wgs84_pos#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix obs:  <https://w3id.org/databook/test/observatory-v1#> .

obs:PlatformShape a sh:NodeShape ;
    sh:targetClass sosa:Platform ;
    sh:property [
        sh:path rdfs:label ;
        sh:minCount 1 ;
        sh:message "Platform must have a label"@en ;
    ] ;
    sh:property [
        sh:path geo:lat ;
        sh:minCount 1 ;
        sh:datatype xsd:decimal ;
        sh:message "Platform must have a WGS84 latitude"@en ;
    ] ;
    sh:property [
        sh:path geo:long ;
        sh:minCount 1 ;
        sh:datatype xsd:decimal ;
        sh:message "Platform must have a WGS84 longitude"@en ;
    ] .

obs:SensorShape a sh:NodeShape ;
    sh:targetClass sosa:Sensor ;
    sh:property [
        sh:path rdfs:label ;
        sh:minCount 1 ;
        sh:message "Sensor must have a label"@en ;
    ] ;
    sh:property [
        sh:path sosa:isHostedBy ;
        sh:minCount 1 ;
        sh:class sosa:Platform ;
        sh:message "Sensor must be hosted by a Platform"@en ;
    ] ;
    sh:property [
        sh:path sosa:observes ;
        sh:minCount 1 ;
        sh:message "Sensor must declare what it observes"@en ;
    ] .

obs:ObservationShape a sh:NodeShape ;
    sh:targetClass sosa:Observation ;
    sh:property [
        sh:path sosa:madeBySensor ;
        sh:minCount 1 ;
        sh:class sosa:Sensor ;
    ] ;
    sh:property [
        sh:path sosa:resultTime ;
        sh:minCount 1 ;
        sh:datatype xsd:dateTime ;
    ] ;
    sh:property [
        sh:path sosa:hasSimpleResult ;
        sh:minCount 1 ;
    ] .
```

---

## Retrieval Query — CONSTRUCT

SPARQL CONSTRUCT to fetch the full sensor graph from the store.
Used for `databook pull --fragment` testing.

```sparql
<!-- databook:id: sensor-construct -->
PREFIX sosa: <http://www.w3.org/ns/sosa/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX obs:  <https://w3id.org/databook/test/observatory-v1#>

CONSTRUCT {
  ?sensor a sosa:Sensor ;
          rdfs:label ?label ;
          sosa:isHostedBy ?platform ;
          sosa:observes ?prop ;
          obs:serialNumber ?serial .
}
WHERE {
  ?sensor a sosa:Sensor ;
          rdfs:label ?label ;
          sosa:isHostedBy ?platform ;
          sosa:observes ?prop .
  OPTIONAL { ?sensor obs:serialNumber ?serial . }
}
```

---

## Retrieval Query — SELECT with Parameter Injection

SPARQL SELECT that supports `<<db:inject>>` for VALUES-based type filtering.
Used for `databook process --sparql` parameterised testing.

```sparql
<!-- databook:id: typed-select -->
PREFIX sosa: <http://www.w3.org/ns/sosa/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX obs:  <https://w3id.org/databook/test/observatory-v1#>

SELECT ?entity ?label ?p ?o WHERE {
  VALUES ?type { <<db:inject>> } # was 
  ?entity a ?type .
  optional {
          ?entity rdfs:label ?label
   } .
   ?entity ?p ?o .
}
ORDER BY ?label
```

---

## Maintenance Update — SPARQL UPDATE

SPARQL UPDATE to refresh calibration timestamps.
Used for `databook push` sparql-update block testing.

```sparql-update
<!-- databook:id: refresh-calibration -->
PREFIX obs: <https://w3id.org/databook/test/observatory-v1#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

DELETE {
  obs:GravitySensor obs:lastCalibrated ?old .
}
INSERT {
  obs:GravitySensor obs:lastCalibrated "2026-04-22"^^xsd:date .
}
WHERE {
  obs:GravitySensor obs:lastCalibrated ?old .
}
```
