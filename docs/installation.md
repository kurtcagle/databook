# Installation

## Requirements

- **Node.js** v18 or later (ESM support required)
- **npm** v9 or later (bundled with Node.js)

## Install from the zip archive

```bash
# Unzip the archive
unzip databook-cli.zip
cd databook-cli

# Install dependencies
npm install

# Link the CLI globally
npm link
```

After linking, `databook --version` should print `1.4.0`.

## Verify the installation

```bash
databook --help
databook --version
```

## Optional dependencies

Several commands delegate to external tools that must be installed separately:

| Tool | Used by | Install |
|---|---|---|
| Apache Jena (`shacl` CLI) | `validate` | [jena.apache.org](https://jena.apache.org) — set `JENA_HOME` |
| pyshacl | `validate` (fallback) | `pip install pyshacl` |
| Saxon (`saxon` or `SAXON_JAR`) | `transform` (XSLT 2/3) | [saxonica.com](https://www.saxonica.com) (Saxon-HE is free) |
| xsltproc | `transform` (XSLT 1.0 fallback) | usually pre-installed on macOS/Linux |

## Environment variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Required for `databook prompt` |
| `JENA_HOME` | Path to Jena install (for `validate`) |
| `SAXON_JAR` | Path to Saxon `.jar` file (for `transform`) |
| `JVM_ARGS` | Extra JVM flags when invoking Saxon |
| `DATABOOK_DEBUG` | Set to any value to print full error stacks |
| `DATABOOK_FUSEKI_AUTH` | Default auth credential for Fuseki (Basic/Bearer) |

## Endpoint configuration (processors.toml)

Place `processors.toml` in your working directory or home directory to define named servers:

```toml
[local]
endpoint = "http://localhost:3030/ds/sparql"

[ggsc]
endpoint = "http://localhost:3030/ggsc/sparql"
auth     = "Basic YWRtaW46cGFzc3dvcmQ="
```

Reference named servers with `-s local` or `-d ds` (Fuseki shorthand) in any command that connects to a triplestore.

## Updating

Replace the `databook-cli` directory with the new archive and re-run `npm install && npm link`.

## Uninstalling

```bash
npm unlink -g databook-cli
```
