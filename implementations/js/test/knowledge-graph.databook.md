<script language="application/yaml">

---
id: https://w3id.org/databook/test/project-v1
title: "Project Management Knowledge Graph — CLI Test Fixture v1"
type: databook
version: 1.0.0
created: 2026-04-25
author:
  - name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator
  - name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: transformer
license: CC-BY-4.0
domain: https://w3id.org/databook/test/project-v1#
subject:
  - project management
  - knowledge graph
  - CLI test fixture
description: >
  Full-featured test DataBook for databook-cli validation.
  Contains a primary Turtle graph (organisation, projects, people, tasks),
  a SHACL shapes block, a SPARQL CONSTRUCT query, a SPARQL SELECT query
  with VALUES injection, and a SPARQL UPDATE block. Generic replacement
  for the observatory fixture; exercises all push-eligible block types
  and all pull modes.
graph:
  namespace: https://w3id.org/databook/test/project-v1#
  named_graph: https://w3id.org/databook/test/project-v1#primary-graph
  triple_count: 41
  subjects: 9
  rdf_version: "1.1"
process:
  transformer: "Chloe Shannon"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-4-6
  inputs:
    - iri: urn:input:project-design-2026-04-25
      role: primary
      block_id: primary-graph
      description: "Project management graph — authored for CLI testing"
    - iri: https://w3id.org/databook/test/project-v1#project-shapes
      role: constraint
      block_id: project-shapes
      description: "SHACL shapes constraining project entities"
  timestamp: 2026-04-25T12:00:00Z
  agent:
    name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: orchestrator
---

</script>

# Project Management Knowledge Graph

This DataBook carries a project management knowledge graph used for `databook-cli` integration testing. It exercises every pushable block type and provides embedded SPARQL blocks for pull testing.

---

## Primary Graph

Organisation, people, projects, and tasks as RDF 1.1 Turtle.

```turtle
<!-- databook:id: primary-graph -->
@prefix proj:  <https://w3id.org/databook/test/project-v1#> .
@prefix foaf:  <http://xmlns.com/foaf/0.1/> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .

# ── Organisation ───────────────────────────────────────────────────────────────

proj:NorthlightGroup a foaf:Organisation ;
    rdfs:label        "Northlight Analytics Group"@en ;
    proj:founded      "2020-01-01"^^xsd:date ;
    foaf:homepage     <https://example.org/northlight> .

# ── People ─────────────────────────────────────────────────────────────────────

proj:AliceSmith a foaf:Person ;
    rdfs:label    "Alice Smith"@en ;
    proj:role     proj:LeadAnalyst ;
    proj:memberOf proj:NorthlightGroup .

proj:BobJones a foaf:Person ;
    rdfs:label    "Bob Jones"@en ;
    proj:role     proj:DataEngineer ;
    proj:memberOf proj:NorthlightGroup .

proj:CarolLee a foaf:Person ;
    rdfs:label    "Carol Lee"@en ;
    proj:role     proj:OntologyEngineer ;
    proj:memberOf proj:NorthlightGroup .

# ── Projects ───────────────────────────────────────────────────────────────────

proj:Alpha a proj:Project ;
    rdfs:label    "Project Alpha"@en ;
    proj:status   proj:Active ;
    proj:lead     proj:AliceSmith ;
    dct:created   "2026-01-15"^^xsd:date ;
    dct:description "Knowledge graph migration"@en .

proj:Beta a proj:Project ;
    rdfs:label    "Project Beta"@en ;
    proj:status   proj:Planning ;
    proj:lead     proj:BobJones ;
    dct:created   "2026-03-01"^^xsd:date ;
    dct:description "Data pipeline optimisation"@en .

# ── Tasks ──────────────────────────────────────────────────────────────────────

proj:Task001 a proj:Task ;
    rdfs:label       "Design ontology schema"@en ;
    proj:assignedTo  proj:CarolLee ;
    proj:inProject   proj:Alpha ;
    proj:status      proj:Complete ;
    dct:created      "2026-01-20"^^xsd:date .

proj:Task002 a proj:Task ;
    rdfs:label       "Build ETL pipeline"@en ;
    proj:assignedTo  proj:BobJones ;
    proj:inProject   proj:Alpha ;
    proj:status      proj:Active ;
    dct:created      "2026-02-10"^^xsd:date .

proj:Task003 a proj:Task ;
    rdfs:label       "Write SHACL constraints"@en ;
    proj:assignedTo  proj:CarolLee ;
    proj:inProject   proj:Beta ;
    proj:status      proj:Planned ;
    dct:created      "2026-03-15"^^xsd:date .
```

