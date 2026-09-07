---
id: https://w3id.org/databook/test/prefixed-keys
title: "Fixture: profile-prefixed comment keys"
type: databook
version: 1.0.0
created: 2026-09-07
description: >
  Pins the parser generalisation in lib/parser.js: any well-formed
  `prefix:key: value` pre-fence comment is captured, not only `databook:`.
  Core keys stay stored bare (`id`, not `databook:id`); other prefixes are
  stored under the full `prefix:key` string. Asserted by
  test/parser-prefixed-keys.test.mjs.
process:
  transformer: "Chloe Shannon"
  transformer_type: human
  inputs:
    - iri: https://w3id.org/holon/databook/primer#4-3-extension-points
      role: template
      description: "Primer S4.3 -- comment-key prefixes as a named profile extension point."
  timestamp: 2026-09-07T23:30:00Z
---

## A core key alongside a profile-prefixed key

Expected: id `core-and-holon` (bare), `all_meta['holon:layer'] === 'L2'`.

<!-- databook:id: core-and-holon -->
<!-- holon:layer: L2 -->
```turtle
@prefix ex: <https://example.org/> .
ex:a ex:p ex:b .
```

## Two different profile prefixes on one block

Expected: both `holon:layer` and `okf:something` present, distinguishable
by their full prefixed keys.

<!-- databook:id: two-prefixes -->
<!-- holon:layer: L3 -->
<!-- okf:something: value -->
```turtle
@prefix ex: <https://example.org/> .
ex:c ex:p ex:d .
```

## A profile-prefixed key still precedes directives correctly

Expected: id `prefix-then-directive`, `all_meta['holon:layer'] === 'L2'`,
`mode === 'hidden'` — the walk must not stop between a profile-prefixed
key and a directive.

<!-- databook:id: prefix-then-directive -->
<!-- holon:layer: L2 -->
<!-- mode=hidden -->
```turtle
@prefix ex: <https://example.org/> .
ex:e ex:p ex:f .
```

## Only core keys — unaffected by the generalisation

Expected: id `core-only`, `all_meta` has exactly `id` and `label`, no
colon-containing keys.

<!-- databook:id: core-only -->
<!-- databook:label: plain core block -->
```turtle
@prefix ex: <https://example.org/> .
ex:g ex:p ex:h .
```
