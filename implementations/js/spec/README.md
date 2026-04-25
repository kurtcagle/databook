# DataBook CLI Specification DataBooks

This directory contains the formal DataBook CLI command specifications, expressed as DataBook documents.

## Contents

| File | Description |
| --- | --- |
| `databook-cli-conventions.databook.md` | Cross-cutting conventions: 4 architectural principles, POSIX stdin/stdout, common flags, fragment addressing, parameterisation mechanics, processors.toml schema, error code conventions |
| `databook-cli-pull.databook.md` | Formal specification for `databook pull`: 3 pull modes, output type inference, in-place block replacement, auth resolution, error handling |
| `databook-cli-push.databook.md` | Formal specification for `databook push`: block selection, named-graph assignment, GSP protocol, frontmatter reification, auth resolution |
| `databook-head-spec.databook.md` | Formal specification for `databook head`: output formats (JSON/YAML/XML/Turtle), block metadata mode, error handling |
| `databook-process-spec.databook.md` | Formal specification for `databook process`: DAG execution, stage ordering, parameterisation, VALUES injection, template interpolation |

## Source

These DataBooks were produced during design sessions in April 2026 and are stored in GDrive under `Chloe-Kurt Sessions/DataBooks/`. Download from there if not present locally.

## Format note

These spec DataBooks use the `<script language="application/yaml">` frontmatter form (canonical in DataBook v1.0; accepted alternative in v1.1). They are valid and parseable by all DataBook-aware tools.
