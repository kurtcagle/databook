---
id: urn:databook:intervention-policy-model-symbolic-layer-v04-v0.4.2
title: "Intervention Policy Model: Symbolic Layer v0.4"
type: databook
version: 0.4.2
created: "2026-04-20"
status: draft
author:
  - name: CausalSpark Engineering
    role: orchestrator
description: >
  Defines the symbolic governance layer for CausalSpark's intervention policy engine. Specifies ontology classes, SHACL
  validation constraints, inference queries, and the boundary contract with the sub-symbolic SNN layer.
subject:
  - causal-inference
  - symbolic-governance
  - intervention
  - shacl
  - policy
graph:
  namespace: https://vocab.causalspark.ai/gov#
  named_graph: urn:databook:intervention-policy-model-symbolic-layer-v04-v0.4.2#graph
  triple_count: 31
  subjects: 6
  rdf_version: "1.1"
source-metadata:
  status: draft
process:
  transformer: databook ingest
  transformer_type: script
  transformer_iri: https://w3id.org/databook/cli#ingest
  timestamp: "2026-04-27T05:54:30Z"
  inputs:
    - iri: file://C:\Users\kurtc\Downloads\databook-cli\databook-cli\causalspark-intervention-policy.md
      role: primary
      description: "Source Markdown file: causalspark-intervention-policy.md"
  agent:
    name: databook-cli
    iri: https://w3id.org/databook/cli
    role: orchestrator
---

# Intervention Policy Model

This document defines the symbolic layer of CausalSpark's intervention
governance architecture. It covers the core ontology, SHACL validation
shapes, SPARQL inference queries, and integration notes for the sub-symbolic
(SNN) confidence scoring layer.

The symbolic layer operates on **fully formed PolicyProposal resources** — it
does not generate proposals; it evaluates, validates, and routes them.
Proposals that fail SHACL validation are rejected before entering the inference
pipeline. Proposals that pass validation are scored by the SNN layer and
returned with a `csp:hasConfidenceScore` literal for further routing.

---

## Namespace Declarations

All CausalSpark governance resources use the `csp:` prefix. The `csi:`
prefix addresses integration points with external causal inference tooling.

<!-- databook:id: prefixes; databook:content-type: text/turtle; databook:label: Namespace Declarations -->
```turtle
@prefix csp:    <https://vocab.causalspark.ai/gov#> .
@prefix csi:    <https://vocab.causalspark.ai/inference#> .
@prefix holon:  <https://ontologist.io/ns/holon#> .
@prefix sh:     <http://www.w3.org/ns/shacl#> .
@prefix owl:    <http://www.w3.org/2002/07/owl#> .
@prefix rdfs:   <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .
@prefix dct:    <http://purl.org/dc/terms/> .
@prefix prov:   <http://www.w3.org/ns/prov#> .

csp:GovernanceOntology a owl:Ontology ;
    rdfs:label "CausalSpark Governance Ontology" ;
    owl:versionInfo "0.4.2" ;
    dct:created "2026-01-15"^^xsd:date ;
    dct:modified "2026-04-20"^^xsd:date .
```

---

## Core Policy Classes

A `PolicyProposal` represents a proposed causal intervention subject to
governance review. The key structural requirement is that every proposal
**must** carry at least one evidence graph reference and at least one
intervention target before it can enter the inference pipeline.

A `CausalChain` represents a directed sequence of causal steps linking an
intervention action to its projected outcomes. Chains are attached to a
proposal via `csp:supportedByChain` and are themselves validated by the
inference engine before scoring.

