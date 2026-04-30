<script language="application/yaml">

---
id: https://w3id.org/databook/test/shapes-v1
title: "GGSC Test: SHACL Shapes Library"
type: databook
version: 1.0.0
created: 2026-04-22
author:
  - name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator
license: CC-BY-4.0
subject:
  - SHACL
  - validation
  - GGSC
  - observatory
description: >
  SHACL shapes library DataBook for databook-cli testing.
  Provides named shapes blocks addressable via fragment reference
  (e.g. shapes.databook.md#observatory-shapes) for use with
  databook process --shapes.
process:
  transformer: "Kurt Cagle"
  transformer_type: human
  inputs:
    - iri: urn:input:test-shapes-2026-04-22
      role: primary
      description: "Manually authored SHACL shapes"
  timestamp: 2026-04-22T12:00:00Z
---

</script>

# GGSC Test: SHACL Shapes Library

Named SHACL shapes blocks for use as fragment references in
`databook process --shapes` tests. Reference any block as:

```
shapes.databook.md#<block-id>
```

---

## Observatory Shapes — Full Constraint Set

Complete SHACL shapes for Platform, Sensor, ObservableProperty,
and Observation. Used in full-pipeline validation tests.

```shacl
<!-- databook:id: observatory-shapes -->
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix sosa: <http://www.w3.org/ns/sosa/> .
@prefix ssn:  <http://www.w3.org/ns/ssn/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix geo:  <http://www.w3.org/2003/01/geo/wgs84_pos#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix obs:  <https://w3id.org/databook/test/observatory-v1#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .

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
        sh:message "Sensor must declare an observable property"@en ;
    ] .

obs:ObservationShape a sh:NodeShape ;
    sh:targetClass sosa:Observation ;
    sh:property [
        sh:path sosa:madeBySensor ;
        sh:minCount 1 ;
        sh:class sosa:Sensor ;
        sh:message "Observation must reference a Sensor"@en ;
    ] ;
    sh:property [
        sh:path sosa:resultTime ;
        sh:minCount 1 ;
        sh:datatype xsd:dateTime ;
        sh:message "Observation must have a result time"@en ;
    ] ;
    sh:property [
        sh:path sosa:hasSimpleResult ;
        sh:minCount 1 ;
        sh:message "Observation must have a result value"@en ;
    ] .
```

---

## Sensor-Only Shapes — Lightweight

Validates sensors only (no platform or observation constraints).
Used for single-operation `--shapes` tests.

```shacl
<!-- databook:id: sensor-shapes -->
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix sosa: <http://www.w3.org/ns/sosa/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix obs:  <https://w3id.org/databook/test/observatory-v1#> .

obs:SensorLightShape a sh:NodeShape ;
    sh:targetClass sosa:Sensor ;
    sh:property [
        sh:path rdfs:label ;
        sh:minCount 1 ;
    ] ;
    sh:property [
        sh:path sosa:observes ;
        sh:minCount 1 ;
    ] ;
    sh:property [
        sh:path obs:serialNumber ;
        sh:minCount 1 ;
        sh:datatype xsd:string ;
        sh:message "Sensor must have a serial number"@en ;
    ] .
```

---

## Calibration Shapes — Property-Level Constraint

Validates that sensors have a recent calibration date (after 2025-01-01).
Tests SHACL `sh:minInclusive` on date values.

```shacl
<!-- databook:id: calibration-shapes -->
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix sosa: <http://www.w3.org/ns/sosa/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix obs:  <https://w3id.org/databook/test/observatory-v1#> .

obs:CalibrationShape a sh:NodeShape ;
    sh:targetClass sosa:Sensor ;
    sh:property [
        sh:path obs:lastCalibrated ;
        sh:minCount 1 ;
        sh:datatype xsd:date ;
        sh:minInclusive "2025-01-01"^^xsd:date ;
        sh:message "Sensor calibration must be dated 2025 or later"@en ;
    ] .
```
