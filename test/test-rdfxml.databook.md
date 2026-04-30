<script language="application/yaml">

---
id: https://w3id.org/databook/test/rdfxml-hga-vocab-v1
title: "HGA Vocabulary — RDF/XML Test DataBook"
type: databook
version: 1.0.0
created: 2026-04-23

author:
  - name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator
  - name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: transformer

license: CC-BY-4.0
domain: https://w3id.org/holon/ns#
subject:
  - holonic graph architecture
  - RDF/XML serialisation
  - DataBook CLI testing
description: >
  A minimal DataBook carrying a slice of the HGA vocabulary serialised as RDF/XML.
  Intended as a test fixture for the DataBook CLI extract and convert commands,
  and as a reference input for the companion XSLT stylesheet rdfxml-to-html.xslt.

graph:
  namespace: https://w3id.org/holon/ns#
  named_graph: https://w3id.org/databook/test/rdfxml-hga-vocab-v1#graph
  triple_count: 32
  subjects: 8
  rdf_version: "1.1"
  turtle_version: "1.1"
  reification: false
  validator_note: >
    Standard RDF/XML — parseable by any RDF 1.1-compliant processor (Jena, rdflib, N3.js).
    Extract block with: databook extract test-rdfxml.databook.md --block-id hga-vocab-rdfxml --to xml
    Convert to Turtle with: databook convert test-rdfxml.databook.md --block-id hga-vocab-rdfxml --to turtle
    Transform to HTML with: xsltproc rdfxml-to-html.xslt <(databook extract ... --to xml)

process:
  transformer: "Chloe Shannon / Claude Sonnet 4.6"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-4-6
  inputs:
    - iri: https://w3id.org/holon/ns#
      role: primary
      description: "HGA namespace vocabulary — four-layer graph model"
  timestamp: 2026-04-23T12:00:00Z
  agent:
    name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: transformer
---

</script>

## Overview

This DataBook packages a representative slice of the **Holonic Graph Architecture (HGA)** vocabulary
serialised as RDF/XML. It is a test fixture for the DataBook CLI, covering:

- `databook extract` — pull the `xml` block to a standalone `.rdf` / `.xml` file
- `databook convert` — convert the extracted RDF/XML to Turtle, JSON-LD, N-Triples, etc.
- XSLT pipeline testing — feed the extracted XML to `rdfxml-to-html.xslt` to generate an HTML report

The vocabulary declares the four graph-layer classes (`SceneGraph`, `BoundaryGraph`, `EventGraph`,
`ProjectionGraph`) as subclasses of the common `HolonGraph` root, plus two object properties
(`containsHolon`, `projectsFrom`).

> **Note:** The companion stylesheet `rdfxml-to-html.xslt` expects RDF/XML as input and produces
> a human-readable HTML class/property report. Run the extract step first to obtain a plain XML file.

## CLI Usage Reference

```bash
# Extract the RDF/XML block to a file
databook extract test-rdfxml.databook.md \
  --block-id hga-vocab-rdfxml \
  --to xml \
  --encoding utf8 \
  > hga-vocab.rdf

# Convert directly to Turtle (via Jena)
databook convert test-rdfxml.databook.md \
  --block-id hga-vocab-rdfxml \
  --to turtle \
  > hga-vocab.ttl

# Convert to JSON-LD
databook convert test-rdfxml.databook.md \
  --block-id hga-vocab-rdfxml \
  --to jsonld \
  > hga-vocab.jsonld

# Convert to N-Triples (useful for diff/count verification)
databook convert test-rdfxml.databook.md \
  --block-id hga-vocab-rdfxml \
  --to nt \
  > hga-vocab.nt

# Count triples from N-Triples output (should be 32)
databook convert test-rdfxml.databook.md \
  --block-id hga-vocab-rdfxml --to nt | wc -l

# Apply XSLT transform to extracted XML (external processor)
databook extract test-rdfxml.databook.md \
  --block-id hga-vocab-rdfxml --to xml | \
  xsltproc rdfxml-to-html.xslt - > hga-vocab-report.html
```

## HGA Vocabulary — RDF/XML

