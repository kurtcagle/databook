---
id: https://w3id.org/databook/examples/minimal-v1
title: "Minimal DataBook"
type: databook
version: 1.0.0
created: 2026-04-25
process:
  transformer: human
  transformer_type: human
  inputs: []
  timestamp: 2026-04-25T12:00:00Z
  agent:
    name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator
---

# Minimal DataBook

This is the smallest valid DataBook: five required identity fields, a process stamp, and one fenced data block.

```turtle
<!-- databook:id: primary-block -->
@prefix ex: <https://example.org/> .
ex:Thing a ex:Class ;
    ex:label "A thing" .
```
