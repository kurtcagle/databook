/**
 * databook list — list DataBooks pushed to a SPARQL triplestore.
 *
 * v1.4.x: Queries all #meta named graphs for the catalogue.
 *
 * v1.5.0 (index graph):
 *   - When an index graph IRI is available (--index-graph, --dataset, or
 *     derivable from endpoint), queries the index named graph instead.
 *   - Adds --path <prefix> for folder-scoped filtering.
 *   - Adds --tree for directory-style tree display.
 *   - Falls back to #meta query when no index graph is available.
 */

import { sparqlQuery, checkResponse }                                        from '../lib/gsp.js';
import { getDefaultEndpoint }                                                from '../lib/config.js';
import { resolveAuth }                                                       from '../lib/auth.js';
import { resolveServer, listServers, LOCALHOST_FUSEKI, datasetToEndpoints }  from '../lib/serverConfig.js';

// ── Legacy catalogue query (pre-index, #meta graphs) ──────────────────────────
const LEGACY_LIST_QUERY = `
PREFIX dct:   <http://purl.org/dc/terms/>
PREFIX build: <https://w3id.org/databook/ns#>
PREFIX prov:  <http://www.w3.org/ns/prov#>
PREFIX void:  <http://rdfs.org/ns/void#>
PREFIX owl:   <http://www.w3.org/2002/07/owl#>

SELECT ?id ?title ?version ?created ?pushedAt ?triples WHERE {
  GRAPH ?metaGraph {
    ?id  a              build:DataBook ;
         dct:title      ?title ;
         dct:created    ?created ;
         prov:generatedAtTime ?pushedAt .
    OPTIONAL { ?id owl:versionInfo  ?version  }
    OPTIONAL { ?id void:triples     ?triples  }
  }
  FILTER(STRENDS(STR(?metaGraph), "#meta"))
}
ORDER BY DESC(?pushedAt)
`.trim();

// ── Index graph catalogue query (v1.5.0) ──────────────────────────────────────
function buildIndexQuery(indexGraphIri, pathPrefix) {
  const pathFilter = pathPrefix
    ? `        FILTER(STRSTARTS(?path, "${pathPrefix}/") || ?path = "${pathPrefix}")`
    : '';
  const pathOptional = pathPrefix
    ? `        ?id db:path ?path .`
    : `        OPTIONAL { ?id db:path ?path }`;

  return `
PREFIX db:      <https://w3id.org/databook/ns#>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?id ?title ?type ?version ?created ?path ?namedGraph ?indexedAt WHERE {
    GRAPH <${indexGraphIri}> {
        ?id a db:DataBook ;
            dcterms:title   ?title ;
            dcterms:type    ?type ;
            db:version      ?version ;
            dcterms:created ?created .
        ${pathOptional}
        OPTIONAL { ?id db:namedGraph ?namedGraph }
        OPTIONAL { ?id db:indexedAt  ?indexedAt  }
${pathFilter}
    }
}
ORDER BY ?path ?title
`.trim();
}

