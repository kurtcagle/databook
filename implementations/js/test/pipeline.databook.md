<script language="application/yaml">

---
id: https://w3id.org/databook/test/pipeline-v1
title: "Project Graph Pipeline Manifest — CLI Test Fixture"
type: databook
version: 1.0.0
created: 2026-04-25
author:
  - name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: transformer
license: CC-BY-4.0
domain: https://w3id.org/databook/ns#
subject:
  - pipeline manifest
  - build dependency
description: >
  A 2-stage pipeline manifest for databook process testing.
  Stage 1: SPARQL CONSTRUCT to extract active tasks (turtle output).
  Stage 2: LLM-generated SHACL validation shapes (shacl output).
  Target: validated active task graph.
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

# Project Graph Pipeline Manifest

A 2-stage pipeline for building a validated active-tasks DataBook from the project graph.

```manifest
<!-- databook:id: pipeline-manifest -->
@prefix build: <https://w3id.org/databook/ns#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix test:  <https://w3id.org/databook/test/> .

# ── Target ─────────────────────────────────────────────────────────────────────

test:active-tasks-validated a build:Target ;
    dct:title       "Validated Active Task Graph"@en ;
    build:outputType "turtle" ;
    build:dependsOn test:active-tasks-raw,
                    test:task-shapes .

# ── Stages ─────────────────────────────────────────────────────────────────────

test:active-tasks-raw a build:Stage ;
    dct:title        "Active Task Subgraph (CONSTRUCT)"@en ;
    build:transformer "sparql" ;
    build:outputType  "turtle" ;
    build:dependsOn   test:project-v1 .

test:task-shapes a build:Stage ;
    dct:title        "Task SHACL Shapes (LLM-generated)"@en ;
    build:transformer "llm" ;
    build:outputType  "shacl" ;
    build:dependsOn   test:project-v1 .

# ── Source ─────────────────────────────────────────────────────────────────────

test:project-v1 a build:Source ;
    dct:title        "Project Management Knowledge Graph"@en ;
    build:outputType "turtle" .
```
