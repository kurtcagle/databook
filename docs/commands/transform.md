# databook transform

Apply an XSLT stylesheet to XML content extracted from a DataBook or a plain XML/RDF file.

## Synopsis

```
databook transform [source] --xslt <file> [options]
```

## Description

`transform` extracts an XML block from a DataBook (or accepts a plain XML file) and applies an XSLT stylesheet to produce HTML, XML, or text output. Both the source content and the stylesheet can live inside DataBooks as named blocks.

**Typical pipeline for SHACL report rendering:**
```
validate → report DataBook
  → convert --to xml-rdf → RDF/XML file
    → transform --xslt report.xsl → HTML or Markdown
```

**Processor resolution** (`--processor auto`):
1. `SAXON_JAR` environment variable → `java [JVM_ARGS] -jar $SAXON_JAR` (Saxon)
2. `saxon` on PATH
3. `xsltproc` on PATH (XSLT 1.0 only)

Saxon (2.0/3.0) is strongly recommended for RDF/XML rendering. `xsltproc` is XSLT 1.0 only and may not handle all RDF namespace patterns.

## Options

| Option | Description |
|---|---|
| `--xslt <file>` | XSLT DataBook or plain `.xslt`/`.xsl` stylesheet file (required) |
| `-b, --block-id <id>` | Block ID to extract from source DataBook |
| `--xslt-block-id <id>` | Block ID to extract from XSLT DataBook |
| `--param <name=value>` | XSLT parameter (repeatable) |
| `--to <format>` | Output method: `html` \| `xml` \| `text` (default: auto-detected) |
| `--processor <mode>` | Processor: `auto` (default) \| `saxon` \| `xsltproc` |
| `--encoding <enc>` | Output encoding: `utf8` (default), `utf8bom`, `utf16` |
| `-o, --output <file>` | Write output to file instead of stdout |

## Examples

```bash
# Transform an RDF/XML file to HTML using Saxon
databook transform report.rdf --xslt shacl-to-html.xsl -o report.html

# Use a stylesheet embedded in a DataBook
databook transform report.rdf --xslt pipeline.databook.md#html-stylesheet -o report.html

# Transform to Markdown using a different stylesheet
databook transform report.rdf --xslt shacl-to-markdown.xsl --to text -o report.md

# Pass XSLT parameters
databook transform data.rdf --xslt report.xsl --param title="My Report" -o report.html

# Use xsltproc explicitly (XSLT 1.0)
databook transform data.rdf --xslt simple.xsl --processor xsltproc
```

## Related commands

- [`convert`](convert.md) — convert Turtle/RDF to RDF/XML (`--to xml-rdf`) before transforming
- [`validate`](validate.md) — produce the SHACL report that is the typical input to `transform`