---

## SHACL Validation Shapes

Shapes constraining Person, Project, and Task entities.

```shacl
<!-- databook:id: project-shapes -->
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix proj: <https://w3id.org/databook/test/project-v1#> .

proj:PersonShape a sh:NodeShape ;
    sh:targetClass foaf:Person ;
    sh:property [
        sh:path rdfs:label ;
        sh:minCount 1 ;
        sh:message "Person must have a label"@en ;
    ] ;
    sh:property [
        sh:path proj:role ;
        sh:minCount 1 ;
        sh:message "Person must have a role"@en ;
    ] ;
    sh:property [
        sh:path proj:memberOf ;
        sh:minCount 1 ;
        sh:message "Person must be a member of an organisation"@en ;
    ] .

proj:ProjectShape a sh:NodeShape ;
    sh:targetClass proj:Project ;
    sh:property [
        sh:path rdfs:label ;
        sh:minCount 1 ;
        sh:message "Project must have a label"@en ;
    ] ;
    sh:property [
        sh:path proj:status ;
        sh:minCount 1 ;
        sh:message "Project must have a status"@en ;
    ] ;
    sh:property [
        sh:path proj:lead ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:class foaf:Person ;
        sh:message "Project must have exactly one lead person"@en ;
    ] .

proj:TaskShape a sh:NodeShape ;
    sh:targetClass proj:Task ;
    sh:property [
        sh:path rdfs:label ;
        sh:minCount 1 ;
        sh:message "Task must have a label"@en ;
    ] ;
    sh:property [
        sh:path proj:assignedTo ;
        sh:minCount 1 ;
        sh:class foaf:Person ;
        sh:message "Task must be assigned to a person"@en ;
    ] ;
    sh:property [
        sh:path proj:inProject ;
        sh:minCount 1 ;
        sh:class proj:Project ;
        sh:message "Task must belong to a project"@en ;
    ] ;
    sh:property [
        sh:path proj:status ;
        sh:minCount 1 ;
        sh:message "Task must have a status"@en ;
    ] .
```

---

## Task Retrieval — CONSTRUCT

SPARQL CONSTRUCT to fetch all tasks with assignee and project details.
Used for `databook pull --fragment` testing.

```sparql
<!-- databook:id: construct-tasks -->
PREFIX proj: <https://w3id.org/databook/test/project-v1#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dct:  <http://purl.org/dc/terms/>

CONSTRUCT {
    ?task a proj:Task ;
          rdfs:label ?taskLabel ;
          proj:assignedTo ?person ;
          proj:inProject ?project ;
          proj:status ?status .
    ?person rdfs:label ?personLabel .
    ?project rdfs:label ?projectLabel .
}
WHERE {
    ?task a proj:Task ;
          rdfs:label ?taskLabel ;
          proj:assignedTo ?person ;
          proj:inProject ?project ;
          proj:status ?status .
    ?person rdfs:label ?personLabel .
    ?project rdfs:label ?projectLabel .
}
```

---

## Entity Retrieval — SELECT with Values Injection

SPARQL SELECT that supports `<<db:inject>>` for VALUES-based status filtering.
Used for `databook process --sparql` parameterised testing.

```sparql
<!-- databook:id: select-by-status -->
PREFIX proj: <https://w3id.org/databook/test/project-v1#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?entity ?label WHERE {
    VALUES (?status) { <<db:inject>> }
    ?entity proj:status ?status ;
            rdfs:label ?label .
}
ORDER BY ?label
```

---

## Task Update — SPARQL UPDATE

SPARQL UPDATE to mark Task002 as complete.
Used for `databook push` sparql-update block testing.

```sparql-update
<!-- databook:id: close-task -->
PREFIX proj: <https://w3id.org/databook/test/project-v1#>

DELETE {
    proj:Task002 proj:status ?old .
}
INSERT {
    proj:Task002 proj:status proj:Complete .
}
WHERE {
    proj:Task002 proj:status ?old .
}
```
