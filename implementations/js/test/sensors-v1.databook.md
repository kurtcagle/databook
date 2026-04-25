<script language="application/yaml">

---
id: https://w3id.org/databook/test/sensors-v1
title: "GGSC Test: Observatory Sensor Ontology"
type: databook
version: 1.0.0
created: 2026-04-22
author:
  - name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator
license: CC-BY-4.0
subject:
  - geodetic observatory
  - sensor data
  - RDF test
description: >
  Test DataBook for databook-cli validation. Contains a small sensor
  ontology in Turtle, a SHACL shapes block, and a SPARQL CONSTRUCT query.
graph:
  namespace: https://w3id.org/databook/test/sensors-v1#
  named_graph: https://w3id.org/databook/test/sensors-v1#sensor-graph
  triple_count: 12
  subjects: 5
  rdf_version: "1.1"
process:
  transformer: "Kurt Cagle"
  transformer_type: human
  inputs:
    - iri: urn:input:test-design-2026-04-22
      role: primary
      description: "Manual test data"
  timestamp: 2026-04-22T10:00:00Z
  agent:
    name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator
---

</script>

# GGSC Test: Observatory Sensor Ontology

A small test DataBook used to validate the `databook-cli` implementation.

## Sensor Data

Primary RDF block carrying three observatory sensors.

```turtle
<!-- databook:id: sensor-graph -->
@prefix ex:    <https://w3id.org/databook/test/sensors-v1#> .
@prefix sosa:  <http://www.w3.org/ns/sosa/> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .

ex:Sensor001 a sosa:Sensor ;
    rdfs:label "Primary Gravity Sensor"@en ;
    sosa:observes ex:GravityObservation ;
    ex:location "51.4778,-0.0015" ;
    ex:calibrated "2026-01-15"^^xsd:date .

ex:Sensor002 a sosa:Sensor ;
    rdfs:label "Atmospheric Pressure Sensor"@en ;
    sosa:observes ex:PressureObservation ;
    ex:location "51.4778,-0.0015" .

ex:Sensor003 a sosa:Sensor ;
    rdfs:label "Magnetic Field Sensor"@en ;
    sosa:observes ex:MagneticObservation ;
    ex:location "51.4780,-0.0016" .
```

## Validation Shapes

SHACL shapes for the sensor data.

```shacl
<!-- databook:id: sensor-shapes -->
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix sosa: <http://www.w3.org/ns/sosa/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix ex:   <https://w3id.org/databook/test/sensors-v1#> .

ex:SensorShape a sh:NodeShape ;
    sh:targetClass sosa:Sensor ;
    sh:property [
        sh:path rdfs:label ;
        sh:minCount 1 ;
        sh:datatype rdfs:Literal ;
    ] ;
    sh:property [
        sh:path sosa:observes ;
        sh:minCount 1 ;
    ] .
```

## Retrieval Query

SPARQL CONSTRUCT to fetch all sensor data.

```sparql
<!-- databook:id: sensor-construct -->
PREFIX sosa:  <http://www.w3.org/ns/sosa/>
PREFIX rdfs:  <http://www.w3.org/2000/01/rdf-schema#>

CONSTRUCT {
  ?sensor a sosa:Sensor ;
          rdfs:label ?label ;
          sosa:observes ?obs .
}
WHERE {
  ?sensor a sosa:Sensor ;
          rdfs:label ?label ;
          sosa:observes ?obs .
}
```
