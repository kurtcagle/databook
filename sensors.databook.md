<script language="application/yaml">

---
id: https://w3id.org/databook/untitled-v1.0.0
title: Sensors
type: databook
version: 1.0.0
created: "2026-04-23"
process:
  transformer: databook create
  transformer_type: script
  timestamp: "2026-04-23T03:38:29Z"
  agent:
    name: databook-cli
    iri: https://w3id.org/databook/cli
    role: orchestrator
  inputs:
    - iri: file://C:\Users\kurtc\Downloads\databook-cli\databook-cli\test\sensors.ttl
      role: primary
      block_id: sensors-block
      description: "Input file: sensors.ttl"
graph:
  triple_count: 16
  subjects: 4
  rdf_version: "1.1"
---

</script>

# Sensors


## Sensors *(primary)*

16 triples, 4 distinct subjects.

```turtle
<!-- databook:id: sensors-block -->
PREFIX dct:  <http://purl.org/dc/terms/>
PREFIX geo:  <http://www.w3.org/2003/01/geo/wgs84_pos#>
PREFIX obs:  <https://w3id.org/databook/test/observatory-v1#>
PREFIX qudt: <http://qudt.org/schema/qudt/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX sosa: <http://www.w3.org/ns/sosa/>
PREFIX ssn:  <http://www.w3.org/ns/ssn/>
PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>

obs:PressureSensor  a     sosa:Sensor;
        rdfs:label        "Vaisala PTB330 Barometer"@en;
        sosa:isHostedBy   obs:RoyalObservatory;
        sosa:observes     obs:AtmosphericPressure;
        obs:serialNumber  "PTB330-117" .

obs:GravitySensor  a      sosa:Sensor;
        rdfs:label        "Absolute Gravity Sensor FG5-X"@en;
        sosa:isHostedBy   obs:RoyalObservatory;
        sosa:observes     obs:GravitationalAcceleration;
        obs:serialNumber  "FG5X-0042" .

obs:RoyalObservatory  rdfs:label  "Royal Observatory Greenwich"@en .

obs:TiltSensor  a         sosa:Sensor;
        rdfs:label        "Lippmann Tiltmeter LT-3"@en;
        sosa:isHostedBy   obs:RoyalObservatory;
        sosa:observes     obs:EarthTilt;
        obs:serialNumber  "LT3-2088" .
```
