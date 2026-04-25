<script language="application/yaml">

---
id: https://w3id.org/databook/untitled-v1.0.0
title: Sensor-construct
type: databook
version: 1.0.0
created: "2026-04-23"
process:
  transformer: databook create
  transformer_type: script
  timestamp: "2026-04-23T02:40:03Z"
  agent:
    name: databook-cli
    iri: https://w3id.org/databook/cli
    role: orchestrator
  inputs:
    - iri: file:///tmp/sensor-construct.sparql
      role: context
      block_id: sensor-construct-block
      description: "Input file: sensor-construct.sparql"
---

</script>

# Sensor-construct


## Sensor Construct *(context)*

```sparql
<!-- databook:id: sensor-construct-block -->
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
