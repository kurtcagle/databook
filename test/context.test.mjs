/**
 * The DataBook header context and the CLI's projection must give the same
 * header graph.
 *
 * For every DataBook with frontmatter in the repository:
 *   A. project it with frontmatterToTurtle (lib/reify.js), and
 *   B. read the same frontmatter as YAML-LD with schema/databook-header.context.jsonld.
 * The two graphs must be isomorphic once two things are normalised:
 *   - nested nodes: the CLI mints index-based fragment IRIs (`<id>#author-0`);
 *     the context yields blank nodes. Both become blank nodes before comparing.
 *   - types of nested nodes: the CLI writes `a databook:AuthorStamp`; the context
 *     does not, because the vocabulary says `databook:author rdfs:range
 *     databook:AuthorStamp`. The test checks every such type against rdfs:range
 *     and then drops it.
 * Frontmatter is read with the YAML core schema (no implicit timestamps), as a
 * YAML-LD processor would.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import jsonld from 'jsonld';
import { Parser, Store } from 'n3';
import { frontmatterToTurtle, getBundledShapesText } from '../lib/reify.js';
import { buildContext, serialise, DEFAULT_OUT } from '../scripts/generate-context.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDFS_RANGE = 'http://www.w3.org/2000/01/rdf-schema#range';

const context = JSON.parse(fs.readFileSync(DEFAULT_OUT, 'utf8'));
const shapes = new Store();
shapes.addQuads(new Parser().parse(getBundledShapesText()));

function frontmatterOf(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---(\n|$)/);
  if (!m) return null;
  try {
    const fm = yaml.load(m[1], { schema: yaml.CORE_SCHEMA });
    return fm && typeof fm === 'object' && typeof fm.id === 'string' && /^[a-z][a-z0-9+.-]*:/i.test(fm.id) ? fm : null;
  } catch { return null; }
}

function nq(q) {
  const t = x => x.termType === 'NamedNode' ? `<${x.value}>`
    : x.termType === 'BlankNode' ? `_:${x.value}`
    : `"${x.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"` +
      (x.language ? `@${x.language}` : x.datatype && x.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string' ? `^^<${x.datatype.value}>` : '');
  return `${t(q.subject)} ${t(q.predicate)} ${t(q.object)} .`;
}

/** CLI projection -> N-Quads with nested nodes as blank nodes and their types checked, then dropped. */
function cliGraph(fm) {
  const quads = new Parser().parse(frontmatterToTurtle(fm));
  const root = fm.id;
  // A nested node is one the CLI minted: a subject other than the document
  // itself. A value that merely looks like a fragment of the document
  // (`#block-id`, a `namedGraph` equal to the node's own IRI) is not one.
  const nestedIris = new Set(quads.map(q => q.subject.value).filter(v => v !== root));
  const nested = new Map();
  let n = 0;
  const bn = iri => { if (!nested.has(iri)) nested.set(iri, `n${n++}`); return nested.get(iri); };
  const out = [];
  for (const q of quads) {
    if (q.predicate.value === RDF_TYPE && nestedIris.has(q.subject.value)) {
      const parent = quads.find(p => p.object.value === q.subject.value && p.subject.value !== p.object.value && p.predicate.value !== RDF_TYPE);
      const ranges = shapes.getObjects(parent.predicate, RDFS_RANGE, null).map(o => o.value);
      assert.ok(ranges.includes(q.object.value),
        `${q.object.value} on a nested node is not the rdfs:range of ${parent.predicate.value}`);
      continue;
    }
    const s = nestedIris.has(q.subject.value) ? { termType: 'BlankNode', value: bn(q.subject.value) } : q.subject;
    const isLink = q.object.termType === 'NamedNode' && nestedIris.has(q.object.value) && q.subject.value !== q.object.value;
    const o = isLink ? { termType: 'BlankNode', value: bn(q.object.value) } : q.object;
    out.push(nq({ subject: s, predicate: q.predicate, object: o }));
  }
  return out.join('\n') + '\n';
}

