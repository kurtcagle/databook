# databook shacl2sparql

Compile SHACL 1.2 shapes to SPARQL SELECT and/or CONSTRUCT retrieval queries.

## Synopsis

```
databook shacl2sparql <source> [options]
```

## Description

`shacl2sparql` reads a SHACL shapes graph (from a DataBook block or a plain `.ttl`/`.shacl` file) and compiles each `sh:NodeShape` into a SPARQL query that retrieves all focus nodes satisfying that shape.

This reflects a key insight: a SHACL `sh:NodeShape` targeting a class with `sh:property` constraints is simultaneously a retrieval specification. The constraint graph and the retrieval graph are duals. `shacl2sparql` makes this relationship explicit and executable.

**SELECT queries** return focus nodes (IRIs) that would pass SHACL validation.  
**CONSTRUCT queries** return all triples for those focus nodes.

Use `--insert` to write the generated SPARQL blocks back into the source DataBook in-place.

## SHACL 1.2 support

| Construct | SPARQL translation |
|---|---|
| `sh:targetClass` | `rdf:type/rdfs:subClassOf* C` |
| `sh:targetNode` | `VALUES` |
| `sh:targetSubjectsOf` / `sh:targetObjectsOf` | triple pattern |
| `sh:path` (all variants) | SPARQL property path |
| `sh:minCount` / `sh:maxCount` | Subquery + `HAVING (COUNT(...))` |
| `sh:datatype` / `sh:class` / `sh:nodeKind` | `FILTER` / type path |
| `sh:minInclusive` / `sh:maxInclusive` etc. | `FILTER` |
| `sh:pattern` / `sh:flags` | `FILTER(REGEX(...))` |
| `sh:in` | `FILTER(IN(...))` |
| `sh:hasValue` | direct triple pattern |
| `sh:not` | `FILTER NOT EXISTS { ... }` |
| `sh:and` | inline join |
| `sh:or` | `UNION` |
| `sh:xone` | comment (cannot be faithfully compiled) |
| `sh:node` (nested shape) | inlined constraint patterns |
| `sh:values` + Node Expressions | `sh:this`, `sh:path`, `sh:filterShape`, `sh:intersection`, `sh:union`, `sh:distinct`, `sh:limit`, `sh:offset` |

**Note:** `sh:maxCount` uses a subquery + `HAVING`. `sh:xone` emits a `#` comment and requires manual review.

## Options

| Option | Description |
|---|---|
| `-b, --block-id <id>` | SHACL block to compile (default: first `shacl` or `turtle` block) |
| `--data-block <id>` | Turtle data block whose graph IRI to inject as a `FROM` clause |
| `--from-graph <iri>` | Explicit `FROM` graph IRI (repeatable) |
| `--shape <iri>` | Compile only this named shape IRI (default: all shapes) |
| `--type <type>` | Query type: `select` (default) \| `construct` \| `both` |
| `--insert` | Insert generated SPARQL block(s) into the source DataBook in-place |
| `--prefix <id>` | Block ID prefix for generated blocks (default: `select-` / `construct-`) |
| `-o, --output <file>` | Output file (default: stdout; or in-place DataBook with `--insert`) |
| `--encoding <enc>` | Output encoding: `utf8` (default), `utf8bom`, `utf16` |
| `--dry-run` | Print generated queries without writing |
| `-v, --verbose` | Log shape extraction and block insertion details |
| `-q, --quiet` | Suppress info messages |

## Examples

```bash
# Print SELECT queries for all shapes in a DataBook
databook shacl2sparql shapes.databook.md

# Print CONSTRUCT queries for a specific SHACL block
databook shacl2sparql shapes.databook.md -b person-shapes --type construct

# Insert generated queries back into the DataBook
databook shacl2sparql shapes.databook.md --insert

# Generate queries with a FROM clause derived from a data block
databook shacl2sparql shapes.databook.md --data-block primary-graph --insert

# Compile only one shape
databook shacl2sparql shapes.databook.md --insert --shape https://example.org/PersonShape

# Compile a plain Turtle file, output both SELECT and CONSTRUCT
databook shacl2sparql shapes.ttl --type both -o queries.sparql
```

## Related commands

- [`validate`](validate.md) — run SHACL validation (constraint direction)
- [`sparql`](sparql.md) — execute the generated queries against a triplestore
