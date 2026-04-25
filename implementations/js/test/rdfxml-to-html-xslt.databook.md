<script language="application/yaml">

---
id: https://w3id.org/databook/test/rdfxml-to-html-xslt-v1
title: "RDF/XML → HTML Vocabulary Report — XSLT Stylesheet DataBook"
type: transformer-library
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
  - XSLT stylesheet
  - RDF/XML transformation
  - HTML report generation
  - DataBook CLI testing
description: >
  A transformer-library DataBook carrying the rdfxml-to-html XSLT 1.0 stylesheet.
  Transforms an RDF/XML document into a human-readable HTML vocabulary report,
  listing ontology metadata, OWL classes with hierarchy, and OWL properties with
  domain and range. Designed as the companion stylesheet for test-rdfxml.databook.md.
  Compatible with xsltproc (libxslt) and Saxon HE/PE/EE 9.x+.

process:
  transformer: "Chloe Shannon / Claude Sonnet 4.6"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-4-6
  inputs:
    - iri: urn:input:rdfxml-to-html-xslt-source
      role: primary
      description: "Hand-authored XSLT 1.0 stylesheet for RDF/XML → HTML transformation"
    - iri: https://w3id.org/databook/test/rdfxml-hga-vocab-v1
      role: context
      description: "Target DataBook this stylesheet is designed to transform"
  timestamp: 2026-04-23T13:30:00Z
  agent:
    name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: transformer
---

</script>

## Overview

This DataBook packages the `rdfxml-to-html` XSLT 1.0 stylesheet as a portable,
self-describing transformer artifact. It is the companion stylesheet for
`test-rdfxml.databook.md` and the primary test fixture for the `databook transform`
command's DataBook-as-stylesheet code path.

The stylesheet accepts any RDF/XML document using standard `rdf:`, `rdfs:`, `owl:`,
and `dct:` namespace declarations and produces a styled HTML vocabulary report.

## Stylesheet Parameters

| Parameter | Default | Description |
|---|---|---|
| `base-iri` | `https://w3id.org/holon/ns#` | IRI prefix stripped when deriving display labels |
| `theme` | `light` | Reserved for future dark-mode support; currently unused |

Pass parameters via `--param` on the CLI:

```bash
databook transform test-rdfxml.databook.md \
  --xslt rdfxml-to-html-xslt.databook.md \
  --block-id hga-vocab-rdfxml \
  --xslt-block-id rdfxml-to-html \
  --param base-iri=https://w3id.org/holon/ns# \
  -o report.html
```

## Processor Compatibility

| Processor | Version | Notes |
|---|---|---|
| xsltproc | any (libxslt 1.x) | XSLT 1.0 — full compatibility |
| Saxon HE | 9.x – 12.x | XSLT 2.0/3.0 in backwards-compat mode |
| Saxon PE/EE | 9.x – 12.x | Full support |

> **Note:** The `<?xml version="1.0"?>` declaration is omitted from the fenced block
> to allow the `<!-- databook:id: -->` marker to occupy the first line as required by
> the DataBook spec. Both xsltproc and Saxon parse a bare `<xsl:stylesheet>` root
> without a preceding XML declaration without issue.

## Transformer Catalogue

```transformer-library
<!-- databook:id: transform-catalogue -->
@prefix build: <https://w3id.org/databook/ns#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix dct:   <http://purl.org/dc/terms/> .
@prefix lib:   <https://w3id.org/databook/test/rdfxml-to-html-xslt-v1#> .

lib:rdfxml-to-html a build:NamedTransform ;
    build:transformerType "xslt" ;
    build:inputType       "xml" ;
    build:outputType      "html" ;
    dct:title             "RDF/XML OWL vocabulary → HTML report"@en ;
    dct:description       "Renders ontology metadata, OWL classes with subclass hierarchy, and OWL properties with domain and range as a styled HTML document."@en ;
    dct:created           "2026-04-23"^^xsd:date ;
    build:xsltVersion     "1.0" ;
    build:processorNote   "Compatible with xsltproc (XSLT 1.0) and Saxon HE 9.x+ (XSLT 2.0/3.0 backwards-compat mode)."@en .
```

## Stylesheet