async function canon(nquads) {
  return jsonld.canonize(nquads, { algorithm: 'URDNA2015', inputFormat: 'application/n-quads', format: 'application/n-quads' });
}

async function contextGraph(fm) {
  return jsonld.toRDF({ '@context': context['@context'], ...fm }, { format: 'application/n-quads' });
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'implementations') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.md$/.test(e.name)) acc.push(p);
  }
  return acc;
}

// Documents where the two projections differ for a stated reason. Each entry
// is asserted to still differ, so the list cannot go stale unnoticed.
const KNOWN_DIVERGENCES = {
  // string-or-IRI properties: the CLI turns a value that looks like an IRI into
  // an IRI; the context keeps every value a plain literal (see the generator).
  // `type` that is not a registered token: the CLI substitutes databook:DataBookHeader
  // (lib/reify.js, typeTokenToClass fallback); the context reads what the document says.
  // A header must not gain a triple from a processor default (SPEC.md, header graph).
  'unregistered-type': fm => !(typeof fm.type === 'string' && fm.type in context['@context']),
  'string-or-iri': fm => ['license', 'publisher'].some(k => typeof fm[k] === 'string' && /^[a-z][a-z0-9+.-]*:\/\//i.test(fm[k])),
};

test('the committed context is the one the generator produces', () => {
  assert.equal(fs.readFileSync(DEFAULT_OUT, 'utf8'), serialise(buildContext()));
});

test('the context is accepted by a JSON-LD 1.1 processor', async () => {
  const out = await jsonld.expand({ '@context': context['@context'], id: 'https://example.org/x', title: 'T' });
  assert.equal(out[0]['@id'], 'https://example.org/x');
});

const files = walk(root).map(f => [f, frontmatterOf(f)]).filter(([, fm]) => fm);

test('there are DataBooks to compare', () => assert.ok(files.length >= 5, `found ${files.length}`));

for (const [file, fm] of files) {
  const rel = path.relative(root, file);
  const reason = Object.entries(KNOWN_DIVERGENCES).find(([, f]) => f(fm))?.[0];
  test(`${rel}: ${reason ? `differs (${reason})` : 'context and CLI give isomorphic header graphs'}`, async () => {
    const a = await canon(cliGraph(fm));
    const b = await canon(await contextGraph(fm));
    if (reason) assert.notEqual(a, b, `expected a divergence (${reason}) but the graphs agree; remove it from KNOWN_DIVERGENCES`);
    else {
      const A = new Set(a.split('\n').filter(Boolean)), B = new Set(b.split('\n').filter(Boolean));
      const onlyCli = [...A].filter(l => !B.has(l)), onlyCtx = [...B].filter(l => !A.has(l));
      assert.ok(!onlyCli.length && !onlyCtx.length,
        `only in CLI projection:\n${onlyCli.map(l => l.replace(/https:\/\/w3id.org\/databook\/header#/g, 'db:')).join('\n')}\nonly in context reading:\n${onlyCtx.map(l => l.replace(/https:\/\/w3id.org\/databook\/header#/g, 'db:')).join('\n')}`);
    }
  });
}

// No fixture in the repository carries an IRI-valued license, so the string-or-IRI
// divergence is exercised with a synthetic header.
test('synthetic: an IRI-valued license is an IRI for the CLI and a literal for the context', async () => {
  const fm = { id: 'https://example.org/synthetic', type: 'databook', title: 'S', license: 'https://creativecommons.org/licenses/by/4.0/' };
  const a = await canon(cliGraph(fm));
  const b = await canon(await contextGraph(fm));
  assert.match(a, /<https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/> \./);
  assert.match(b, /"https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/" \./);
  assert.ok(KNOWN_DIVERGENCES['string-or-iri'](fm));
});
