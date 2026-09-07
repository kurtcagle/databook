# DataBook Changelog

All notable changes to the DataBook format specification and reference CLI are documented here.

## [Unreleased]

### CLI

- **Fixed:** `lib/parser.js` now recognises v1.2 block directive lines
  (`<!-- mode=printed -->`, `<!-- mode=executed endpoint=<iri> cache=true -->`)
  in the pre-fence comment zone and collects them into a new `directives`
  map on each block (with `mode` as a convenience field). Previously the
  backward walk that gathers `databook:` annotations stopped at the first
  non-annotation line, so any block whose zone ended in a directive — the
  conventional ordering — lost its `databook:id` and all other pre-fence
  metadata. Run against the DataBook Specification Primer, the old parser
  returned 18 of 19 blocks as anonymous; the new one returns none.
  Directive lines *inside* a fence remain payload, as specified. No change
  to how any existing fixture parses. Added `parseDirectiveLine()`.
- **Added:** `test/directives.databook.md` fixture and
  `test/parser-directives.test.mjs`; `npm test` now runs `node --test`
  before the smoke check. Set `PRIMER=<path>` to also assert the primer
  parses cleanly.
- `implementations/js/lib/parser.js` synced with the root parser (it had
  been behind since the pre-fence annotation work in April).

### Header namespace re-homed (databook:)

- **Changed:** the `databook:` header-projection namespace moves from
  `https://w3id.org/holon/databook#` to `https://w3id.org/databook/header#`
  (module version 2.0.0-alpha.1 → 2.0.0-alpha.2). The header projection is
  what every DataBook does regardless of architecture, so it belongs to
  DataBook core rather than under `holon/`; see the DataBook Specification
  Primer §4 for the profile model this is part of, and §4.5 specifically
  for the re-home argument. `owl:priorVersion` on the shapes graph subject
  now carries both this and the original ontologist.io draft it superseded
  on 2026-08-24. No property shape, cardinality, `sh:codeIdentifier`, or
  constraint changed — only the namespace.
- **Fixed:** `lib/reify.js` no longer hard-codes the namespace. A new
  `getDatabookNamespace()` reads it from the bundled shapes file's own
  `sh:declare` table (parsed once, cached with the rest of the shapes
  index), so a future re-home is a one-file edit to
  `schema/holon-databook-header.shacl.ttl`, not a code change.
  `commands/list.js`'s legacy catalogue query is now built at call time
  (`buildLegacyListQuery()`) from the same source, replacing the
  module-level `LEGACY_LIST_QUERY` constant.
- **Added:** `migrations/2026-09-07-header-namespace-rehome.sparql` for
  anyone with data already pushed under the old namespace — rewrites all
  44 predicates and 9 classes this module defines, across both named
  graphs and the default graph, idempotently. Generated mechanically from
  the shapes index rather than hand-typed, and verified both against
  rdflib (in-memory, named + default graph) and against a real Apache
  Jena 6.2.0 TDB2 store via `tdb2.tdbupdate`: 11 triples in, 11 out, zero
  residual old-namespace triples in either check.
- `implementations/js/lib/reify.js` and
  `implementations/js/schema/holon-databook-header.shacl.ttl` synced with
  root.

### `mode` reconciled with `display_only`

- **Fixed:** the parser's pre-existing `display_only` field — which
  `commands/create.js` reads when folding an existing DataBook's blocks
  into a new one, and which `commands/head.js` reports — now also treats
  a block's `mode` (`printed`, `hidden`, or `reference`) as display-only,
  matching what those three mode values have always meant in the spec.
  `mode=executed` and `mode=rendered` do not force display-only; a
  rendered or executed block's payload status is governed by its fence
  label exactly as before. The pre-existing `databook:display-only: true`
  key is unchanged and still works standalone — this is additive, not a
  replacement. New exported `MODE_DISPLAY_ONLY_VALUES` set in
  `lib/parser.js`.
- **Correction to the note below:** on inspection, `push` and `process`
  turned out not to consult `display_only` at all — `push` filters
  purely by fence label (`PUSHABLE_LABELS`), and `process` runs an
  unrelated `processor-registry`/`build:` DAG pipeline with no `mode`
  awareness. The actual (and only) consumer of `display_only` from
  `lib/parser.js` is `commands/create.js`'s "merge an existing DataBook"
  path; `commands/ingest.js`'s similarly-named display-only concept is a
  self-contained classification over plain Markdown input, unrelated to
  this field, and is out of scope here.
