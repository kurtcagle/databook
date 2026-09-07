---
id: https://w3id.org/holon/databook/primer
title: "The DataBook Specification — A Primer for the HCG DataBook Working Group"
type: databook
version: 1.1.2
created: 2026-09-07
author:
  - name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator
  - name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: transformer
license: CC-BY-4.0
domain: https://w3id.org/holon/databook#
subject:
  - DataBook specification
  - YAML frontmatter
  - SHACL 1.2
  - RDF 1.2
  - provenance
  - W3C Holon Community Group
tags:
  - databook
  - primer
  - hcg
  - databook-wg
  - shacl
  - v2-candidate
description: >
  A definitive primer on the DataBook specification as it stands on
  2026-09-07, written as a DataBook for the W3C Holon Community Group's
  DataBook Working Group. It consolidates three layers that currently live
  in three places: the canonical v1.1 specification (SPEC.md), the v1.2
  block-header and directive conventions that are implemented in the
  reference CLI but not yet ratified in SPEC.md, and the v2.0 candidate
  header module (the databook: bridge namespace and its SHACL 1.2 shapes).
  Every frontmatter term is given its definition, YAML usage, RDF
  projection, cardinality, and SHACL signature; every fenced block in this
  document carries a pre-fence header and is itself a worked example of the
  conventions it describes. The primary data block is the RDF projection of
  a complete example header, validated against the candidate shapes graph
  with pyshacl before publication. Version 1.1.0 adds the profile model:
  the holon architecture becomes one profile among several, the header
  projection is proposed for re-homing from the holon namespace to a
  DataBook-owned one, and the extension points a profile may use are named.
imports:
  - https://w3id.org/holon/databook#
shapes:
  - https://w3id.org/holon/databook#DataBookHeaderShape
  - https://w3id.org/holon/databook#AuthorStampShape
  - https://w3id.org/holon/databook#GraphMetadataShape
  - https://w3id.org/holon/databook#ProcessStampShape
  - https://w3id.org/holon/databook#ProcessInputShape
  - https://w3id.org/holon/databook#AgentStampShape
  - https://w3id.org/holon/databook#OutputSpecShape
graph:
  namespace: https://w3id.org/holon/databook#
  named_graph: https://w3id.org/holon/databook/primer#graph
  triple_count: 66
  subjects: 9
  rdf_version: "1.1"
  turtle_version: "1.1"
  reification: false
  validator_note: >
    The primary data block (header-projection-example) was parsed with
    rdflib 7.6.0 and validated with pyshacl 0.40.1 against the 738-triple
    candidate shapes graph (https://w3id.org/holon/databook#, version
    2.0.0-alpha.1). Result: conforms. The document also carries a
    deliberately non-conforming header (mode=reference) together with the
    real validation report it produces. All other Turtle/SHACL blocks are
    documentation excerpts marked mode=printed and are not payloads.
process:
  transformer: "Claude Sonnet 5"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-5
  inputs:
    - iri: https://w3id.org/holon/databook#
      block_id: holon-databook-header-shapes
      role: constraint
      description: "Holon DataBook Header Shapes (SHACL 1.2), v2.0.0-alpha.1 — the candidate v2.0 header module; source of every term, definition, and SHACL signature reproduced here."
    - iri: https://github.com/kurtcagle/databook/blob/main/SPEC.md
      role: reference
      description: "DataBook Format Reference v1.1 (2026-04-25) — the canonical published specification."
    - iri: https://github.com/kurtcagle/databook/blob/main/CHANGELOG.md
      role: reference
      description: "Specification and CLI changelog, used to establish what is formally ratified versus in-practice."
    - iri: https://github.com/kurtcagle/databook/blob/main/databook-property-reference.databook.md
      role: reference
      description: "Canonical build: (db:) namespace property reference, cited by the shapes module as its field inventory."
    - iri: https://www.w3.org/TR/2026/WD-shacl12-core-20260803/
      role: constraint
      description: "SHACL 1.2 Core Working Draft — normative source for sh:codeIdentifier, sh:declare, and property-shape IRI conventions."
  timestamp: 2026-09-07T19:45:00Z
  agent:
    name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator
  note: >
    Prose and example selection are LLM-generated under human direction and
    are therefore non-deterministic; the SHACL signatures are reproduced
    verbatim from the candidate shapes module, not paraphrased. Term
    definitions were cross-checked against SPEC.md v1.1 and, where the two
    sources differ, the difference is stated rather than silently resolved.
    v1.1.0 (same day): §4 replaced by the profile model and §2.1, §8, §9,
    §14–§18 revised to match; the machine-readable blocks deliberately keep
    the published namespace so every validation claim stays reproducible.
    v1.1.1 (same day): corrected an overstatement — the reference CLI
    implements the pre-fence header zone but not block directives; running
    its parser on this document leaves 18 of 19 blocks anonymous, because a
    trailing directive line terminates the parser's backward walk. §1, §8,
    §16 and §17 now say so. v1.1.2 (same day): that parser defect is fixed
    in the reference CLI; §8.7 records the fix.
  output_format: turtle
  output_media_type: text/turtle
---

# The DataBook Specification — A Primer for the HCG DataBook Working Group

## 1. Purpose, audience, and how to read this document

This primer is for members of the W3C Holon Community Group's DataBook
Working Group who need one authoritative account of what the DataBook
specification currently says, what it is about to say, and where those two
things differ. It is deliberately exhaustive: every frontmatter term is
defined, every controlled vocabulary is enumerated, every SHACL signature is
reproduced, and every claim about parser behaviour is stated as a rule
rather than a suggestion.

The specification does not, at the time of writing, live in one place. It
lives in three, and much of the confusion the WG will have to resolve comes
from that. This document tags every rule with the layer it belongs to:

| Tag | Meaning | Where it lives today |
|---|---|---|
| **[v1.1]** | Canonical, published, ratified | `SPEC.md` in the `kurtcagle/databook` repository, dated 2026-04-25 |
| **[v1.2]** | In daily use, but not yet written into `SPEC.md` | The reference CLI (`lib/parser.js`) parses the pre-fence header zone and, since 2026-09-07, directive lines; it does not yet *act* on `mode` (§8.7) |
| **[v2.0]** | Proposed; offered to the WG for review | The header shapes module at `https://w3id.org/holon/databook#`, version 2.0.0-alpha.1 |
| **[proposed]** | Proposed in this primer, 2026-09-07; in no published artefact | The profile model (§4) and everything it touches |

Where a **[v1.2]** convention supersedes a **[v1.1]** one, both are shown
and the supersession is stated. Where a **[v2.0]** proposal changes the
meaning of a **[v1.1]** term, the change is called out. Where a
**[proposed]** rule would change a **[v2.0]** artefact, the artefact is left
as published and the change is described. §16 collects every decision the
WG needs to make into one list.

> **Note:** This document is itself a DataBook and follows every convention
> it describes. Its own frontmatter above is a live example of §5; every
> fenced block below carries a pre-fence header (§8); its primary data block
> is the RDF projection of the worked example (§13) and was validated against
> the candidate shapes before publication. Where the document has to *show*
> a fenced block inside prose, it uses an indented code block rather than a
> nested fence, for the reason given in §8.6.

## 2. What a DataBook is

A DataBook is a Markdown document constructed so that it can be read three
ways at once, without any of the three readings interfering with the others:

1. **A human-readable document.** Prose, headings, tables, admonitions. A
   plain Markdown renderer shows all of it and shows the data blocks as code.
2. **A typed data container.** Fenced blocks — as many as needed, or none —
   whose label (`turtle`, `sparql`, `shacl`, `manifest`, `prompt`, …) tells a
   DataBook-aware processor how to route each payload.
3. **A self-describing semantic artefact.** YAML frontmatter that states the
   document's identity, its descriptive metadata, what graph it carries, and
   the full provenance of how it was produced.

The frame that makes the design coherent is the **microdatabase**: a
container for content that is too small and too task-specific to justify an
indexed triple store, but too structured and too important to be a plain
file. Pipeline intermediates, configuration graphs, shape libraries,
taxonomy fragments, session records, named-query catalogues, archival
snapshots — anything that falls below the indexing threshold but above the
"just a file" threshold.

### 2.1 Readings, and profiles **[proposed]**

The three readings above are what *every* DataBook offers. On top of them,
a **profile** (§4) adds the conventions of one architecture or one
community: what the frontmatter means in that setting, which additional
keys, block labels, and directives are in play, and which further shapes the
document must satisfy. The Holon Graph Architecture supplies one such
profile — it reads the three layers of a DataBook as the three layers of a
holon (§4.6) — and it is one profile among several the WG should expect,
not the format's definition. A DataBook that declares no profile is a core
DataBook, and everything in §3 and §5–§12 applies to it unchanged.

### 2.2 When to use one, and when not to **[v1.1]**

| Data scale | Appropriate store | DataBook? |
|---|---|---|
| < 10K triples, task-specific | DataBook | Yes |
| < 10K triples, persistent reference | DataBook or named graph | Probably |
| 10K–1M triples, frequently queried | Triple store | No |
| > 1M triples | Indexed triple store | No |
| Pipeline intermediate, any size | DataBook for the stage output | Yes |
| Archival snapshot, infrequently queried | DataBook or graph archive | Yes |

Do not use a DataBook for production-scale graph data, real-time query
endpoints, data needing frequent partial updates, or content that will only
ever be consumed by systems with no DataBook parser.

## 3. Anatomy of a DataBook

A DataBook has exactly two zones, in this order. The first is mandatory;
the second may contain any number of fenced data blocks, including none:

    [YAML frontmatter block]          — identity, metadata, provenance (§5)
    [prose and fenced blocks, mixed]  — zero or more fenced data blocks (§7)

A document with frontmatter but no data block is still a DataBook; a
document without the frontmatter is Markdown. The frontmatter is what makes
a DataBook a DataBook — a self-describing, provenance-stamped, addressable
document — whether or not it carries a typed payload. A pure-prose DataBook
is a legitimate artefact: a specification, a report, a meeting record, each
with identity and a process stamp, and each citable through
`process.inputs[]` by the DataBooks that build on it.

> **Note:** This reverses SPEC.md v1.1 §4, which says "pure prose documents
> without a data block are not DataBooks; use plain Markdown." The rule
> stated here is the editors' current position and is item 13 in §16. Until
> `SPEC.md` is updated, a strict v1.1 parser may reject a DataBook with no
> data block; a v2.0-conformant parser must accept one.

### 3.1 File conventions **[v1.1]**

- **Extension:** `.databook.md`. The `.md` keeps every Markdown renderer
  happy; the `.databook` infix signals DataBook-aware tooling. Either alone
  is acceptable where the context makes it obvious; the double extension is
  canonical.
- **Naming:** kebab-case, reflecting content identity, not creation date.
  Versions belong in the `version` field and, if pinning is needed, in the
  IRI — not in the filename.
- **Identity:** every DataBook carries a stable, ideally dereferenceable IRI
  in `id`. The filename is a local convenience; the IRI is the identity.
- **Versioning:** semantic. PATCH = prose or metadata only; MINOR = blocks
  added, existing block IDs preserved; MAJOR = existing `databook:id` values
  may be removed or renamed, so consumers pinning a version IRI must not
  silently cross the boundary.

### 3.2 The frontmatter block **[v1.1, canonical since 1.1]**

The frontmatter is a bare `---`-delimited YAML block at the very start of
the file. The opening `---` is the first line; nothing precedes it, not even
a blank line. The closing `---` is on its own line. Everything between is
well-formed YAML.

> **Important:** The `<script language="application/yaml">` wrapper was
> canonical in v1.0 and is still an *accepted* input form — a conformant
> parser must read it — but it must never be *emitted*. It does not render in
> GitHub or in Claude's Markdown renderer, and standard frontmatter parsers
> ignore it. Bare `---` is the only form a producer should write.

### 3.3 The body **[v1.1]**

There is no mandatory ordering in the body. The conventional and
recommended order is: overview prose → primary data block(s) → query blocks
→ usage prose → validation notes → manifest block (if any). This document
follows that order.

### 3.4 The block, and its header zone **[v1.2]**

A fenced block is a standard triple-backtick fence with a label:

    <!-- databook:id: my-block -->
    <!-- databook:label: What this block is for -->
    <!-- mode=printed -->
    ```turtle
    ... payload ...
    ```

The three comment lines *immediately before* the opening fence form the
**pre-fence comment zone**, the block's header. It is invisible to ordinary
Markdown renderers and is the only place block-level metadata and processing
directives live in v1.2. §8 is the full reference; the point to fix in mind
now is that the fence contents are pure payload.

## 4. Profiles, and the namespaces they own **[proposed]**

The DataBook format has, until now, been specified with one architecture in
mind. Most of the specification never noticed — the frontmatter, the process
stamp, the block mechanics, the manifest pattern are all indifferent to what
the data is *for* — but two decisions were made as if the Holon Graph
Architecture were the only consumer, and one of them is a namespace that is
about to be adopted. This section proposes the profile model that the WG
should adopt instead, and re-homes that namespace before anything depends
on it.

> **Note:** Everything in this section is tagged **[proposed]**: it was
> drafted for this primer on 2026-09-07 and appears in no published artefact
> yet. The machine-readable material in §5 and §13 still uses the namespace
> as currently published, so that every validation claim in this document
> remains true of the shapes graph that actually exists. §4.5 says exactly
> what a re-home changes.

### 4.1 What a profile is

The word is overloaded. OWL 2 profiles are *restrictions* of a language.
JSON-LD profiles are media-type parameters. Dublin Core *application*
profiles are constraints plus extensions on a base vocabulary for one
community's use. The DataBook sense is the last of these:

> A **DataBook profile** is a named, IRI-identified set of (a) additional or
> tightened constraints on the core specification, (b) additional
> vocabularies — frontmatter keys, block labels, directive keys, comment-key
> prefixes, document types — and (c) conventions for how a community reads
> and processes a DataBook, such that **conformance to the profile implies
> conformance to core.**

The final clause is the whole design. Profiles may **tighten** (make an
optional key required, narrow an enumeration, add shapes) and **extend**
(add keys, labels, directives, types in their own namespace). They may
never **relax** a core constraint or **reinterpret** a core term. That
one rule is what guarantees that a DataBook written under an OKF profile is
loadable, addressable, and provenance-walkable by a holon-aware tool, and
vice versa — the processor simply ignores the profile it does not
understand and treats the document as core.

### 4.2 Declaring conformance: `profiles[]`

A core frontmatter key, listing the IRIs of every profile the document
claims to conform to, in no particular order. Omitting it, or an empty
list, means core only.

<!-- databook:id: yaml-profiles-key -->
<!-- databook:label: Declaring profile conformance in frontmatter -->
<!-- mode=printed -->
```yaml
profiles:
  - https://w3id.org/holon/databook#
  - https://w3id.org/databook/profiles/encryption
```

Proposed projection: `databook:profile`, `sh:nodeKind sh:IRI`, `0..*`, on
`DataBookHeader`. It has no shape in the 2.0.0-alpha.1 module (§5.9) and
is item 14 in §16.

### 4.3 Extension points

Core states where a profile may add things. Nowhere else is extensible.

| Extension point | Core provides | A profile may |
|---|---|---|
| Frontmatter keys | §5, reserved names | Add keys under its own namespace or declared by its descriptor; tighten cardinality or enumerations of core keys |
| Document types (`type`) | The three §6.1 values | Add a type, as a class `rdfs:subClassOf databook:DataBookHeader` in its namespace (§16 item 8) |
| Block labels (§7) | The base vocabulary; unknown = display | Register labels; a processor without the profile still displays them |
| Directive keys (§8.3) | `mode` and its five fixed values; the six other keys | Add directive *keys*; may not add `mode` values |
| Comment-key prefixes (§8.2) | `databook:` | Declare a prefix of its own, e.g. `<!-- holon:layer: L2 -->` |
| Shapes | The seven §5 node shapes | Add node shapes targeting the same classes; SHACL applies both |
| Parser behaviour (§15) | The core contract | Add behaviours; may not remove or weaken core ones |

