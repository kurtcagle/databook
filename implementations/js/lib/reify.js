/**
 * Frontmatter → Turtle reification.
 * Maps DataBook YAML frontmatter fields to RDF triples in the databook:
 * namespace (https://w3id.org/holon/databook#, DataBook v2.0 draft).
 * Used by `databook push --meta`.
 *
 * v2 (DataBook v2.0): driven by the bundled SHACL shapes
 * (schema/holon-databook-header.shacl.ttl) rather than a hand-rolled
 * per-field mapping. The shapes graph is parsed once and indexed by
 * sh:codeIdentifier -> {sh:path, sh:datatype, sh:nodeKind, sh:node, sh:or}.
 * A generic recursive walker then resolves each codeIdentifier against the
 * parsed frontmatter with a path-get and emits the corresponding triple —
 * so a new frontmatter field only needs a new property shape in the shapes
 * file, not a matching code change here.
 *
 * The one piece that isn't purely shapes-derived: the `type` field's YAML
 * string tokens ("databook", "transformer-library", "processor-registry")
 * aren't themselves encoded in the shapes graph's sh:in class list, so a
 * small fixed lookup table selects the class. Everything else is generic.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Parser as N3Parser, Store } from 'n3';

const SH  = 'http://www.w3.org/ns/shacl#';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';

const sh  = p => `${SH}${p}`;
const rdf = p => `${RDF}${p}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHAPES_PATH = path.join(__dirname, '..', 'schema', 'holon-databook-header.shacl.ttl');

const DATABOOK_NS = 'https://w3id.org/holon/databook#';

// The YAML `type` string -> class local name. Not derivable from the shapes
// graph itself (sh:in lists valid classes, not the YAML tokens that select
// among them), so this one small table is intentionally hand-maintained.
const TYPE_CLASS = {
  'databook':            'DataBookHeader',
  'transformer-library':  'TransformerLibraryHeader',
  'processor-registry':   'ProcessorRegistryHeader',
};

let _shapesIndex = null;

/**
 * Parse the bundled SHACL shapes file once and build a lookup of property
 * shapes keyed by sh:codeIdentifier, plus a NodeShape -> sh:targetClass map
 * (for typing nested container nodes). Cached after the first call.
 */
export function loadShapesIndex() {
  if (_shapesIndex) return _shapesIndex;

  let ttl;
  try {
    ttl = fs.readFileSync(SHAPES_PATH, 'utf8');
  } catch (e) {
    throw new Error(
      `frontmatterToTurtle: could not read bundled shapes file at ${SHAPES_PATH}: ${e.message}`
    );
  }

  const store = new Store();
  try {
    store.addQuads(new N3Parser().parse(ttl));
  } catch (e) {
    throw new Error(`frontmatterToTurtle: failed to parse shapes file: ${e.message}`);
  }

  const collectList = (listNode) => {
    const items = [];
    let cur = listNode;
    while (cur && cur.value !== rdf('nil')) {
      const first = store.getObjects(cur, rdf('first'), null);
      if (first.length) items.push(first[0]);
      const rest = store.getObjects(cur, rdf('rest'), null);
      cur = rest[0] ?? null;
    }
    return items;
  };

  const propertyShapes = [];
  for (const q of store.getQuads(null, sh('codeIdentifier'), null, null)) {
    const shapeId = q.subject.value;
    const codeIdentifier = q.object.value;

    const pathTerm = store.getObjects(shapeId, sh('path'), null)[0] ?? null;
    const nodeTerm = store.getObjects(shapeId, sh('node'), null)[0] ?? null;
    const datatypeTerm = store.getObjects(shapeId, sh('datatype'), null)[0] ?? null;
    const nodeKindTerm = store.getObjects(shapeId, sh('nodeKind'), null)[0] ?? null;
    const orTerm = store.getObjects(shapeId, sh('or'), null)[0] ?? null;

    let orAlternatives = null;
    if (orTerm) {
      orAlternatives = collectList(orTerm).map(alt => ({
        datatype: store.getObjects(alt, sh('datatype'), null)[0]?.value ?? null,
        nodeKind: store.getObjects(alt, sh('nodeKind'), null)[0]?.value ?? null,
      }));
    }

    propertyShapes.push({
      shapeId,
      codeIdentifier,
      path: pathTerm?.value ?? null,
      node: nodeTerm?.value ?? null,
      datatype: datatypeTerm?.value ?? null,
      nodeKind: nodeKindTerm?.value ?? null,
      orAlternatives,
    });
  }

  const targetClassByShape = {};
  for (const q of store.getQuads(null, sh('targetClass'), null, null)) {
    (targetClassByShape[q.subject.value] ??= []).push(q.object.value);
  }

  _shapesIndex = { propertyShapes, targetClassByShape };
  return _shapesIndex;
}

// ─── Tree walking over sh:codeIdentifier paths ────────────────────────────────

/**
 * Direct children of `parentCodeId` ('' for root): property shapes whose
 * codeIdentifier starts with "parentCodeId." (or has no dot at all, for
 * root) and has no further "." after that prefix is stripped. This is
 * sufficient to reconstruct the whole tree purely from the codeIdentifier
 * strings, since containers (sh:node-typed shapes) are the only shapes
 * with further-nested children.
 */
