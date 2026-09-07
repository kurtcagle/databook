---
id: https://w3id.org/databook/test/mode-display-only
title: "Fixture: mode implies display-only, per S8.7 of the primer"
type: databook
version: 1.0.0
created: 2026-09-07
description: >
  Pins the reconciliation between the v1.2 `mode` directive and the CLI's
  pre-existing `display_only` field: mode=printed|hidden|reference imply
  display-only; mode=executed and mode=rendered do not, and are governed
  by fence label exactly as before. Asserted by
  test/parser-display-only.test.mjs.
process:
  transformer: "Chloe Shannon"
  transformer_type: human
  inputs:
    - iri: https://w3id.org/holon/databook/primer#the-reference-cli-and-this-section
      role: template
      description: "Primer S8.7 -- the reconciliation this fixture guards."
  timestamp: 2026-09-07T22:00:00Z
---

## mode=printed on an RDF-labelled block forces display-only

Expected: id `printed-turtle`, display_only true, even though `turtle`
is not in DISPLAY_ONLY_LABELS.

<!-- databook:id: printed-turtle -->
<!-- mode=printed -->
```turtle
@prefix ex: <https://example.org/> .
ex:a ex:p ex:b .
```

## mode=hidden forces display-only

Expected: id `hidden-sparql`, display_only true.

<!-- databook:id: hidden-sparql -->
<!-- mode=hidden -->
```sparql
SELECT * WHERE { ?s ?p ?o }
```

## mode=reference forces display-only

Expected: id `reference-shacl`, display_only true.

<!-- databook:id: reference-shacl -->
<!-- mode=reference -->
```shacl
@prefix sh: <http://www.w3.org/ns/shacl#> .
```

## mode=executed does NOT force display-only

Expected: id `executed-sparql`, display_only false — this block is the
live payload; `sparql` is not a DISPLAY_ONLY_LABELS member.

<!-- databook:id: executed-sparql -->
<!-- mode=executed endpoint=<urn:jena:local> -->
```sparql
SELECT * WHERE { ?s ?p ?o } LIMIT 1
```

## mode=rendered does NOT force display-only

Expected: id `rendered-mermaid`, display_only false — rendered content is
handed to a renderer, not suppressed; `mermaid` is not display-only by label.

<!-- databook:id: rendered-mermaid -->
<!-- mode=rendered -->
```mermaid
graph TD; A-->B;
```

## The legacy display-only key still works with no mode present

Expected: id `legacy-key`, display_only true, mode null — backward
compatibility pin for databook:display-only, predating mode.

<!-- databook:id: legacy-key -->
<!-- databook:display-only: true -->
```turtle
@prefix ex: <https://example.org/> .
ex:c ex:p ex:d .
```

## A display-only label with no mode and no legacy key

Expected: id `python-no-mode`, display_only true (from DISPLAY_ONLY_LABELS),
mode null — confirms the label path is untouched by this change.

<!-- databook:id: python-no-mode -->
```python
print("hello")
```