The `mode` values are deliberately closed. A profile that needs "execute,
but through my pipeline" declares an `endpoint=` or a directive key of its
own, not a sixth mode.

### 4.4 Describing a profile

A profile is described with the W3C **Profiles Vocabulary (PROF)** — a
`prof:Profile` that `prof:isProfileOf` core and lists its resources by role:
schema, vocabulary, guidance, examples, validation. Because a profile
descriptor is a small RDF graph with prose around it, it is naturally itself
a DataBook, and the profile's IRI is that DataBook's `id`.

<!-- databook:id: prof-holon-profile-descriptor -->
<!-- databook:label: PROF descriptor for core and for the holon profile (illustrative) -->
<!-- mode=printed -->
```turtle
@prefix prof:    <http://www.w3.org/ns/dx/prof/> .
@prefix role:    <http://www.w3.org/ns/dx/prof/role/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

# The DataBook core, as the thing profiles are profiles of.
<https://w3id.org/databook/>
    a prof:Profile ;
    dcterms:title "DataBook core"@en ;
    prof:hasToken "databook-core" ;
    prof:hasResource
        [ a prof:ResourceDescriptor ;
          prof:hasRole role:specification ;
          dcterms:format "text/markdown" ;
          prof:hasArtifact <https://github.com/kurtcagle/databook/blob/main/SPEC.md> ] ,
        [ a prof:ResourceDescriptor ;
          prof:hasRole role:schema ;
          dcterms:format "text/turtle" ;
          prof:hasArtifact <https://w3id.org/databook/header#> ] .

# The holon profile: everything the Holon Graph Architecture adds.
<https://w3id.org/holon/databook#>
    a prof:Profile ;
    dcterms:title "Holon profile of DataBook"@en ;
    prof:hasToken "holon" ;
    prof:isProfileOf <https://w3id.org/databook/> ;
    prof:hasResource
        [ a prof:ResourceDescriptor ;
          prof:hasRole role:schema ;
          dcterms:format "text/turtle" ;
          dcterms:description "Additional SHACL shapes: the L3 context-layer link and any holon-required keys."@en ;
          prof:hasArtifact <https://w3id.org/holon/databook#shapes> ] ,
        [ a prof:ResourceDescriptor ;
          prof:hasRole role:guidance ;
          dcterms:format "text/markdown" ;
          dcterms:description "The holonic reading (L1/L2/L3), HGA mode patterns, and authority conventions."@en ;
          prof:hasArtifact <https://w3id.org/holon/databook/primer#the-holon-profile> ] .
```

### 4.5 The namespaces, revised

| Prefix | Namespace | Owner | Role | Status |
|---|---|---|---|---|
| `build:` | `https://w3id.org/databook/ns#` | DataBook WG (core) | The **pipeline vocabulary**: `build:Target`, `build:Stage`, `build:dependsOn`, and the rest of §11. | **[v1.1]** canonical |
| `db:` | `https://w3id.org/databook/ns#` | — | Alias prefix for the same namespace, used in the shapes module's `sh:declare`. Pick one (§16 item 6). | alias |
| `databook:` | **today:** `https://w3id.org/holon/databook#` | as published: personal repo; framed as a holon bridge | The **header projection**: every term in §5. | **[v2.0]** 2.0.0-alpha.1 |
| `databook:` | **proposed:** `https://w3id.org/databook/header#` | DataBook WG (core) | The same header projection, re-homed as core. Prefix unchanged. | **[proposed]** |
| *(none needed)* | `https://w3id.org/holon/databook#` | Holon CG (holon profile) | Re-purposed as the **holon profile's** IRI and module: the PROF descriptor, the L3 link (`rdfs:subClassOf holon:ContextLayer` or equivalent), any holon-required keys and shapes. | **[proposed]** |
| `holon:` | `https://ontologist.io/ns/holon#` | Holon CG | The core HGA ontology. Never a DataBook namespace. | out of scope |
| *(TBD)* | *(TBD)* | OKF's editors | An OKF profile, should one be defined: its own keys, labels, and shapes under its own namespace. | anticipated |

The Aug 24 argument for a namespace *separate from the core holon ontology*
was right and still stands — keep DataBook-spec churn and generic names like
`title`, `version`, `role`, `timestamp` out of `holon:`. The conclusion drawn
from it was "so put the header module under `holon/`, at arm's length from
the core terms." Under a profile model the conclusion is different: the
header projection is what *every* DataBook does, so it is not holon's to
house at all. It belongs under `https://w3id.org/databook/`, beside the
pipeline vocabulary, owned by the same working group.

**What a re-home changes.** One line. The shapes module, this primer's
payload, and every DataBook projection written so far share a single
`@prefix databook: <https://w3id.org/holon/databook#> .` declaration; the
prefix stays, the IRI behind it changes. The `owl:priorVersion` chain
records the move. And the old IRI is not wasted: it becomes the natural home
of the holon profile itself, which is what it was always describing.

### 4.6 The holon profile

What the Holon Graph Architecture adds when a DataBook declares
`https://w3id.org/holon/databook#`. Everything here was, in earlier drafts,
presented as core; it is not.

**The holonic reading.** The three readings of §2 are the three layers of a
holon:

| DataBook layer | HGA layer | Function |
|---|---|---|
| YAML frontmatter | **L3 — context / boundary** | Identity, boundary conditions, provenance |
| Fenced data blocks | **L2 — domain** | The holon's internal graph reality |
| Prose | **L1 — scene** | The human-facing projection |

A DataBook is a holon in the strict sense — whole (self-contained,
self-describing, addressable) and part (composable through
`process.inputs`, `build:dependsOn`, and fragment IRIs). The header
projection is what makes the L3 reading literal: the boundary layer becomes
queryable with the same SPARQL as the domain layer. The profile's schema
resource asserts that link — a single `rdfs:subClassOf` from
`databook:DataBookHeader` to the core ontology's context-layer class — and
nothing more.

**Mode patterns.** The profile's guidance names canonical uses of the core
directives: `mode=hidden` for Pass 1 entity-grounding output;
`mode=hidden authority=<IRI>` for provenance trails and intermediate results;
`mode=executed endpoint=<IRI>` for live queries against a named store;
`mode=rendered` for cartographer depiction output; `mode=reference` for
supporting ontology fragments and prior shape versions.

**Authority.** The core `authority=<IRI>` directive names who asserts a
block. The holon profile gives that a semantics — different authorities
contributing blocks to one DataBook with different trust weights in the
architecture's frame system. Core defines the key; the profile defines what
a processor does with it.

### 4.7 Encryption, the profile that already exists

SPEC.md §13 reserves the `encryption` key and the `encrypted*` block labels
and states the parser contract for a processor that does or does not
support decryption. It calls itself "a profile on top of core, not a
required feature." It is the first DataBook profile, and its handling of the
unaware processor — skip the block, no error — is the model for every
profile's degradation rule.

### 4.8 Governance

Core is owned by the DataBook WG. Each profile is owned by whoever defines
it: the Holon CG for the holon profile, OKF's editors for an OKF profile,
and so on. A profile is published as a DataBook whose primary block is its
PROF descriptor; the WG maintains a registry of profile IRIs — itself a
small DataBook — so that a processor can resolve `profiles[]` to the
resources it needs. This is also the mechanism by which communities with
DataBook-shaped requirements of their own adopt the format without forking
it: they write a profile, not a variant.

## 5. Frontmatter term reference

This is the core of the primer. Each subsection covers one class in the
**[v2.0]** header module — one node in the RDF projection of the frontmatter —
and for every term gives: the YAML key, the RDF predicate it projects to,
its datatype or node kind, its cardinality, any value constraint, and its
status. Each subsection ends with the class's SHACL signature, reproduced
verbatim from the candidate shapes module so that the WG is reviewing the
real constraint, not a paraphrase.

Three conventions run through every table:

- **Code identifier.** Every property shape carries `sh:codeIdentifier`, the
  literal YAML key path. Dot-notation addresses nested keys
  (`process.timestamp`); a trailing `[]` marks a YAML sequence
  (`author[]`, `process.inputs[]`). A generic YAML→RDF mapper resolves each
  identifier against the parsed frontmatter with a plain path-get and asserts
  the corresponding `sh:path`. This is what makes the shapes graph a
  *mapping specification* and not only a validator.
- **Cardinality** is written `min..max`, with `*` for unbounded. `1..1` is
  required and single-valued; `0..1` optional and single-valued; `0..*`
  optional and repeatable; `1..*` required and repeatable.
- **Status** is **[v1.1]** where SPEC.md defines the key, **[v2.0]** where the
  shapes module adds constraints SPEC.md does not state, and both where the
  two agree.

> **Note:** Every signature below uses `https://w3id.org/holon/databook#`,
> the namespace as published. Under the re-home proposed in §4.5 only the
> `@prefix databook:` line changes; nothing else in this section does.

### 5.1 `databook:DataBookHeader` — the document itself

The header node *is* the DataBook, addressed by the DataBook's own `id`.
It carries the identity and descriptive fields directly, and reaches the
graph metadata and the process stamp through object properties. It is
`rdfs:subClassOf prov:Entity`.

**The `id` field is the one frontmatter key with no property shape.** It
supplies the header node's subject IRI — `@id` in JSON-LD terms — rather
than a predicate value. A mapper reads `id` first, mints the node, and then
attaches every other key to it.

**The `type` field maps to `rdf:type`,** not to a `databook:` predicate.
Its three permitted YAML values correspond to three classes, and
`DataBookHeaderShape` targets all three:

| YAML `type` | RDF class | Meaning |
|---|---|---|
| `databook` | `databook:DataBookHeader` | Standard DataBook carrying domain data, queries, or prompts |
| `transformer-library` | `databook:TransformerLibraryHeader` | Catalogue of named, reusable transforms (§11.2) |
| `processor-registry` | `databook:ProcessorRegistryHeader` | Catalogue of named processors with capability declarations (§11.3) |

#### 5.1.1 Identity group (`sh:group databook:IdentityPropertyGroup`)

| YAML key | Predicate | Type | Card. | Constraint | Status |
|---|---|---|---|---|---|
| `id` | *(subject IRI)* | IRI | 1..1 | Stable, globally unique, ideally dereferenceable | [v1.1] |
| `type` | `rdf:type` | IRI | 1..1 | `sh:in` the three classes above | [v1.1] [v2.0] |
| `title` | `databook:title` | `xsd:string` | 1..1 | `sh:minLength 1`; quote in YAML if it contains a colon | [v1.1] [v2.0] |
| `version` | `databook:version` | `xsd:string` | 1..1 | Full semver, including pre-release and build metadata (see note) | [v1.1] [v2.0] |
| `created` | `databook:created` | `xsd:date` | 1..1 | `YYYY-MM-DD` | [v1.1] [v2.0] |

> **Note:** The `version` pattern was broadened in the 2.0.0-alpha.1 rework.
> The earlier draft enforced strict `MAJOR.MINOR.PATCH` and would have
> rejected the shapes module's own `2.0.0-alpha.1`. The current pattern is
> `^\d+\.\d+\.\d+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$`
> — SemVer 2.0.0 in full. `sh:message` still says "MAJOR.MINOR.PATCH" for
> brevity; the WG may wish to align the message with the pattern (§16).

#### 5.1.2 Descriptive group (`sh:group databook:DescriptivePropertyGroup`)

| YAML key | Predicate | Type | Card. | Constraint | Status |
|---|---|---|---|---|---|
| `description` | `databook:description` | `xsd:string` | 0..1 | One-paragraph catalogue abstract; distinct from body prose | [v1.1] [v2.0] |
| `author[]` | `databook:author` | node → `AuthorStampShape` | 0..* | Each entry is a §5.2 node | [v1.1] [v2.0] |
| `license` | `databook:license` | `xsd:string` **or** IRI | 0..1 | `sh:or ( string, IRI )` — SPDX identifier or licence IRI | [v1.1] [v2.0] |
| `domain` | `databook:domain` | IRI | 0..1 | Primary ontology namespace the data blocks instantiate | [v1.1] [v2.0] |
| `subject[]` | `databook:subject` | `xsd:string` | 0..* | Free-text terms for catalogue *search* | [v1.1] [v2.0] |
| `tags[]` | `databook:tag` | `xsd:string` | 0..* | Short labels for faceted *filtering* — distinct from `subject` | [v2.0] |
| `publisher` | `databook:publisher` | `xsd:string` **or** IRI | 0..1 | `sh:or ( string, IRI )` | [v2.0] |
| `imports[]` | `databook:imports` | IRI | 0..* | Other DataBooks whose prefix declarations and namespace context this one inherits (§9.3) | [v2.0] |
| `shapes[]` | `databook:shapes` | IRI | 0..* | SHACL shapes the data is *expected* to conform to. Informational; not enforced at the DataBook level (§9.5) | [v1.1] [v2.0] |
| `profiles[]` | `databook:profile` *(proposed)* | IRI | 0..* | Profiles the document claims conformance to (§4.2); omitted means core only | **[proposed]** — no shape yet |

> **Note:** `tags`, `publisher`, and `imports` are **[v2.0]** additions with
> no entry in SPEC.md v1.1's property table. SPEC.md does not forbid them —
> "properties not listed here may be used freely" — but they need to be
> written into the v2.0 spec text, not only into the shapes.

#### 5.1.3 Graph and process links

| YAML key | Predicate | Type | Card. | Constraint | Status |
|---|---|---|---|---|---|
| `graph` | `databook:graph` | node → `GraphMetadataShape` | 0..1 | §5.3 | [v1.1] [v2.0] |
| `process` | `databook:process` | node → `ProcessStampShape` | **1..1** | §5.4 — **required** | [v1.1] [v2.0] |

> **Important:** SPEC.md v1.1 makes `process` "required if data was produced
> by any transformer" and notes that human authoring is a transformer. The
> **[v2.0]** shape makes it unconditionally `sh:minCount 1`. A header without
> a process stamp fails validation. This is a deliberate tightening: a
> DataBook with unknown provenance is worse than one with an imprecise stamp.

#### 5.1.4 YAML form

<!-- databook:id: yaml-header-identity-descriptive -->
<!-- databook:label: Identity and descriptive frontmatter for the worked example -->
<!-- mode=printed -->
```yaml
id: https://example.org/databooks/sensor-catalogue-v1
title: "Example Observatory Sensor Catalogue"
type: databook
version: 1.2.0
created: 2026-09-07
description: >
  A worked example used throughout the DataBook v2.0 primer: a small
  catalogue of sensors at a fictional observatory.
author:
  - name: Kurt Cagle
    iri: https://holongraph.com/people/kurt-cagle
    role: orchestrator
  - name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: transformer
license: CC-BY-4.0
domain: https://example.org/ontology/sensor#
subject:
  - sensor metadata
  - observatory operations
tags:
  - example
  - primer
  - sosa
publisher: Example Observatory Consortium
imports:
  - https://example.org/databooks/sensor-ontology-v2
shapes:
  - https://example.org/shapes/SensorShape
  - https://example.org/shapes/ObservationShape
```

#### 5.1.5 RDF projection (excerpt)

<!-- databook:id: rdf-header-excerpt -->
<!-- databook:label: Header node projection, identity and descriptive terms only -->
<!-- mode=printed -->
```turtle
@prefix databook: <https://w3id.org/holon/databook#> .
@prefix xsd:      <http://www.w3.org/2001/XMLSchema#> .
@prefix ex:       <https://example.org/databooks/> .
@prefix exsh:     <https://example.org/shapes/> .

ex:sensor-catalogue-v1
    a databook:DataBookHeader ;                       # from `type: databook`
    databook:title       "Example Observatory Sensor Catalogue" ;
    databook:version     "1.2.0" ;
    databook:created     "2026-09-07"^^xsd:date ;
    databook:license     "CC-BY-4.0" ;
    databook:domain      <https://example.org/ontology/sensor#> ;
    databook:subject     "sensor metadata" , "observatory operations" ;
    databook:tag         "example" , "primer" , "sosa" ;
    databook:publisher   "Example Observatory Consortium" ;
    databook:imports     ex:sensor-ontology-v2 ;
    databook:shapes      exsh:SensorShape , exsh:ObservationShape .
```

