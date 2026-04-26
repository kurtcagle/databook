# DataBook LLM Skill

This directory contains a **skill file** for large language models — specifically Claude — that enables any LLM with access to a skill-loading mechanism to work correctly and efficiently with the DataBook format.

## What Is a Skill File?

A skill file is a structured Markdown document that gives an LLM authoritative, compact guidance on a specific domain or format. Rather than relying on training data that may be incomplete or outdated, the skill file is loaded at runtime into the model's context, providing:

- The canonical spec summary (structure, conventions, vocabulary)
- Worked examples of correct and incorrect patterns
- Decision tables for common authoring choices
- Validation checklists
- Integration notes (HGA layer mapping, pipeline semantics)

Skill files follow a lightweight convention: YAML frontmatter identifying the skill, followed by structured Markdown sections the model uses as a reference. They are human-readable and version-controlled alongside the spec they describe.

## File

[llm-skills/databook/SKILL.md](SKILL.md)

## How to Use It

### With Claude (claude.ai or API)

Upload `SKILL.md` as a document attachment before asking Claude to work with DataBooks. Claude will use it as a live reference for the session.

Alternatively, if you are building on the Anthropic API, you can inject the skill file as a `document` block in the system prompt or first user turn:

```javascript
{
  role: "user",
  content: [
    {
      type: "document",
      source: {
        type: "text",
        media_type: "text/plain",
        data: skillFileContents
      },
      title: "DataBook Skill",
      context: "Use this as your authoritative reference for all DataBook operations in this session."
    },
    {
      type: "text",
      text: "Your prompt here."
    }
  ]
}
```

### With Other LLMs

The skill file is plain Markdown and works as a context injection with any model that supports document or system-prompt injection. Prepend the contents to your system prompt, or include it as a retrieved document in a RAG pipeline.

## What the Skill Covers

| Section | Content |
|---|---|
| Quick Orientation | Task routing table — which section to use for which operation |
| Creating DataBooks | Minimum viable structure, document type vocabulary, standard workflow |
| Frontmatter Reference | All required and recommended fields, graph metadata, process stamp |
| Fenced Block Types | Labels, `databook:id` conventions, all block-level comment keys |
| Manifests | `build:` vocabulary, pipeline stage declarations, DAG execution |
| Transformer Libraries | Named reusable transforms, `build:NamedTransform` pattern |
| Processor Registries | Named processors, capability declarations, `build:Processor` pattern |
| Parameterised Queries | `databook:param` syntax, VALUES substitution, block naming conventions |
| Validation Checklist | Pre-publish checks for structure, metadata, graph consistency, block conventions |
| HGA Integration Notes | DataBook ↔ holonic graph layer mapping (scene / domain / context) |
| Admonitions | Blockquote convention: Note, Warning, Deprecated, Example, See also, Important |

## Versioning

The skill file tracks the DataBook spec version it describes. The current skill targets **DataBook spec v1.1**.

When the spec advances, the skill file will be updated in the same pull request as the spec changes that affect LLM-observable behaviour (new fields, new block types, changed conventions). Patch changes that don't affect authoring behaviour (clarifications, examples) may update the skill independently.

## Contributing

If you find the skill file gives incorrect guidance, produces invalid DataBooks, or misses a common authoring pattern, please open an issue or PR. The goal is for any LLM using this skill to produce spec-compliant DataBooks on the first attempt without needing correction.

## Relationship to the Spec

The skill file is *derived from* the spec, not authoritative over it. In any conflict between the skill file and [`README.md`](../../README.md) or the formal spec documents, the spec takes precedence. The skill file is optimised for LLM consumption — compact, example-heavy, decision-table-oriented — rather than for human reference, where the full spec is more appropriate.
