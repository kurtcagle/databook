# DataBook Changelog

All notable changes to the DataBook format specification and reference CLI are documented here.

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