#### 5.1.6 SHACL signature

<!-- databook:id: shacl-databook-header-shape -->
<!-- databook:label: databook:DataBookHeaderShape and its fifteen property shapes -->
<!-- mode=printed -->
```shacl
@prefix databook: <https://w3id.org/holon/databook#> .
@prefix sh:       <http://www.w3.org/ns/shacl#> .
@prefix xsd:      <http://www.w3.org/2001/XMLSchema#> .
@prefix rdf:      <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:     <http://www.w3.org/2000/01/rdf-schema#> .

databook:IdentityPropertyGroup    a sh:PropertyGroup ; sh:name "Identity"@en ;           sh:order 1 .
databook:DescriptivePropertyGroup a sh:PropertyGroup ; sh:name "Descriptive"@en ;        sh:order 2 .
databook:GraphPropertyGroup       a sh:PropertyGroup ; sh:name "Graph Metadata"@en ;     sh:order 3 .
databook:ProcessPropertyGroup     a sh:PropertyGroup ; sh:name "Process Provenance"@en ; sh:order 4 .

databook:DataBookHeaderShape
    a sh:NodeShape ;
    rdfs:label "DataBook Header Shape"@en ;
    sh:targetClass databook:DataBookHeader , databook:TransformerLibraryHeader , databook:ProcessorRegistryHeader ;
    sh:property
        databook:DataBookHeaderShape-type ,
        databook:DataBookHeaderShape-title ,
        databook:DataBookHeaderShape-version ,
        databook:DataBookHeaderShape-created ,
        databook:DataBookHeaderShape-description ,
        databook:DataBookHeaderShape-author ,
        databook:DataBookHeaderShape-license ,
        databook:DataBookHeaderShape-domain ,
        databook:DataBookHeaderShape-subject ,
        databook:DataBookHeaderShape-tag ,
        databook:DataBookHeaderShape-publisher ,
        databook:DataBookHeaderShape-imports ,
        databook:DataBookHeaderShape-shapes ,
        databook:DataBookHeaderShape-graph ,
        databook:DataBookHeaderShape-process .

databook:DataBookHeaderShape-type
    a sh:PropertyShape ;
    sh:path rdf:type ;
    sh:name "document type"@en ;
    sh:codeIdentifier "type" ;
    sh:in ( databook:DataBookHeader databook:TransformerLibraryHeader databook:ProcessorRegistryHeader ) ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:group databook:IdentityPropertyGroup ;
    sh:order 10 ;
    sh:message "type must be one of databook, transformer-library, processor-registry (mapped to rdf:type)."@en .

databook:DataBookHeaderShape-title
    a sh:PropertyShape ;
    sh:path databook:title ;
    sh:name "title"@en ;
    sh:codeIdentifier "title" ;
    sh:datatype xsd:string ;
    sh:minLength 1 ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:group databook:IdentityPropertyGroup ;
    sh:order 20 ;
    sh:message "Every DataBook must have exactly one non-empty title."@en .

databook:DataBookHeaderShape-version
    a sh:PropertyShape ;
    sh:path databook:version ;
    sh:name "version"@en ;
    sh:codeIdentifier "version" ;
    sh:datatype xsd:string ;
    sh:pattern "^\\d+\\.\\d+\\.\\d+(-[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?(\\+[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?$" ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:group databook:IdentityPropertyGroup ;
    sh:order 30 ;
    sh:message "version must be a semantic version string (MAJOR.MINOR.PATCH)."@en .

databook:DataBookHeaderShape-created
    a sh:PropertyShape ;
    sh:path databook:created ;
    sh:name "created"@en ;
    sh:codeIdentifier "created" ;
    sh:datatype xsd:date ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:group databook:IdentityPropertyGroup ;
    sh:order 40 ;
    sh:message "Every DataBook must have a creation date (YYYY-MM-DD)."@en .

databook:DataBookHeaderShape-description
    a sh:PropertyShape ;
    sh:path databook:description ;
    sh:name "description"@en ;
    sh:codeIdentifier "description" ;
    sh:datatype xsd:string ;
    sh:maxCount 1 ;
    sh:group databook:DescriptivePropertyGroup ;
    sh:order 50 .

databook:DataBookHeaderShape-author
    a sh:PropertyShape ;
    sh:path databook:author ;
    sh:name "author"@en ;
    sh:codeIdentifier "author[]" ;
    sh:node databook:AuthorStampShape ;
    sh:group databook:DescriptivePropertyGroup ;
    sh:order 60 .

databook:DataBookHeaderShape-license
    a sh:PropertyShape ;
    sh:path databook:license ;
    sh:name "license"@en ;
    sh:codeIdentifier "license" ;
    sh:or ( [ sh:datatype xsd:string ] [ sh:nodeKind sh:IRI ] ) ;
    sh:maxCount 1 ;
    sh:group databook:DescriptivePropertyGroup ;
    sh:order 70 ;
    sh:message "license must be an SPDX identifier string or an IRI."@en .

databook:DataBookHeaderShape-domain
    a sh:PropertyShape ;
    sh:path databook:domain ;
    sh:name "domain namespace"@en ;
    sh:codeIdentifier "domain" ;
    sh:nodeKind sh:IRI ;
    sh:maxCount 1 ;
    sh:group databook:DescriptivePropertyGroup ;
    sh:order 80 .

databook:DataBookHeaderShape-subject
    a sh:PropertyShape ;
    sh:path databook:subject ;
    sh:name "subject"@en ;
    sh:codeIdentifier "subject[]" ;
    sh:datatype xsd:string ;
    sh:group databook:DescriptivePropertyGroup ;
    sh:order 90 .

databook:DataBookHeaderShape-tag
    a sh:PropertyShape ;
    sh:path databook:tag ;
    sh:name "tags"@en ;
    sh:codeIdentifier "tags[]" ;
    sh:datatype xsd:string ;
    sh:group databook:DescriptivePropertyGroup ;
    sh:order 100 .

databook:DataBookHeaderShape-publisher
    a sh:PropertyShape ;
    sh:path databook:publisher ;
    sh:name "publisher"@en ;
    sh:codeIdentifier "publisher" ;
    sh:or ( [ sh:datatype xsd:string ] [ sh:nodeKind sh:IRI ] ) ;
    sh:maxCount 1 ;
    sh:group databook:DescriptivePropertyGroup ;
    sh:order 110 .

databook:DataBookHeaderShape-imports
    a sh:PropertyShape ;
    sh:path databook:imports ;
    sh:name "imports"@en ;
    sh:codeIdentifier "imports[]" ;
    sh:nodeKind sh:IRI ;
    sh:group databook:DescriptivePropertyGroup ;
    sh:order 120 .

databook:DataBookHeaderShape-shapes
    a sh:PropertyShape ;
    sh:path databook:shapes ;
    sh:name "governing shapes"@en ;
    sh:codeIdentifier "shapes[]" ;
    sh:nodeKind sh:IRI ;
    sh:group databook:DescriptivePropertyGroup ;
    sh:order 130 ;
    sh:message "shapes is informational: IRIs of SHACL shapes this DataBook's data is expected to conform to."@en .

databook:DataBookHeaderShape-graph
    a sh:PropertyShape ;
    sh:path databook:graph ;
    sh:name "graph metadata"@en ;
    sh:codeIdentifier "graph" ;
    sh:node databook:GraphMetadataShape ;
    sh:maxCount 1 ;
    sh:group databook:GraphPropertyGroup ;
    sh:order 140 .

databook:DataBookHeaderShape-process
    a sh:PropertyShape ;
    sh:path databook:process ;
    sh:name "process stamp"@en ;
    sh:codeIdentifier "process" ;
    sh:node databook:ProcessStampShape ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:group databook:ProcessPropertyGroup ;
    sh:order 150 ;
    sh:message "Every DataBook must carry a process provenance stamp."@en .
```

### 5.2 `databook:AuthorStamp` — one entry of `author[]`

Each entry of the `author` sequence becomes an `AuthorStamp` node,
`rdfs:subClassOf prov:Agent`. The author list records *who contributed to
the document*; it is distinct from `process.agent` (§5.6), which records
*who orchestrated the transformation that produced it*. The same person may
appear in both.

| YAML key | Predicate | Type | Card. | Constraint | Status |
|---|---|---|---|---|---|
| `author[].name` | `databook:authorName` | `xsd:string` | 1..1 | `sh:minLength 1` | [v1.1] [v2.0] |
| `author[].iri` | `databook:authorIri` | IRI | 0..1 | Stable identifier for the contributor | [v1.1] [v2.0] |
| `author[].role` | `databook:authorRole` | `xsd:string` | 0..1 | `sh:in` §6.2 | [v1.1] [v2.0] |

<!-- databook:id: shacl-author-stamp-shape -->
<!-- databook:label: databook:AuthorStampShape -->
<!-- mode=printed -->
```shacl
@prefix databook: <https://w3id.org/holon/databook#> .
@prefix sh:       <http://www.w3.org/ns/shacl#> .
@prefix xsd:      <http://www.w3.org/2001/XMLSchema#> .
@prefix rdfs:     <http://www.w3.org/2000/01/rdf-schema#> .

databook:AuthorStampShape
    a sh:NodeShape ;
    rdfs:label "Author Stamp Shape"@en ;
    sh:targetClass databook:AuthorStamp ;
    sh:property
        databook:AuthorStampShape-name ,
        databook:AuthorStampShape-iri ,
        databook:AuthorStampShape-role .

databook:AuthorStampShape-name
    a sh:PropertyShape ;
    sh:path databook:authorName ;
    sh:name "name"@en ;
    sh:codeIdentifier "author[].name" ;
    sh:datatype xsd:string ;
    sh:minLength 1 ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Every author entry must carry a name."@en .

databook:AuthorStampShape-iri
    a sh:PropertyShape ;
    sh:path databook:authorIri ;
    sh:name "IRI"@en ;
    sh:codeIdentifier "author[].iri" ;
    sh:nodeKind sh:IRI ;
    sh:maxCount 1 .

databook:AuthorStampShape-role
    a sh:PropertyShape ;
    sh:path databook:authorRole ;
    sh:name "role"@en ;
    sh:codeIdentifier "author[].role" ;
    sh:datatype xsd:string ;
    sh:in ( "orchestrator" "transformer" "reviewer" "editor" "contributor" ) ;
    sh:maxCount 1 .
```

### 5.3 `databook:GraphMetadata` — the `graph` block

Describes the primary RDF payload so that a consumer can decide *whether and
how* to load it before touching the data: which parser it needs, which named
graph it belongs in, and a quick integrity check on the triple count. Every
property is optional at the shape level; SPEC.md recommends the whole block
whenever a DataBook carries graph data.

| YAML key | Predicate | Type | Card. | Constraint | Status |
|---|---|---|---|---|---|
| `graph.namespace` | `databook:namespace` | IRI | 0..1 | Primary namespace of entities in the data block | [v1.1] [v2.0] |
| `graph.named_graph` | `databook:namedGraph` | IRI | 0..1 | Target named graph; by convention `{id}#graph` | [v1.1] [v2.0] |
| `graph.triple_count` | `databook:tripleCount` | `xsd:integer` | 0..1 | `sh:minInclusive 0`; integrity hint, not a hard constraint | [v1.1] [v2.0] |
| `graph.subjects` | `databook:subjectCount` | `xsd:integer` | 0..1 | `sh:minInclusive 0`; distinct subject IRIs | [v1.1] [v2.0] |
| `graph.rdf_version` | `databook:rdfVersion` | `xsd:string` | 0..1 | `sh:in ( "1.1" "1.2" )` | [v1.1] [v2.0] |
| `graph.turtle_version` | `databook:turtleVersion` | `xsd:string` | 0..1 | `sh:in ( "1.1" "1.2" )` | [v1.1] [v2.0] |
| `graph.reification` | `databook:usesReification` | `xsd:boolean` | 0..1 | `true` if RDF 1.2 triple-term / annotation syntax is used | [v1.1] [v2.0] |
| `graph.validator_note` | `databook:validatorNote` | `xsd:string` | 0..1 | Free text for humans; parser prerequisites and quirks | [v1.1] [v2.0] |

> **Note:** The `triple_count` mismatch rule is stated in SPEC.md §15.4: a
> conformant parser *warns* and loads anyway. The count is an integrity hint
> for humans and CI, never a gate. The YAML key is `subjects`; the predicate
> is `subjectCount` — one of a handful of places where the two names differ
> and the `sh:codeIdentifier` is doing real work.

<!-- databook:id: yaml-graph-metadata -->
<!-- databook:label: graph block for the worked example -->
<!-- mode=printed -->
```yaml
graph:
  namespace: https://example.org/ontology/sensor#
  named_graph: https://example.org/databooks/sensor-catalogue-v1#graph
  triple_count: 29
  subjects: 8
  rdf_version: "1.2"
  turtle_version: "1.2"
  reification: true
  validator_note: >
    Uses RDF 1.2 triple-term annotations on calibration assertions;
    requires Jena 6.0 or another RDF 1.2 parser for full fidelity.
```

<!-- databook:id: shacl-graph-metadata-shape -->
<!-- databook:label: databook:GraphMetadataShape -->
<!-- mode=printed -->
```shacl
@prefix databook: <https://w3id.org/holon/databook#> .
@prefix sh:       <http://www.w3.org/ns/shacl#> .
@prefix xsd:      <http://www.w3.org/2001/XMLSchema#> .
@prefix rdfs:     <http://www.w3.org/2000/01/rdf-schema#> .

databook:GraphMetadataShape
    a sh:NodeShape ;
    rdfs:label "Graph Metadata Shape"@en ;
    sh:targetClass databook:GraphMetadata ;
    sh:property
        databook:GraphMetadataShape-namespace ,
        databook:GraphMetadataShape-namedGraph ,
        databook:GraphMetadataShape-tripleCount ,
        databook:GraphMetadataShape-subjectCount ,
        databook:GraphMetadataShape-rdfVersion ,
        databook:GraphMetadataShape-turtleVersion ,
        databook:GraphMetadataShape-usesReification ,
        databook:GraphMetadataShape-validatorNote .

databook:GraphMetadataShape-namespace
    a sh:PropertyShape ;
    sh:path databook:namespace ;
    sh:name "namespace"@en ;
    sh:codeIdentifier "graph.namespace" ;
    sh:nodeKind sh:IRI ;
    sh:maxCount 1 .

databook:GraphMetadataShape-namedGraph
    a sh:PropertyShape ;
    sh:path databook:namedGraph ;
    sh:name "named graph"@en ;
    sh:codeIdentifier "graph.named_graph" ;
    sh:nodeKind sh:IRI ;
    sh:maxCount 1 .

databook:GraphMetadataShape-tripleCount
    a sh:PropertyShape ;
    sh:path databook:tripleCount ;
    sh:name "triple count"@en ;
    sh:codeIdentifier "graph.triple_count" ;
    sh:datatype xsd:integer ;
    sh:minInclusive 0 ;
    sh:maxCount 1 ;
    sh:message "triple_count must be a non-negative integer."@en .

databook:GraphMetadataShape-subjectCount
    a sh:PropertyShape ;
    sh:path databook:subjectCount ;
    sh:name "subject count"@en ;
    sh:codeIdentifier "graph.subjects" ;
    sh:datatype xsd:integer ;
    sh:minInclusive 0 ;
    sh:maxCount 1 .

databook:GraphMetadataShape-rdfVersion
    a sh:PropertyShape ;
    sh:path databook:rdfVersion ;
    sh:name "RDF version"@en ;
    sh:codeIdentifier "graph.rdf_version" ;
    sh:datatype xsd:string ;
    sh:in ( "1.1" "1.2" ) ;
    sh:maxCount 1 ;
    sh:message "rdf_version must be '1.1' or '1.2'."@en .

databook:GraphMetadataShape-turtleVersion
    a sh:PropertyShape ;
    sh:path databook:turtleVersion ;
    sh:name "Turtle version"@en ;
    sh:codeIdentifier "graph.turtle_version" ;
    sh:datatype xsd:string ;
    sh:in ( "1.1" "1.2" ) ;
    sh:maxCount 1 ;
    sh:message "turtle_version must be '1.1' or '1.2'."@en .

databook:GraphMetadataShape-usesReification
    a sh:PropertyShape ;
    sh:path databook:usesReification ;
    sh:name "uses RDF 1.2 reification"@en ;
    sh:codeIdentifier "graph.reification" ;
    sh:datatype xsd:boolean ;
    sh:maxCount 1 .

databook:GraphMetadataShape-validatorNote
    a sh:PropertyShape ;
    sh:path databook:validatorNote ;
    sh:name "validator note"@en ;
    sh:codeIdentifier "graph.validator_note" ;
    sh:datatype xsd:string ;
    sh:maxCount 1 .
```

