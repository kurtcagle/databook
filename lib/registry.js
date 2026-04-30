/**
 * registry.js — DataBook Registry persistence layer
 *
 * Implements the hybrid persistence strategy for `databook push` and `databook pull`:
 *
 *   Push side:
 *     - RDF payload blocks → named graphs via GSP PUT (existing behaviour, unchanged)
 *     - Frontmatter → {doc.id}#meta via reify logic (existing, unchanged)
 *     - Full raw document text → {doc.id}#registry as db:DataBookRecord (NEW)
 *       The registry graph also stores a block-type inventory for catalogue queries.
 *
 *   Pull side:
 *     - Existing modes (named graph fetch / external query / fragment-ref) unchanged
 *     - --restore <iri>: retrieve raw document from {iri}#registry → file or stdout (NEW)
 *     - --reconstruct: assemble derivative DataBook from live graph state (NEW, explicit flag)
 *
 * Namespace: https://w3id.org/databook/ns#
 * Reference triplestore: Apache Jena Fuseki 6.0
 */

const DATABOOK_NS  = 'https://w3id.org/databook/ns#';
const DCT_NS       = 'http://purl.org/dc/terms/';
const XSD_NS       = 'http://www.w3.org/2001/XMLSchema#';
const PROV_NS      = 'http://www.w3.org/ns/prov#';

// ---------------------------------------------------------------------------
// Turtle literal escaping
// ---------------------------------------------------------------------------

/**
 * Escape a string for use as a Turtle long string literal (triple-quoted).
 * Long-string form avoids newline/tab escape complexity.
 */
