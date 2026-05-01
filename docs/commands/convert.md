# databook convert

Convert a DataBook block between RDF serialisation formats or SPARQL result formats.

## Synopsis

```
databook convert [input] --to <format> [options]
```

## Description

`convert` reads a named block (or raw input from stdin) and serialises it to the target format. Input and output formats are inferred from the block label or `--from`/`--to` flags.

The `#fragment` shorthand is supported: `source.databook.md#block-id`.

Use `--list` to see all available target formats for each block in a DataBook.

## Options

| Option | Description |
|---|---|
| `-b, --block-id <id>` | Block to convert (overridden by `#fragment` syntax) |
| `--to <format>` | Target format (required unless `--list`) |
| `--from <format>` | Input format override (required for stdin with ambiguous content) |
| `-o, --output <path>` | Output file. Use `"."` to auto-name. Default: stdout |
| `--encoding <enc>` | Output encoding: `utf8` (default), `utf8bom`, `utf16` |
| `--list` | List all blocks and their convertible target formats, then exit |
| `-q, --quiet` | Suppress info and lossy-conversion warnings |

## Supported formats

**RDF input formats:** `turtle`, `turtle12`, `trig`, `shacl`, `json-ld`

**RDF output formats:** `turtle`, `turtle12`, `ntriples`, `trig`, `json-ld`, `yaml-ld`, `xml-rdf`, `csv`, `tsv`, `markdown`, `yaml`

**SPARQL results input:** SPARQL JSON results (from `sparql` command output)

**SPARQL results output:** `csv`, `tsv`, `markdown`, `yaml`, `json`

> **Note:** `xml-rdf` is the DataBook label for RDF/XML serialisation. Use `--to xml-rdf`, not `--to rdf-xml`.

## Examples

```bash
# Convert RDF block to JSON-LD
databook convert source.databook.md#primary-graph --to json-ld

# Convert to RDF/XML
databook convert source.databook.md#primary-graph --to xml-rdf -o graph.rdf

# Convert to Markdown table (from SPARQL JSON results)
databook convert results.json --to markdown -o table.md

# Convert from stdin
cat graph.ttl | databook convert - --from turtle --to json-ld

# List all convertible formats for each block
databook convert source.databook.md --list
```

## Related commands

- [`extract`](extract.md) — emit raw block content without conversion
- [`sparql`](sparql.md) — produce query results that can then be converted
- [`transform`](transform.md) — apply XSLT to XML/RDF-XML content