### 5.4 `databook:ProcessStamp` — the `process` block

The process stamp is the DataBook's provenance record: what kind of process
produced the data, what it consumed, when, and who was responsible. It is
`rdfs:subClassOf prov:Activity`. It does not promise reproducibility — an
`llm` or `human` transformer cannot be replayed — it provides the forensic
trail needed to assess, audit, and where possible re-run a pipeline stage.

| YAML key | Predicate | Type | Card. | Constraint | Status |
|---|---|---|---|---|---|
| `process.transformer` | `databook:transformer` | `xsd:string` | **1..1** | `sh:minLength 1`; display name | [v1.1] [v2.0] |
| `process.transformer_type` | `databook:transformerType` | `xsd:string` | **1..1** | `sh:in` §6.3 | [v1.1] [v2.0] |
| `process.transformer_iri` | `databook:transformerIri` | IRI | 0..1 | Specific model/tool instance; for `library-transform` and `registry-processor` this is a fragment IRI into the library or registry | [v1.1] [v2.0] |
| `process.timestamp` | `databook:timestamp` | `xsd:dateTime` | **1..1** | ISO 8601 combined date-time; include a timezone | [v1.1] [v2.0] |
| `process.inputs[]` | `databook:input` | node → `ProcessInputShape` | **1..*** | At least one input; each is a §5.5 node | [v1.1] [v2.0] |
| `process.agent` | `databook:agent` | node → `AgentStampShape` | 0..1 | §5.6 | [v1.1] [v2.0] |
| `process.note` | `databook:note` | `xsd:string` | 0..1 | Non-determinism warnings, limitations, manual post-processing | [v1.1] [v2.0] |
| `process.output_format` | `databook:outputFormat` | `xsd:string` | 0..1 | Fence label of the primary output block type (§7) | [v1.1] [v2.0] |
| `process.output_media_type` | `databook:outputMediaType` | `xsd:string` | 0..1 | MIME type, for precision when the fence label is ambiguous | [v1.1] [v2.0] |
| `process.output` | `databook:output` | node → `OutputSpecShape` | 0..1 | §5.7; absent means stdout | [v1.1] [v2.0] |
| `process.outputs[]` | *(no shape)* | sequence | 0..* | Multiple simultaneous destinations; takes precedence over `output` when both present | **[v1.1] only — see §16** |

> **Important:** Three differences between SPEC.md v1.1 and the **[v2.0]**
> shape are worth the WG's attention. (1) `timestamp` is "recommended" in
> v1.1 and `sh:minCount 1` in v2.0. (2) `inputs` is required in both, but v1.1
> allows `inputs: []` in its minimum-viable example (§18), which the v2.0
> shape rejects — a human-authored DataBook must now cite at least one input,
> even if only a `urn:` for the authoring session. (3) `process.outputs[]`
> exists in v1.1 but has no shape and no `databook:` predicate in v2.0.

<!-- databook:id: yaml-process-stamp -->
<!-- databook:label: process block for the worked example -->
<!-- mode=printed -->
```yaml
process:
  transformer: "Claude Sonnet 5"
  transformer_type: llm
  transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-5
  inputs:
    - iri: https://example.org/databooks/sensor-inventory-csv-2026-08
      role: primary
      description: "Raw sensor inventory export, one row per instrument."
    - iri: https://example.org/databooks/sensor-shapes-v1
      block_id: sensor-shapes
      role: constraint
      description: "SHACL shapes the catalogue must conform to."
  timestamp: 2026-09-07T18:30:00Z
  agent:
    name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: orchestrator
  note: >
    Sensor identifiers were reconciled by hand after generation; the LLM
    step is non-deterministic.
  output_format: turtle12
  output_media_type: "text/turtle; version=1.2"
  output:
    graph: https://example.org/databooks/sensor-catalogue-v1#graph
    url: https://store.example.org/ds/data
    file: ./build/sensor-catalogue.ttl
```

<!-- databook:id: shacl-process-stamp-shape -->
<!-- databook:label: databook:ProcessStampShape -->
<!-- mode=printed -->
```shacl
@prefix databook: <https://w3id.org/holon/databook#> .
@prefix sh:       <http://www.w3.org/ns/shacl#> .
@prefix xsd:      <http://www.w3.org/2001/XMLSchema#> .
@prefix rdfs:     <http://www.w3.org/2000/01/rdf-schema#> .

databook:ProcessStampShape
    a sh:NodeShape ;
    rdfs:label "Process Stamp Shape"@en ;
    sh:targetClass databook:ProcessStamp ;
    sh:property
        databook:ProcessStampShape-transformer ,
        databook:ProcessStampShape-transformerType ,
        databook:ProcessStampShape-transformerIri ,
        databook:ProcessStampShape-timestamp ,
        databook:ProcessStampShape-input ,
        databook:ProcessStampShape-agent ,
        databook:ProcessStampShape-note ,
        databook:ProcessStampShape-outputFormat ,
        databook:ProcessStampShape-outputMediaType ,
        databook:ProcessStampShape-output .

databook:ProcessStampShape-transformer
    a sh:PropertyShape ;
    sh:path databook:transformer ;
    sh:name "transformer"@en ;
    sh:codeIdentifier "process.transformer" ;
    sh:datatype xsd:string ;
    sh:minLength 1 ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Process stamp must name the transformer."@en .

databook:ProcessStampShape-transformerType
    a sh:PropertyShape ;
    sh:path databook:transformerType ;
    sh:name "transformer type"@en ;
    sh:codeIdentifier "process.transformer_type" ;
    sh:datatype xsd:string ;
    sh:in ( "llm" "human" "script" "xslt" "sparql" "shacl"
            "service" "composite" "library-transform" "registry-processor" ) ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "transformer_type must be one of the defined vocabulary values."@en .

databook:ProcessStampShape-transformerIri
    a sh:PropertyShape ;
    sh:path databook:transformerIri ;
    sh:name "transformer IRI"@en ;
    sh:codeIdentifier "process.transformer_iri" ;
    sh:nodeKind sh:IRI ;
    sh:maxCount 1 .

databook:ProcessStampShape-timestamp
    a sh:PropertyShape ;
    sh:path databook:timestamp ;
    sh:name "timestamp"@en ;
    sh:codeIdentifier "process.timestamp" ;
    sh:datatype xsd:dateTime ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Process stamp must have an ISO 8601 dateTime timestamp."@en .

databook:ProcessStampShape-input
    a sh:PropertyShape ;
    sh:path databook:input ;
    sh:name "inputs"@en ;
    sh:codeIdentifier "process.inputs[]" ;
    sh:node databook:ProcessInputShape ;
    sh:minCount 1 ;
    sh:message "Process stamp must declare at least one input."@en .

databook:ProcessStampShape-agent
    a sh:PropertyShape ;
    sh:path databook:agent ;
    sh:name "agent"@en ;
    sh:codeIdentifier "process.agent" ;
    sh:node databook:AgentStampShape ;
    sh:maxCount 1 .

databook:ProcessStampShape-note
    a sh:PropertyShape ;
    sh:path databook:note ;
    sh:name "note"@en ;
    sh:codeIdentifier "process.note" ;
    sh:datatype xsd:string ;
    sh:maxCount 1 .

databook:ProcessStampShape-outputFormat
    a sh:PropertyShape ;
    sh:path databook:outputFormat ;
    sh:name "output format"@en ;
    sh:codeIdentifier "process.output_format" ;
    sh:datatype xsd:string ;
    sh:maxCount 1 .

databook:ProcessStampShape-outputMediaType
    a sh:PropertyShape ;
    sh:path databook:outputMediaType ;
    sh:name "output media type"@en ;
    sh:codeIdentifier "process.output_media_type" ;
    sh:datatype xsd:string ;
    sh:maxCount 1 .

databook:ProcessStampShape-output
    a sh:PropertyShape ;
    sh:path databook:output ;
    sh:name "output routing"@en ;
    sh:codeIdentifier "process.output" ;
    sh:node databook:OutputSpecShape ;
    sh:maxCount 1 .
```

### 5.5 `databook:ProcessInput` — one entry of `process.inputs[]`

Each input is a `ProcessInput` node, `rdfs:subClassOf prov:Entity`. Because
`sourceIri` is usually another DataBook's `id`, and that DataBook carries its
own process stamp, **inputs are the links in the provenance chain** (§12.2).
The optional `block_id` narrows the citation to one block of the input
document, giving fragment-level provenance without a second mechanism.

| YAML key | Predicate | Type | Card. | Constraint | Status |
|---|---|---|---|---|---|
| `process.inputs[].iri` | `databook:sourceIri` | IRI | **1..1** | The input's identity | [v1.1] [v2.0] |
| `process.inputs[].role` | `databook:role` | `xsd:string` | **1..1** | `sh:in` §6.4 | [v1.1 recommended] [v2.0 required] |
| `process.inputs[].description` | `databook:description` | `xsd:string` | 0..1 | What this input contributed | [v1.1] [v2.0] |
| `process.inputs[].block_id` | `databook:blockId` | `xsd:string` | 0..1 | A `databook:id` value within the input DataBook | [v1.1 §7.3] [v2.0] |

> **Note:** `databook:description` is reused here with a different domain
> from its use on the header (§5.1.2). The property vocabulary therefore
> declares it without an `rdfs:domain`, and its `rdfs:comment` describes both
> uses. Two distinct property *shapes* still constrain it in each context.

<!-- databook:id: shacl-process-input-shape -->
<!-- databook:label: databook:ProcessInputShape -->
<!-- mode=printed -->
```shacl
@prefix databook: <https://w3id.org/holon/databook#> .
@prefix sh:       <http://www.w3.org/ns/shacl#> .
@prefix xsd:      <http://www.w3.org/2001/XMLSchema#> .
@prefix rdfs:     <http://www.w3.org/2000/01/rdf-schema#> .

databook:ProcessInputShape
    a sh:NodeShape ;
    rdfs:label "Process Input Shape"@en ;
    sh:targetClass databook:ProcessInput ;
    sh:property
        databook:ProcessInputShape-sourceIri ,
        databook:ProcessInputShape-role ,
        databook:ProcessInputShape-description ,
        databook:ProcessInputShape-blockId .

databook:ProcessInputShape-sourceIri
    a sh:PropertyShape ;
    sh:path databook:sourceIri ;
    sh:name "IRI"@en ;
    sh:codeIdentifier "process.inputs[].iri" ;
    sh:nodeKind sh:IRI ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Each process input must declare its source IRI."@en .

databook:ProcessInputShape-role
    a sh:PropertyShape ;
    sh:path databook:role ;
    sh:name "role"@en ;
    sh:codeIdentifier "process.inputs[].role" ;
    sh:datatype xsd:string ;
    sh:in ( "primary" "constraint" "context" "evidence" "reference" "template" ) ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Input role must be one of: primary, constraint, context, evidence, reference, template."@en .

databook:ProcessInputShape-description
    a sh:PropertyShape ;
    sh:path databook:description ;
    sh:name "description"@en ;
    sh:codeIdentifier "process.inputs[].description" ;
    sh:datatype xsd:string ;
    sh:maxCount 1 .

databook:ProcessInputShape-blockId
    a sh:PropertyShape ;
    sh:path databook:blockId ;
    sh:name "block ID"@en ;
    sh:codeIdentifier "process.inputs[].block_id" ;
    sh:datatype xsd:string ;
    sh:maxCount 1 .
```

### 5.6 `databook:AgentStamp` — the `process.agent` block

The person or system that *orchestrated* the transformation, when that is
someone other than the transformer itself. `rdfs:subClassOf prov:Agent`.
For an LLM-produced DataBook this is normally the human who directed the
model; for a `human` transformer it is usually redundant with `author`, and
may be omitted.

| YAML key | Predicate | Type | Card. | Constraint | Status |
|---|---|---|---|---|---|
| `process.agent.name` | `databook:agentName` | `xsd:string` | **1..1** | `sh:minLength 1` | [v1.1] [v2.0] |
| `process.agent.iri` | `databook:agentIri` | IRI | 0..1 | | [v1.1] [v2.0] |
| `process.agent.role` | `databook:agentRole` | `xsd:string` | 0..1 | `sh:in` §6.2 — note the vocabulary differs from `author[].role` | [v1.1 required] [v2.0 optional] |

> **Note:** SPEC.md v1.1 lists `agent.role` as "required in agent"; the
> **[v2.0]** shape makes it `sh:maxCount 1` with no `sh:minCount`. The agent
> role vocabulary is also a strict subset of the author role vocabulary
> (§6.2): an agent can be an orchestrator, contributor, reviewer, or
> validator, but not a transformer or editor. One of the two sources should
> yield (§16).

<!-- databook:id: shacl-agent-stamp-shape -->
<!-- databook:label: databook:AgentStampShape -->
<!-- mode=printed -->
```shacl
@prefix databook: <https://w3id.org/holon/databook#> .
@prefix sh:       <http://www.w3.org/ns/shacl#> .
@prefix xsd:      <http://www.w3.org/2001/XMLSchema#> .
@prefix rdfs:     <http://www.w3.org/2000/01/rdf-schema#> .

databook:AgentStampShape
    a sh:NodeShape ;
    rdfs:label "Agent Stamp Shape"@en ;
    sh:targetClass databook:AgentStamp ;
    sh:property
        databook:AgentStampShape-name ,
        databook:AgentStampShape-iri ,
        databook:AgentStampShape-role .

databook:AgentStampShape-name
    a sh:PropertyShape ;
    sh:path databook:agentName ;
    sh:name "name"@en ;
    sh:codeIdentifier "process.agent.name" ;
    sh:datatype xsd:string ;
    sh:minLength 1 ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:message "Agent stamp must carry a name."@en .

databook:AgentStampShape-iri
    a sh:PropertyShape ;
    sh:path databook:agentIri ;
    sh:name "IRI"@en ;
    sh:codeIdentifier "process.agent.iri" ;
    sh:nodeKind sh:IRI ;
    sh:maxCount 1 .

databook:AgentStampShape-role
    a sh:PropertyShape ;
    sh:path databook:agentRole ;
    sh:name "role"@en ;
    sh:codeIdentifier "process.agent.role" ;
    sh:datatype xsd:string ;
    sh:in ( "orchestrator" "contributor" "reviewer" "validator" ) ;
    sh:maxCount 1 .
```

### 5.7 `databook:OutputSpec` — the `process.output` block

Where the transformation's result went. Absence means stdout — the
command-line default. All three destinations may be declared at once; a
pipeline runner writes to each.

| YAML key | Predicate | Type | Card. | Constraint | Status |
|---|---|---|---|---|---|
| `process.output.graph` | `databook:outputGraph` | IRI | 0..1 | Named graph to load the output into | [v1.1] [v2.0] |
| `process.output.url` | `databook:outputUrl` | IRI | 0..1 | Upload endpoint — typically SPARQL Graph Store Protocol | [v1.1] [v2.0] |
| `process.output.file` | `databook:outputFile` | `xsd:string` | 0..1 | Filesystem path; relative paths resolve against the DataBook's own location | [v1.1] [v2.0] |

