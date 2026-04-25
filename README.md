# DataBook

**DataBook** is a Markdown-based format for self-describing semantic documents. A DataBook simultaneously is a human-readable document, a typed data container (RDF/SPARQL/SHACL), and a self-describing semantic artifact carrying identity, provenance, and graph metadata.

This repository is the canonical home for:

- The **DataBook Format Specification** (`SPEC.md`)
- The **DataBook CLI** — a Node.js reference implementation (`implementations/js/`)
- **Example DataBooks** demonstrating the full range of format features (`examples/`)

---

## Repository Layout

```
databook/
├── SPEC.md                          # DataBook format specification (v1.1)
├── CHANGELOG.md                     # Version history
├── README.md                        # This file
│
├── spec/                            # Extended specification documents
│   ├── frontmatter.md               # Full frontmatter property reference
│   ├── block-types.md               # Fenced block label vocabulary
│   ├── manifests.md                 # Pipeline manifest pattern
│   ├── transformer-libraries.md     # Transformer library document type
│   ├── processor-registries.md      # Processor registry document type
│   └── encryption.md               # Encryption profile
│
├── schema/                          # Machine-readable validation artefacts
│   ├── databook.shacl.ttl           # SHACL shapes for DataBook metadata
│   ├── databook.schema.json         # JSON Schema for frontmatter
│   └── build.ttl                    # build: vocabulary (OWL/RDF)
│
├── examples/                        # Reference DataBooks (one per feature area)
│   ├── minimal.databook.md          # Minimum viable DataBook
│   ├── skos-taxonomy.databook.md    # SKOS data with SPARQL queries
│   ├── parameterised-queries.databook.md  # databook:param / VALUES injection
│   ├── shacl-shapes.databook.md     # Standalone SHACL shapes library
│   ├── pipeline-manifest.databook.md      # Build dependency graph
│   ├── transformer-library.databook.md    # Named transformer catalogue
│   ├── processor-registry.databook.md     # Named processor catalogue
│   └── rdf12-reification.databook.md      # RDF 1.2 reification syntax
│
└── implementations/
    └── js/                          # Node.js CLI reference implementation
        ├── README.md                # CLI installation and usage
        ├── bin/databook.js          # CLI entry point
        ├── commands/                # Command implementations
        ├── lib/                     # Shared utilities
        ├── test/                    # Test fixtures and test guide
        └── package.json
```

---

## Quick Start — DataBook Format

A DataBook is a `.databook.md` file whose frontmatter declares its identity and provenance, and whose body carries one or more typed fenced blocks:

```markdown
---
id: https://example.org/databooks/my-first-databook
title: "My First DataBook"
type: databook
version: 1.0.0
created: 2026-04-25
process:
  transformer: human
  transformer_type: human
  inputs: []
  timestamp: 2026-04-25T12:00:00Z
---

## Overview

This DataBook carries a small RDF graph.

```turtle
<!-- databook:id: primary-block -->
@prefix ex: <https://example.org/> .
ex:Thing a ex:Class ;
    ex:label "A thing" .
```
```

See `SPEC.md` for the full specification and `examples/` for working demonstrations of every feature.

---

## Quick Start — DataBook CLI

### Installation

```bash
cd implementations/js
npm install
npm link            # makes 'databook' available globally
```

### Common commands

```bash
# Inspect a DataBook's structure
databook head my-file.databook.md

# Extract a named block
databook extract my-file.databook.md --block-id primary-block --format turtle

# Push graph data to a SPARQL endpoint
databook push my-file.databook.md --endpoint http://localhost:3030/ds/sparql

# Pull a named graph from a SPARQL endpoint into a DataBook
databook pull my-file.databook.md --graph https://example.org/my-graph

# Run a pipeline defined in a manifest DataBook
databook process pipeline.databook.md

# Execute a prompt template block against an LLM
databook prompt my-file.databook.md --block-id my-prompt
```

See `implementations/js/README.md` for the full command reference, configuration, and examples.

---

## Specification

The DataBook format specification is in `SPEC.md`. Current version: **1.1** (2026-04-25).

Key concepts:

| Concept | Description |
| --- | --- |
| `---` frontmatter | YAML identity and provenance metadata (canonical in v1.1) |
| Fenced data blocks | Typed payloads: `turtle`, `sparql`, `shacl`, `manifest`, `prompt`, etc. |
| `databook:id` | Block identifier enabling fragment addressing (`{doc-iri}#{block-id}`) |
| Process stamp | Provenance record: transformer, inputs, agent, timestamp |
| Manifest | Pipeline dependency graph using the `build:` RDF vocabulary |
| Transformer library | Catalogue of reusable named transforms |
| Processor registry | Catalogue of named SPARQL/LLM/tool endpoints |

Canonical namespace: `https://w3id.org/databook/ns#`

---

## Contributing

The DataBook format is developed openly. To propose changes to the spec or report issues with the CLI, open an issue at `https://github.com/kurtcagle/databook`.

**Authors:** Kurt Cagle, Chloe Shannon  
**Licence:** CC-BY-4.0