```xml
<!-- databook:id: hga-vocab-rdfxml -->
<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF
  xmlns:rdf  = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:rdfs = "http://www.w3.org/2000/01/rdf-schema#"
  xmlns:owl  = "http://www.w3.org/2002/07/owl#"
  xmlns:dct  = "http://purl.org/dc/terms/"
  xmlns:xsd  = "http://www.w3.org/2001/XMLSchema#"
  xmlns:holon= "https://w3id.org/holon/ns#">

  <!-- ============================================================
       Ontology header
       ============================================================ -->

  <owl:Ontology rdf:about="https://w3id.org/holon/ns#">
    <dct:title xml:lang="en">Holonic Graph Architecture Vocabulary</dct:title>
    <dct:description xml:lang="en">
      Core vocabulary for the four-layer HGA model: Scene, Boundary, Event, and Projection graphs.
    </dct:description>
    <dct:created rdf:datatype="http://www.w3.org/2001/XMLSchema#date">2026-04-23</dct:created>
    <owl:versionIRI rdf:resource="https://w3id.org/holon/ns/1.0.0"/>
  </owl:Ontology>

  <!-- ============================================================
       Root class
       ============================================================ -->

  <owl:Class rdf:about="https://w3id.org/holon/ns#HolonGraph">
    <rdfs:label xml:lang="en">Holon Graph</rdfs:label>
    <rdfs:comment xml:lang="en">
      The abstract base class for all graph layers in a holonic architecture.
      A HolonGraph is simultaneously an autonomous whole and a part of a larger graph holarchy.
    </rdfs:comment>
    <rdfs:isDefinedBy rdf:resource="https://w3id.org/holon/ns#"/>
  </owl:Class>

  <!-- ============================================================
       Four-layer subclasses
       ============================================================ -->

  <owl:Class rdf:about="https://w3id.org/holon/ns#SceneGraph">
    <rdfs:label xml:lang="en">Scene Graph</rdfs:label>
    <rdfs:subClassOf rdf:resource="https://w3id.org/holon/ns#HolonGraph"/>
    <rdfs:comment xml:lang="en">
      The observable projection layer. Represents holonic state as perceived by an
      external agent — the rendered surface of the holon.
    </rdfs:comment>
    <rdfs:isDefinedBy rdf:resource="https://w3id.org/holon/ns#"/>
  </owl:Class>

  <owl:Class rdf:about="https://w3id.org/holon/ns#BoundaryGraph">
    <rdfs:label xml:lang="en">Boundary Graph</rdfs:label>
    <rdfs:subClassOf rdf:resource="https://w3id.org/holon/ns#HolonGraph"/>
    <rdfs:comment xml:lang="en">
      The Markov blanket layer. Encodes constraints, policies, and SHACL shapes
      that mediate all interactions between the holon's interior and the outside world.
    </rdfs:comment>
    <rdfs:isDefinedBy rdf:resource="https://w3id.org/holon/ns#"/>
  </owl:Class>

  <owl:Class rdf:about="https://w3id.org/holon/ns#EventGraph">
    <rdfs:label xml:lang="en">Event Graph</rdfs:label>
    <rdfs:subClassOf rdf:resource="https://w3id.org/holon/ns#HolonGraph"/>
    <rdfs:comment xml:lang="en">
      The temporal layer. Captures state transitions, temporal ordering, causality,
      and provenance across the holon's lifecycle.
    </rdfs:comment>
    <rdfs:isDefinedBy rdf:resource="https://w3id.org/holon/ns#"/>
  </owl:Class>

  <owl:Class rdf:about="https://w3id.org/holon/ns#ProjectionGraph">
    <rdfs:label xml:lang="en">Projection Graph</rdfs:label>
    <rdfs:subClassOf rdf:resource="https://w3id.org/holon/ns#HolonGraph"/>
    <rdfs:comment xml:lang="en">
      The derived-view layer. Computes agent- or context-specific projections
      from the primary domain graph, analogous to a database view.
    </rdfs:comment>
    <rdfs:isDefinedBy rdf:resource="https://w3id.org/holon/ns#"/>
  </owl:Class>

  <!-- ============================================================
       Object properties
       ============================================================ -->

  <owl:ObjectProperty rdf:about="https://w3id.org/holon/ns#containsHolon">
    <rdfs:label xml:lang="en">contains holon</rdfs:label>
    <rdfs:comment xml:lang="en">
      Relates a parent holon to a child holon it encloses. Encodes the part-whole
      relationship that defines a holarchy.
    </rdfs:comment>
    <rdfs:domain rdf:resource="https://w3id.org/holon/ns#HolonGraph"/>
    <rdfs:range  rdf:resource="https://w3id.org/holon/ns#HolonGraph"/>
    <rdfs:isDefinedBy rdf:resource="https://w3id.org/holon/ns#"/>
  </owl:ObjectProperty>

  <owl:ObjectProperty rdf:about="https://w3id.org/holon/ns#projectsFrom">
    <rdfs:label xml:lang="en">projects from</rdfs:label>
    <rdfs:comment xml:lang="en">
      Links a ProjectionGraph to the source HolonGraph from which it derives its view.
      Analogous to a SQL view's SELECT … FROM clause.
    </rdfs:comment>
    <rdfs:domain rdf:resource="https://w3id.org/holon/ns#ProjectionGraph"/>
    <rdfs:range  rdf:resource="https://w3id.org/holon/ns#HolonGraph"/>
    <rdfs:isDefinedBy rdf:resource="https://w3id.org/holon/ns#"/>
  </owl:ObjectProperty>

</rdf:RDF>
```

## Validation Notes

Expected output from `databook convert … --to nt | wc -l` is **32 triples** across **8 subjects**.
If the count differs, check that the XML declaration line inside the fenced block was extracted
cleanly (some CLI parsers may strip the `<?xml …?>` processing instruction — this is harmless for
Jena but can confuse stricter XML parsers).

> **Note:** The `<?xml version="1.0"?>` declaration must be the *first* line of the extracted
> content. When piping through the CLI, verify with `databook extract … | head -1`.