<!-- databook:id: shacl-output-spec-shape -->
<!-- databook:label: databook:OutputSpecShape -->
<!-- mode=printed -->
```shacl
@prefix databook: <https://w3id.org/holon/databook#> .
@prefix sh:       <http://www.w3.org/ns/shacl#> .
@prefix xsd:      <http://www.w3.org/2001/XMLSchema#> .
@prefix rdfs:     <http://www.w3.org/2000/01/rdf-schema#> .

databook:OutputSpecShape
    a sh:NodeShape ;
    rdfs:label "Output Spec Shape"@en ;
    sh:targetClass databook:OutputSpec ;
    sh:property
        databook:OutputSpecShape-graph ,
        databook:OutputSpecShape-url ,
        databook:OutputSpecShape-file .

databook:OutputSpecShape-graph
    a sh:PropertyShape ;
    sh:path databook:outputGraph ;
    sh:name "output graph"@en ;
    sh:codeIdentifier "process.output.graph" ;
    sh:nodeKind sh:IRI ;
    sh:maxCount 1 .

databook:OutputSpecShape-url
    a sh:PropertyShape ;
    sh:path databook:outputUrl ;
    sh:name "output URL"@en ;
    sh:codeIdentifier "process.output.url" ;
    sh:nodeKind sh:IRI ;
    sh:maxCount 1 .

databook:OutputSpecShape-file
    a sh:PropertyShape ;
    sh:path databook:outputFile ;
    sh:name "output file"@en ;
    sh:codeIdentifier "process.output.file" ;
    sh:datatype xsd:string ;
    sh:maxCount 1 .
```

### 5.8 `databook:TransformerLibraryHeader` and `databook:ProcessorRegistryHeader`

Both are `rdfs:subClassOf databook:DataBookHeader` and add no properties of
their own. They exist so that `type: transformer-library` and
`type: processor-registry` have somewhere to land under `rdf:type`, and so
that a SPARQL query can find every library or every registry in a store
with a single class match. `DataBookHeaderShape` targets all three classes
directly (§5.1.6), so no additional shape is needed. The body conventions
that go with each type are in §11.

### 5.9 Frontmatter keys with no v2.0 shape

For completeness, these keys are defined or reserved in SPEC.md v1.1 and
have **no** `databook:` predicate and no property shape in the candidate
module. Each is a §16 item.

| YAML key | Status in v1.1 | Why it has no shape |
|---|---|---|
| `process.outputs[]` | Optional; overrides `output` when both present | Plural form never modelled; needs either a repeatable `databook:output` or a decision to drop it |
| `encryption` and children (`profile`, `key_id`, `scope`, `blocks[]`) | Reserved key; encryption profile | The profile is layered on core and was scoped out of the header module deliberately; the key must stay reserved |
| `profiles[]` | **[proposed]** in this primer | Post-dates the shapes module; needs a `databook:profile` predicate and an IRI-valued, repeatable property shape (§4.2, §16 item 14) |

## 6. Controlled vocabularies

Every enumerated value in the header module, in one place. These are the
exact `sh:in` lists; a value not in the list fails validation.

### 6.1 Document type (`type` → `rdf:type`) **[v1.1] [v2.0]**

| Value | Class | Meaning |
|---|---|---|
| `databook` | `databook:DataBookHeader` | Standard DataBook carrying domain data, queries, or prompts |
| `transformer-library` | `databook:TransformerLibraryHeader` | Catalogue of named, reusable transforms |
| `processor-registry` | `databook:ProcessorRegistryHeader` | Catalogue of named processors with capability declarations |

### 6.2 Roles **[v1.1] [v2.0]**

The two role vocabularies are related but not identical. An `author[].role`
describes a contribution to the *document*; a `process.agent.role` describes
a part in the *transformation*.

| Value | `author[].role` | `process.agent.role` | Meaning |
|---|---|---|---|
| `orchestrator` | ✓ | ✓ | The human or agent directing the overall production |
| `transformer` | ✓ | — | The process or agent that performed the primary transformation |
| `contributor` | ✓ | ✓ | Any other contributing role |
| `reviewer` | ✓ | ✓ | Validated the content after production |
| `editor` | ✓ | — | Revised prose or structure without changing the data |
| `validator` | — | ✓ | Ran or signed off validation of the transformation's output |

### 6.3 Transformer type (`process.transformer_type`) **[v1.1] [v2.0]**

| Value | Meaning | Deterministic? |
|---|---|---|
| `llm` | Large language model, any provider | **No** |
| `human` | Human authoring or annotation | **No** |
| `script` | Custom code (Python, JavaScript, …) | Varies |
| `xslt` | XSLT transformation | Yes |
| `sparql` | SPARQL CONSTRUCT, Update, or inference rule | Yes |
| `shacl` | SHACL validation or rule application | Yes |
| `service` | External API or web service call | Varies |
| `composite` | Orchestrated pipeline of several transformer types | Varies |
| `library-transform` | Named transform resolved from a `transformer-library` DataBook; `transformer_iri` is its fragment IRI | Varies |
| `registry-processor` | Processor resolved from a `processor-registry` DataBook; `transformer_iri` is its fragment IRI | Varies |

Non-deterministic types make strict reproducibility impossible. The stamp
documents this honestly; `process.note` is where the caveat belongs.

### 6.4 Input role (`process.inputs[].role`) **[v1.1] [v2.0]**

| Value | Meaning |
|---|---|
| `primary` | The principal data being transformed or processed |
| `constraint` | A shapes graph, schema, or other normative constraint the output must satisfy |
| `context` | Background knowledge that informed the transformation |
| `evidence` | Observational or empirical data from which output assertions derive |
| `reference` | Consulted, but not itself transformed |
| `template` | A scaffold whose structure the output follows |

Several inputs may share a role. Every input has exactly one.

### 6.5 RDF and Turtle version (`graph.rdf_version`, `graph.turtle_version`) **[v1.1] [v2.0]**

`"1.1"` or `"1.2"`, as strings. Quote them in YAML; unquoted `1.2` is a
float and will not survive a YAML parser intact. RDF 1.2 is the version that
introduces triple terms and the `~ reifier {| … |}` annotation syntax; if a
data block uses either, both fields say `"1.2"`, `reification` is `true`,
and the block label is `turtle12` (§7).

## 7. Fenced block reference **[v1.1]**

The label after the opening fence is the block's **media type hint** — a
short token from the vocabulary below, not a MIME string. It tells a
DataBook-aware processor which sub-parser to route the payload to. Any
label not in the vocabulary is a **display block**: rendered for humans,
never treated as a data payload. That fallback is what makes the format
forward-compatible.

### 7.1 Graph data payloads

| Label | Interpretation | MIME type |
|---|---|---|
| `turtle` | RDF Turtle 1.1 | `text/turtle` |
| `turtle12` | RDF Turtle 1.2, triple terms and annotations permitted | `text/turtle; version=1.2` |
| `json-ld` | JSON-LD 1.1 | `application/ld+json` |
| `trig` | TriG (named graphs) | `application/trig` |
| `n-triples` | N-Triples | `application/n-triples` |
| `n-quads` | N-Quads | `application/n-quads` |
| `json`, `xml`, `yaml`, `csv`, `html`, `text` | Non-RDF data payloads | as named |

### 7.2 Operations

| Label | Interpretation |
|---|---|
| `sparql` | SPARQL 1.1 / 1.2 query — SELECT, CONSTRUCT, ASK, DESCRIBE |
| `sparql-update` | SPARQL 1.1 Update |
| `shacl` | SHACL shapes, normally Turtle-serialised |
| `xslt`, `xquery`, `jq` | Transformation expressions |
| `manifest` | Build dependency graph in the `build:` vocabulary (§11.1) |
| `transformer-library` | RDF catalogue of named transforms (§11.2) |
| `processor-registry` | RDF catalogue of named processors (§11.3) |
| `prompt`, `prompt-system`, `prompt-user` | LLM prompt templates; `{{variable}}` interpolation permitted |

### 7.3 Visual specifications

`mermaid`, `graphviz`, `plantuml`, `d2`. With `mode=rendered` (§8.3) these
are handed to a renderer; without it they are display blocks.

### 7.4 Imperative code

`python`, `javascript`, `typescript`, `bash`, `r`, `sql`, and any other
language label. **Display by default.** A block is opted into execution only
by `mode=executed` (§8.3).

> **Warning:** Executable imperative code is a different security surface
> from a declarative query. A conformant runner must require explicit user
> confirmation before executing any imperative block and must sandbox it
> where possible. A `mode=executed` block with no `endpoint` and no runtime
> is treated as `mode=printed`.

### 7.5 Encrypted content (encryption profile)

`encrypted`, `encrypted-turtle`, `encrypted-jsonld`. Opaque base64
ciphertext. A parser without the encryption profile must skip these without
error and must not attempt to parse them.

## 8. Block headers: the pre-fence comment zone **[v1.2]**

This section is the single largest practical difference between what
`SPEC.md` v1.1 says and what every current DataBook actually does, and the
WG should ratify it first.

### 8.1 Where the header goes

**[v1.1]** placed block metadata *inside* the fence, as the first lines of
the payload:

    ```turtle
    <!-- databook:id: my-block -->
    @prefix ex: <https://example.org/> .
    ```

**[v1.2]** moves it *before* the fence, into the pre-fence comment zone:

    <!-- databook:id: my-block -->
    ```turtle
    @prefix ex: <https://example.org/> .
    ```

The v1.2 form is canonical. The v1.1 form is accepted on input for
backwards compatibility and must never be emitted. The reason is not
cosmetic: with the header outside the fence, **fence contents are always
pure payload**. A Turtle block can be handed to a Turtle parser byte-for-byte
with no pre-filtering, an extracted block is bit-identical to the payload,
and no processing instruction can ever leak into the data.

### 8.2 `databook:` keys

Block metadata lines have the form `<!-- prefix:key: value -->` — colon-
namespaced, colon-separated. Core reserves the `databook:` prefix; a profile
declared in `profiles[]` may register a prefix of its own (§4.3), so that
`<!-- holon:layer: L2 -->` is a holon-profile key and `<!-- okf:… -->` an
OKF one. Unrecognised keys, and keys under a prefix no declared profile
registers, are ignored without error.

| Key | Description | Status |
|---|---|---|
| `databook:id` | Block identifier. Kebab-case, unique within the document. Required for addressability (§9.1). Always the first line of the zone. | [v1.1] [v1.2] |
| `databook:label` | Human-readable label for this block | [v1.1] [v1.2] |
| `databook:graph` | Named graph IRI for this block; overrides frontmatter `graph.named_graph` | [v1.1] [v1.2] |
| `databook:base` | Base IRI for relative IRI resolution within the block | [v1.1] [v1.2] |
| `databook:import` | IRI of another DataBook whose prefixes and namespace context are in scope (§9.4) | [v1.1] [v1.2] |
| `databook:encoding` | Character encoding if not UTF-8 | [v1.1] [v1.2] |
| `databook:param` | Declares a substitutable parameter on a query block (§10) | [v1.1] [v1.2] |
| `databook:runtime` | Execution environment required, e.g. `python>=3.11`, `node>=20` | [v1.1] [v1.2] |
| `databook:executable` | `true` opts an imperative block into execution | [v1.1] — **deprecated in v1.2**, use `mode=executed` |
| `databook:encrypted-media-type` | MIME type of the plaintext in an encrypted block | [v1.1] encryption profile |
| `databook:key-ref` | IRI of the encryption key or key manifest entry | [v1.1] encryption profile |

### 8.3 Directive keys

Directives are processing instructions. They have the form
`<!-- key=value key=value -->` — **un**-namespaced, `=`-separated, one or more
pairs per comment line, no nesting, no YAML. A parser distinguishes the two
kinds with one test: does the comment body start with `databook:`?

**`mode` is the primary directive.** Its five values are closed: a profile
may add directive *keys* (§4.3) but not modes.

| Value | Meaning |
|---|---|
| `mode=executed` | Runnable. Submit to the declared `endpoint` or execution environment. The result may be appended as a new block with provenance. |
| `mode=rendered` | A rendering specification. Hand to the renderer named by the fence label — Mermaid → diagram, GeoJSON → map, Vega-Lite → chart, SVG → display. |
| `mode=printed` | Pretty-print as syntax-highlighted code. States that the block is for reading, not execution. **Default for display code blocks.** |
| `mode=hidden` | Present and available to processors and LLMs reading the document, but suppressed from every rendered view. For grounding data, provenance trails, intermediate results, system metadata. |
| `mode=reference` | Not displayed by default but surfaceable on demand — the footnote model. A client may expose reference blocks on explicit request; hidden blocks are never surfaced. |

**Other directives:**

| Key | Applies to | Description |
|---|---|---|
| `endpoint=<IRI>` | `mode=executed` | Endpoint or service to submit against. Overrides `process.output.url` for this block. |
| `cache=true\|false` | `mode=executed` | Store the result back into the DataBook (`true`) or re-execute on every load. Default `false`. |
| `authority=<IRI>` | any | The named authority asserting this block's content. Different authorities may contribute blocks to one DataBook with different trust weights. |
| `version=<semver>` | any | Block-level version, so a DataBook can carry a current and a prior version of a shape or query side by side. |
| `result-iri=<IRI>` | `mode=executed` | IRI of the output DataBook or graph produced by execution. Set by the processor after the fact; absent beforehand. |
| `expires=<dateTime>` | `mode=executed` | `xsd:dateTime` after which a cached result is stale. |

### 8.4 Ordering within the zone

1. `databook:id` — always first; it is the block's identity anchor.
2. Other `databook:` keys — `label`, `graph`, `base`, `import`, `param`, …
3. Directive lines — `mode`, `endpoint`, `cache`, `authority`, …

Directives may share one comment line or be split across consecutive lines;
parsers accumulate `key=value` pairs from every directive line in the zone.
A comment in the zone that is neither a `databook:` key nor a directive is a
prose comment and is discarded from the header.

### 8.5 A processor's routing rule, in full

For each fenced block: collect every consecutive `<!-- … -->` line
immediately above the opening fence. For each, if the body starts with
`databook:` — or with a prefix registered by a profile the document declares
— parse `PREFIX:KEY: VALUE` into the block's metadata map, keyed by the
full prefixed name; otherwise, if it matches `^<!--\s*((?:[\w-]+=\S+\s*)+)-->$`, parse each
`KEY=VALUE` token into the block's directive map; otherwise discard it. Then
route the payload by label (§7), and apply `mode` (§8.3) to decide whether
to execute, render, print, hide, or hold it.

### 8.6 Embedding a DataBook inside a DataBook

This document has to *show* fenced blocks with their headers, which raises a
hazard the spec does not yet address. A CommonMark renderer nests fences
happily — wrap a ```` ```turtle ```` example in a four-backtick or `~~~`
outer fence and it displays correctly. But the reference CLI's block scanner
recognises **only** three-backtick fences at column zero. A four-backtick
opener does not match it, so it never opens a block — and the *inner*
```` ```turtle ```` line then does, harvesting the example's blocks as if they
were this document's own payloads, with whatever `databook:id` values they
happen to carry.

The safe form is an **indented code block**: four spaces, no fence at all.
Every embedded example in this primer, including the complete worked example
in §13.1, is written that way. §16 asks the WG to write a rule.

### 8.7 The reference CLI and this section

`lib/parser.js` implements §8.1 — it collects contiguous
`<!-- databook:key: value -->` lines above the fence, tolerates one blank
line, and prefers pre-fence values over legacy inline ones. Until
2026-09-07 it did **not** implement §8.3, and worse: its backward walk
stopped at the first line that was not a `databook:` key, so a zone written
to the §8.4 ordering — directives last — was truncated before the walk ever
reached `databook:id`. Run against v1.1.1 of this document, the CLI saw 18
of 19 blocks as anonymous; only §13.2's payload, whose zone happens to end
in a `databook:` key, kept its identity. Every DataBook produced to the v1.2
convention was affected the same way, and `push`'s anonymous-block collision
guard, `extract --id`, and fragment resolution all failed on them.

**Fixed the same day** in the reference CLI: the walk now accepts directive
lines and collects them into a `directives` map on each block (`mode` as a
convenience field), with `parseDirectiveLine()` exported alongside
`parseAdjacentAnnotation()`. `test/directives.databook.md` and
`test/parser-directives.test.mjs` pin every placement in §8.4 plus two
negatives — a prose comment in the zone still ends the walk, and a
directive-shaped line *inside* a fence is payload — and `npm test` now runs
them. All sixteen pre-existing fixtures parse identically before and after.
What remains for §16 item 1: the parser exposes `mode` but `push` and
`process` do not yet act on it; they still decide display-only by label and
by the CLI's own `databook:display-only: true` key, which appears in no spec
text and is the CLI's ad hoc `mode=printed`. Reconciling those is the next
slice.

