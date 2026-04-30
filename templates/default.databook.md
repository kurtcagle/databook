---
id: https://w3id.org/databook/templates/default-v1
title: "DataBook Default Template"
type: template
version: 1.0.0
created: 2026-04-28
description: >
  Default prose template for databook create.  Substitute {{title}}, {{version}},
  {{created}}, {{description}}, and {{blocks}} with document metadata and block
  content.  Copy and customise this file; point to it with --template or
  config template: to override the default.
process:
  transformer: "databook-cli"
  transformer_type: script
  agent:
    name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: orchestrator
---

# {{title}}

> **Version:** {{version}} &nbsp;|&nbsp; **Created:** {{created}}

{{description}}

## Overview

*Replace this section with a description of the DataBook's purpose, provenance,
and intended use.  What domain does it model?  What system produced the data?
Who is the intended consumer?*

## Data

{{blocks}}

## Notes

*Add usage notes, validation guidance, known limitations, or cross-references
to related DataBooks here.*
