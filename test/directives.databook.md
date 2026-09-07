---
id: https://w3id.org/databook/test/directives
title: "Fixture: pre-fence block directives"
type: databook
version: 1.0.0
created: 2026-09-07
description: >
  Exercises the v1.2 pre-fence comment zone with directive lines in every
  position the convention allows. Each block's expected parse is stated in
  the prose above it and asserted by test/parser-directives.test.mjs.
process:
  transformer: "Chloe Shannon"
  transformer_type: human
  inputs:
    - iri: https://w3id.org/holon/databook/primer#the-reference-cli-and-this-section
      role: template
      description: "Primer §8.7 — the parser truncation this fixture guards against."
  timestamp: 2026-09-07T21:00:00Z
---

## Conventional order: id, other keys, directives last

Expected: id `conventional`, label `turtle`, mode `printed`.
Before the fix, this block came back anonymous.

<!-- databook:id: conventional -->
<!-- databook:label: Conventional zone ordering -->
<!-- mode=printed -->
```turtle
@prefix ex: <https://example.org/> .
ex:a ex:p ex:b .
```

## Several directives on one line, plus a second directive line

Expected: id `multi`, mode `executed`, endpoint `<urn:jena:local>`,
cache `true`, authority `<urn:org:test>`, version `1.2.0`.

<!-- databook:id: multi -->
<!-- mode=executed endpoint=<urn:jena:local> cache=true -->
<!-- authority=<urn:org:test> version=1.2.0 -->
```sparql
SELECT * WHERE { ?s ?p ?o } LIMIT 1
```

## Directive before the id (tolerated, not recommended)

Expected: id `unordered`, mode `hidden`. The ordering rule is a convention
for authors; a parser must not depend on it.

<!-- mode=hidden -->
<!-- databook:id: unordered -->
```turtle
@prefix ex: <https://example.org/> .
ex:c ex:p ex:d .
```

## No directives at all

Expected: id `plain`, `directives` empty, `mode` null.

<!-- databook:id: plain -->
```turtle
@prefix ex: <https://example.org/> .
ex:e ex:p ex:f .
```

## A prose comment in the zone ends the walk

Expected: this block is anonymous. The comment immediately above the fence
is neither a `databook:` key nor a directive, so the walk stops there and
never reaches the `databook:id` line above it. That is the specified
behaviour (SPEC.md §15.4: prose comments in the zone are discarded), and
the fixture pins it so a future "helpful" change does not silently widen it.

<!-- databook:id: orphaned -->
<!-- this is a prose comment, not a header line -->
```turtle
@prefix ex: <https://example.org/> .
ex:g ex:p ex:h .
```

## Directive inside the fence is payload, not a directive

Expected: id `inside`, `directives` empty, and the payload still contains
the `<!-- mode=printed -->` line. Directives live outside the fence only.

<!-- databook:id: inside -->
```turtle
<!-- mode=printed -->
@prefix ex: <https://example.org/> .
ex:i ex:p ex:j .
```