### 8.8 The headers in this document

Every fenced block in this primer is a live instance of §8. The SHACL
signatures in §5 are `mode=printed` documentation; the frontmatter excerpts
are `mode=printed` and labelled `yaml`, which is a payload label in §7.1, so
the directive is what keeps a strict processor from loading them as data.
The RDF projection in §13.2 is the **only** block with no `mode` directive
and the only one carrying `databook:graph`: it is this document's single
loadable payload, and `graph.triple_count` in the frontmatter counts it and
nothing else. The broken header in §13.4 is `mode=reference`.

## 9. Addressing and linking between DataBooks

DataBooks link to one another in six distinct ways, each with a different
meaning. Choosing the right one is a modelling decision.

| Mechanism | Level | Meaning | Status |
|---|---|---|---|
| `{id}#{databook:id}` fragment IRI | block | *This specific block.* Standard URL fragment semantics. | [v1.1] |
| `process.inputs[].iri` (+ `block_id`) | document | *This document was produced from that one.* The provenance link; `prov:used`. | [v1.1] [v2.0] |
| `imports[]` (frontmatter) | document | *This document inherits that one's prefix declarations and namespace context.* | [v2.0] |
| `databook:import` (block header) | block | *This block* inherits prefixes and context from that DataBook. Finer-grained `imports`. | [v1.1] [v1.2] |
| `shapes[]` (frontmatter) | document | *This document's data is expected to conform to those shapes.* Informational. | [v1.1] [v2.0] |
| `build:dependsOn` (manifest block) | pipeline | *In this build, this artefact depends on that one.* Queryable with `build:dependsOn+`. | [v1.1] |
| `owl:priorVersion` (in the data) | vocabulary | *This graph supersedes that one.* Used by the shapes module itself. | OWL; pattern adopted [v2.0] |
| `profiles[]` (frontmatter) | document | *This document conforms to that profile.* Resolves, through the profile's PROF descriptor, to the shapes and conventions that apply (§4). | **[proposed]** |

### 9.1 Fragment addressing

A block is addressed by appending its `databook:id` to the document IRI:

    https://w3id.org/holon/databook#holon-databook-header-shapes
    https://w3id.org/holon/databook/primer#header-projection-example

A DataBook-aware client resolving the IRI fetches the document and locates
the block whose `databook:id` matches. This is what turns a DataBook of
`sparql` blocks into a **named-query catalogue**: every identified query is
a stable, addressable endpoint (§10).

### 9.2 Provenance links: `process.inputs[]`

The primary link. Because each input's `iri` is normally another DataBook's
`id`, and that DataBook carries its own stamp, the chain is walkable:

    primer  → process.inputs → header-shapes module
    header-shapes module → process.inputs → property-reference DataBook, SHACL 1.2 WD, prior draft

`block_id` narrows the citation to one block of the input. This document's
own stamp cites `https://w3id.org/holon/databook#` with
`block_id: holon-databook-header-shapes` — the shapes block specifically,
not the surrounding prose.

### 9.3 Context inheritance: `imports[]` **[v2.0]**

`imports` says that the prefix declarations and namespace context of the
named DataBook are in scope for this one. The shapes module's `sh:declare`
table (nine prefixes) is exactly the kind of context an importer wants. This
document imports `https://w3id.org/holon/databook#` for that reason.

> **Note:** `imports` is *not* `owl:imports`. It does not assert that the
> imported graph's triples are part of this graph. It asserts namespace
> context. A consumer that needs the triples loads them through
> `process.inputs` or `build:dependsOn`.

### 9.4 Block-level context: `databook:import`

The same inheritance, scoped to one block. Use it when one block in a
document is written against a different vocabulary from the rest. A circular
`databook:import` is a parse error.

### 9.5 Shape expectations: `shapes[]`

Informational. It lets a validator find the right shapes without inspecting
the data, and lets a catalogue answer "what conforms to `X`" without
validating anything. It does not gate anything at the DataBook level; the
processor that loads the data decides whether to validate.

### 9.6 Supersession: `owl:priorVersion`

When a graph replaces an earlier published one, the replacement carries
`owl:priorVersion <earlier IRI>` on its ontology subject. The candidate
shapes module does this to point at the `holon:`-namespaced draft it
replaced. Combined with `version` in the frontmatter, a consumer can
distinguish "newer edition of the same thing" from "different thing."

### 9.7 Links in prose **[v1.1]**

