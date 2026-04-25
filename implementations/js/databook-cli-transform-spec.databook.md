<script language="application/yaml">

---
id: https://w3id.org/databook/specs/transform
title: "DataBook CLI Specification: transform Command"
type: databook
version: 1.0.0
created: 2026-04-23

author:
  - name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator
  - name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: transformer

license: CC-BY-4.0
domain: https://w3id.org/databook/ns#
subject:
  - DataBook CLI
  - XSLT transformation
  - stylesheet execution
description: >
  Specification for the `databook transform` command, which applies an XSLT stylesheet
  to a data block extracted from a source DataBook (or plain XML file). The stylesheet
  may itself be sourced from a DataBook carrying an xslt fenced block, or supplied as
  a plain .xslt / .xsl file. Supports Saxon (XSLT 2.0/3.0) and xsltproc (XSLT 1.0),
  with auto-detection based on what is available on PATH or via SAXON_JAR env var.

process:
  transformer: "Chloe Shannon / Claude Sonnet 4.6"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-4-6
  inputs:
    - iri: https://w3id.org/databook/specs/cli-conventions
      role: constraint
      description: "DataBook CLI conventions spec — encoding flags, DataBook detection, temp file strategy"
    - iri: urn:input:kurt-cagle-design-intent
      role: context
      description: "Option A design decision: dedicated transform subcommand, external processor delegation"
  timestamp: 2026-04-23T13:00:00Z
  agent:
    name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: transformer
---

</script>

## Overview

The `transform` command applies an XSLT stylesheet to XML content extracted from a DataBook
(or supplied as a standalone file) and writes the result to stdout or a named output file.

It is deliberately scoped to **XSLT execution only**. RDF format conversion remains the
responsibility of `databook convert`. The separation keeps each command's semantics clean:
`convert` is the RDF format router; `transform` is the general stylesheet executor.

## Synopsis

```
databook transform <source> --xslt <stylesheet> [options]
```

