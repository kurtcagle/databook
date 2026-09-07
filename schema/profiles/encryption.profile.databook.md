---
id: https://w3id.org/databook/profiles/encryption
title: "Encryption Profile of DataBook (bundled stub)"
type: databook
version: 0.1.0
created: 2026-09-07
description: >
  A minimal PROF descriptor for the encryption profile SPEC.md S13
  already defines conceptually: the reserved `encryption` frontmatter
  key, the `encrypted`/`encrypted-turtle`/`encrypted-jsonld` fence
  labels, and the parser contract for a processor that does or does not
  support decryption. It registers no comment-key prefix -- encryption
  reuses `databook:encrypted-media-type` and `databook:key-ref`, both
  already under the core `databook:` prefix -- and declares no additional
  SHACL shapes, since encrypted-block validity is enforced procedurally
  by the parser contract (auth-tag verification, block-id matching
  against `encryption.blocks`), not by SHACL. This is the "profile with
  nothing to add to core mechanics, only a documented convention" case,
  included as a second bundled fixture alongside the holon stub so
  profile resolution is tested against more than one shape.
subject:
  - encryption profile
  - DataBook profile model
tags:
  - profile
  - encryption
  - stub
process:
  transformer: "Claude Sonnet 5"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-5
  inputs:
    - iri: https://github.com/kurtcagle/databook/blob/main/SPEC.md
      role: template
      description: "SPEC.md S13, Encryption Profile -- the design this descriptor documents; already the first profile the spec defines, per the primer S4.7."
  timestamp: 2026-09-07T23:00:00Z
  agent:
    name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator
---

## Overview

Bundled offline fallback for `https://w3id.org/databook/profiles/encryption`.
Resolves successfully with an empty prefix table and no shapes text —
declaring this profile is a documentation convention (asserting "this
DataBook's encrypted blocks follow SPEC.md S13"), not a trigger for any
additional parsing or validation behaviour.

## PROF descriptor

<!-- databook:id: encryption-profile-descriptor -->
<!-- databook:label: PROF descriptor for the encryption profile -->
```turtle
@prefix prof:    <http://www.w3.org/ns/dx/prof/> .
@prefix role:    <http://www.w3.org/ns/dx/prof/role/> .
@prefix dcterms: <http://purl.org/dc/terms/> .

<https://w3id.org/databook/profiles/encryption>
    a prof:Profile ;
    dcterms:title "Encryption profile of DataBook"@en ;
    prof:hasToken "encryption" ;
    prof:isProfileOf <https://w3id.org/databook/> ;
    prof:hasResource
        [ a prof:ResourceDescriptor ;
          prof:hasRole role:specification ;
          dcterms:format "text/markdown" ;
          dcterms:description "SPEC.md S13, Encryption Profile"@en ] .
```