In prose, an IRI that refers to something in a data block is written as a
code span; a same-document block reference is a Markdown link to the
fragment; a cross-document block reference is a Markdown link to the full
fragment IRI:

    The `databook:DataBookHeader` class is constrained by the
    [header shape](#shacl-databook-header-shape) above, reproduced from the
    [canonical module](https://w3id.org/holon/databook#holon-databook-header-shapes).

### 9.8 The DataBooks this primer links to

| DataBook | IRI / location | Relationship to this document |
|---|---|---|
| Holon DataBook Header Shapes (SHACL 1.2), v2.0.0-alpha.1 | `https://w3id.org/holon/databook#` — [source](https://github.com/kurtcagle/databook/blob/main/holon-databook-header-shapes.databook.md); standalone shapes at [`schema/holon-databook-header.shacl.ttl`](https://github.com/kurtcagle/databook/blob/main/schema/holon-databook-header.shacl.ttl) | Constraint input; every SHACL signature in §5 is reproduced from it; imported for namespace context |
| DataBook Property Reference | [`databook-property-reference.databook.md`](https://github.com/kurtcagle/databook/blob/main/databook-property-reference.databook.md) | Reference input; the `build:` (`db:`) YAML→RDF mapping the header module was reprojected from |
| DataBook CLI Transform Specification | [`databook-cli-transform-spec.databook.md`](https://github.com/kurtcagle/databook/blob/main/databook-cli-transform-spec.databook.md) | Companion; specifies the `transform` command that consumes transformer libraries and processor registries (§11) |
| DataBook Format Reference v1.1 | [`SPEC.md`](https://github.com/kurtcagle/databook/blob/main/SPEC.md) | Reference input; the canonical **[v1.1]** text this primer consolidates |
| Reference examples | [`examples/`](https://github.com/kurtcagle/databook/tree/main/examples) | Eight reference DataBooks covering the major format features |
| Core `build:` vocabulary and DataBook shapes | [`schema/build.ttl`](https://github.com/kurtcagle/databook/blob/main/schema/build.ttl), [`schema/databook.shacl.ttl`](https://github.com/kurtcagle/databook/blob/main/schema/databook.shacl.ttl) | The **[v1.1]** pipeline vocabulary and its own shapes; distinct from the **[v2.0]** header module |
| W3C Holon Community Group | [`w3c-cg/holon`](https://github.com/w3c-cg/holon) | The WG's home; the intended destination of a ratified v2.0 specification |

## 10. Parameterised queries **[v1.1]**

A `sparql` block may declare substitutable parameters with `databook:param`,
which turns the DataBook into a **named-query API**: a client resolves the
block by fragment IRI, substitutes values, and executes, without editing the
document.

### 10.1 The `VALUES` clause as the parameter slot

The SPARQL `VALUES` clause is the mechanism. A `VALUES` clause with one
binding is simultaneously the default (the query is valid SPARQL if nothing
is substituted) and the substitution target. Substitution is **text-level**:
the client finds `VALUES ?name { … }` and replaces the binding set.
Multi-valued parameters use the ordinary multi-binding form. A required
parameter is declared with the `required` flag and an *empty* binding set,
so that an unsubstituted query returns nothing rather than something
misleading.

    <!-- databook:param: VARNAME [type=TYPE] [default=DEFAULT] [required] -->

| Field | Description |
|---|---|
| `VARNAME` | The SPARQL variable, without `?`. Must match a `VALUES` clause in the body. |
| `type` | Expected node kind: `IRI`, `xsd:string`, `xsd:integer`, `xsd:date`, … Optional; aids client validation. |
| `default` | Used when nothing is substituted. A prefixed name, an angle-bracketed IRI, or a quoted literal. |
| `required` | No default; the caller must supply a value. |

### 10.2 Block naming

| `databook:id` prefix | Role |
|---|---|
| `select-` | Documentation query (SELECT) |
| `describe-` | Documentation query (DESCRIBE) |
| `construct-` | Transformation specification |
| `validate-` | Integrity check (ASK or SELECT) |
| `update-` | Lifecycle operation (`sparql-update`) |

Not normative, but relied on by tools that auto-discover query blocks.

### 10.3 Live examples over this document's payload

Both queries below were executed against the §13.2 projection before
publication. The first is parameterised on the input role; the second walks
one hop of the provenance chain.

<!-- databook:id: select-inputs-by-role -->
<!-- databook:label: Inputs of a DataBook filtered by role, parameterised -->
<!-- databook:param: role type=xsd:string default="constraint" -->
<!-- mode=printed -->
```sparql
PREFIX databook: <https://w3id.org/holon/databook#>

SELECT ?databook ?title ?input ?description WHERE {
    VALUES ?role { "constraint" }
    ?databook a databook:DataBookHeader ;
              databook:title   ?title ;
              databook:process ?process .
    ?process  databook:input ?in .
    ?in       databook:sourceIri ?input ;
              databook:role      ?role .
    OPTIONAL { ?in databook:description ?description }
}
ORDER BY ?databook ?input
```

<!-- databook:id: select-provenance-one-hop -->
<!-- databook:label: One hop of the provenance chain — transformer and inputs per DataBook -->
<!-- mode=printed -->
```sparql
PREFIX databook: <https://w3id.org/holon/databook#>

SELECT ?databook ?transformer ?type ?when ?input ?role WHERE {
    ?databook a databook:DataBookHeader ;
              databook:process ?p .
    ?p databook:transformer     ?transformer ;
       databook:transformerType ?type ;
       databook:timestamp       ?when ;
       databook:input           ?in .
    ?in databook:sourceIri ?input ;
        databook:role      ?role .
}
ORDER BY ?databook ?role
```

Against the projection, `select-inputs-by-role` returns one row — the
`sensor-shapes-v1` constraint input — and `select-provenance-one-hop`
returns two, one per input, both stamped `Claude Sonnet 5` / `llm`.
Substituting `VALUES ?role { "primary" }` into the first returns the CSV
inventory instead. To walk the next hop, take each `?input` and query it as
`?databook`.

## 11. Manifests, transformer libraries, and processor registries **[v1.1]**

These three patterns are what make a set of DataBooks a *pipeline* rather
than a folder. All three use the `build:` vocabulary (§4) — never
`databook:`, which describes a single document's header.

### 11.1 Manifests

A manifest is an RDF graph describing a pipeline's dependency structure. It
lives in a `manifest`-labelled block and may be the primary block of its own
DataBook — the canonical pattern for compiling a book from chapter
DataBooks.

| Term | Type | Description |
|---|---|---|
| `build:Target` | Class | A build goal — the intended output |
| `build:Stage` | Class | An intermediate DataBook |
| `build:Source` | Class | A raw input with no DataBook dependencies |
| `build:Manifest` | Class | The manifest document itself |
| `build:dependsOn` | Property | Target/Stage → input DataBook IRIs |
| `build:transformer` | Property | Stage → transformer type string (§6.3) |
| `build:produces` | Property | Stage → output DataBook IRI |
| `build:order` | Property | Integer ordering hint |
| `build:outputType` | Property | Expected fence label of the output. **Always set it** on Stages and Targets; it is what lets a planner check type compatibility before running anything. |
| `build:inputType` | Property | Expected fence label of the input |

<!-- databook:id: manifest-worked-example -->
<!-- databook:label: Build manifest placing the worked example in a two-stage pipeline -->
<!-- mode=printed -->
```manifest
@prefix build: <https://w3id.org/databook/ns#> .
@prefix ex:    <https://example.org/databooks/> .

ex:sensor-catalogue-validated-v1 a build:Target ;
    build:outputType "turtle12" ;
    build:dependsOn  ex:sensor-catalogue-v1 , ex:sensor-shapes-v1 .

ex:sensor-catalogue-v1 a build:Stage ;
    build:transformer "llm" ;
    build:inputType   "csv" ;
    build:outputType  "turtle12" ;
    build:dependsOn   ex:sensor-inventory-csv-2026-08 , ex:sensor-shapes-v1 .

ex:sensor-shapes-v1 a build:Source ;
    build:outputType "shacl" .

ex:sensor-inventory-csv-2026-08 a build:Source ;
    build:outputType "csv" .
```

Because it is RDF, change impact is a one-line query:
`?affected build:dependsOn+ ex:sensor-shapes-v1`. Type compatibility is
another: find every `dependsOn` edge where the consumer's `inputType` and
the producer's `outputType` disagree.

### 11.2 Transformer libraries (`type: transformer-library`)

A catalogue of named, reusable transforms — SPARQL CONSTRUCTs, XSLT, SHACL
rules, prompt templates — each with a stable fragment IRI. Process stamps
then reference a transform by IRI (`transformer_type: library-transform`)
instead of embedding it.

| Term | Type | Description |
|---|---|---|
| `build:NamedTransform` | Class | One catalogue entry |
| `build:transformerType` | Property | §6.3 value |
| `build:inputType` / `build:outputType` | Property | Expected fence labels |

### 11.3 Processor registries (`type: processor-registry`)

A catalogue of named processing *services* — SPARQL endpoints, LLM APIs,
validation services — each with an IRI, a capability profile, and a
status. Process stamps reference a processor by IRI
(`transformer_type: registry-processor`), decoupling pipeline definitions
from deployment details.

| Term | Type | Description |
|---|---|---|
| `build:Processor` | Class | One registry entry |
| `build:processorType` | Property | §6.3 value |
| `build:serviceIRI` | Property | Endpoint or homepage |
| `build:rdfVersion` | Property | RDF version supported (graph stores) |
| `build:modelVersion` | Property | Model version string (LLM processors) |
| `build:status` | Property | `build:Active`, `build:Inactive`, `build:Deprecated` |
| `build:capabilityNote` | Property | Free-text capabilities, limits, access requirements |

## 12. PROV-O alignment **[v1.1] [v2.0]**

The header module is built to sit inside W3C PROV-O without requiring it to
be loaded. The YAML stamp is a human-readable projection of a PROV graph;
the **[v2.0]** classes make the alignment explicit through `rdfs:subClassOf`.

| DataBook concept | PROV-O | How |
|---|---|---|
| The document (`id`) | `prov:Entity` | `databook:DataBookHeader rdfs:subClassOf prov:Entity` |
| `process` | `prov:Activity` | `databook:ProcessStamp rdfs:subClassOf prov:Activity` |
| `author[]` entries | `prov:Agent` | `databook:AuthorStamp rdfs:subClassOf prov:Agent` |
| `process.agent` | `prov:Agent` | `databook:AgentStamp rdfs:subClassOf prov:Agent` |
| `process.inputs[]` entries | `prov:Entity` | `databook:ProcessInput rdfs:subClassOf prov:Entity` |
| `process.inputs[].iri` | `prov:used` | The activity used these entities |
| `process.transformer_iri`, `process.agent.iri` | `prov:wasAssociatedWith` | Software and human agents of the activity |
| `process.output.*` | `prov:generated` | What the activity produced |
| `process.timestamp` | `prov:endedAtTime` | When the activity completed |
| `created` | `prov:generatedAtTime` | When the entity came into being |
| One DataBook citing another | `prov:wasDerivedFrom` | When the output derives from a specific input |

### 12.1 Two granularities of provenance

The YAML stamp covers the DataBook *as a whole*. Inside a `turtle12` block,
individual triples carry their own provenance through RDF 1.2 annotations —
the worked example (§13.1) annotates one calibration assertion with its
source log. The two are complementary, not alternatives: document-level
provenance says how the graph was made; assertion-level provenance says
where one fact in it came from.

### 12.2 Walking the chain

`process.inputs[n].iri` values are DataBook IRIs; those DataBooks carry their
own stamps. The chain is therefore graph-traversable:

    primer ─process.inputs─▶ header-shapes ─process.inputs─▶ property-reference
                                            └────────────────▶ SHACL 1.2 WD
                                            └────────────────▶ prior holon: draft

The `select-provenance-one-hop` query in §10.3 is one step of that walk.

## 13. A complete worked example, end to end

Everything in §5 comes together here: a complete DataBook, the RDF
projection of its header, that projection validated against the candidate
shapes, and a deliberately broken header with the report it produces.

### 13.1 The example DataBook

Shown as an indented block for the reason given in §8.6. Its primary block
is Turtle 1.2 and was validated and counted with Apache Jena 6.2.0 `riot`
(29 triples, 8 subjects — the reifier `obs:cal-therm-01-2026-06` is the
eighth). The frontmatter's `graph` block reports exactly that.

    ---
    id: https://example.org/databooks/sensor-catalogue-v1
    title: "Example Observatory Sensor Catalogue"
    type: databook
    version: 1.2.0
    created: 2026-09-07
    description: >
      A worked example used throughout the DataBook v2.0 primer: a small
      catalogue of sensors at a fictional observatory.
    author:
      - name: Kurt Cagle
        iri: https://holongraph.com/people/kurt-cagle
        role: orchestrator
      - name: Chloe Shannon
        iri: https://holongraph.com/people/chloe-shannon
        role: transformer
    license: CC-BY-4.0
    domain: https://example.org/ontology/sensor#
    subject:
      - sensor metadata
      - observatory operations
    tags:
      - example
      - primer
      - sosa
    publisher: Example Observatory Consortium
    imports:
      - https://example.org/databooks/sensor-ontology-v2
    shapes:
      - https://example.org/shapes/SensorShape
      - https://example.org/shapes/ObservationShape
    graph:
      namespace: https://example.org/ontology/sensor#
      named_graph: https://example.org/databooks/sensor-catalogue-v1#graph
      triple_count: 29
      subjects: 8
      rdf_version: "1.2"
      turtle_version: "1.2"
      reification: true
      validator_note: >
        Uses RDF 1.2 triple-term annotations on calibration assertions;
        requires Jena 6.0 or another RDF 1.2 parser for full fidelity.
    process:
      transformer: "Claude Sonnet 5"
      transformer_type: llm
      transformer_iri: https://api.anthropic.com/v1/models/claude-sonnet-5
      inputs:
        - iri: https://example.org/databooks/sensor-inventory-csv-2026-08
          role: primary
          description: "Raw sensor inventory export, one row per instrument."
        - iri: https://example.org/databooks/sensor-shapes-v1
          block_id: sensor-shapes
          role: constraint
          description: "SHACL shapes the catalogue must conform to."
      timestamp: 2026-09-07T18:30:00Z
      agent:
        name: Chloe Shannon
        iri: https://holongraph.com/people/chloe-shannon
        role: orchestrator
      note: >
        Sensor identifiers were reconciled by hand after generation; the LLM
        step is non-deterministic.
      output_format: turtle12
      output_media_type: "text/turtle; version=1.2"
      output:
        graph: https://example.org/databooks/sensor-catalogue-v1#graph
        url: https://store.example.org/ds/data
        file: ./build/sensor-catalogue.ttl
    ---

    ## Overview

    Three sensors at one site, the properties they observe, and one calibration
    record carrying assertion-level provenance through an RDF 1.2 annotation.

    ## Primary data

    <!-- databook:id: sensor-catalogue -->
    <!-- databook:label: Sensor catalogue for Site A -->
    <!-- databook:graph: https://example.org/databooks/sensor-catalogue-v1#graph -->
    ```turtle12
    @prefix sosa:   <http://www.w3.org/ns/sosa/> .
    @prefix rdfs:   <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .
    @prefix dcterms: <http://purl.org/dc/terms/> .
    @prefix sensor: <https://example.org/ontology/sensor#> .
    @prefix obs:    <https://example.org/observatory/> .

    obs:SiteA a sensor:Site ;
        rdfs:label "Site A — Ridge Station"@en ;
        sensor:hosts obs:therm-01 , obs:baro-01 , obs:hygro-01 .

    obs:therm-01 a sosa:Sensor ;
        rdfs:label "Thermistor 01"@en ;
        sosa:observes sensor:AirTemperature ;
        sensor:serialNumber "TH-2026-0117" ;
        sensor:calibratedOn "2026-06-14"^^xsd:date
            ~ obs:cal-therm-01-2026-06
            {| dcterms:source obs:calibration-log-2026-q2 ;
               rdfs:comment "Two-point calibration, ice bath and 40 °C block."@en |} .

    obs:baro-01 a sosa:Sensor ;
        rdfs:label "Barometer 01"@en ;
        sosa:observes sensor:AirPressure ;
        sensor:serialNumber "BA-2026-0042" ;
        sensor:calibratedOn "2026-05-30"^^xsd:date .

    obs:hygro-01 a sosa:Sensor ;
        rdfs:label "Hygrometer 01"@en ;
        sosa:observes sensor:RelativeHumidity ;
        sensor:serialNumber "HY-2026-0089" ;
        sensor:calibratedOn "2026-05-30"^^xsd:date .

    sensor:AirTemperature  a sosa:ObservableProperty ; rdfs:label "Air temperature"@en .
    sensor:AirPressure     a sosa:ObservableProperty ; rdfs:label "Air pressure"@en .
    sensor:RelativeHumidity a sosa:ObservableProperty ; rdfs:label "Relative humidity"@en .
    ```

    ## Queries

    <!-- databook:id: select-sensors-by-property -->
    <!-- databook:param: property type=IRI default=sensor:AirTemperature -->
    <!-- mode=printed -->
    ```sparql
    PREFIX sosa:   <http://www.w3.org/ns/sosa/>
    PREFIX rdfs:   <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX sensor: <https://example.org/ontology/sensor#>

    SELECT ?sensor ?label ?serial WHERE {
        VALUES ?property { sensor:AirTemperature }
        ?sensor a sosa:Sensor ;
                sosa:observes ?property ;
                rdfs:label ?label ;
                sensor:serialNumber ?serial .
    }
    ```

    ## Usage

    > **Note:** The primary block is Turtle 1.2. rdflib will reject the
    > annotation on `obs:therm-01`; load with Jena 6 (or strip the annotation
    > to obtain the 26-triple RDF 1.1 base graph).


Three things to notice. The `graph` block is honest about needing an RDF 1.2
parser, and the `validator_note` says what an RDF 1.1 consumer will get
instead. The second input cites a specific block of the shapes DataBook
through `block_id`. And the query block is `mode=printed` — it documents a
query; it does not declare an endpoint, so no processor will try to run it.

### 13.2 Its RDF projection — this document's primary data block

The header above, projected into the `databook:` namespace. This is the one
block in this primer with no `mode` directive: it is the payload the
frontmatter's `graph` block describes. A generic mapper produces it by
reading `id`, minting the header node, walking the shapes graph, and
resolving every `sh:codeIdentifier` against the parsed YAML. Nested objects
(`author[]`, `graph`, `process`, `process.inputs[]`, `process.agent`,
`process.output`) each become a node of the `sh:node` target class, minted
here as fragment-style IRIs off the document IRI so they stay stable across
re-projections.

<!-- databook:id: header-projection-example -->
<!-- databook:label: databook: projection of the worked example's frontmatter -->
<!-- databook:graph: https://w3id.org/holon/databook/primer#graph -->
```turtle
@prefix databook: <https://w3id.org/holon/databook#> .
@prefix xsd:      <http://www.w3.org/2001/XMLSchema#> .
@prefix ex:       <https://example.org/databooks/> .
@prefix exsh:     <https://example.org/shapes/> .
@prefix people:   <https://holongraph.com/people/> .

# -----------------------------------------------------------------------------
# RDF projection of the example frontmatter shown in §10.1. The DataBook's own
# `id` becomes the subject IRI of the header node; every other frontmatter key
# becomes one predicate on that node, or one nested node reached through it.
# -----------------------------------------------------------------------------

ex:sensor-catalogue-v1
    a databook:DataBookHeader ;
    databook:title       "Example Observatory Sensor Catalogue" ;
    databook:version     "1.2.0" ;
    databook:created     "2026-09-07"^^xsd:date ;
    databook:description "A worked example used throughout the DataBook v2.0 primer: a small catalogue of sensors at a fictional observatory." ;
    databook:license     "CC-BY-4.0" ;
    databook:domain      <https://example.org/ontology/sensor#> ;
    databook:subject     "sensor metadata" , "observatory operations" ;
    databook:tag         "example" , "primer" , "sosa" ;
    databook:publisher   "Example Observatory Consortium" ;
    databook:imports     ex:sensor-ontology-v2 ;
    databook:shapes      exsh:SensorShape , exsh:ObservationShape ;
    databook:author      ex:sensor-catalogue-v1-author-1 , ex:sensor-catalogue-v1-author-2 ;
    databook:graph       ex:sensor-catalogue-v1-graph-meta ;
    databook:process     ex:sensor-catalogue-v1-process .

ex:sensor-catalogue-v1-author-1
    a databook:AuthorStamp ;
    databook:authorName "Kurt Cagle" ;
    databook:authorIri  people:kurt-cagle ;
    databook:authorRole "orchestrator" .

ex:sensor-catalogue-v1-author-2
    a databook:AuthorStamp ;
    databook:authorName "Chloe Shannon" ;
    databook:authorIri  people:chloe-shannon ;
    databook:authorRole "transformer" .

ex:sensor-catalogue-v1-graph-meta
    a databook:GraphMetadata ;
    databook:namespace       <https://example.org/ontology/sensor#> ;
    databook:namedGraph      <https://example.org/databooks/sensor-catalogue-v1#graph> ;
    databook:tripleCount     29 ;
    databook:subjectCount    8 ;
    databook:rdfVersion      "1.2" ;
    databook:turtleVersion   "1.2" ;
    databook:usesReification true ;
    databook:validatorNote   "Uses RDF 1.2 triple-term annotations on calibration assertions; requires Jena 6.0 or another RDF 1.2 parser for full fidelity." .

ex:sensor-catalogue-v1-process
    a databook:ProcessStamp ;
    databook:transformer      "Claude Sonnet 5" ;
    databook:transformerType  "llm" ;
    databook:transformerIri   <https://api.anthropic.com/v1/models/claude-sonnet-5> ;
    databook:timestamp        "2026-09-07T18:30:00Z"^^xsd:dateTime ;
    databook:input            ex:sensor-catalogue-v1-input-1 , ex:sensor-catalogue-v1-input-2 ;
    databook:agent            ex:sensor-catalogue-v1-agent ;
    databook:note             "Sensor identifiers were reconciled by hand after generation; the LLM step is non-deterministic." ;
    databook:outputFormat     "turtle12" ;
    databook:outputMediaType  "text/turtle; version=1.2" ;
    databook:output           ex:sensor-catalogue-v1-output .

ex:sensor-catalogue-v1-input-1
    a databook:ProcessInput ;
    databook:sourceIri   ex:sensor-inventory-csv-2026-08 ;
    databook:role        "primary" ;
    databook:description "Raw sensor inventory export, one row per instrument." .

ex:sensor-catalogue-v1-input-2
    a databook:ProcessInput ;
    databook:sourceIri   ex:sensor-shapes-v1 ;
    databook:role        "constraint" ;
    databook:description "SHACL shapes the catalogue must conform to." ;
    databook:blockId     "sensor-shapes" .

ex:sensor-catalogue-v1-agent
    a databook:AgentStamp ;
    databook:agentName "Chloe Shannon" ;
    databook:agentIri  people:chloe-shannon ;
    databook:agentRole "orchestrator" .

ex:sensor-catalogue-v1-output
    a databook:OutputSpec ;
    databook:outputGraph <https://example.org/databooks/sensor-catalogue-v1#graph> ;
    databook:outputUrl   <https://store.example.org/ds/data> ;
    databook:outputFile  "./build/sensor-catalogue.ttl" .
```

### 13.3 Validation: conforms

Parsed with rdflib 7.6.0 — **66 triples, 9 named subjects** (the header,
two authors, graph metadata, process stamp, two inputs, agent, output spec) —
and validated with pyshacl 0.40.1 against the full 738-triple shapes graph
at `https://w3id.org/holon/databook#`, inference off:

    Validation Report
    Conforms: True

Every `sh:node` link resolves: the header's `process` value is checked
against `ProcessStampShape`, whose `input` values are checked against
`ProcessInputShape`, and so on down. A nested failure is reported both at
the leaf and, as a `NodeConstraintComponent` result, at the link — which is
what §13.4 shows.

### 13.4 Validation: a header that fails

Four deliberate faults: an empty `title`, a `version` with a leading `v`, a
`transformer_type` outside the vocabulary, and no `inputs` at all.

<!-- databook:id: header-broken-example -->
<!-- databook:label: Deliberately non-conforming header, for the report below -->
<!-- mode=reference -->
```turtle
@prefix databook: <https://w3id.org/holon/databook#> .
@prefix xsd:      <http://www.w3.org/2001/XMLSchema#> .
@prefix ex:       <https://example.org/databooks/> .

ex:broken-v1
    a databook:DataBookHeader ;
    databook:title   "" ;
    databook:version "v1.2" ;
    databook:created "2026-09-07"^^xsd:date ;
    databook:process ex:broken-v1-process .

ex:broken-v1-process
    a databook:ProcessStamp ;
    databook:transformer     "Someone" ;
    databook:transformerType "wizard" ;
    databook:timestamp       "2026-09-07T18:30:00Z"^^xsd:dateTime .
```

The real report, lightly reformatted:

<!-- databook:id: shacl-report-broken-example -->
<!-- databook:label: pyshacl validation report for header-broken-example -->
<!-- mode=printed -->
```text
Validation Report
Conforms: False
Results (5):
Constraint Violation in InConstraintComponent:
    Severity: sh:Violation
    Source Shape: databook:ProcessStampShape-transformerType
    Focus Node: ex:broken-v1-process
    Value Node: Literal("wizard")
    Result Path: databook:transformerType
    Message: transformer_type must be one of the defined vocabulary values.
Constraint Violation in MinCountConstraintComponent:
    Severity: sh:Violation
    Source Shape: databook:ProcessStampShape-input
    Focus Node: ex:broken-v1-process
    Result Path: databook:input
    Message: Process stamp must declare at least one input.
Constraint Violation in MinLengthConstraintComponent:
    Severity: sh:Violation
    Source Shape: databook:DataBookHeaderShape-title
    Focus Node: ex:broken-v1
    Value Node: Literal("")
    Result Path: databook:title
    Message: Every DataBook must have exactly one non-empty title.
Constraint Violation in NodeConstraintComponent:
    Severity: sh:Violation
    Source Shape: databook:DataBookHeaderShape-process
    Focus Node: ex:broken-v1
    Value Node: ex:broken-v1-process
    Result Path: databook:process
    Message: Every DataBook must carry a process provenance stamp.
    Details: (the two ProcessStampShape violations above, re-reported
              as the reason the nested sh:node check on `process` failed)
Constraint Violation in PatternConstraintComponent:
    Severity: sh:Violation
    Source Shape: databook:DataBookHeaderShape-version
    Focus Node: ex:broken-v1
    Value Node: Literal("v1.2")
    Result Path: databook:version
    Message: version must be a semantic version string (MAJOR.MINOR.PATCH).
```

Five results for four faults, because the two `ProcessStampShape` failures
surface once each on the process node *and* once more, nested, on the
header's `process` link. That is standard SHACL behaviour for `sh:node`, and
a consumer reading the report should de-duplicate by `(Focus Node, Result
Path)` before counting.

## 14. Validation checklist

Run this before publishing any DataBook. Items marked **[v2.0]** are what
the candidate shapes enforce; the rest are structural and come from
SPEC.md v1.1 and the v1.2 conventions.

**Document structure**
- [ ] Line 1 is `---`; nothing precedes it
- [ ] Frontmatter closes with `---` on its own line before any prose
- [ ] Frontmatter is well-formed YAML; `title` is quoted if it contains a colon; `rdf_version` and `turtle_version` are quoted strings
- [ ] Body may contain zero or more fenced data blocks; the frontmatter alone qualifies the document as a DataBook
- [ ] No `<script language="application/yaml">` wrapper emitted

**Required identity and provenance — [v2.0] enforced**
- [ ] `id` is a stable IRI
- [ ] `type` is `databook`, `transformer-library`, or `processor-registry`
- [ ] `title` is non-empty
- [ ] `version` is full SemVer 2.0.0
- [ ] `created` is `YYYY-MM-DD`
- [ ] `process` is present with `transformer`, `transformer_type` (§6.3), `timestamp` (with timezone), and at least one `inputs[]` entry carrying `iri` and `role` (§6.4)
- [ ] Every `author[]` entry has a `name`; roles are from §6.2
- [ ] `license` and `publisher`, if present, are a string or an IRI, not a mapping

**Graph metadata**
- [ ] `graph.triple_count` and `graph.subjects` match the primary payload as counted by the reference parser for its RDF version (rdflib for 1.1, Jena riot for 1.2)
- [ ] `rdf_version: "1.2"`, `turtle_version: "1.2"`, `reification: true`, and a `turtle12` label all agree whenever triple-term or annotation syntax is present
- [ ] `graph.named_graph` matches the primary block's `databook:graph` if both are set

**Block headers — [v1.2]**
- [ ] Every data block has `<!-- databook:id: kebab-case -->` as the first line of its pre-fence zone
- [ ] `databook:id` values are unique within the document
- [ ] Header lines are *before* the opening fence, not inside it
- [ ] Zone ordering: `databook:id` → other `databook:` keys → directives
- [ ] Directive lines are `<!-- key=value … -->`, never prefixed `databook:`
- [ ] `mode` is one of `executed`, `rendered`, `printed`, `hidden`, `reference`
- [ ] `mode=executed` blocks declare `endpoint=<IRI>` unless a registry supplies it
- [ ] `mode=rendered` labels are `mermaid`, `geojson`, `vega-lite`, or `svg`
- [ ] No `databook:executable` in new documents
- [ ] Blocks labelled with a payload label (`yaml`, `json`, `turtle`, …) that are *documentation* carry `mode=printed`
- [ ] Embedded DataBook examples are indented, not nested-fenced (§8.6)

**Linking**
- [ ] `process.inputs[].iri` values resolve, and any `block_id` names a real `databook:id` in that input
- [ ] `imports[]` and `shapes[]` are IRIs
- [ ] Manifest/library/registry blocks use `https://w3id.org/databook/ns#`, not the pre-1.0 `databook.org/ns/build#`

**Profiles — [proposed]**
- [ ] `profiles[]`, if present, lists IRIs that resolve to profile descriptors
- [ ] Every profile-prefixed comment key uses a prefix one of the declared profiles registers
- [ ] The document satisfies each declared profile's shapes *in addition to* core's — never instead of

**Projection — [v2.0]**
- [ ] The frontmatter, projected into `databook:`, validates against `https://w3id.org/holon/databook#` with no `sh:Violation`

## 15. Parser conformance **[v1.1] [v1.2]**

### 15.1 Capability tiers

| Parser | Behaviour |
|---|---|
| Plain Markdown renderer | Renders prose; shows every fenced block as code; ignores comments. Everything is still readable. |
| YAML-frontmatter-aware renderer | Also extracts `title`, `author`, `description` from the `---` block. |
| DataBook core parser | Extracts `---` frontmatter (or the `<script>` form on input); extracts typed blocks with their pre-fence headers; routes by label; applies `mode`; resolves `databook:id`; skips encrypted blocks without error. |
| DataBook parser, encryption profile | Also decrypts and loads encrypted blocks. |
| RDF 1.2 parser (Jena 6) | Full fidelity for `turtle12` blocks. |
| RDF 1.1 parser (rdflib) | Base graph only; annotation syntax is a parse error unless pre-filtered. |

### 15.2 Required behaviours

A conformant core parser **must**: accept both frontmatter forms and emit
only the bare `---` form; identify blocks by label and route them; treat
unknown labels as display blocks without error; treat encrypted labels as
opaque without the profile; ignore unknown frontmatter keys and unknown
`databook:` keys without error; collect the pre-fence comment zone and
distinguish `databook:` keys from directives by the §8.5 rule; make
`databook:id` blocks addressable; require explicit user confirmation
before executing any `mode=executed` imperative block; and, on meeting a
profile IRI in `profiles[]` it does not recognise, **warn and continue as
core** — never fail, since conformance to any profile implies conformance
to core (§4.1).

### 15.3 Error handling

| Condition | Required behaviour |
|---|---|
| Malformed YAML frontmatter | **Error.** Not a DataBook. |
| Missing `id`, `title`, `type`, or `version` | **Error.** Required identity. |
| `type` not a recognised value | **Error.** Not a DataBook; do not process as one. |
| Missing `process` when data blocks are present | **Warning.** Structurally valid, provenance-incomplete. **[v2.0]** validation of the projection will additionally fail. |
| `graph.triple_count` mismatch | **Warning.** Load anyway. Informational field. |
| Execution failure, non-update block | **Warning.** Skip the block, continue. |
| Execution failure, `sparql-update` block | **Error.** Halt. Partial mutation is unsafe. |
| Encrypted block with no `encryption.blocks` entry | **Error.** Cannot be safely identified. |
| Encryption auth-tag mismatch | **Error.** Do not load. Security-critical. |
| `mode=executed` without confirmation | **Refuse.** Error. |
| `mode=executed` without `endpoint` | Treat as `mode=printed`. |
| `mode=rendered` with unsupported label | **Warning.** Fall back to `mode=printed`. |
| `databook:import` cycle | **Error.** |
| `databook:executable` encountered | Accept as `mode=executed` with no endpoint; **warn** and prompt migration. |
| Header lines inside the fence (v1.1 form) | Accept; strip from payload; **warn** and prompt migration. |

## 16. Open issues for the Working Group

Everything below is a decision this document could not make on the WG's
behalf. They are ordered by how much else depends on them.

1. **Ratify the v1.2 block-header conventions into `SPEC.md` — and make
   the CLI honour them.** The pre-fence comment zone (§8.1) is implemented
   in the reference CLI; the directive syntax and `mode` vocabulary (§8.3),
   the ordering rule (§8.4), and the deprecation of `databook:executable`
   are used by every DataBook produced since April but exist only in the
   LLM skill. The CLI's parser was truncated by directive lines until
   2026-09-07 (§8.7); it now reads them but does not yet act on `mode`.
   `SPEC.md` still stops at v1.1 and `CHANGELOG.md` at "Unreleased". Until
   the text and the tooling agree, "conformant" is ambiguous in practice as
   well as on paper.

2. **Adopt the header module as the v2.0 normative projection — and
   re-home it.** Decide that the seven node shapes in §5 are normative and
   that a v2.0 DataBook is one whose projected header validates against
   them. Then decide the namespace: the module is published at
   `https://w3id.org/holon/databook#`, and §4.5 argues it belongs at
   `https://w3id.org/databook/header#` because it is core, not holon's.
   This also decides where the shapes are published — the WG's own
   repository, not a personal one — and requires that the w3id.org
   redirects for `https://w3id.org/databook/ns#`, the new header namespace,
   and `https://w3id.org/holon/databook#` (as the holon profile IRI) all be
   registered and dereference.

3. **Resolve the v1.1 / v2.0 cardinality differences** listed in §5:
   `process.timestamp` (recommended → required), `process.inputs` (empty
   list allowed → at least one), `process.inputs[].role` (recommended →
   required), `process.agent.role` (required → optional), and `process`
   itself (conditional → unconditional). Each is a reasonable tightening;
   each needs to be stated in the spec text, not only in the shapes.

4. **Model or drop `process.outputs[]`.** v1.1 defines the plural form; v2.0
   has no shape for it. Either make `databook:output` repeatable (drop
   `sh:maxCount 1` on `ProcessStampShape-output`) and retire the plural key,
   or shape the plural key. Do not leave a v1.1 key with no v2.0 meaning.

5. **Write `tags`, `publisher`, and `imports` into the spec text.** They are
   shaped but undocumented in `SPEC.md`. `imports` in particular needs the
   §9.3 clarification that it is namespace context, not `owl:imports`.

6. **Pick one prefix for `https://w3id.org/databook/ns#`.** `SPEC.md` says
   `build:`; the shapes module's `sh:declare` says `db:`. Two prefixes for one
   namespace in two normative documents will confuse every reader.
   Recommendation: `build:`, matching the published spec, with `db:` removed
   from the shapes module's declaration table.

7. **Rule on embedding.** §8.6 documents that nested fences are unsafe with
   the reference scanner and that indented blocks are the workaround. The WG
   should either (a) specify that a conformant scanner recognises only
   column-zero three-backtick fences, making indentation the rule, or (b)
   extend the scanner to handle fence nesting per CommonMark and say so.
   (a) is simpler and matches current behaviour.

8. **`type` → `rdf:type`, or a `databook:documentType` literal?** The current
   design maps the YAML `type` to `rdf:type` with three classes. It is clean
   and queryable, and the profile model (§4.3) argues for keeping it: a
   profile-defined document type is simply a class `rdfs:subClassOf
   databook:DataBookHeader` in the profile's namespace, which an enumeration
   of strings could not express without core being edited. The residual cost
   is that `DataBookHeaderShape-type`'s `sh:in` is a list of classes rather
   than strings, which may surprise generic mappers. Recommendation: confirm
   `rdf:type`, and state in the spec that profiles extend it by subclassing.

9. **Align `sh:message` with `sh:pattern` on `version`.** The pattern accepts
   full SemVer 2.0.0; the message still says `MAJOR.MINOR.PATCH`. Trivial,
   but a validator's message is the only thing many users read.

10. **`sh:codeIdentifier` and `sh:declare` are SHACL 1.2 Working Draft
    terms** (WD 2026-08-03). The header module depends on them for its
    mapping semantics. The WG should note the dependency, track the WD to
    Recommendation, and decide what to do if either term changes.

11. **Reify the `encryption` profile or keep it reserved.** v1.1 reserves the
    key and defines the profile's interface; v2.0 gives it no shape. Keeping
    it reserved-but-unshaped is defensible; saying so explicitly is required.

12. **Externally sourced named queries.** The fragment-addressed query
    catalogue (§10) currently assumes the query text is *in* the DataBook.
    A design for `ExternallySourcedQuery` — a `sparql` block whose body is
    resolved from another IRI at execution time — exists as a draft outside
    the WG and is the subject of an open migration task. It should come to
    the WG as a v2.x proposal once the v2.0 header module is settled.

13. **A DataBook with no data block.** §3 now states that the frontmatter,
    not the presence of a typed payload, is what makes a document a
    DataBook, and that a frontmatter-bearing document with only prose is a
    DataBook. `SPEC.md` v1.1 §4 says the reverse. The WG should ratify the §3
    position and amend `SPEC.md` §4 ("Document Structure") and the
    minimum-viable example in `SPEC.md` §18 accordingly; `SPEC.md` §15.4's
    error table needs no change, since it never listed a missing data block
    as an error.

14. **Ratify the profile model (§4).** The definition, the additive-only
    conformance rule, the `profiles[]` key with a `databook:profile` shape,
    the named extension points, and the PROF descriptor convention. This is
    the change that turns the DataBook format from one architecture's
    artefact into a neutral core that others can adopt without forking.

15. **Register the holon profile.** Move the holonic reading, the HGA mode
    patterns, and the authority semantics (§4.6) out of core prose and into
    a holon profile DataBook at `https://w3id.org/holon/databook#`, owned by
    the Holon CG, with its PROF descriptor and its one-line L3 shape.

16. **Generalise comment-key prefixes.** §8.2 and §8.5 now allow a profile
    to register a comment-key prefix. The reference scanner recognises only
    `databook:`; it needs to accept declared prefixes and to key metadata by
    the full prefixed name.

17. **Invite an OKF profile.** Open Knowledge Format is the most likely
    second profile. Its editors should be asked what an OKF DataBook needs
    that core does not provide — keys, block labels, shapes — so that the
    extension points in §4.3 are tested against a real second community
    before v2.0 is frozen.

## 17. Specification history

| Version | Date | What changed |
|---|---|---|
| 0.9 | 2026-04-12 | Internal consistency reference. Bare `---` frontmatter; namespace `databook.org/ns/build#`; core structure, block label vocabulary, process stamp, manifest pattern. |
| 1.0 | 2026-04-19 | Frontmatter wrapped in `<script language="application/yaml">`; namespace moved to `https://w3id.org/databook/ns#`; `transformer-library` and `processor-registry` document types; `library-transform` and `registry-processor` transformer types; `build:outputType`. Parameterised queries inadvertently dropped. |
| 1.1 | 2026-04-25 | **Current canonical.** Bare `---` restored as canonical, `<script>` demoted to accepted alternative. Parameterised queries, `databook:param` / `executable` / `runtime`, and `process.output*` restored. Reference implementation named. |
| 1.2 *(practice)* | from 2026-04-28 | Block header moved to the pre-fence comment zone — implemented in the CLI (v1.2.0 → 1.4.x). Block directives (`mode=`, `endpoint=`, `cache=`, `authority=`, `version=`, `result-iri=`, `expires=`) and the deprecation of `databook:executable` — in the LLM skill only; the CLI does not parse them (§8.7). Not yet in `SPEC.md`. |
| 2.0.0-alpha.1 *(candidate)* | 2026-08-24 | Header module: `databook:` bridge namespace at `https://w3id.org/holon/databook#`; seven SHACL 1.2 node shapes and 46 property shapes with `sh:codeIdentifier`; PROV-O subclassing; `sh:declare` prefix table; `owl:priorVersion` link to the same-day `holon:`-namespaced draft it replaced; `version` pattern widened to full SemVer. Offered to the HCG DataBook WG. |
| — | 2026-09-07 | This primer, v1.0.0. |
| — | 2026-09-07 | This primer, v1.1.0: the profile model (§4), with the holon architecture recast as one profile and the header namespace proposed for re-homing. v1.1.1: corrected the claim that the CLI implements directives (§8.7). v1.1.2: the CLI parser fix landed; §8.7 records it. |

## 18. References

- **DataBook Format Reference v1.1.** Cagle, K. and Shannon, C. 2026-04-25.
  `https://github.com/kurtcagle/databook/blob/main/SPEC.md`
- **Holon DataBook Header Shapes (SHACL 1.2), v2.0.0-alpha.1.** 2026-08-24.
  `https://w3id.org/holon/databook#` — source at
  `https://github.com/kurtcagle/databook/blob/main/holon-databook-header-shapes.databook.md`
- **SHACL 1.2 Core, W3C Working Draft 03 August 2026.**
  `https://www.w3.org/TR/2026/WD-shacl12-core-20260803/`
- **RDF 1.2 Concepts and Abstract Syntax; RDF 1.2 Turtle.** W3C.
  `https://www.w3.org/TR/rdf12-concepts/`, `https://www.w3.org/TR/rdf12-turtle/`
- **PROV-O: The PROV Ontology.** W3C Recommendation, 2013.
  `https://www.w3.org/TR/prov-o/`
- **The Profiles Vocabulary (PROF).** W3C Working Group Note, 2019.
  `https://www.w3.org/TR/dx-prof/`
- **Guidelines for Dublin Core Application Profiles.** DCMI.
  `https://www.dublincore.org/specifications/dublin-core/profile-guidelines/`
- **Semantic Versioning 2.0.0.** `https://semver.org/spec/v2.0.0.html`
- **SPDX License List.** `https://spdx.org/licenses/`
- **W3C Holon Community Group.** `https://www.w3.org/community/holon/`;
  repository `https://github.com/w3c-cg/holon`

---

*This primer is a DataBook. Its primary data block is the RDF projection of
the worked example in §13; its frontmatter describes that block; its process
stamp cites the shapes module it documents as a `constraint` input. Version
1.1.2, 2026-09-07. Proposed amendments should be raised with the HCG DataBook
Working Group.*