- **Added:** `test/mode-display-only.databook.md` fixture (one block per
  `mode` value, plus the legacy-key and label-only cases) and
  `test/parser-display-only.test.mjs`; both copied to
  `implementations/js/test/`. No regressions across the 16 pre-existing
  fixtures.

### Profile model: `profiles[]`, prefixed comment keys, `typeToken` (S4, S16 items 3/4/6/14)

- **Added:** `lib/profiles.js` resolves a frontmatter `profiles[]` IRI to
  its registered comment-key prefixes and any additional SHACL shapes it
  declares. Bundled registry (`schema/profiles/index.json`) is tried
  first — fully offline, deterministic in CI — with a live HTTP fetch as
  fallback unless `offline` is set. An unresolvable profile is never a
  hard error: per SPEC §15.2's own contract, it is a warning and
  validation proceeds against core alone. Two bundled stub profiles ship
  as fixtures: `holon.profile.databook.md` (registers the `holon:`
  prefix; no shapes yet — an explicit placeholder for the real
  publication, primer §16 item 15) and `encryption.profile.databook.md`
  (no prefix, no shapes — the "profile with nothing to add but a
  documented convention" case, since SPEC §13's encryption profile is
  procedural, not SHACL-based).
- **Added:** `databook validate --header` — validates a DataBook's own
  frontmatter (projected via `frontmatterToTurtle()`) against the
  bundled header shapes plus any profiles declared in `profiles[]`,
  instead of a domain data block against `--shapes`. `--no-profiles`
  skips profile resolution; `--offline-profiles` restricts it to the
  bundled registry. Warns (does not fail) on an unresolvable profile or a
  comment-key prefix no declared profile registers. Verified end to end
  against a real Jena SHACL engine: a valid header conforms; a header
  with five deliberate faults (empty title, non-semver version, missing
  process, no inputs, invalid `transformer_type`) reports all five and
  exits 1 under `--fail-on-violation`; an unreachable profile domain
  warns and degrades to core-only validation without crashing.
- **Added:** `databook:profile` — an `sh:IRI` property shape for
  `profiles[]` (`sh:codeIdentifier "profiles[]"`), demonstrating that the
  shapes-driven design costs nothing: no code change to `lib/reify.js`
  was needed to project it. Module bumped to 2.0.0-alpha.3.
- **Fixed:** `lib/parser.js`'s `RE_META_COMMENT` now accepts any
  well-formed `prefix:key: value` comment, not only `databook:`. Core
  keys are stored bare (`id`, unchanged); other prefixes are stored under
  the full `prefix:key` string, so a declared profile's `holon:layer` or
  an undeclared `okf:something` are both captured (and distinguishable)
  rather than silently discarded as a prose comment — which, before this
  fix, also aborted the backward walk before it reached `databook:id` on
  the same block. `lib/profiles.js`'s `findUnregisteredPrefixes()` is the
  higher-level check for "declared by a profile" vs. merely well-formed.
- **Fixed:** `lib/reify.js`'s hand-maintained `TYPE_CLASS` table is gone.
  A new `databook:typeToken` class-level SHACL annotation
  (`databook:DataBookHeader databook:typeToken "databook"`, etc.) lets
  `type:` → class resolution be read from the bundled shapes file, the
  same way every other frontmatter field already was. A profile that
  defines its own document type as a class `rdfs:subClassOf
  databook:DataBookHeader` with its own `typeToken` needs no code change
  to be recognised by `frontmatterToTurtle()` — verified by injecting a
  synthetic class in an unrelated namespace and confirming the same
  scanning logic picks it up. Does **not** widen
  `DataBookHeaderShape-type`'s `sh:in` enumeration, which remains a
  separate, fixed list (primer §16 item 8) — the property shape's own
  `rdfs:comment` says so explicitly.
- **Added:** `getBundledShapesText()` in `lib/reify.js`, for callers (like
  `validate --header`) that need the raw shapes Turtle to union with
  profile shapes, alongside the existing parsed `sh:codeIdentifier` index.