<!-- databook:id: core-policy-classes; databook:content-type: text/turtle -->
```turtle
csp:PolicyProposal a owl:Class ;
    rdfs:label "Policy Proposal" ;
    rdfs:comment "A proposed causal intervention pending governance review." .

csp:EvidenceGraph a owl:Class ;
    rdfs:label "Evidence Graph" ;
    rdfs:comment "A named graph of causal evidence supporting a proposal." .

csp:InterventionTarget a owl:Class ;
    rdfs:label "Intervention Target" ;
    rdfs:comment "A causal variable or system component targeted by the proposal." .

csp:CausalChain a owl:Class ;
    rdfs:label "Causal Chain" ;
    rdfs:comment "A directed sequence of causal steps from intervention to outcome." .

csp:ReviewOutcome a owl:Class ;
    rdfs:label "Review Outcome" ;
    rdfs:comment "The result of the governance review process for a proposal." .

csp:hasEvidenceGraph a owl:ObjectProperty ;
    rdfs:domain csp:PolicyProposal ;
    rdfs:range  csp:EvidenceGraph ;
    rdfs:label  "has evidence graph" .

csp:hasInterventionTarget a owl:ObjectProperty ;
    rdfs:domain csp:PolicyProposal ;
    rdfs:range  csp:InterventionTarget ;
    rdfs:label  "has intervention target" .

csp:hasConfidenceScore a owl:DatatypeProperty ;
    rdfs:domain csp:PolicyProposal ;
    rdfs:range  xsd:decimal ;
    rdfs:label  "has confidence score" .

csp:supportedByChain a owl:ObjectProperty ;
    rdfs:domain csp:PolicyProposal ;
    rdfs:range  csp:CausalChain ;
    rdfs:label  "supported by causal chain" .

csp:hasReviewOutcome a owl:ObjectProperty ;
    rdfs:domain csp:PolicyProposal ;
    rdfs:range  csp:ReviewOutcome ;
    rdfs:label  "has review outcome" .

csp:escalationThreshold a owl:DatatypeProperty ;
    rdfs:domain csp:GovernanceOntology ;
    rdfs:range  xsd:decimal ;
    rdfs:label  "escalation threshold" .
```

---

## SHACL Validation Constraints

These shapes enforce minimum validity requirements before a `PolicyProposal`
enters the inference pipeline. The pipeline executor calls the SHACL validator
as its first step; proposals failing any `sh:Violation` severity constraint
are rejected with an error graph. `sh:Warning` violations are logged but do
not block execution.

<!-- databook:id: proposal-shapes; databook:content-type: text/turtle; databook:label: PolicyProposal Constraints -->
```shacl
@prefix csp:  <https://vocab.causalspark.ai/gov#> .
@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

csp:PolicyProposalShape a sh:NodeShape ;
    sh:targetClass csp:PolicyProposal ;

    sh:property [
        sh:path     csp:hasEvidenceGraph ;
        sh:minCount 1 ;
        sh:severity sh:Violation ;
        sh:message  "A PolicyProposal must reference at least one EvidenceGraph." ;
    ] ;

    sh:property [
        sh:path     csp:hasConfidenceScore ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:decimal ;
        sh:minInclusive 0.0 ;
        sh:maxInclusive 1.0 ;
        sh:severity sh:Violation ;
        sh:message  "Confidence score must be a decimal in [0.0, 1.0]." ;
    ] ;

    sh:property [
        sh:path     csp:hasInterventionTarget ;
        sh:minCount 1 ;
        sh:severity sh:Violation ;
        sh:message  "A PolicyProposal must name at least one InterventionTarget." ;
    ] ;

    sh:property [
        sh:path     csp:supportedByChain ;
        sh:minCount 1 ;
        sh:severity sh:Warning ;
        sh:message  "Proposals without an attached CausalChain will receive reduced confidence weighting." ;
    ] .
```

---

## Inference Engine Queries

### Eligible Proposals

Returns proposals that have passed minimum validity (evidence graph and
confidence score present, score ≥ 0.6) and have not yet been assigned
a review outcome. Higher-confidence proposals sort first.

<!-- databook:id: select-eligible; databook:content-type: application/sparql-query; databook:label: Eligible Proposals -->
```sparql
PREFIX csp:  <https://vocab.causalspark.ai/gov#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?proposal ?score ?target ?chain WHERE {
    ?proposal a csp:PolicyProposal ;
              csp:hasConfidenceScore ?score ;
              csp:hasInterventionTarget ?target .
    OPTIONAL { ?proposal csp:supportedByChain ?chain . }
    FILTER NOT EXISTS { ?proposal csp:hasReviewOutcome ?any . }
    FILTER (?score >= 0.6)
}
ORDER BY DESC(?score)
```

### Proposals by Intervention Target Class

Parameterisable query — the inference engine substitutes `?targetClass`
at runtime to filter proposals by intervention domain.

