---
id: https://w3id.org/holon/databook#
title: "Holon Profile of DataBook (bundled stub)"
type: databook
version: 0.1.0
created: 2026-09-07
description: >
  A minimal, bundled PROF descriptor for the Holon Graph Architecture's
  profile of DataBook, registering the `holon:` comment-key prefix so that
  a document declaring `profiles: [https://w3id.org/holon/databook#]` can
  be resolved offline by `lib/profiles.js`. This is explicitly a
  placeholder, not the profile's eventual publication -- see the DataBook
  Specification Primer S4.6 (what the profile is expected to add) and S16
  item 15 (registering it, owned by the Holon CG). It carries no
  additional SHACL shapes yet: resolving this profile widens the set of
  recognised comment-key prefixes but does not currently tighten or extend
  validation beyond core.
domain: https://ontologist.io/ns/holon#
subject:
  - holon profile
  - DataBook profile model
tags:
  - profile
  - holon
  - stub
process:
  transformer: "Claude Sonnet 5"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-5
  inputs:
    - iri: https://w3id.org/holon/databook/primer#the-holon-profile
      role: template
      description: "Primer S4.6 -- what the holon profile is expected to add (the holonic reading, mode patterns, authority semantics), none of which is encoded here yet."
  timestamp: 2026-09-07T23:00:00Z
  agent:
    name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator
  note: >
    Bundled with the CLI so `profiles[]` resolution has something to find
    offline. Registers only the `holon:` prefix, pointing at the core HGA
    ontology namespace -- e.g. a `<!-- holon:layer: L2 -->` comment key
    becomes a recognised (not merely tolerated) annotation once this
    profile is declared. Superseding this stub with the real profile
    (additional shapes, the L3 `rdfs:subClassOf` link, etc.) does not
    require a schema change to core -- only a new file here and, if it
    moves off this namespace, an updated schema/profiles/index.json entry.
---

## Overview

This is the bundled offline fallback for the `https://w3id.org/holon/databook#`
profile IRI. It exists so that a document declaring this profile can be
resolved without a network fetch, per the spec's own preference for
graceful degradation (S15) over silent failure.

## PROF descriptor and prefix registration

<!-- databook:id: holon-profile-descriptor -->
<!-- databook:label: PROF descriptor for the holon profile, with its comment-key prefix -->
```turtle
@prefix prof:    <http://www.w3.org/ns/dx/prof/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix sh:      <http://www.w3.org/ns/shacl#> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

<https://w3id.org/holon/databook#>
    a prof:Profile ;
    dcterms:title "Holon profile of DataBook (bundled stub)"@en ;
    prof:hasToken "holon" ;
    prof:isProfileOf <https://w3id.org/databook/> ;
    sh:declare
        [ a sh:PrefixDeclaration ;
          sh:prefix "holon" ;
          sh:namespace "https://ontologist.io/ns/holon#"^^xsd:anyURI ] .
```

## Usage note

Declaring this profile does not currently add any SHACL constraints —
`lib/profiles.js` looks for `shacl`-labelled blocks to union with core
when validating, and this file has none. It only widens the set of
comment-key prefixes `lib/parser.js`'s generalised annotation scanner and
`databook validate --header`'s unknown-prefix check treat as registered.
