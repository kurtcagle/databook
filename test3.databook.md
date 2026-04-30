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
  transformer_type: service
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
  timestamp: 2026-04-26T06:33:46.907Z
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
PREFIX build: <https://w3id.org/databook/ns#>
PREFIX dct:   <http://purl.org/dc/terms/>
PREFIX foaf:  <http://xmlns.com/foaf/0.1/>
PREFIX owl:   <http://www.w3.org/2002/07/owl#>
PREFIX prov:  <http://www.w3.org/ns/prov#>
PREFIX sd:    <http://www.w3.org/ns/sparql-service-description#>
PREFIX void:  <http://rdfs.org/ns/void#>
PREFIX xsd:   <http://www.w3.org/2001/XMLSchema#>

<https://w3id.org/databook/test/observatory-v1#RoyalObservatory>
        a                <http://www.w3.org/ns/sosa/Platform>;
        <http://www.w3.org/2000/01/rdf-schema#label>
                "Royal Observatory Greenwich"@en;
        dct:created      "1675-10-22"^^xsd:date;
        dct:description  "Primary geodetic reference station"@en;
        <http://www.w3.org/2003/01/geo/wgs84_pos#lat>
                51.4778;
        <http://www.w3.org/2003/01/geo/wgs84_pos#long>
                -0.0015;
        <https://w3id.org/databook/test/observatory-v1#icaoCode>
                "EGLL" .

<https://w3id.org/databook/test/observatory-v1#GravitySensor>
        a       <http://www.w3.org/ns/sosa/Sensor>;
        <http://www.w3.org/2000/01/rdf-schema#label>
                "Absolute Gravity Sensor FG5-X"@en;
        <http://www.w3.org/ns/sosa/isHostedBy>
                <https://w3id.org/databook/test/observatory-v1#RoyalObservatory>;
        <http://www.w3.org/ns/sosa/observes>
                <https://w3id.org/databook/test/observatory-v1#GravitationalAcceleration>;
        <http://www.w3.org/ns/ssn/hasProperty>
                <https://w3id.org/databook/test/observatory-v1#CalibrationStatus>;
        <https://w3id.org/databook/test/observatory-v1#lastCalibrated>
                "2026-01-15"^^xsd:date;
        <https://w3id.org/databook/test/observatory-v1#serialNumber>
                "FG5X-0042" .

<https://w3id.org/databook/test/observatory-v1#GravitationalAcceleration>
        a       <http://www.w3.org/ns/sosa/ObservableProperty>;
        <http://www.w3.org/2000/01/rdf-schema#label>
                "Gravitational acceleration"@en;
        <http://qudt.org/schema/qudt/unit>
                <http://qudt.org/vocab/unit/M-PER-SEC2> .

<https://w3id.org/databook/test/observatory-v1#PressureSensor>
        a       <http://www.w3.org/ns/sosa/Sensor>;
        <http://www.w3.org/2000/01/rdf-schema#label>
                "Vaisala PTB330 Barometer"@en;
        <http://www.w3.org/ns/sosa/isHostedBy>
                <https://w3id.org/databook/test/observatory-v1#RoyalObservatory>;
        <http://www.w3.org/ns/sosa/observes>
                <https://w3id.org/databook/test/observatory-v1#AtmosphericPressure>;
        <https://w3id.org/databook/test/observatory-v1#lastCalibrated>
                "2026-02-01"^^xsd:date;
        <https://w3id.org/databook/test/observatory-v1#serialNumber>
                "PTB330-117" .

<https://w3id.org/databook/test/observatory-v1#AtmosphericPressure>
        a       <http://www.w3.org/ns/sosa/ObservableProperty>;
        <http://www.w3.org/2000/01/rdf-schema#label>
                "Atmospheric pressure"@en;
        <http://qudt.org/schema/qudt/unit>
                <http://qudt.org/vocab/unit/HectoPA> .

<https://w3id.org/databook/test/observatory-v1#TiltSensor>
        a       <http://www.w3.org/ns/sosa/Sensor>;
        <http://www.w3.org/2000/01/rdf-schema#label>
                "Lippmann Tiltmeter LT-3"@en;
        <http://www.w3.org/ns/sosa/isHostedBy>
                <https://w3id.org/databook/test/observatory-v1#RoyalObservatory>;
        <http://www.w3.org/ns/sosa/observes>
                <https://w3id.org/databook/test/observatory-v1#EarthTilt>;
        <https://w3id.org/databook/test/observatory-v1#serialNumber>
                "LT3-2088" .

<https://w3id.org/databook/test/observatory-v1#EarthTilt>
        a       <http://www.w3.org/ns/sosa/ObservableProperty>;
        <http://www.w3.org/2000/01/rdf-schema#label>
                "Earth tilt / polar motion"@en;
        <http://qudt.org/schema/qudt/unit>
                <http://qudt.org/vocab/unit/MicroRAD> .

<https://w3id.org/databook/test/observatory-v1#Obs20260422T0900Z>
        a       <http://www.w3.org/ns/sosa/Observation>;
        <http://www.w3.org/ns/sosa/hasSimpleResult>
                9.81185;
        <http://www.w3.org/ns/sosa/madeBySensor>
                <https://w3id.org/databook/test/observatory-v1#GravitySensor>;
        <http://www.w3.org/ns/sosa/observedProperty>
                <https://w3id.org/databook/test/observatory-v1#GravitationalAcceleration>;
        <http://www.w3.org/ns/sosa/resultTime>
                "2026-04-22T09:00:00Z"^^xsd:dateTime .

<https://w3id.org/databook/test/observatory-v1#Obs20260422T0901Z>
        a       <http://www.w3.org/ns/sosa/Observation>;
        <http://www.w3.org/ns/sosa/hasSimpleResult>
                1013.2;
        <http://www.w3.org/ns/sosa/madeBySensor>
                <https://w3id.org/databook/test/observatory-v1#PressureSensor>;
        <http://www.w3.org/ns/sosa/observedProperty>
                <https://w3id.org/databook/test/observatory-v1#AtmosphericPressure>;
        <http://www.w3.org/ns/sosa/resultTime>
                "2026-04-22T09:01:00Z"^^xsd:dateTime .
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

SELECT ?entity ?label WHERE {
  VALUES (?type) { <<db:inject>> }
  ?entity a ?type ;
          rdfs:label ?label .
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