export async function runList(opts) {
  const {
    server:     serverName,
    endpoint:   endpointOpt,
    dataset:    datasetName,
    format:     fmt = 'table',
    auth:       authOpt,
    indexGraph: indexGraphOpt,
    path:       pathPrefix,
    tree:       treeMode = false,
    verbose     = false,
    quiet       = false,
  } = opts;

  // ── Resolve named server config ────────────────────────────────────────────
  let serverCfg = null;
  if (serverName) {
    if (serverName === 'list') {
      const servers = listServers();
      if (servers.length === 0) {
        process.stdout.write('No servers configured in processors.toml.\n');
      } else {
        for (const s of servers) {
          process.stdout.write(`  ${s.name.padEnd(16)} ${s.endpoint ?? '(no endpoint)'}${s.auth ? '  auth: (set)' : ''}\n`);
        }
      }
      process.exit(0);
    }
    try { serverCfg = resolveServer(serverName); }
    catch (e) { die(e.message, 2); }
    if (verbose) process.stderr.write(`[list] Server '${serverName}': endpoint=${serverCfg.endpoint}\n`);
  }

  const datasetCfg     = datasetName ? datasetToEndpoints(datasetName) : null;
  const sparqlEndpoint = endpointOpt
    ?? serverCfg?.endpoint
    ?? datasetCfg?.endpoint
    ?? getDefaultEndpoint()
    ?? LOCALHOST_FUSEKI.endpoint;

  const auth = resolveAuth(sparqlEndpoint, authOpt ?? serverCfg?.auth);

  // ── Resolve index graph IRI ────────────────────────────────────────────────
  // Priority: --index-graph > derived from --dataset > derived from endpoint
  const indexGraphIri = indexGraphOpt !== 'none'
    ? (indexGraphOpt ?? deriveIndexGraphIri(datasetName, sparqlEndpoint))
    : null;

  const useIndex = !!indexGraphIri;

  // ── Emit SPARQL source on --format sparql ─────────────────────────────────
  if (fmt === 'sparql') {
    const query = useIndex
      ? buildIndexQuery(indexGraphIri, pathPrefix)
      : LEGACY_LIST_QUERY;
    process.stdout.write(query + '\n');
    return;
  }

  if (verbose) {
    process.stderr.write(useIndex
      ? `[list] index graph: ${indexGraphIri}\n`
      : `[list] no index graph — falling back to #meta scan\n`);
    process.stderr.write(`[list] POST ${sparqlEndpoint}\n`);
  }

  // ── Execute query ──────────────────────────────────────────────────────────
  const query = useIndex
    ? buildIndexQuery(indexGraphIri, pathPrefix)
    : LEGACY_LIST_QUERY;

  let result;
  try {
    result = await sparqlQuery(sparqlEndpoint, query, 'application/sparql-results+json', auth);
  } catch (e) {
    die(e.message, e.exitCode ?? 1);
  }
  checkResponse(result, 'list query');

  let parsed;
  try {
    parsed = JSON.parse(result.body);
  } catch (e) {
    die(`unexpected response format: ${e.message}`, 1);
  }

  const bindings = parsed?.results?.bindings ?? [];

  if (bindings.length === 0) {
    if (!quiet) process.stderr.write('No DataBooks found.\n');
    return;
  }

  // ── Normalise rows ─────────────────────────────────────────────────────────
  const rows = bindings.map(b => ({
    id:         b.id?.value        ?? '(unknown)',
    title:      b.title?.value     ?? '(untitled)',
    type:       b.type?.value      ?? b.dctermsType?.value ?? '—',
    version:    b.version?.value   ?? '—',
    created:    b.created?.value   ?? '—',
    path:       b.path?.value      ?? null,
    namedGraph: b.namedGraph?.value ?? null,
    indexedAt:  (b.indexedAt?.value ?? b.pushedAt?.value ?? '—')
                  .replace('T', ' ').replace(/\.\d+Z$/, 'Z'),
  }));

  // ── JSON output ────────────────────────────────────────────────────────────
  if (fmt === 'json') {
    process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
    return;
  }

  // ── Turtle output ──────────────────────────────────────────────────────────
  if (fmt === 'turtle') {
    const lines = [
      '@prefix db:      <https://w3id.org/databook/ns#> .',
      '@prefix dcterms: <http://purl.org/dc/terms/> .',
      '@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .',
      '',
    ];
    for (const r of rows) {
      lines.push(`<${r.id}>`);
      lines.push(`    a db:DataBook ;`);
      lines.push(`    dcterms:title "${r.title.replace(/"/g, '\\"')}" ;`);
      if (r.path)  lines.push(`    db:path "${r.path}" ;`);
      lines.push(`    db:version "${r.version}" ;`);
      lines.push(`    dcterms:created "${r.created}"^^xsd:date .`);
      lines.push('');
    }
    process.stdout.write(lines.join('\n') + '\n');
    return;
  }

  // ── Tree output ────────────────────────────────────────────────────────────
  if (treeMode) {
    renderTree(rows, verbose, quiet);
    return;
  }

  // ── Table output ───────────────────────────────────────────────────────────
  const MAX_ID = 60;
  const idWidth = Math.min(Math.max(...rows.map(r => r.id.length), 4), MAX_ID);

  const cols = useIndex
    ? [
        { key: 'id',        label: 'ID',      width: idWidth },
        { key: 'title',     label: 'Title',   width: 28 },
        { key: 'version',   label: 'Ver',     width: 8  },
        { key: 'path',      label: 'Path',    width: 40 },
        { key: 'indexedAt', label: 'Indexed', width: 22 },
      ]
    : [
        { key: 'id',        label: 'ID',      width: idWidth },
        { key: 'title',     label: 'Title',   width: 28 },
        { key: 'version',   label: 'Ver',     width: 8  },
        { key: 'indexedAt', label: 'Pushed',  width: 22 },
      ];

  const header = cols.map(c => c.label.padEnd(c.width)).join('  ');
  const sep    = cols.map(c => '─'.repeat(c.width)).join('  ');
  process.stdout.write(header + '\n' + sep + '\n');

  for (const row of rows) {
    const line = cols.map(c => {
      const raw = String(row[c.key] ?? '');
      const val = raw.length > c.width ? raw.slice(0, c.width - 1) + '…' : raw;
      return val.padEnd(c.width);
    }).join('  ');
    process.stdout.write(line + '\n');
    if (verbose && row.id.length > idWidth) {
      process.stdout.write('  ID (full): ' + row.id + '\n');
    }
  }

  if (!quiet) {
    process.stderr.write(`\n${rows.length} DataBook${rows.length !== 1 ? 's' : ''} found.\n`);
    if (!verbose && rows.some(r => r.id.length > idWidth)) {
      process.stderr.write('Some IDs truncated — use --verbose or --format json for full IRIs.\n');
    }
  }
}