function directChildren(propertyShapes, parentCodeId) {
  if (parentCodeId === '') {
    return propertyShapes.filter(ps => !ps.codeIdentifier.includes('.'));
  }
  const prefix = parentCodeId + '.';
  return propertyShapes.filter(ps => {
    if (!ps.codeIdentifier.startsWith(prefix)) return false;
    const rest = ps.codeIdentifier.slice(prefix.length);
    return !rest.includes('.');
  });
}

/** The JS object key to look up under the immediate parent object. */
function relativeKey(codeIdentifier, parentCodeId) {
  const rel = parentCodeId === ''
    ? codeIdentifier
    : codeIdentifier.slice(parentCodeId.length + 1);
  return rel.replace(/\[\]$/, '');
}

/** Deterministic, dereferenceable fragment IRI for a nested container node. */
function withFragment(baseIri, fragment) {
  const trimmed = baseIri.endsWith('#') ? baseIri.slice(0, -1) : baseIri;
  return `${trimmed}#${fragment}`;
}

function fragmentName(codeIdentifier, index = null) {
  const base = codeIdentifier.replace(/\[\]$/, '').replace(/\./g, '-');
  return index === null ? base : `${base}-${index}`;
}

function looksLikeIri(v) {
  return typeof v === 'string' && /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v);
}

function ttlLiteral(value) {
  const escaped = String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
  return `"${escaped}"`;
}

function toDateString(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

function toDateTimeString(v) {
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function formatValue(v, ps) {
  if (ps.nodeKind === sh('IRI')) return `<${v}>`;

  if (ps.orAlternatives) {
    // license / publisher: string OR IRI — disambiguate by shape of the value.
    return looksLikeIri(v) ? `<${v}>` : ttlLiteral(v);
  }

  // js-yaml auto-parses YAML date/timestamp scalars into native JS Date
  // objects (YAML 1.1 implicit !!timestamp typing). Naive template-literal
  // stringification of a Date gives its locale toString() (e.g. "Mon Aug 24
  // 2026 00:00:00 GMT+0000 (Coordinated Universal Time)"), not an ISO date —
  // this bit the *previous* frontmatterToTurtle too (ttlDate/ttlDateTime did
  // `${value}` directly). Handle both Date instances and already-string
  // values explicitly.
  if (ps.datatype === `${XSD}date`)     return `"${toDateString(v)}"^^xsd:date`;
  if (ps.datatype === `${XSD}dateTime`) return `"${toDateTimeString(v)}"^^xsd:dateTime`;

  if (ps.datatype === `${XSD}integer`) {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? String(n) : ttlLiteral(v);
  }
  if (ps.datatype === `${XSD}boolean`) return v ? 'true' : 'false';

  // Default: xsd:string, written as a plain (untyped) literal.
  return ttlLiteral(v);
}

/**
 * Recursively walk `obj` against the property shapes that are direct
 * children of `parentCodeId`, appending `<subjectIri> <path> value .`
 * triples (or, for sh:node-typed properties, a fresh fragment IRI plus a
 * recursive call) to `out`.
 */
function walk(subjectIri, obj, parentCodeId, shapesIndex, out) {
  const children = directChildren(shapesIndex.propertyShapes, parentCodeId);

  for (const ps of children) {
    if (ps.codeIdentifier === 'type') continue; // handled by the caller

    const isArray = ps.codeIdentifier.endsWith('[]');
    const key = relativeKey(ps.codeIdentifier, parentCodeId);
    const rawVal = obj ? obj[key] : undefined;
    if (rawVal === undefined || rawVal === null || rawVal === '') continue;

    if (ps.node) {
      const targetClasses = shapesIndex.targetClassByShape[ps.node] ?? [];
      const items = isArray
        ? (Array.isArray(rawVal) ? rawVal : [rawVal])
        : [rawVal];

      items.forEach((item, idx) => {
        if (item === undefined || item === null) return;
        const childIri = withFragment(
          subjectIri,
          fragmentName(ps.codeIdentifier, isArray ? idx : null)
        );
        out.push(`<${subjectIri}> <${ps.path}> <${childIri}> .`);
        for (const cls of targetClasses) out.push(`<${childIri}> a <${cls}> .`);
        walk(childIri, item, ps.codeIdentifier, shapesIndex, out);
      });
    } else {
      const values = isArray
        ? (Array.isArray(rawVal) ? rawVal : [rawVal])
        : [rawVal];

      for (const v of values) {
        if (v === undefined || v === null || v === '') continue;
        out.push(`<${subjectIri}> <${ps.path}> ${formatValue(v, ps)} .`);
      }
    }
  }
}

/**
 * Serialise DataBook frontmatter as a Turtle string.
 * Subject is the DataBook `id` IRI (or a file:// URI as fallback).
 * @param {object} frontmatter
 * @param {string|null} filePath  - fallback for id generation
 * @returns {string}
 */
export function frontmatterToTurtle(frontmatter, filePath = null) {
  const shapesIndex = loadShapesIndex();

  const subjectIri = frontmatter.id ?? `file://${filePath ?? 'unknown'}`;
  const cls = TYPE_CLASS[frontmatter.type] ?? 'DataBookHeader';

  const triples = [`<${subjectIri}> a databook:${cls} .`];
  walk(subjectIri, frontmatter, '', shapesIndex, triples);

  const lines = [
    `@prefix databook: <${DATABOOK_NS}> .`,
    `@prefix xsd:      <${XSD}> .`,
    ``,
    ...triples,
  ];
  return lines.join('\n') + '\n';
}
