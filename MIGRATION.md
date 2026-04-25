# DataBook Repository Migration Guide

This document describes how to migrate from the two-repo setup (`kurtcagle/databook` + `kurtcagle/databook-cli-js`) to the consolidated `kurtcagle/databook` repository.

---

## Overview

| Before | After |
| --- | --- |
| `kurtcagle/databook` — format spec only, contaminated with CLI artefacts | `kurtcagle/databook` — spec + CLI + examples, clean structure |
| `kurtcagle/databook-cli-js` — CLI implementation | Archived / redirected |

The consolidated repo layout is documented in `README.md`. The working CLI code is **unchanged**; only documentation, tests, and repo structure are updated.

---

## Step 1 — Prepare the new local structure

Clone the existing `databook-cli-js` repo as the starting point (since it contains the working code):

```bash
git clone https://github.com/kurtcagle/databook-cli-js databook
cd databook
```

Create the new directory structure:

```bash
mkdir -p spec schema examples implementations/js

# Move all existing CLI source into implementations/js/
git mv bin commands lib test processors*.toml rdfxml-to-html.xslt \
       obs-data.databook.md sensor*.* sensors.* package.json README.md \
       implementations/js/
```

---

## Step 2 — Copy in new root-level files

Copy the following files from this session's output into the repo root:

| File | Source | Notes |
| --- | --- | --- |
| `SPEC.md` | `databook-1_1.md` | Rename to `SPEC.md` |
| `README.md` | `repo/README.md` | Replace any existing README |
| `CHANGELOG.md` | `repo/CHANGELOG.md` | New file |
| `MIGRATION.md` | `repo/MIGRATION.md` | This file |

---

## Step 3 — Populate `examples/`

Copy all 8 example DataBooks into `examples/`:

```bash
# From this session's output:
cp repo/examples/*.databook.md examples/
```

Files:
- `minimal.databook.md`
- `skos-taxonomy.databook.md`
- `parameterised-queries.databook.md`
- `shacl-shapes.databook.md`
- `pipeline-manifest.databook.md`
- `transformer-library.databook.md`
- `processor-registry.databook.md`
- `rdf12-reification.databook.md`

---

## Step 4 — Populate `schema/`

Copy the three schema files:

```bash
cp repo/schema/build.ttl schema/
cp repo/schema/databook.schema.json schema/
cp repo/schema/databook.shacl.ttl schema/
```

---

## Step 5 — Update `implementations/js/`

### Replace documentation and tests

```bash
# Updated README
cp repo/implementations/js/README.md implementations/js/README.md

# Updated package.json (name: "databook", version: "1.1.0")
cp repo/implementations/js/package.json implementations/js/package.json

# Replace entire test directory with generic fixtures
rm -f implementations/js/test/*.md \
       implementations/js/test/*.sparql \
       implementations/js/test/*.json \
       implementations/js/test/*.yaml \
       implementations/js/test/*.ttl

cp repo/implementations/js/test/* implementations/js/test/
```

### Move loose example files into examples/

The following files currently at the CLI root are GGSC-specific and should move to `examples/` (or be removed if they contain client-sensitive content):

```bash
# Evaluate each before moving:
# implementations/js/obs-data.databook.md  → examples/ (genericise first)
# implementations/js/sensors.databook.md   → examples/ (genericise first)
# implementations/js/sensor-construct.databook.md → examples/ (genericise first)
# implementations/js/sensor-list.md        → remove or examples/
# implementations/js/rdfxml-to-html.xslt   → keep in implementations/js/ (used by transform command)
```

### Copy CLI spec DataBooks from GDrive

Download the following from `Chloe-Kurt Sessions/DataBooks/` on GDrive and place in `implementations/js/spec/`:

- `databook-cli-conventions.databook.md`
- `databook-cli-pull.databook.md`
- `databook-cli-push.databook.md`
- `databook-head-spec.databook.md`
- `databook-process-spec.databook.md`

```bash
mkdir -p implementations/js/spec
# Download from GDrive and copy here
```

Add a `implementations/js/spec/README.md` noting these are the formal CLI command specifications.

---

## Step 6 — Update `.gitignore`

Ensure `.gitignore` at the repo root includes:

```gitignore
node_modules/
implementations/js/node_modules/
implementations/js/processors.toml
.DS_Store
*.env
```

---

## Step 7 — Commit and push

```bash
git add -A
git commit -m "chore: consolidate databook-cli-js into databook repo; update to spec v1.1

- Move CLI code to implementations/js/
- Add SPEC.md (DataBook format spec v1.1)
- Add examples/ with 8 reference DataBooks
- Add schema/ (SHACL, JSON Schema, build vocabulary OWL)
- Replace GGSC-specific test fixtures with generic project-management domain
- Update implementations/js/README.md with full CLI command reference
- Update CHANGELOG.md"

git push origin main
```

---

## Step 8 — Archive the old repos

### Archive `kurtcagle/databook-cli-js`

On GitHub: **Settings → Danger Zone → Archive this repository**

Add a notice to the old `databook-cli-js` README:

```markdown
> **Archived.** The DataBook CLI has moved to
> [kurtcagle/databook](https://github.com/kurtcagle/databook)
> under `implementations/js/`.
> This repository is archived and will not receive further updates.
```

### Clean `kurtcagle/databook` (old spec-only repo)

The old `databook` repo contained the spec and some contaminating CLI artefacts. Since we're reusing it as the consolidated repo (or starting fresh from `databook-cli-js`), verify there is no content in the old `databook` repo worth preserving that isn't already in the new structure.

---

## Step 9 — Verify

After pushing, verify the following:

```bash
cd implementations/js
npm install
node bin/databook.js head test/knowledge-graph.databook.md
# Expected: JSON with 5 blocks including primary-graph (turtle)

node bin/databook.js head test/pre-v1.databook.md
# Expected: JSON output, pre-v1 warning (or none if code updated)

node bin/databook.js head --help
# Expected: command help text
```

Check that the examples render correctly on GitHub:
- `SPEC.md` — should render as a clean Markdown document with frontmatter visible as a YAML block
- `examples/skos-taxonomy.databook.md` — the `---` frontmatter block should be visible and readable
- `examples/rdf12-reification.databook.md` — the `turtle12` block should display as a code block

---

## Post-migration TODO

| Item | Priority | Notes |
| --- | --- | --- |
| Flip `W_HEAD_PRE_V1` detection in CLI | Medium | Currently warns for bare `---`; should warn for `<script>` form. Minor code change in `commands/head.js`. |
| Update CLI spec DataBooks to v1.1 frontmatter | Low | Spec DataBooks in `implementations/js/spec/` use v1.0 `<script>` form. Works fine; cosmetic update only. |
| Populate `spec/` extended spec documents | Low | `spec/frontmatter.md`, `spec/block-types.md`, etc. Can be extracted from SPEC.md sections. |
| Publish `schema/` to `w3id.org/databook/schema/` | Low | Makes schema IRI dereferenceable. |
| Tag v1.1.0 release on GitHub | Medium | After verifying the consolidated repo builds and tests pass. |