<!-- databook:id: select-by-target; databook:content-type: application/sparql-query; databook:param: targetClass type=IRI default=csp:InterventionTarget; databook:label: Proposals by Target Class -->
```sparql
PREFIX csp: <https://vocab.causalspark.ai/gov#>

SELECT ?proposal ?score ?t WHERE {
    VALUES ?targetClass { csp:InterventionTarget }
    ?proposal a csp:PolicyProposal ;
              csp:hasInterventionTarget ?t ;
              csp:hasConfidenceScore ?score .
    ?t a ?targetClass .
    FILTER NOT EXISTS { ?proposal csp:hasReviewOutcome ?any . }
}
ORDER BY DESC(?score)
```

### Escalation Candidates

Identifies proposals scoring above 0.85 that have not yet been escalated.
These should be routed to senior review automatically.

<!-- databook:id: escalation-candidates; databook:content-type: application/sparql-query -->
```sparql
PREFIX csp: <https://vocab.causalspark.ai/gov#>

SELECT ?proposal ?score WHERE {
    ?proposal a csp:PolicyProposal ;
              csp:hasConfidenceScore ?score .
    FILTER NOT EXISTS { ?proposal csp:hasReviewOutcome ?any . }
    FILTER (?score >= 0.85)
}
ORDER BY DESC(?score)
```

---

## JSON-LD Context Fragment

This context definition maps the `csp:` vocabulary to compact JSON-LD keys
used by the REST API layer when serialising proposal payloads. It is consumed
by the API gateway and does not carry RDF class definitions.

<!-- databook:content-type: application/ld+json; databook:id: json-ld-context-fragment -->
```json-ld
{
  "@context": {
    "csp": "https://vocab.causalspark.ai/gov#",
    "prov": "http://www.w3.org/ns/prov#",
    "proposal": "@id",
    "evidenceGraph": { "@id": "csp:hasEvidenceGraph", "@type": "@id" },
    "interventionTarget": { "@id": "csp:hasInterventionTarget", "@type": "@id" },
    "confidenceScore": { "@id": "csp:hasConfidenceScore", "@type": "xsd:decimal" },
    "causalChain": { "@id": "csp:supportedByChain", "@type": "@id" },
    "reviewOutcome": { "@id": "csp:hasReviewOutcome", "@type": "@id" },
    "generatedAt": { "@id": "prov:generatedAtTime", "@type": "xsd:dateTime" }
  }
}
```

---

## Python Integration Stub

The following snippet shows how the inference engine calls the SHACL validator
before submitting a proposal to the SNN scoring layer. This is display-only
code; it is not part of the RDF graph.

```python
import rdflib
from pyshacl import validate

def validate_proposal(proposal_graph: rdflib.Graph, shapes_graph: rdflib.Graph):
    """
    Validate a PolicyProposal graph against the SHACL shapes.
    Returns (conforms: bool, results_graph: rdflib.Graph, results_text: str).
    """
    conforms, results_graph, results_text = validate(
        data_graph=proposal_graph,
        shacl_graph=shapes_graph,
        inference='rdfs',
        abort_on_first=False,
    )
    return conforms, results_graph, results_text
```

---

## CLI Usage Notes

```bash
# Validate a proposal graph against the SHACL shapes
databook process proposal.databook.md \
  --shapes gov-policy.databook.md#proposal-shapes \
  -o validation-report.databook.md

# Run eligible proposals query against local Fuseki instance
databook pull gov-policy.databook.md \
  --fragment select-eligible \
  --endpoint http://localhost:3030/csp/sparql \
  --wrap \
  -o eligible-proposals.databook.md
```

---

## Implementation Notes

> **Note:** The confidence score threshold for automatic escalation is 0.85.
> Proposals scoring below 0.6 are filtered out at query time and require
> manual triage via the governance dashboard.

> **Note:** Sub-symbolic layer integration (SNNs) produces `csp:hasConfidenceScore`
> values; the symbolic layer defined in this document consumes them. The
> boundary between layers is the score literal — no SNN internals cross
> into the symbolic graph.

> **Note:** Evidence graph IRIs follow the pattern
> `https://evidence.causalspark.ai/{proposal-id}/graph`.
> These are named graph references, not embedded content. The EvidenceGraph
> class is a pointer, not a container.

> **Warning:** Do not set `csp:hasReviewOutcome` before the confidence score
> has been written by the SNN layer. Proposals with an outcome but no score
> will be treated as administratively closed and excluded from all queries.