| Positional / Flag | Required | Description |
|---|---|---|
| `<source>` | Yes | Source DataBook (`.databook.md`) or plain XML/RDF-XML file |
| `--xslt <stylesheet>` | Yes | XSLT DataBook or plain `.xslt` / `.xsl` file |
| `--block-id <id>` | No | Fragment ID of the block to extract from `<source>` if it is a DataBook. If omitted, the first `xml`, `rdf-xml`, or `xhtml` block is used. |
| `--xslt-block-id <id>` | No | Fragment ID of the XSLT block to extract if `--xslt` is a DataBook. If omitted, the first `xslt` block is used. |
| `--param <name=value>` | No | Pass an XSLT stylesheet parameter. Repeatable. |
| `--to <format>` | No | Output method hint: `html`, `xml`, `text`. Overrides `xsl:output/@method`. Default: `auto` (honours the stylesheet's own `xsl:output`). |
| `--processor <mode>` | No | Processor selection: `auto` (default), `saxon`, `xsltproc`. |
| `--encoding <enc>` | No | Output encoding: `utf8` (default), `utf8bom`, `utf16`. |
| `-o, --output <file>` | No | Write output to `<file>` instead of stdout. |

## Processor Resolution

Processor selection under `--processor auto` (the default) follows this priority chain:

1. **Saxon** — check `SAXON_JAR` environment variable. If set and the file exists, use
   `java [JVM_ARGS] -jar $SAXON_JAR`.
2. **Saxon on PATH** — check for `saxon` command on PATH (common on Linux distros that
   package `libsaxon-java`).
3. **xsltproc** — check for `xsltproc` on PATH (standard on macOS and most Linux distros).
4. **Failure** — if none found, exit with code 1 and a descriptive message including install
   hints for each processor.

When `--processor saxon` or `--processor xsltproc` is specified explicitly, resolution skips
the chain and fails immediately if the named processor is not available.

On Windows, `toJenaPath()` path normalisation applies to all file arguments passed to Java-based
processors. The `JVM_ARGS` environment variable is forwarded to Saxon invocations unchanged.

## Source and Stylesheet Resolution

| `<source>` extension | Behaviour |
|---|---|
| `.databook.md` | Extract the target block (via `--block-id` or first xml-typed block) to a temp file |
| `.xml`, `.rdf`, `.rdf-xml`, other | Used directly as the XSLT source document |

| `--xslt` extension | Behaviour |
|---|---|
| `.databook.md` | Extract the target XSLT block (via `--xslt-block-id` or first `xslt` block) to a temp file |
| `.xslt`, `.xsl` | Used directly as the stylesheet |

Temp files are written to `os.tmpdir()` with randomised names and removed in a `finally` block
regardless of success or failure.

## Parameter Passing

`--param` values are passed as string parameters in `name=value` form.

With **Saxon**:
```
name=value   →   appended as positional name=value arguments
```

With **xsltproc**:
```
name=value   →   --stringparam name value
```

Boolean / numeric XSLT parameters must be handled by the stylesheet itself via `xs:boolean()`
or `xs:integer()` casting — the CLI always passes string values.

## Output Encoding

| `--encoding` | Behaviour |
|---|---|
| `utf8` (default) | Raw UTF-8 bytes to stdout / output file |
| `utf8bom` | Prepend `\xEF\xBB\xBF` BOM before output |
| `utf16` | Re-encode processor output from UTF-8 to UTF-16LE with BOM |

Note: XSLT processors write their own encoding declaration inside the output document
(e.g. `encoding="UTF-8"` in the XML declaration). The CLI `--encoding` flag governs the
**byte stream** written to the file system / pipe, not the declaration inside the document.
If you use `--encoding utf16`, also set `xsl:output encoding="UTF-16"` in the stylesheet to
keep the declaration consistent.

## Exit Codes

| Code | Meaning |
|---|---|
| 0 | Transform completed successfully |
| 1 | Processor not found; or source / stylesheet file not found |
| 2 | Block ID not found in DataBook |
| 3 | XSLT processor reported an error (stderr forwarded to CLI stderr) |

## Examples

```bash
# Basic: DataBook source + plain XSLT file → HTML on stdout
databook transform test-rdfxml.databook.md \
  --xslt rdfxml-to-html.xslt \
  --block-id hga-vocab-rdfxml \
  > hga-vocab-report.html

# Write to file explicitly
databook transform test-rdfxml.databook.md \
  --xslt rdfxml-to-html.xslt \
  --block-id hga-vocab-rdfxml \
  -o hga-vocab-report.html

# Both source and stylesheet from DataBooks
databook transform source.databook.md \
  --xslt stylesheets.databook.md \
  --block-id primary-xml \
  --xslt-block-id rdfxml-to-html \
  -o report.html

# Pass XSLT parameters
databook transform source.databook.md \
  --xslt report.xslt \
  --param base-iri=https://w3id.org/holon/ns# \
  --param theme=dark \
  -o report.html

# Force Saxon, UTF-8 BOM output
databook transform source.databook.md \
  --xslt report.xslt \
  --processor saxon \
  --encoding utf8bom \
  -o report.html

# Plain XML file input (no DataBook extraction step)
databook transform hga-vocab.rdf \
  --xslt rdfxml-to-html.xslt \
  -o report.html
```

## Relationship to Other Commands

| Need | Command |
|---|---|
| Convert RDF between formats (Turtle ↔ JSON-LD ↔ N-Triples etc.) | `databook convert` |
| Apply XSLT stylesheet to XML content | `databook transform` |
| Run a full DataBook pipeline manifest | `databook process` |
| Extract a raw block to stdout | `databook extract` |

A common composition: `databook convert … --to xml | databook transform - --xslt report.xslt`
(stdin as source is a **v1.1 candidate feature** — not in v1.0).

## Spec Block

```turtle
<!-- databook:id: transform-cmd-spec-rdf -->
@prefix build: <https://w3id.org/databook/ns#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix spec:  <https://w3id.org/databook/specs/> .

spec:transform a build:CliCommand ;
    dct:title          "databook transform"@en ;
    dct:created        "2026-04-23"^^xsd:date ;
    build:cliVersion   "1.0.0" ;
    build:status       build:Active ;
    build:description  "Apply an XSLT stylesheet to XML content from a DataBook or plain XML file."@en ;
    build:processorSupport  "saxon", "xsltproc" ;
    build:encodingSupport   "utf8", "utf8bom", "utf16" ;
    build:dependsOn    spec:cli-conventions ,
                       spec:extract .
```
