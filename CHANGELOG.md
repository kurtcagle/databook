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
