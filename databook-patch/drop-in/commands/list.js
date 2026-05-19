/**
 * databook list — list DataBooks pushed to a SPARQL triplestore.
 *
 * Queries all #meta named graphs to return a catalogue of every DataBook
 * that has been pushed via `databook push`.  Meta graphs are written by
 * push --meta (on by default) and contain dc:title, dct:created,
 * owl:versionInfo, void:triples, and prov:generatedAtTime.
 *
 * Three output modes:
 *   table   (default) — aligned columns, human-readable
 *   json    — machine-readable array, suitable for piping
 *   sparql  — print the catalogue query and exit (for debugging / custom use)
 */

import { sparqlQuery, checkResponse }                                    from '../lib/gsp.js';
import { getDefaultEndpoint }                                            from '../lib/config.js';
import { resolveAuth }                                                   from '../lib/auth.js';
import { resolveServer, listServers, LOCALHOST_FUSEKI, datasetToEndpoints } from '../lib/serverConfig.js';

// ── Catalogue query ────────────────────────────────────────────────────────────
// Finds every named graph whose IRI ends in "#meta" and extracts standard
// DataBook metadata properties written by frontmatterToTurtle() in reify.js.
const LIST_QUERY = `
PREFIX dct:   <http://purl.org/dc/terms/>
PREFIX build: <https://w3id.org/databook/ns#>
PREFIX prov:  <http://www.w3.org/ns/prov#>
PREFIX void:  <http://rdfs.org/ns/void#>
PREFIX owl:   <http://www.w3.org/2002/07/owl#>
PREFIX sd:    <http://www.w3.org/ns/sparql-service-description#>

SELECT ?id ?title ?version ?created ?pushedAt ?triples ?namedGraph WHERE {
  GRAPH ?metaGraph {
    ?id  a              build:DataBook ;
         dct:title      ?title ;
         dct:created    ?created ;
         prov:generatedAtTime ?pushedAt .
    OPTIONAL { ?id owl:versionInfo  ?version     }
    OPTIONAL { ?id void:triples     ?triples     }
    OPTIONAL { ?id sd:namedGraph    ?namedGraph  }
  }
  FILTER(STRENDS(STR(?metaGraph), "#meta"))
}
ORDER BY DESC(?pushedAt)
`.trim();

/**
 * Run `databook list`.
 * @param {object} opts
 */
export async function runList(opts) {
  const {
    server:     serverName,
    endpoint:   endpointOpt,
    dataset:    datasetName,
    format:     fmt = 'table',
    auth:       authOpt,
    verbose     = false,
    quiet       = false,
  } = opts;

  // ── databook list --format sparql ─────────────────────────────────────────
  if (fmt === 'sparql') {
    process.stdout.write(LIST_QUERY + '\n');
    return;
  }

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

  const datasetCfg    = datasetName ? datasetToEndpoints(datasetName) : null;
  const sparqlEndpoint = endpointOpt
    ?? serverCfg?.endpoint
    ?? datasetCfg?.endpoint
    ?? getDefaultEndpoint()
    ?? LOCALHOST_FUSEKI.endpoint;

  const auth = resolveAuth(sparqlEndpoint, authOpt ?? serverCfg?.auth);

  if (verbose) process.stderr.write(`[list] POST ${sparqlEndpoint}\n`);

  // ── Execute query ──────────────────────────────────────────────────────────
  let result;
  try {
    result = await sparqlQuery(
      sparqlEndpoint, LIST_QUERY,
      'application/sparql-results+json', auth
    );
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
    if (!quiet) process.stderr.write('No DataBooks found in triplestore.\n');
    return;
  }

  // ── Normalise rows ─────────────────────────────────────────────────────────
  const rows = bindings.map(b => ({
    id:         b.id?.value          ?? '(unknown)',
    title:      b.title?.value       ?? '(untitled)',
    version:    b.version?.value     ?? '—',
    created:    b.created?.value     ?? '—',
    pushedAt:   (b.pushedAt?.value   ?? '—')
                  .replace('T', ' ')
                  .replace(/\.\d+Z$/, 'Z'),
    triples:    b.triples?.value     ?? '—',
    namedGraph: b.namedGraph?.value  ?? '—',
  }));

  // ── JSON output ────────────────────────────────────────────────────────────
  if (fmt === 'json') {
    process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
    return;
  }

  // ── Table output ───────────────────────────────────────────────────────────
  const cols = [
    { key: 'title',    label: 'Title',    width: 36 },
    { key: 'version',  label: 'Ver',      width: 8  },
    { key: 'created',  label: 'Created',  width: 12 },
    { key: 'pushedAt', label: 'Pushed',   width: 22 },
    { key: 'triples',  label: 'Triples',  width: 8  },
  ];

  const header = cols.map(c => c.label.padEnd(c.width)).join('  ');
  const sep    = cols.map(c => '─'.repeat(c.width)).join('  ');
  process.stdout.write(header + '\n' + sep + '\n');

  for (const row of rows) {
    const line = cols.map(c =>
      String(row[c.key] ?? '').slice(0, c.width).padEnd(c.width)
    ).join('  ');
    process.stdout.write(line + '\n');
    if (verbose) {
      process.stdout.write('  IRI:   ' + row.id + '\n');
      if (row.namedGraph !== '—') {
        process.stdout.write('  Graph: ' + row.namedGraph + '\n');
      }
    }
  }

  if (!quiet) {
    process.stderr.write(`\n${rows.length} DataBook${rows.length !== 1 ? 's' : ''} found.\n`);
  }
}

function die(msg, code = 2) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}
