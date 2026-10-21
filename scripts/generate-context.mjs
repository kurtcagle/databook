#!/usr/bin/env node
/**
 * Generate the DataBook header JSON-LD context from the bundled SHACL shapes.
 *
 * The shapes file (schema/holon-databook-header.shacl.ttl) pairs every
 * property with the YAML key that carries it (sh:codeIdentifier). This script
 * turns that pairing into a JSON-LD 1.1 context so that frontmatter read as
 * YAML-LD yields the same header graph as `frontmatterToTurtle`.
 *
 * The context is a name table: term -> property IRI, with datatype/IRI
 * coercion, @set containers for `[]` keys, and scoped contexts for nested
 * objects. It carries no other semantics. Types of nested nodes come from
 * rdfs:range in the vocabulary, not from the context.
 *
 * All term IRIs are written in full. The `type` tokens (`databook`,
 * `transformer-library`, `processor-registry`) are defined as terms for the
 * header classes, which would clash with a `databook:` prefix.
 *
 * Usage: node scripts/generate-context.mjs [--check] [--out <path>]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadShapesIndex, directChildren, relativeKey } from '../lib/reify.js';

const XSD = 'http://www.w3.org/2001/XMLSchema#';
const SH = 'http://www.w3.org/ns/shacl#';
const COERCED = new Set(['date', 'dateTime', 'integer', 'boolean'].map(n => XSD + n));

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_OUT = path.join(here, '..', 'schema', 'databook-header.context.jsonld');

function termFor(ps, parentCodeId, index) {
  const isArray = ps.codeIdentifier.endsWith('[]');
  const def = { '@id': ps.path };

  if (ps.node) {
    // nested container: scoped context holding the children's terms
    def['@context'] = scopeFor(ps.codeIdentifier, index);
  } else if (ps.nodeKind === SH + 'IRI') {
    def['@type'] = '@id';
  } else if (ps.datatype && COERCED.has(ps.datatype)) {
    def['@type'] = ps.datatype;
  }
  // string-or-IRI properties (license, publisher) stay plain literals: a
  // context cannot choose by the lexical form of a value.

  if (isArray) def['@container'] = '@set';
  return [relativeKey(ps.codeIdentifier, parentCodeId), def];
}

function scopeFor(parentCodeId, index) {
  const out = {};
  const kids = directChildren(index.propertyShapes, parentCodeId)
    .filter(ps => ps.codeIdentifier !== 'type')
    .sort((a, b) => a.codeIdentifier.localeCompare(b.codeIdentifier));
  for (const ps of kids) {
    const [term, def] = termFor(ps, parentCodeId, index);
    out[term] = Object.keys(def).length === 1 ? def['@id'] : def;
  }
  return out;
}

export function buildContext() {
  const index = loadShapesIndex();
  const ctx = { '@version': 1.1, '@protected': true, id: '@id', type: '@type' };
  const tokens = Object.entries(index.typeTokenToClass).sort(([a], [b]) => a.localeCompare(b));
  for (const [token, cls] of tokens) ctx[token] = cls;
  Object.assign(ctx, scopeFor('', index));
  return { '@context': ctx };
}

export function serialise(ctx) {
  return JSON.stringify(ctx, null, 2) + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const out = outIdx >= 0 ? args[outIdx + 1] : DEFAULT_OUT;
  const text = serialise(buildContext());
  if (args.includes('--check')) {
    const current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
    if (current !== text) {
      console.error(`${out} is out of date; run: node scripts/generate-context.mjs`);
      process.exit(1);
    }
    console.log(`${out} is up to date`);
  } else {
    fs.writeFileSync(out, text);
    console.log(`wrote ${out}`);
  }
}