// ─── Tree renderer ─────────────────────────────────────────────────────────────

function renderTree(rows, verbose, quiet) {
  // Separate root-level (no path) from pathed
  const rootRows  = rows.filter(r => !r.path);
  const pathedRows = rows.filter(r =>  r.path);

  // Build folder tree from paths
  const tree = {};  // { 'ggsc': { 'country-risk': [rows], '_items': [] } }

  for (const row of pathedRows) {
    const segments = row.path.split('/');
    let node = tree;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      node[seg] = node[seg] ?? {};
      node = node[seg];
    }
    // Terminal: attach to _items in current node
    const terminal = segments[segments.length - 1];
    node[terminal] = node[terminal] ?? {};
    node[terminal]._items = node[terminal]._items ?? [];
    node[terminal]._items.push(row);
  }

  for (const r of rootRows) {
    const label = verbose ? r.id : r.title;
    process.stdout.write(`${label} (v${r.version}, ${r.created})\n`);
  }

  renderNode(tree, '', verbose);

  if (!quiet) {
    process.stderr.write(`\n${rows.length} DataBook${rows.length !== 1 ? 's' : ''} found.\n`);
  }
}

function renderNode(node, indent, verbose) {
  for (const [key, value] of Object.entries(node)) {
    if (key === '_items') continue;
    const items = value._items ?? [];
    const children = Object.entries(value).filter(([k]) => k !== '_items');

    if (items.length > 0 && children.length === 0) {
      // Terminal folder with items
      process.stdout.write(`${indent}${key}/\n`);
      for (const r of items) {
        const label = verbose ? r.id : r.title;
        process.stdout.write(`${indent}  ${label} (v${r.version}, ${r.created})\n`);
      }
    } else if (items.length === 0 && children.length > 0) {
      // Intermediate folder with no direct items
      process.stdout.write(`${indent}${key}/\n`);
      renderNode(value, indent + '  ', verbose);
    } else {
      // Mixed: items and children
      process.stdout.write(`${indent}${key}/\n`);
      for (const r of items) {
        const label = verbose ? r.id : r.title;
        process.stdout.write(`${indent}  ${label} (v${r.version}, ${r.created})\n`);
      }
      renderNode(value, indent + '  ', verbose);
    }
  }
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Derive index graph IRI from dataset name or SPARQL endpoint.
 * dataset name takes priority: "causalspark" → urn:causalspark:databook:index#graph
 */
function deriveIndexGraphIri(datasetName, sparqlEndpoint) {
  if (datasetName) return `urn:${datasetName}:databook:index#graph`;
  try {
    const url    = new URL(sparqlEndpoint);
    const parts  = url.pathname.split('/').filter(Boolean);
    const dataset = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    if (dataset) return `urn:${dataset}:databook:index#graph`;
  } catch {}
  return null;
}

function die(msg, code = 2) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}
