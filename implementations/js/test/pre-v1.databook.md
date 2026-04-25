---
id: https://w3id.org/databook/test/pre-v1-legacy
title: "Legacy pre-v1.0 DataBook"
type: databook
version: 0.9.0
created: 2025-11-01
author:
  name: Kurt Cagle
  iri: https://holongraph.com/people/kurt-cagle
  role: orchestrator
license: CC-BY-4.0
description: >
  Pre-v1.0 DataBook using bare --- frontmatter delimiters (no script tag).
  Used to test W_HEAD_PRE_V1 warning emission and fallback parser path.
  databook head should parse this correctly and emit the warning unless --quiet.
---

# Legacy pre-v1.0 DataBook

This DataBook uses the pre-v1.0 bare `---` frontmatter syntax. The CLI
should parse it with the fallback parser and emit `W_HEAD_PRE_V1` unless
`--quiet` is specified.

## Minimal Turtle Payload

```turtle
<!-- databook:id: legacy-graph -->
@prefix ex:   <https://w3id.org/databook/test/pre-v1-legacy#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:LegacyNode a ex:LegacyClass ;
    rdfs:label "Legacy node from pre-v1.0 DataBook"@en ;
    ex:note    "This block should be parseable via the pre-v1 fallback path" .

ex:LegacyClass a ex:MetaClass ;
    rdfs:label "Legacy class"@en .
```
