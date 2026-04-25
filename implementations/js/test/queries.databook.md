<script language="application/yaml">

---
id: https://w3id.org/databook/test/queries-v1
title: "Project Graph Query Library — CLI Test Fixture"
type: databook
version: 1.0.0
created: 2026-04-25
author:
  - name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: transformer
license: CC-BY-4.0
domain: https://w3id.org/databook/test/project-v1#
subject:
  - SPARQL queries
  - query library
  - fragment addressing
description: >
  A library of named SPARQL queries for the project management test graph.
  Each query has a databook:id enabling fragment-IRI addressing. Used for
  testing databook pull --fragment mode.
process:
  transformer: "Chloe Shannon"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-4-6
  inputs:
    - iri: https://w3id.org/databook/test/project-v1
      role: primary
  timestamp: 2026-04-25T12:00:00Z
  agent:
    name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: orchestrator
---

</script>

# Project Graph Query Library

Named SPARQL queries for the project management test graph. Used for `databook pull --fragment` testing.

## Queries

```sparql
<!-- databook:id: select-all-people -->
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX proj: <https://w3id.org/databook/test/project-v1#>

SELECT ?person ?label ?role WHERE {
    ?person a foaf:Person ;
            rdfs:label ?label ;
            proj:role ?role .
}
ORDER BY ?label
```

```sparql
<!-- databook:id: select-all-projects -->
PREFIX proj: <https://w3id.org/databook/test/project-v1#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dct:  <http://purl.org/dc/terms/>

SELECT ?project ?label ?status ?lead WHERE {
    ?project a proj:Project ;
             rdfs:label ?label ;
             proj:status ?status ;
             proj:lead ?lead .
}
ORDER BY ?label
```

```sparql
<!-- databook:id: construct-active-tasks -->
PREFIX proj: <https://w3id.org/databook/test/project-v1#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

CONSTRUCT {
    ?task a proj:Task ;
          rdfs:label ?label ;
          proj:assignedTo ?person ;
          proj:inProject ?project .
}
WHERE {
    ?task a proj:Task ;
          rdfs:label ?label ;
          proj:status proj:Active ;
          proj:assignedTo ?person ;
          proj:inProject ?project .
}
```

```sparql
<!-- databook:id: describe-person -->
<!-- databook:param: personIRI type=IRI required -->
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX proj: <https://w3id.org/databook/test/project-v1#>

DESCRIBE ?person WHERE {
    VALUES ?person { }
    ?person a foaf:Person .
}
```
