#!/usr/bin/env node
/**
 * apply-all-patches.mjs  —  DataBook CLI v1.4.2 patch installer
 *
 * Run once from your databook-cli root directory:
 *   node apply-all-patches.mjs
 *
 * Applies all changes from this session in the correct order.
 * Safe to re-run — already-patched functions are detected and skipped.
 *
 * ── Changes applied ───────────────────────────────────────────────────────────
 *
 * lib/parser.js        REPLACE  (pre-fence block annotation support)
 * lib/gsp.js           REPLACE  (url in gspPut/gspPost return, richer errors)
 * lib/config.js        REPLACE  (getDefaultNamedGraph() for processors.toml)
 * commands/list.js     NEW      (databook list — catalogue of pushed DataBooks)
 * bin/databook.js      PATCH    (import runList, register list command, bump version)
 * commands/create.js   PATCH    (renderBlock: pre-fence annotation placement)
 * commands/push.js     PATCH 1  (meta graph push respects --merge flag)
 *                      PATCH 2  (resolveGraphIri: fragment-addressing as default)
 * commands/pull.js     PATCH    (resolveGraphIris: processors.toml named_graph step)
 *
 * ── Drop-in replacements ──────────────────────────────────────────────────────
 *
 * Copy the files from the drop-in/ directory alongside this script before running:
 *   drop-in/lib/parser.js
 *   drop-in/lib/gsp.js
 *   drop-in/lib/config.js
 *   drop-in/commands/list.js
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const CLI_ROOT   = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
const DROPIN_DIR = join(__dirname, 'drop-in');

let applied = 0, skipped = 0, errors = 0;

// ── Helpers ────────────────────────────────────────────────────────────────────

function read(rel)    { return readFileSync(join(CLI_ROOT, rel), 'utf8'); }
function write(rel, c){ writeFileSync(join(CLI_ROOT, rel), c, 'utf8'); }
function ok(msg)      { console.log(`  ✓  ${msg}`); applied++; }
function skip(msg)    { console.log(`  –  ${msg} (already applied)`); skipped++; }
function fail(msg, e) { console.error(`  ✗  ${msg}: ${e.message}`); errors++; }

function patch(rel, oldStr, newStr, label) {
  let src;
  try { src = read(rel); } catch(e) { fail(`read ${rel}`, e); return; }
  if (!src.includes(oldStr)) {
    if (src.includes(newStr.slice(0, 40))) { skip(label); } else { fail(label, new Error('pattern not found')); }
    return;
  }
  write(rel, src.replace(oldStr, newStr));
  ok(label);
}

function copyDropIn(src, dest) {
  const srcPath  = join(DROPIN_DIR, src);
  const destPath = join(CLI_ROOT, dest);
  if (!existsSync(srcPath)) { fail(`copy ${src}`, new Error(`drop-in file not found at ${srcPath}`)); return; }
  try { copyFileSync(srcPath, destPath); ok(`replaced ${dest}`); }
  catch(e) { fail(`copy ${dest}`, e); }
}

// ── 1. Drop-in replacements ────────────────────────────────────────────────────

console.log('\n── Drop-in replacements ─────────────────────────────────────────');
copyDropIn('lib/parser.js',      'lib/parser.js');
copyDropIn('lib/gsp.js',         'lib/gsp.js');
copyDropIn('lib/config.js',      'lib/config.js');
copyDropIn('commands/list.js',   'commands/list.js');

// ── 2. bin/databook.js — bump version, add import, register list command ───────

console.log('\n── bin/databook.js ──────────────────────────────────────────────');

// 2a. Version bump
patch(
  'bin/databook.js',
  `.version('1.4.0')`,
  `.version('1.4.2')`,
  'version bump 1.4.0 → 1.4.2'
);

// 2b. Add runList import after runShacl2Sparql import
patch(
  'bin/databook.js',
  `import { runShacl2Sparql }        from '../commands/shacl2sparql.js';`,
  `import { runShacl2Sparql }        from '../commands/shacl2sparql.js';
import { runList }             from '../commands/list.js';`,
  'add runList import'
);

// 2c. Insert list command block before program.parseAsync
patch(
  'bin/databook.js',
  `program.parseAsync(process.argv);`,
  `// ─── databook list ────────────────────────────────────────────────────────────

program
  .command('list')
  .description('List DataBooks pushed to the triplestore (queries #meta graphs)')
  .option('-s, --server <n>',        'Named server from processors.toml (use "list" to show all)')
  .option('-d, --dataset <n>',       'Fuseki dataset name on localhost')
  .option('-e, --endpoint <url>',    'SPARQL query endpoint URL')
  .option('-f, --format <fmt>',      'Output format: table (default), json, sparql', 'table')
  .option('-a, --auth <credential>', 'Auth credential (Basic/Bearer or bare base64)')
  .option('-v, --verbose',           'Show DataBook IRIs and named graph IRIs')
  .option('-q, --quiet',             'Suppress count summary line')
  .addHelpText('after', \`
Output formats:
  table   Aligned columns (Title, Version, Created, Pushed, Triples)
  json    Machine-readable array — pipe to jq or other tools
  sparql  Print the catalogue SPARQL query and exit (for custom use)

Examples:
  databook list -d ds
  databook list -e http://localhost:3030/ds/sparql
  databook list -e http://localhost:3030/ds/sparql --format json | jq '.[].id'
  databook list -d ds --verbose
  databook list --format sparql
  \`)
  .action(async (opts) => { await runList(opts); });

program.parseAsync(process.argv);`,
  'register list command'
);

// ── 3. commands/create.js — renderBlock: move annotation pre-fence ─────────────

console.log('\n── commands/create.js ───────────────────────────────────────────');
patch(
  'commands/create.js',
  `function renderBlock(block) {
  const lines = [
    \`\\\`\\\`\\\`\${block.label}\`,
    \`<!-- databook:id: \${block.blockId} -->\`,
    block.content,
    '\`\`\`',
  ];
  return lines.join('\\n');
}`,
  `function renderBlock(block) {
  // Strip any inline <!-- databook:... --> annotations from the content payload.
  // Necessary when re-wrapping blocks extracted from older (v1.1) DataBooks
  // that used the inside-fence annotation placement.
  const RE_INLINE_META = /^<!--\\s*databook:[\\w-]+:.*?-->\\s*$/;
  const cleanContent = block.content
    .split('\\n')
    .filter(l => !RE_INLINE_META.test(l))
    .join('\\n');

  // Pre-fence annotation (canonical v1.2+ placement):
  // <!-- databook:id: block-id --> immediately before the opening fence,
  // with no blank line between the annotation and the fence.
  const lines = [
    \`<!-- databook:id: \${block.blockId} -->\`,
    \`\\\`\\\`\\\`\${block.label}\`,
    cleanContent,
    '\`\`\`',
  ];
  return lines.join('\\n');
}`,
  'renderBlock: pre-fence annotation placement'
);

// ── 4. commands/push.js ─────────────────────────────────────────────────────────

console.log('\n── commands/push.js ─────────────────────────────────────────────');

// 4a. Meta graph push respects --merge
patch(
  'commands/push.js',
  `logBlockOp('PUT', gspEndpoint, metaIri, 'text/turtle', metaTurtle, dryRun, true);`,
  `logBlockOp(merge ? 'POST' : 'PUT', gspEndpoint, metaIri, 'text/turtle', metaTurtle, dryRun, true);`,
  'meta graph logBlockOp: dynamic method'
);
patch(
  'commands/push.js',
  `const result = await gspPut(gspEndpoint, metaIri, metaTurtle, 'text/turtle', auth);
          checkResponse(result, 'meta graph');`,
  `const result = merge
            ? await gspPost(gspEndpoint, metaIri, metaTurtle, 'text/turtle', auth)
            : await gspPut(gspEndpoint, metaIri, metaTurtle, 'text/turtle', auth);
          checkResponse(result, 'meta graph');`,
  'meta graph push: respects --merge flag'
);

// 4b. Add getDefaultNamedGraph to the config.js import line in push.js
patch(
  'commands/push.js',
  `import { getDefaultEndpoint, inferGspEndpoint, inferUpdateEndpoint } from '../lib/config.js';`,
  `import { getDefaultEndpoint, inferGspEndpoint, inferUpdateEndpoint, getDefaultNamedGraph } from '../lib/config.js';`,
  'push.js: add getDefaultNamedGraph import'
);

// 4c. resolveGraphIri: add processors.toml + fragment-addressing steps
patch(
  'commands/push.js',
  `function resolveGraphIri(block, graphOpt, fm, databookId, filePath, totalBlocks = 1) {
  // 1. Explicit --graph
  if (graphOpt) return graphOpt;

  // 2. Frontmatter graph.named_graph (single-block convenience)
  if (fm.graph?.named_graph && totalBlocks === 1) return fm.graph.named_graph;

  // 3. Default graph  (null → GSP ?default in gsp.js)
  return null;
}`,
  `function resolveGraphIri(block, graphOpt, fm, databookId, filePath, totalBlocks = 1) {
  // 1. Explicit --graph
  if (graphOpt) return graphOpt;

  // 2. Frontmatter graph.named_graph (single-block convenience)
  if (fm.graph?.named_graph && totalBlocks === 1) return fm.graph.named_graph;

  // 3. processors.toml default_endpoint.named_graph (per-environment default)
  //    Set named_graph = "urn:x-arq:DefaultGraph" for Jena's default graph,
  //    or any named graph IRI to route all pushes to a fixed destination.
  const configGraph = getDefaultNamedGraph();
  if (configGraph) return configGraph;

  // 4. Fragment-addressing: {databookId}#{block.id}
  //    Mirrors pull's resolveGraphIris() — makes push/pull symmetric by default
  //    without requiring graph.named_graph in every DataBook frontmatter.
  if (databookId && block.id) return \`\${databookId}#\${block.id}\`;

  // 5. Default graph — only when no stable id or block has no id
  return null;
}`,
  'resolveGraphIri: fragment-addressing + processors.toml named_graph'
);

// ── 5. commands/pull.js ─────────────────────────────────────────────────────────

console.log('\n── commands/pull.js ─────────────────────────────────────────────');
patch(
  'commands/pull.js',
  `import { getDefaultEndpoint, inferGspEndpoint } from '../lib/config.js';`,
  `import { getDefaultEndpoint, inferGspEndpoint, getDefaultNamedGraph } from '../lib/config.js';`,
  'pull.js: add getDefaultNamedGraph import'
);
patch(
  'commands/pull.js',
  `function resolveGraphIris(graphOpts, fm, db) {
  if (graphOpts && graphOpts.length > 0) return Array.isArray(graphOpts) ? graphOpts : [graphOpts];

  // From frontmatter
  if (fm.graph?.named_graph) return [fm.graph.named_graph];

  // Fragment-addressing rule: {document.id}#{first-pushable-block-id}
  const firstBlock = db.blocks.find(b => b.id);
  if (fm.id && firstBlock) return [\`\${fm.id}#\${firstBlock.id}\`];

  die('no graph IRI — supply --graph or add graph.named_graph to frontmatter', 2);
}`,
  `function resolveGraphIris(graphOpts, fm, db) {
  // 1. Explicit --graph flag(s)
  if (graphOpts && graphOpts.length > 0) return Array.isArray(graphOpts) ? graphOpts : [graphOpts];

  // 2. Frontmatter graph.named_graph
  if (fm.graph?.named_graph) return [fm.graph.named_graph];

  // 3. processors.toml default_endpoint.named_graph (per-environment default)
  //    Mirrors push's resolveGraphIri() priority chain for push/pull symmetry.
  const configGraph = getDefaultNamedGraph();
  if (configGraph) return [configGraph];

  // 4. Fragment-addressing rule: {document.id}#{first-block-id}
  const firstBlock = db.blocks.find(b => b.id);
  if (fm.id && firstBlock) return [\`\${fm.id}#\${firstBlock.id}\`];

  die('no graph IRI — supply --graph or add graph.named_graph to frontmatter', 2);
}`,
  'resolveGraphIris: add processors.toml named_graph step'
);

// ── Summary ────────────────────────────────────────────────────────────────────

console.log(`
${'─'.repeat(60)}
  Applied : ${applied}
  Skipped : ${skipped}  (already patched)
  Errors  : ${errors}
${'─'.repeat(60)}`);

if (errors > 0) {
  console.error('\nSome patches failed. Check the messages above.');
  process.exit(1);
}
console.log(`
v1.4.2 patch complete.

Post-install checklist:
  1. Add to .databook/processors.toml:
       [default_endpoint]
       sparql      = "http://localhost:3030/ds/sparql"
       gsp         = "http://localhost:3030/ds/data"
       # named_graph = "urn:x-arq:DefaultGraph"   ← uncomment for Jena default graph

  2. Test extract still works:
       databook extract sensors.databook.md#sensors-block

  3. Test push/pull round-trip:
       databook push sensors.databook.md -e http://localhost:3030/ds/sparql
       databook pull sensors.databook.md -e http://localhost:3030/ds/sparql --wrap -o out.databook.md

  4. Test list:
       databook list -e http://localhost:3030/ds/sparql
`);
