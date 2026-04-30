---
id: https://w3id.org/databook/untitled-v1.0.0
title: My Databook
type: databook
version: 2.1.2
created: "2026-04-28"
process:
  transformer: databook create
  transformer_type: script
  timestamp: "2026-04-28T21:26:17Z"
  agent:
    name: databook-cli
    iri: https://w3id.org/databook/cli
    role: orchestrator
  inputs: []
  transformer_domain: CNL
description: This is a CNL file.
---


# Untitled DataBook

> **Version:** 1.0.0 &nbsp;|&nbsp; **Created:** 2026-04-28

{{description}}

## Overview

*Replace this section with a description of the DataBook's purpose, provenance,
and intended use.  What domain does it model?  What system produced the data?
Who is the intended consumer?*

## Data



## Notes

*Add usage notes, validation guidance, known limitations, or cross-references
to related DataBooks here.*


SHACL validation layer for schema v2.

```json
<!-- databook:id: ttl-block-1 -->
<!-- databook:source: package.json -->
{
  "name": "databook-cli",
  "version": "1.2.0",
  "description": "DataBook CLI \u2014 inspect, push, pull, and process DataBook semantic documents",
  "type": "module",
  "bin": {
    "databook": "./bin/databook.js"
  },
  "scripts": {
    "test": "node bin/databook.js --help"
  },
  "dependencies": {
    "@iarna/toml": "^2.2.5",
    "commander": "^12.1.0",
    "js-yaml": "^4.1.0",
    "jsonld": "^9.0.0",
    "n3": "^1.22.0"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": [
    "databook",
    "rdf",
    "semantic-web",
    "cli",
    "sparql",
    "shacl"
  ],
  "license": "CC-BY-4.0"
}
```