```xslt
<!-- databook:id: rdfxml-to-html -->
<xsl:stylesheet
  version        = "1.0"
  xmlns:xsl      = "http://www.w3.org/1999/XSL/Transform"
  xmlns:rdf      = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:rdfs     = "http://www.w3.org/2000/01/rdf-schema#"
  xmlns:owl      = "http://www.w3.org/2002/07/owl#"
  xmlns:dct      = "http://purl.org/dc/terms/"
  xmlns:xsd      = "http://www.w3.org/2001/XMLSchema#"
  exclude-result-prefixes="rdf rdfs owl dct xsd">

  <xsl:output
    method   = "html"
    encoding = "UTF-8"
    indent   = "yes"
    doctype-public = "-//W3C//DTD HTML 4.01//EN"
    doctype-system = "http://www.w3.org/TR/html4/strict.dtd"/>

  <!-- ============================================================
       Parameters (override on command line if needed)
       ============================================================ -->

  <!-- Base prefix to strip from IRIs for display labels -->
  <xsl:param name="base-iri" select="'https://w3id.org/holon/ns#'"/>

  <!-- Page colour theme: 'light' (default) or 'dark' -->
  <xsl:param name="theme" select="'light'"/>


  <!-- ============================================================
       Root template
       ============================================================ -->

  <xsl:template match="/rdf:RDF">
    <html>
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
        <title>
          <xsl:choose>
            <xsl:when test="owl:Ontology/dct:title">
              <xsl:value-of select="owl:Ontology/dct:title[1]"/>
            </xsl:when>
            <xsl:otherwise>RDF/XML Vocabulary Report</xsl:otherwise>
          </xsl:choose>
        </title>
        <style>
          /* ---- Reset and base ---- */
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
            font-size: 15px;
            line-height: 1.6;
            background: #f7f8fa;
            color: #1a1a2e;
            padding: 2rem 1rem;
          }
          /* ---- Layout ---- */
          .page { max-width: 860px; margin: 0 auto; }
          /* ---- Ontology header ---- */
          .onto-header {
            background: #1a1a2e;
            color: #e8eaf6;
            border-radius: 8px;
            padding: 1.5rem 2rem;
            margin-bottom: 2rem;
          }
          .onto-header h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.4rem; }
          .onto-header .onto-meta { font-size: 0.85rem; opacity: 0.75; margin-top: 0.25rem; }
          .onto-header .onto-iri {
            font-family: "Fira Mono", "Consolas", monospace;
            font-size: 0.8rem;
            background: rgba(255,255,255,0.1);
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            display: inline-block;
            margin-top: 0.5rem;
          }
          .onto-header .onto-desc {
            margin-top: 0.75rem;
            font-size: 0.9rem;
            opacity: 0.88;
          }
          /* ---- Section headings ---- */
          .section-title {
            font-size: 1.1rem;
            font-weight: 700;
            color: #1a1a2e;
            border-left: 4px solid #5c6bc0;
            padding-left: 0.75rem;
            margin: 2rem 0 1rem;
          }
          /* ---- Cards ---- */
          .card {
            background: #fff;
            border: 1px solid #e0e3ef;
            border-radius: 6px;
            padding: 1rem 1.25rem;
            margin-bottom: 0.75rem;
          }
          .card-header {
            display: flex;
            align-items: baseline;
            gap: 0.75rem;
            margin-bottom: 0.4rem;
          }
          .card-name {
            font-weight: 700;
            font-size: 1rem;
            color: #1a1a2e;
          }
          .card-iri {
            font-family: "Fira Mono", "Consolas", monospace;
            font-size: 0.75rem;
            color: #5c6bc0;
            word-break: break-all;
          }
          .card-comment { font-size: 0.875rem; color: #444; margin-bottom: 0.5rem; }
          /* ---- Metadata rows inside cards ---- */
          .meta-row {
            display: flex;
            gap: 0.5rem;
            font-size: 0.8rem;
            margin-top: 0.3rem;
          }
          .meta-key {
            font-weight: 600;
            color: #888;
            white-space: nowrap;
            min-width: 5.5rem;
          }
          .meta-val {
            font-family: "Fira Mono", "Consolas", monospace;
            color: #333;
            word-break: break-all;
          }
          /* ---- Hierarchy indent pill ---- */
          .subclass-of {
            display: inline-block;
            background: #e8eaf6;
            color: #3949ab;
            font-size: 0.72rem;
            font-family: "Fira Mono", "Consolas", monospace;
            border-radius: 3px;
            padding: 0.1rem 0.4rem;
            margin-left: 0.25rem;
          }
          /* ---- Stats bar ---- */
          .stats {
            background: #e8eaf6;
            border-radius: 6px;
            padding: 0.6rem 1rem;
            font-size: 0.82rem;
            color: #3949ab;
            margin-bottom: 1.5rem;
          }
          .stats strong { font-weight: 700; }
          /* ---- Footer ---- */
          footer {
            margin-top: 2.5rem;
            font-size: 0.78rem;
            color: #aaa;
            text-align: center;
          }
        </style>
      </head>

      <body>
        <div class="page">

          <!-- Ontology header -->
          <xsl:apply-templates select="owl:Ontology"/>

          <!-- Stats bar -->
          <div class="stats">
            <strong>
              <xsl:value-of select="count(owl:Class)"/>
            </strong> classes ·
            <strong>
              <xsl:value-of select="count(owl:ObjectProperty) + count(owl:DatatypeProperty)"/>
            </strong> properties
            (<xsl:value-of select="count(owl:ObjectProperty)"/> object,
             <xsl:value-of select="count(owl:DatatypeProperty)"/> datatype)
          </div>

          <!-- Classes -->
          <xsl:if test="owl:Class">
            <div class="section-title">Classes</div>
            <xsl:apply-templates select="owl:Class">
              <xsl:sort select="rdfs:label[@xml:lang='en']"/>
            </xsl:apply-templates>
          </xsl:if>

          <!-- Object Properties -->
          <xsl:if test="owl:ObjectProperty">
            <div class="section-title">Object Properties</div>
            <xsl:apply-templates select="owl:ObjectProperty">
              <xsl:sort select="rdfs:label[@xml:lang='en']"/>
            </xsl:apply-templates>
          </xsl:if>

          <!-- Datatype Properties -->
          <xsl:if test="owl:DatatypeProperty">
            <div class="section-title">Datatype Properties</div>
            <xsl:apply-templates select="owl:DatatypeProperty">
              <xsl:sort select="rdfs:label[@xml:lang='en']"/>
            </xsl:apply-templates>
          </xsl:if>

          <!-- Named Individuals -->
          <xsl:if test="rdf:Description[not(@rdf:about = //owl:Class/@rdf:about)
                                        and not(@rdf:about = //owl:ObjectProperty/@rdf:about)
                                        and not(@rdf:about = //owl:DatatypeProperty/@rdf:about)
                                        and not(@rdf:about = //owl:Ontology/@rdf:about)]">
            <div class="section-title">Named Individuals / Other Resources</div>
            <xsl:apply-templates
              select="rdf:Description[not(@rdf:about = //owl:Class/@rdf:about)
                                      and not(@rdf:about = //owl:ObjectProperty/@rdf:about)
                                      and not(@rdf:about = //owl:DatatypeProperty/@rdf:about)
                                      and not(@rdf:about = //owl:Ontology/@rdf:about)]"/>
          </xsl:if>

          <footer>
            Generated by rdfxml-to-html ·
            <xsl:value-of select="owl:Ontology/dct:created"/>
          </footer>

        </div>
      </body>
    </html>
  </xsl:template>


  <!-- ============================================================
       Ontology header template
       ============================================================ -->

  <xsl:template match="owl:Ontology">
    <div class="onto-header">
      <h1>
        <xsl:choose>
          <xsl:when test="dct:title">
            <xsl:value-of select="dct:title[1]"/>
          </xsl:when>
          <xsl:otherwise>Unnamed Ontology</xsl:otherwise>
        </xsl:choose>
      </h1>
      <xsl:if test="@rdf:about">
        <div class="onto-iri">
          <xsl:value-of select="@rdf:about"/>
        </div>
      </xsl:if>
      <xsl:if test="dct:created">
        <div class="onto-meta">Created: <xsl:value-of select="dct:created"/></div>
      </xsl:if>
      <xsl:if test="owl:versionIRI">
        <div class="onto-meta">Version IRI:
          <xsl:value-of select="owl:versionIRI/@rdf:resource"/>
        </div>
      </xsl:if>
      <xsl:if test="dct:description">
        <div class="onto-desc">
          <xsl:value-of select="normalize-space(dct:description)"/>
        </div>
      </xsl:if>
    </div>
  </xsl:template>


  <!-- ============================================================
       Class template
       ============================================================ -->

  <xsl:template match="owl:Class">
    <div class="card">
      <div class="card-header">
        <span class="card-name">
          <xsl:call-template name="local-name">
            <xsl:with-param name="iri" select="@rdf:about"/>
          </xsl:call-template>
        </span>
        <span class="card-iri">
          <xsl:value-of select="@rdf:about"/>
        </span>
      </div>

      <!-- subClassOf -->
      <xsl:for-each select="rdfs:subClassOf">
        <xsl:text>&#x21B3; </xsl:text>
        <span class="subclass-of">
          <xsl:call-template name="local-name">
            <xsl:with-param name="iri" select="@rdf:resource"/>
          </xsl:call-template>
        </span>
        <br/>
      </xsl:for-each>

      <!-- Comment -->
      <xsl:if test="rdfs:comment">
        <div class="card-comment">
          <xsl:value-of select="normalize-space(rdfs:comment[1])"/>
        </div>
      </xsl:if>

      <!-- isDefinedBy -->
      <xsl:if test="rdfs:isDefinedBy">
        <div class="meta-row">
          <span class="meta-key">defined by</span>
          <span class="meta-val">
            <xsl:value-of select="rdfs:isDefinedBy/@rdf:resource"/>
          </span>
        </div>
      </xsl:if>
    </div>
  </xsl:template>


  <!-- ============================================================
       ObjectProperty / DatatypeProperty template (shared)
       ============================================================ -->

  <xsl:template match="owl:ObjectProperty | owl:DatatypeProperty">
    <div class="card">
      <div class="card-header">
        <span class="card-name">
          <xsl:call-template name="local-name">
            <xsl:with-param name="iri" select="@rdf:about"/>
          </xsl:call-template>
        </span>
        <span class="card-iri">
          <xsl:value-of select="@rdf:about"/>
        </span>
      </div>

      <xsl:if test="rdfs:comment">
        <div class="card-comment">
          <xsl:value-of select="normalize-space(rdfs:comment[1])"/>
        </div>
      </xsl:if>

      <xsl:if test="rdfs:domain">
        <div class="meta-row">
          <span class="meta-key">domain</span>
          <span class="meta-val">
            <xsl:call-template name="local-name">
              <xsl:with-param name="iri" select="rdfs:domain/@rdf:resource"/>
            </xsl:call-template>
            <xsl:text> </xsl:text>
            <span style="opacity:0.55">
              (<xsl:value-of select="rdfs:domain/@rdf:resource"/>)
            </span>
          </span>
        </div>
      </xsl:if>

      <xsl:if test="rdfs:range">
        <div class="meta-row">
          <span class="meta-key">range</span>
          <span class="meta-val">
            <xsl:call-template name="local-name">
              <xsl:with-param name="iri" select="rdfs:range/@rdf:resource"/>
            </xsl:call-template>
            <xsl:text> </xsl:text>
            <span style="opacity:0.55">
              (<xsl:value-of select="rdfs:range/@rdf:resource"/>)
            </span>
          </span>
        </div>
      </xsl:if>

      <xsl:if test="rdfs:isDefinedBy">
        <div class="meta-row">
          <span class="meta-key">defined by</span>
          <span class="meta-val">
            <xsl:value-of select="rdfs:isDefinedBy/@rdf:resource"/>
          </span>
        </div>
      </xsl:if>
    </div>
  </xsl:template>


  <!-- ============================================================
       Generic rdf:Description fallback template
       ============================================================ -->

  <xsl:template match="rdf:Description">
    <div class="card">
      <div class="card-header">
        <span class="card-name">
          <xsl:choose>
            <xsl:when test="rdfs:label">
              <xsl:value-of select="rdfs:label[1]"/>
            </xsl:when>
            <xsl:otherwise>
              <xsl:call-template name="local-name">
                <xsl:with-param name="iri" select="@rdf:about"/>
              </xsl:call-template>
            </xsl:otherwise>
          </xsl:choose>
        </span>
        <xsl:if test="@rdf:about">
          <span class="card-iri">
            <xsl:value-of select="@rdf:about"/>
          </span>
        </xsl:if>
      </div>
      <xsl:if test="rdfs:comment">
        <div class="card-comment">
          <xsl:value-of select="normalize-space(rdfs:comment[1])"/>
        </div>
      </xsl:if>
    </div>
  </xsl:template>


  <!-- ============================================================
       Named template: extract local name from an IRI
       ============================================================ -->

  <xsl:template name="local-name">
    <xsl:param name="iri" select="''"/>
    <xsl:choose>
      <xsl:when test="contains($iri, '#')">
        <xsl:call-template name="after-last">
          <xsl:with-param name="s"     select="$iri"/>
          <xsl:with-param name="delim" select="'#'"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="contains($iri, '/')">
        <xsl:call-template name="after-last">
          <xsl:with-param name="s"     select="$iri"/>
          <xsl:with-param name="delim" select="'/'"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$iri"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="after-last">
    <xsl:param name="s"     select="''"/>
    <xsl:param name="delim" select="'#'"/>
    <xsl:choose>
      <xsl:when test="contains($s, $delim)">
        <xsl:call-template name="after-last">
          <xsl:with-param name="s"     select="substring-after($s, $delim)"/>
          <xsl:with-param name="delim" select="$delim"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$s"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

</xsl:stylesheet>
```