function escapeTurtleLongString(str) {
  // Only """ needs escaping inside triple-quoted Turtle strings
  return str.replace(/"""/g, '\\"""');
}

// ---------------------------------------------------------------------------
// Registry graph IRI
// ---------------------------------------------------------------------------

/**
 * Derive the registry named graph IRI from a document id.
 * Convention: {doc.id}#registry
 */
function registryGraphIri(docId) {
  return `${docId}#registry`;
}

// ---------------------------------------------------------------------------
// Block-type inventory
// ---------------------------------------------------------------------------

/**
 * Extract the set of distinct fence-label types from parsed blocks.
 * Used to populate db:hasBlockType triples for catalogue queries.
 *
 * @param {Array<{label: string, meta: object, content: string}>} blocks
 * @returns {string[]} Sorted, deduplicated fence labels
 */
function blockTypeInventory(blocks) {
  const types = new Set(blocks.map(b => b.label));
  return [...types].sort();
}

// ---------------------------------------------------------------------------
// Build the registry graph Turtle payload
// ---------------------------------------------------------------------------

/**
 * Serialise a DataBook's registry record as Turtle.
 *
 * Stored triples (all in the {doc.id}#registry named graph):
 *   <docId>  a                db:DataBookRecord
 *            dct:title        "..."
 *            dct:type         "databook" | "transformer-library" | "processor-registry"
 *            db:version       "..."
 *            dct:created      "..."^^xsd:date
 *            db:storedAt      "..."^^xsd:dateTime
 *            db:hasBlockType  "turtle", "shacl", ... (one triple per type)
 *            db:rawContent    """..."""^^xsd:string
 *
 * Note: db:rawContent is last because it may be very large — keeping catalogue
 * metadata first makes the Turtle human-scannable despite the raw blob.
 *
 * @param {string}   rawText     Full DataBook document text
 * @param {object}   frontmatter Parsed YAML frontmatter
 * @param {string[]} blockTypes  Output of blockTypeInventory()
 * @param {string}   [storedAt]  ISO timestamp; defaults to now
 * @returns {string} Turtle serialisation of the registry record
 */
function buildRegistryTurtle(rawText, frontmatter, blockTypes, storedAt) {
  const docId    = frontmatter.id;
  const title    = (frontmatter.title || '').replace(/"/g, '\\"');
  const type     = frontmatter.type || 'databook';
  const version  = frontmatter.version || '1.0.0';
  const created  = frontmatter.created || '';
  const ts       = storedAt || new Date().toISOString();
  const escaped  = escapeTurtleLongString(rawText);

  const blockTypeTriples = blockTypes
    .map(t => `    db:hasBlockType  "${t.replace(/"/g, '\\"')}" ;`)
    .join('\n');

  return `@prefix db:   <${DATABOOK_NS}> .
@prefix dct:  <${DCT_NS}> .
@prefix xsd:  <${XSD_NS}> .

<${docId}>
    a                db:DataBookRecord ;
    dct:title        "${title}" ;
    dct:type         "${type}" ;
    db:version       "${version}" ;
    dct:created      "${created}"^^xsd:date ;
    db:storedAt      "${ts}"^^xsd:dateTime ;
${blockTypeTriples}
    db:rawContent    """${escaped}"""^^xsd:string .
`;
}

// ---------------------------------------------------------------------------
// Push: store registry record
// ---------------------------------------------------------------------------

/**
 * Push the DataBook registry record to {doc.id}#registry via GSP PUT.
 *
 * Always uses PUT (replace), never POST — the registry record represents the
 * current state of the document, not an accumulation. Idempotent on re-push.
 *
 * @param {object} opts
 * @param {string}   opts.rawText      Full document text
 * @param {object}   opts.frontmatter  Parsed frontmatter
 * @param {Array}    opts.blocks       Parsed block list (for type inventory)
 * @param {string}   opts.gspEndpoint  GSP data endpoint URL
 * @param {string}   [opts.authHeader] Authorization header value, if any
 * @param {boolean}  [opts.verbose]    Log to stderr
 * @param {boolean}  [opts.dryRun]     Log without sending
 * @returns {Promise<{graphIri: string, status: number|null}>}
 */
async function pushRegistryRecord(opts) {
  const { rawText, frontmatter, blocks, gspEndpoint, authHeader, verbose, dryRun } = opts;

  const docId      = frontmatter.id;
  const graphIri   = registryGraphIri(docId);
  const types      = blockTypeInventory(blocks);
  const turtle     = buildRegistryTurtle(rawText, frontmatter, types);
  const url        = `${gspEndpoint}?graph=${encodeURIComponent(graphIri)}`;

  const headers = {
    'Content-Type': 'text/turtle',
    ...(authHeader ? { 'Authorization': authHeader } : {})
  };

  if (verbose || dryRun) {
    const byteSize = Buffer.byteLength(turtle, 'utf8');
    process.stderr.write(
      `[push] PUT  ${url}\n` +
      `            Content-Type: text/turtle\n` +
      `            Registry graph: ${graphIri}\n` +
      `            Block types: ${types.join(', ') || '(none)'}\n` +
      `            Payload: ${byteSize} bytes\n` +
      (dryRun ? `            Status: [not sent]\n` : '')
    );
  }

  if (dryRun) {
    return { graphIri, status: null };
  }

  const response = await fetch(url, { method: 'PUT', headers, body: turtle });

  if (verbose) {
    process.stderr.write(`            Status: ${response.status} ${response.statusText}\n`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw Object.assign(
      new Error(`Registry graph push failed (HTTP ${response.status}): ${body.slice(0, 200)}`),
      { httpStatus: response.status, graphIri }
    );
  }

  return { graphIri, status: response.status };
}

// ---------------------------------------------------------------------------
// Pull: restore raw document from registry
// ---------------------------------------------------------------------------

/**
 * Retrieve a DataBook's raw text from its registry graph via SPARQL SELECT.
 *
 * Query: SELECT ?content WHERE { GRAPH <{iri}#registry> { <iri> db:rawContent ?content } }
 *
 * @param {object} opts
 * @param {string}   opts.docIri         DataBook document IRI
 * @param {string}   opts.sparqlEndpoint SPARQL query endpoint URL
 * @param {string}   [opts.authHeader]   Authorization header value, if any
 * @returns {Promise<string>} Raw DataBook document text
 * @throws  If no registry record exists for the given IRI
 */
async function restoreRawDocument(opts) {
  const { docIri, sparqlEndpoint, authHeader } = opts;

  const graphIri = registryGraphIri(docIri);

  const query = `PREFIX db: <${DATABOOK_NS}>
SELECT ?content WHERE {
  GRAPH <${graphIri}> {
    <${docIri}> db:rawContent ?content .
  }
}`;

  const headers = {
    'Content-Type': 'application/sparql-query',
    'Accept':       'application/sparql-results+json',
    ...(authHeader ? { 'Authorization': authHeader } : {})
  };

  const response = await fetch(sparqlEndpoint, { method: 'POST', headers, body: query });

  if (!response.ok) {
    throw Object.assign(
      new Error(`SPARQL query failed (HTTP ${response.status}) retrieving registry record for <${docIri}>`),
      { httpStatus: response.status }
    );
  }

  const data = await response.json();
  const bindings = data?.results?.bindings;

  if (!bindings || bindings.length === 0) {
    throw new Error(
      `No registry record found for <${docIri}>.\n` +
      `Hint: was this DataBook pushed with --store-doc (the default)?\n` +
      `      Check that the registry graph <${graphIri}> exists at the endpoint.`
    );
  }

  return bindings[0].content.value;
}

// ---------------------------------------------------------------------------
// Pull: catalogue query helpers
// ---------------------------------------------------------------------------

/**
 * List all DataBookRecords in the store, optionally filtered by block type.
 *
 * Returns an array of { iri, title, type, version, created, storedAt, blockTypes[] }.
 *
 * @param {object} opts
 * @param {string}   opts.sparqlEndpoint SPARQL query endpoint
 * @param {string}   [opts.authHeader]
 * @param {string}   [opts.filterBlockType]  Fence label to filter on (e.g. 'shacl')
 * @returns {Promise<Array>}
 */
async function listRegistryRecords(opts) {
  const { sparqlEndpoint, authHeader, filterBlockType } = opts;

  const typeFilter = filterBlockType
    ? `  FILTER EXISTS { <${registryGraphIri('?_docIri')}> db:hasBlockType "${filterBlockType}" }\n`
    : '';

  // Note: We can't use ?_docIri as a graph directly in this way.
  // Instead use a VALUES or subquery pattern. Simpler: no graph-variable filter.
  // Real catalogue query uses SPARQL's GRAPH + variable:
  const query = `PREFIX db:  <${DATABOOK_NS}>
PREFIX dct: <${DCT_NS}>
SELECT DISTINCT ?doc ?title ?type ?version ?created ?storedAt ?blockType WHERE {
  GRAPH ?g {
    ?doc a db:DataBookRecord ;
         dct:title ?title ;
         dct:type  ?type ;
         db:version ?version ;
         dct:created ?created ;
         db:storedAt ?storedAt .
    OPTIONAL { ?doc db:hasBlockType ?blockType }
  }
  FILTER(STRENDS(STR(?g), "#registry"))
  ${filterBlockType ? `FILTER(STR(?blockType) = "${filterBlockType}")` : ''}
}
ORDER BY ?doc ?blockType`;

  const headers = {
    'Content-Type': 'application/sparql-query',
    'Accept':       'application/sparql-results+json',
    ...(authHeader ? { 'Authorization': authHeader } : {})
  };

  const response = await fetch(sparqlEndpoint, { method: 'POST', headers, body: query });
  if (!response.ok) {
    throw new Error(`Registry catalogue query failed (HTTP ${response.status})`);
  }

  const data = await response.json();
  const bindings = data?.results?.bindings || [];

  // Aggregate blockTypes per document
  const docs = new Map();
  for (const b of bindings) {
    const iri = b.doc?.value;
    if (!iri) continue;
    if (!docs.has(iri)) {
      docs.set(iri, {
        iri,
        title:      b.title?.value || '',
        type:       b.type?.value  || '',
        version:    b.version?.value || '',
        created:    b.created?.value || '',
        storedAt:   b.storedAt?.value || '',
        blockTypes: []
      });
    }
    const bt = b.blockType?.value;
    if (bt && !docs.get(iri).blockTypes.includes(bt)) {
      docs.get(iri).blockTypes.push(bt);
    }
  }

  return [...docs.values()];
}

// ---------------------------------------------------------------------------
// Pull: --reconstruct (derivative DataBook from live graph)
// ---------------------------------------------------------------------------

/**
 * Reconstruct a derivative DataBook from the live graph state in the store.
 *
 * This is EXPLICITLY a new artifact:
 *   - New id: {original.id}#reconstructed-{timestamp}
 *   - New provenance stamp: transformer = "databook pull --reconstruct"
 *   - Source DataBook IRI recorded in inputs[]
 *
 * The RDF payload is fetched via GSP GET from {doc.id}#{primaryBlock} (or
 * graph.named_graph from the stored #meta graph). The frontmatter is
 * reconstructed from the #meta graph.
 *
 * Caller must explicitly pass --reconstruct flag; this function is never
 * invoked by default pull behaviour.
 *
 * @param {object} opts
 * @param {string}   opts.docIri          Source DataBook IRI
 * @param {string}   opts.sparqlEndpoint  SPARQL query endpoint
 * @param {string}   opts.gspEndpoint     GSP data endpoint
 * @param {string}   [opts.authHeader]
 * @param {string}   [opts.graphIri]      Override data graph IRI (else inferred from #meta)
 * @returns {Promise<string>} DataBook Markdown text
 */
async function reconstructDataBook(opts) {
  const { docIri, sparqlEndpoint, gspEndpoint, authHeader, graphIri: graphIriOverride } = opts;

  const authHeaders = authHeader ? { 'Authorization': authHeader } : {};

  // Step 1: Retrieve frontmatter metadata from #meta graph
  const metaQuery = `PREFIX db:   <${DATABOOK_NS}>
PREFIX dct:  <${DCT_NS}>
PREFIX owl:  <http://www.w3.org/2002/07/owl#>
PREFIX sd:   <http://www.w3.org/ns/sparql-service-description#>
SELECT * WHERE {
  GRAPH <${docIri}#meta> {
    <${docIri}>  dct:title ?title ;
                 dct:type  ?type ;
                 owl:versionInfo ?version ;
                 dct:created ?created .
    OPTIONAL { <${docIri}> sd:namedGraph ?namedGraph }
    OPTIONAL { <${docIri}> dct:description ?description }
  }
}`;

  const metaRes = await fetch(sparqlEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sparql-query',
                'Accept': 'application/sparql-results+json', ...authHeaders },
    body: metaQuery
  });

  if (!metaRes.ok) {
    throw new Error(`Failed to retrieve #meta graph for <${docIri}> (HTTP ${metaRes.status})`);
  }

  const metaData   = await metaRes.json();
  const metaBindings = metaData?.results?.bindings || [];
  if (metaBindings.length === 0) {
    throw new Error(
      `No #meta graph found for <${docIri}>.\n` +
      `Hint: was this DataBook pushed with --meta (the default)?`
    );
  }

  const meta = metaBindings[0];
  const title       = meta.title?.value       || docIri;
  const type        = meta.type?.value        || 'databook';
  const version     = meta.version?.value     || '1.0.0';
  const created     = meta.created?.value     || '';
  const description = meta.description?.value || '';
  const dataGraph   = graphIriOverride || meta.namedGraph?.value || `${docIri}#graph`;

  // Step 2: Fetch RDF payload from the data named graph via GSP GET
  const gspUrl = `${gspEndpoint}?graph=${encodeURIComponent(dataGraph)}`;
  const gspRes = await fetch(gspUrl, {
    method: 'GET',
    headers: { 'Accept': 'text/turtle', ...authHeaders }
  });

  if (!gspRes.ok) {
    throw new Error(`GSP GET failed for graph <${dataGraph}> (HTTP ${gspRes.status})`);
  }

  const turtleContent = await gspRes.text();

  // Step 3: Assemble the reconstructed DataBook
  const ts         = new Date().toISOString();
  const newId      = `${docIri}#reconstructed-${ts.replace(/[:.]/g, '-')}`;
  const today      = ts.slice(0, 10);

  // Count triples (rough heuristic: non-blank, non-comment, non-prefix lines that contain ' . ')
  const tripleCount = turtleContent
    .split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#') && !l.trim().startsWith('@')
                          && (l.includes(' .') || l.endsWith('.')))
    .length;

  const reconstructed =
`---
id: ${newId}
title: "${title} (reconstructed)"
type: ${type}
version: ${version}
created: ${today}
description: >
  Derivative DataBook reconstructed from live graph state. Source: <${docIri}>.
  ${description ? description : ''}
graph:
  named_graph: ${dataGraph}
  triple_count: ${tripleCount}
  rdf_version: "1.1"
process:
  transformer: "databook pull --reconstruct"
  transformer_type: script
  transformer_iri: https://w3id.org/databook/ns#PullReconstruct
  inputs:
    - iri: ${docIri}
      role: primary
      description: "Source DataBook; data fetched from live named graph"
  timestamp: ${ts}
  agent:
    name: Chloe Shannon
    iri: https://holongraph.com/people/chloe-shannon
    role: orchestrator
  note: >
    This is a DERIVATIVE DataBook, not the original. It reflects the live
    state of the named graph at reconstruction time. Use --restore to retrieve
    the original verbatim document.
---

# ${title} (reconstructed)

> **Important:** This DataBook was reconstructed from live graph state at
> ${ts}. It is a derivative artifact. The original document IRI is
> \`<${docIri}>\`. Use \`databook pull --restore ${docIri}\` to retrieve the
> verbatim original.

## RDF Payload

\`\`\`turtle
<!-- databook:id: reconstructed-payload -->
<!-- databook:graph: ${dataGraph} -->
${turtleContent.trimEnd()}
\`\`\`
`;

  return reconstructed;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  registryGraphIri,
  blockTypeInventory,
  buildRegistryTurtle,
  pushRegistryRecord,
  restoreRawDocument,
  listRegistryRecords,
  reconstructDataBook
};
