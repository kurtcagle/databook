<script language="application/yaml">

---
id: https://w3id.org/databook/specs/cli-conventions-v1
title: "DataBook CLI: Cross-Cutting Conventions v1.0"
type: databook
version: 1.0.0
created: 2026-04-22
author:
  - name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator
  - name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: transformer
license: CC-BY-4.0
subject:
  - DataBook CLI
  - conventions
  - POSIX compliance
  - processors.toml
description: >
  Cross-cutting conventions for the DataBook CLI toolchain. Covers the four
  architectural principles, POSIX stdin/stdout compliance, common flags,
  fragment addressing, universal parameterisation, processors.toml schema,
  and exit code conventions. All command specs reference this document rather
  than restating these conventions individually.
process:
  transformer: "Claude Sonnet 4.6"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-4-6
  inputs:
    - iri: urn:input:design-session-2026-04-22
      role: primary
      description: "Design session transcript: CLI conventions"
  timestamp: 2026-04-22T00:00:00Z
  agent:
    name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: orchestrator
---

</script>

# DataBook CLI — Cross-Cutting Conventions v1.0

This document defines conventions that apply uniformly across all DataBook CLI
commands. Individual command specs reference this document by section rather
than restating these conventions. Where a command deviates from a convention,
the deviation is explicitly noted in that command's spec.

---