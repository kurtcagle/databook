<script language="application/yaml">

---
id: https://w3id.org/databook/test/pre-v1-legacy
title: "Legacy v1.0 Script-Wrapped Frontmatter Test"
type: databook
version: 1.0.0
created: 2026-04-25
description: >
  Tests the <script language="application/yaml"> frontmatter form
  that was canonical in DataBook v1.0 and is an accepted alternative in v1.1.
  Parsers must accept this form for backwards compatibility.
process:
  transformer: human
  transformer_type: human
  inputs: []
  timestamp: 2026-04-25T12:00:00Z
---

</script>

# Legacy v1.0 Format Test

This DataBook uses the `<script language="application/yaml">` frontmatter form that was canonical in DataBook v1.0. In v1.1, bare `---` frontmatter is canonical, but parsers must accept this form for backwards compatibility.

```turtle
<!-- databook:id: legacy-graph -->
@prefix ex: <https://example.org/> .
ex:LegacyThing a ex:Class ;
    ex:label "Legacy format test"@en .
```