- **Added:** `test/prefixed-keys.databook.md` +
  `test/parser-prefixed-keys.test.mjs` (item 4); `test/profiles.test.mjs`
  (items 3 and 6, fully offline). 29 tests total, 28 passing (1 skipped
  outside `PRIMER=` mode); zero regressions across all pre-existing
  fixtures.
- **Scope note:** `lib/profiles.js` and `schema/profiles/` are root-only.
  `implementations/js/commands/` never included `list.js` or
  `validate.js` — it is a smaller, older snapshot missing nine commands
  entirely — so there is nothing there to consume the new module, and
  mirroring it would be inert. `lib/parser.js`, `lib/reify.js`, and the
  shapes file remain synced as always.

### Not yet done (see the primer, §16 item 1)

- `mode=printed|hidden|reference` is parsed but not yet applied: `push` and
  `process` still decide display-only by label and by the CLI's own
  `databook:display-only: true` key. Reconciling the two is the next slice.

---

## [1.1] — 2026-04-25

### Format specification

**Frontmatter form**
- Bare `---`-delimited YAML frontmatter is now canonical. This is the standard Markdown frontmatter convention and renders correctly in GitHub, Claude, and all common Markdown tooling.
- The `<script language="application/yaml">` form (canonical in v1.0) is demoted to an accepted alternative. Parsers must continue to support it for backwards compatibility.

**Restored from v0.9**
- §8 Parameterised Queries restored: `databook:param` comment key, `VALUES`-clause substitution pattern, required parameters, client substitution mechanics.
- `databook:param`, `databook:executable`, `databook:runtime` restored to the reserved comment key list.
- `process.output_format`, `process.output_media_type`, `process.output`, `process.output.graph`, `process.output.url`, `process.output.file`, and `process.outputs` restored to the process stamp property table.

**Other changes**
- Repository restructured: spec at root, implementation under `implementations/js/`, examples under `examples/`.
- §3.5 Reference Implementation added, noting the Node.js CLI.
- Naming examples genericised; project-specific filenames removed.
- Complete annotated example updated to use bare `---` frontmatter.
- Parser behaviour section restructured: `---` is the primary detection path; `<script>` is the fallback for v1.0 compatibility.
- Error handling table expanded with `databook:executable` guard and `databook:import` circular reference conditions.

### Repository

- **New:** `examples/` directory with 8 reference DataBooks covering all major format features.
- **New:** `implementations/js/` consolidates the former `databook-cli-js` repository.
- **Updated:** `implementations/js/test/` fixtures genericised (removed GGSC/domain-specific content).
- **Updated:** `implementations/js/README.md` — full CLI command reference.

---

## [1.0] — 2026-04-19

### Format specification

**Breaking / canonical changes**
- YAML metadata block wrapped in `<script language="application/yaml">` (now demoted to accepted alternative in v1.1).
- Canonical namespace changed from `https://databook.org/ns/build#` to `https://w3id.org/databook/ns#`.

**New features**
- `type` field extended: `transformer-library` and `processor-registry` document types added.
- New fence labels: `transformer-library`, `processor-registry`.
- New transformer types: `library-transform`, `registry-processor`.
- `build:outputType` property added to build vocabulary.
- Extended build vocabulary: `build:NamedTransform`, `build:Processor`, and associated properties.
- Transformer Libraries and Processor Registries section added to spec.

### CLI (`databook-cli-js` — now `implementations/js/`)

- Initial release of all commands: `create`, `head`, `extract`, `convert`, `push`, `pull`, `clear`, `process`, `transform`, `prompt`.
- v1.1 CLI feature: SHACL-guided DESCRIBE — `pull --describe <iri> --shapes <ref>` compiles shapes to SPARQL CONSTRUCT (Tier 1: simple paths + `sh:inversePath`; Tier 2: `sh:node` recursion; Tier 3 deferred).

---

## [0.9] — 2026-04-12

Initial internal consistency reference. Bare `---` YAML frontmatter. Namespace `https://databook.org/ns/build#`. Pre-publication draft establishing the core structure, block label vocabulary, process stamp, and manifest pattern.
