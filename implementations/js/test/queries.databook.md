<script language="application/yaml">

---
id: https://w3id.org/databook/test/queries-v1
title: "GGSC Test: SPARQL Query Library"
type: databook
version: 1.0.0
created: 2026-04-22
author:
  - name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator
license: CC-BY-4.0
subject:
  - SPARQL
  - query library
  - GGSC
description: >
  SPARQL query library DataBook for databook-cli testing.
  Provides named query blocks addressable via fragment reference
  (e.g. queries.databook.md#all-sensors) for use with
  databook pull --fragment and databook process --sparql.
process:
  transformer: "Kurt Cagle"
  transformer_type: human
  inputs:
    - iri: urn:input:test-queries-2026-04-22
      role: primary
      description: "Manually authored test queries"
  timestamp: 2026-04-22T12:00:00Z
---

</script>

# GGSC Test: SPARQL Query Library

Named SPARQL blocks for use as fragment references in `push`, `pull`,
and `process` command tests. Reference any block as:

```
queries.databook.md#<block-id>
```

---

## All Sensors — CONSTRUCT

Returns all sensors with their labels, platforms, and serial numbers.

```sparql
<!-- databook:id: all-sensors -->
PREFIX sosa: <http://www.w3.org/ns/sosa/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX obs:  <https://w3id.org/databook/test/observatory-v1#>

CONSTRUCT {
  ?sensor a sosa:Sensor ;
          rdfs:label ?label ;
          sosa:isHostedBy ?platform ;
          sosa:observes ?prop ;
          obs:serialNumber ?serial .
  ?platform rdfs:label ?platformLabel .
}
WHERE {
  ?sensor a sosa:Sensor ;
          rdfs:label ?label ;
          sosa:isHostedBy ?platform ;
          sosa:observes ?prop .
  ?platform rdfs:label ?platformLabel .
  OPTIONAL { ?sensor obs:serialNumber ?serial . }
}
```

---

## All Observations — CONSTRUCT

Returns all recorded observations with their result values.

```sparql
<!-- databook:id: all-observations -->
PREFIX sosa: <http://www.w3.org/ns/sosa/>
PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>

CONSTRUCT {
  ?obs a sosa:Observation ;
       sosa:madeBySensor ?sensor ;
       sosa:observedProperty ?prop ;
       sosa:resultTime ?time ;
       sosa:hasSimpleResult ?result .
}
WHERE {
  ?obs a sosa:Observation ;
       sosa:madeBySensor ?sensor ;
       sosa:observedProperty ?prop ;
       sosa:resultTime ?time ;
       sosa:hasSimpleResult ?result .
}
ORDER BY ?time
```

---

## Sensor Summary — SELECT

Tabular summary of sensors with host platform and observable property.
Useful for `databook pull --fragment sensor-summary --format json`.

```sparql
<!-- databook:id: sensor-summary -->
PREFIX sosa: <http://www.w3.org/ns/sosa/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX obs:  <https://w3id.org/databook/test/observatory-v1#>

SELECT ?sensor ?sensorLabel ?platformLabel ?propertyLabel WHERE {
  ?sensor a sosa:Sensor ;
          rdfs:label ?sensorLabel ;
          sosa:isHostedBy ?platform ;
          sosa:observes ?prop .
  ?platform rdfs:label ?platformLabel .
  ?prop rdfs:label ?propertyLabel .
}
ORDER BY ?sensorLabel
```

---

## Sensors by Type — SELECT with Injection

Parameterised SELECT filtered by observable property.
Place `<<db:inject>>` receives VALUES rows from `--params`.

```sparql
<!-- databook:id: sensors-by-property -->
PREFIX sosa: <http://www.w3.org/ns/sosa/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?sensor ?label WHERE {
  VALUES (?observedProperty) { <<db:inject>> }
  ?sensor a sosa:Sensor ;
          rdfs:label ?label ;
          sosa:observes ?observedProperty .
}
ORDER BY ?label
```

---

## Uncalibrated Sensors — SELECT

Returns sensors with no `obs:lastCalibrated` date or calibrated before 2026.

```sparql
<!-- databook:id: uncalibrated-sensors -->
PREFIX sosa: <http://www.w3.org/ns/sosa/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX obs:  <https://w3id.org/databook/test/observatory-v1#>
PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>

SELECT ?sensor ?label ?lastCal WHERE {
  ?sensor a sosa:Sensor ;
          rdfs:label ?label .
  OPTIONAL { ?sensor obs:lastCalibrated ?lastCal . }
  FILTER (!bound(?lastCal) || ?lastCal < "2026-01-01"^^xsd:date)
}
```

---

## Graph Statistics — SELECT

Counts of entities by type for the default graph.
Useful for post-push verification.

```sparql
<!-- databook:id: graph-stats -->
PREFIX sosa: <http://www.w3.org/ns/sosa/>

SELECT ?type (COUNT(?entity) AS ?count) WHERE {
  ?entity a ?type .
  FILTER(?type IN (sosa:Platform, sosa:Sensor,
                   sosa:Observation, sosa:ObservableProperty))
}
GROUP BY ?type
ORDER BY DESC(?count)
```
