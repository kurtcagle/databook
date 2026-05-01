/**
 * lib/shacl2sparql.js
 *
 * SHACL 1.2 Core → SPARQL compiler.
 * Parses a SHACL shapes graph (Turtle string) with N3.js and generates
 * SPARQL SELECT (and optionally CONSTRUCT) queries that return all focus
 * nodes satisfying each NodeShape.
 *
 * Supports:
 *   - sh:targetClass / sh:targetNode / sh:targetSubjectsOf / sh:targetObjectsOf
 *   - sh:path (sequence, alternative, inverse, zero-or-more, one-or-more, zero-or-one)
 *   - sh:minCount / sh:maxCount (subquery + HAVING)
 *   - sh:datatype / sh:class / sh:nodeKind
 *   - sh:minInclusive / sh:maxInclusive / sh:minExclusive / sh:maxExclusive
 *   - sh:minLength / sh:maxLength / sh:pattern / sh:flags
 *   - sh:in / sh:hasValue
 *   - sh:not / sh:and / sh:or  (sh:xone emits a comment — not faithfully compilable)
 *   - sh:node (nested NodeShape reference)
 *   - SHACL 1.2 Node Expressions: sh:values / sh:this / sh:path / sh:filterShape
 *     sh:intersection / sh:union / sh:distinct / sh:limit / sh:offset
 *   - Optional FROM / FROM NAMED clause injection
 */

import { Parser, Store } from 'n3';

// ─── Namespace helpers ────────────────────────────────────────────────────────

const SH   = 'http://www.w3.org/ns/shacl#';
const RDF  = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const XSD  = 'http://www.w3.org/2001/XMLSchema#';

const sh   = p => `${SH}${p}`;
const rdf  = p => `${RDF}${p}`;

/** Serialise an N3 Term to a SPARQL token. */
function termToSparql(term) {
  if (!term) return '?_undef';
  if (term.termType === 'NamedNode')  return `<${term.value}>`;
  if (term.termType === 'BlankNode')  return `_:${term.value}`;
  if (term.termType === 'Literal') {
    const lex = term.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    if (term.language) return `"${lex}"@${term.language}`;
    if (term.datatype?.value && term.datatype.value !== `${XSD}string`)
      return `"${lex}"^^<${term.datatype.value}>`;
    return `"${lex}"`;
  }
  return `<${term.value}>`;
}

let _varIdx = 0;
const freshVar  = (hint = 'v') => `?_${hint}_${_varIdx++}`;
export const resetVars = () => { _varIdx = 0; };

// ─── RDF list helper ──────────────────────────────────────────────────────────

function collectList(store, listNode) {
  const items = [];
  let cur = listNode;
  while (cur && cur.value !== rdf('nil')) {
    const first = store.getObjects(cur, rdf('first'), null);
    if (first.length) items.push(first[0]);
    const rest = store.getObjects(cur, rdf('rest'), null);
    cur = rest[0] ?? null;
  }
  return items;
}

// ─── Path compiler ────────────────────────────────────────────────────────────

function compilePath(store, pathNode) {
  if (!pathNode) return '?_nopath';
  if (pathNode.termType === 'NamedNode') return termToSparql(pathNode);

  // rdf:List → sequence path
  const firstItems = store.getObjects(pathNode, rdf('first'), null);
  if (firstItems.length) {
    const items = collectList(store, pathNode);
    return items.map(n => compilePath(store, n)).join('/');
  }

  const alt = store.getObjects(pathNode, sh('alternativePath'), null);
  if (alt.length) {
    const items = collectList(store, alt[0]);
    return `(${items.map(n => compilePath(store, n)).join('|')})`;
  }

  const inv = store.getObjects(pathNode, sh('inversePath'), null);
  if (inv.length) return `^${compilePath(store, inv[0])}`;

  const zom = store.getObjects(pathNode, sh('zeroOrMorePath'), null);
  if (zom.length) return `${compilePath(store, zom[0])}*`;

  const oom = store.getObjects(pathNode, sh('oneOrMorePath'), null);
  if (oom.length) return `${compilePath(store, oom[0])}+`;

  const zoo = store.getObjects(pathNode, sh('zeroOrOnePath'), null);
  if (zoo.length) return `(${compilePath(store, zoo[0])})?`;

  return termToSparql(pathNode);
}

// ─── Node Expression compiler ─────────────────────────────────────────────────

function extractNodeExprNode(store, node) {
  if (node.value === sh('this')) return { type: 'this' };
  if (node.termType === 'NamedNode') return { type: 'constant', value: node };
  if (node.termType === 'Literal')   return { type: 'constant', value: node };

  const path = store.getObjects(node, sh('path'), null)[0];
  if (path) {
    const inner = store.getObjects(node, sh('nodes'), null)[0];
    return {
      type: 'path',
      path: compilePath(store, path),
      nodes: inner ? extractNodeExprNode(store, inner) : { type: 'this' },
    };
  }

  const filterShape = store.getObjects(node, sh('filterShape'), null)[0];
  if (filterShape) {
    const inner = store.getObjects(node, sh('nodes'), null)[0];
    return {
      type: 'filterShape',
      shape: filterShape,
      nodes: inner ? extractNodeExprNode(store, inner) : { type: 'this' },
    };
  }

  const inter = store.getObjects(node, sh('intersection'), null)[0];
  if (inter) {
    return {
      type: 'intersection',
      members: collectList(store, inter).map(m => extractNodeExprNode(store, m)),
    };
  }

  const union = store.getObjects(node, sh('union'), null)[0];
  if (union) {
    return {
      type: 'union',
      members: collectList(store, union).map(m => extractNodeExprNode(store, m)),
    };
  }

  // SHACL 1.2 modifiers: sh:distinct / sh:limit / sh:offset
  const innerExpr = store.getObjects(node, sh('nodes'), null)[0];
  const distinct  = store.getObjects(node, sh('distinct'), null)[0];
  const limit     = store.getObjects(node, sh('limit'), null)[0];
  const offset    = store.getObjects(node, sh('offset'), null)[0];

  if (distinct || limit || offset) {
    return {
      type: 'modifier',
      distinct: distinct?.value === 'true',
      limit:    limit  ? parseInt(limit.value, 10)  : null,
      offset:   offset ? parseInt(offset.value, 10) : null,
      nodes: innerExpr ? extractNodeExprNode(store, innerExpr) : { type: 'this' },
    };
  }

  return { type: 'unknown', raw: node };
}

function compileNodeExpr(expr, focusVar, resultVar, compileShapeConstraintsFn) {
  switch (expr.type) {
    case 'this':
      return { patterns: [`BIND(${focusVar} AS ${resultVar})`], resultVar };

    case 'constant':
      return { patterns: [`BIND(${termToSparql(expr.value)} AS ${resultVar})`], resultVar };

    case 'path': {
      const innerVar = freshVar('ni');
      const inner = compileNodeExpr(expr.nodes, focusVar, innerVar, compileShapeConstraintsFn);
      return {
        patterns: [...inner.patterns, `${innerVar} ${expr.path} ${resultVar} .`],
        resultVar,
      };
    }

    case 'filterShape': {
      const innerVar = freshVar('nf');
      const inner = compileNodeExpr(expr.nodes, focusVar, innerVar, compileShapeConstraintsFn);
      const shapePatterns = compileShapeConstraintsFn(expr.shape, innerVar);
      return {
        patterns: [
          ...inner.patterns,
          `FILTER EXISTS {\n  ${shapePatterns.join('\n  ')}\n}`,
          `BIND(${innerVar} AS ${resultVar})`,
        ],
        resultVar,
      };
    }

    case 'intersection': {
      const patterns = [];
      const sharedVar = freshVar('nx');
      expr.members.forEach((m, i) => {
        const mv = i === 0 ? sharedVar : freshVar('nx');
        const c = compileNodeExpr(m, focusVar, mv, compileShapeConstraintsFn);
        patterns.push(...c.patterns);
        if (i > 0) patterns.push(`FILTER(${mv} = ${sharedVar})`);
      });
      return { patterns: [...patterns, `BIND(${sharedVar} AS ${resultVar})`], resultVar };
    }

    case 'union': {
      const branches = expr.members.map(m => {
        const bv = freshVar('nu');
        const c = compileNodeExpr(m, focusVar, bv, compileShapeConstraintsFn);
        return [...c.patterns, `BIND(${bv} AS ${resultVar})`].join('\n  ');
      });
      return {
        patterns: [`{ ${branches.join('\n} UNION {\n  ')} }`],
        resultVar,
      };
    }

    case 'modifier': {
      const innerVar = freshVar('nm');
      const inner = compileNodeExpr(expr.nodes, focusVar, innerVar, compileShapeConstraintsFn);
      const distinct = expr.distinct ? 'DISTINCT ' : '';
      const limit    = expr.limit  != null ? `\nLIMIT ${expr.limit}`   : '';
      const offset   = expr.offset != null ? `\nOFFSET ${expr.offset}` : '';
      return {
        patterns: [
          `{ SELECT ${distinct}${innerVar} WHERE {`,
          ...inner.patterns.map(p => '  ' + p),
          `}${limit}${offset} }`,
          `BIND(${innerVar} AS ${resultVar})`,
        ],
        resultVar,
      };
    }

    default:
      return { patterns: [`# Unsupported Node Expression: ${expr.type}`], resultVar };
  }
}

// ─── Shape extractor ──────────────────────────────────────────────────────────

function extractTargets(store, node) {
  const targets = [];
  for (const cls of store.getObjects(node, sh('targetClass'), null))
    targets.push({ type: 'class', value: cls });
  for (const n of store.getObjects(node, sh('targetNode'), null))
    targets.push({ type: 'node', value: n });
  for (const p of store.getObjects(node, sh('targetSubjectsOf'), null))
    targets.push({ type: 'subjectsOf', value: p });
  for (const p of store.getObjects(node, sh('targetObjectsOf'), null))
    targets.push({ type: 'objectsOf', value: p });
  return targets;
}

function extractPropertyShape(store, node) {
  const get    = pred => store.getObjects(node, sh(pred), null)[0] ?? null;
  const getAll = pred => store.getObjects(node, sh(pred), null);
  const path   = get('path');

  // SHACL 1.2 sh:values Node Expression
  const valExpr = store.getObjects(node, sh('values'), null)[0];

  return {
    type: 'PropertyShape',
    id: node,
    path:    path ? compilePath(store, path) : null,
    pathNode: path,
    minCount: get('minCount') ? parseInt(get('minCount').value, 10) : null,
    maxCount: get('maxCount') ? parseInt(get('maxCount').value, 10) : null,
    datatype:     get('datatype'),
    class:        get('class'),
    nodeKind:     get('nodeKind'),
    minInclusive: get('minInclusive'),
    maxInclusive: get('maxInclusive'),
    minExclusive: get('minExclusive'),
    maxExclusive: get('maxExclusive'),
    minLength: get('minLength') ? parseInt(get('minLength').value, 10) : null,
    maxLength: get('maxLength') ? parseInt(get('maxLength').value, 10) : null,
    pattern:  get('pattern'),
    flags:    get('flags'),
    hasValue: getAll('hasValue'),
    in:       get('in') ? collectList(store, get('in')) : null,
    node:     get('node'),
    qualifiedValueShape: get('qualifiedValueShape'),
    qualifiedMinCount: get('qualifiedMinCount')
      ? parseInt(get('qualifiedMinCount').value, 10) : null,
    qualifiedMaxCount: get('qualifiedMaxCount')
      ? parseInt(get('qualifiedMaxCount').value, 10) : null,
    nodeExpression: valExpr ? extractNodeExprNode(store, valExpr) : null,
    logical: extractLogical(store, node),
  };
}

function extractLogical(store, node) {
  return {
    and:  store.getObjects(node, sh('and'),  null).map(l => collectList(store, l)),
    or:   store.getObjects(node, sh('or'),   null).map(l => collectList(store, l)),
    not:  store.getObjects(node, sh('not'),  null),
    xone: store.getObjects(node, sh('xone'), null).map(l => collectList(store, l)),
  };
}

function extractNodeShape(store, node) {
  return {
    type: 'NodeShape',
    id:   node,
    targets:    extractTargets(store, node),
    properties: store.getObjects(node, sh('property'), null)
                     .map(ps => extractPropertyShape(store, ps)),
    logical:    extractLogical(store, node),
  };
}

function extractShapes(store) {
  const seen = new Set();
  const candidates = [
    ...store.getSubjects(rdf('type'), sh('NodeShape'), null),
    ...store.getSubjects(sh('property'), null, null),
    // shapes referenced via sh:targetClass as implicit NodeShapes
  ];
  return candidates
    .filter(n => { if (seen.has(n.value)) return false; seen.add(n.value); return true; })
    .filter(n => n.termType === 'NamedNode' || n.termType === 'BlankNode')
    .map(n => extractNodeShape(store, n));
}

// ─── SPARQL compiler ──────────────────────────────────────────────────────────

const NODEKIND_TESTS = {
  [`${sh('IRI')}`]:            v => `isIRI(${v})`,
  [`${sh('Literal')}`]:        v => `isLiteral(${v})`,
  [`${sh('BlankNode')}`]:      v => `isBlank(${v})`,
  [`${sh('BlankNodeOrIRI')}`]: v => `(isBlank(${v}) || isIRI(${v}))`,
  [`${sh('IRIOrLiteral')}`]:   v => `(isIRI(${v}) || isLiteral(${v}))`,
};

class SPARQLCompiler {
  constructor(store) {
    this.store = store;
  }

  /** Compile a NodeShape to a complete SELECT query string. */
  compileSelect(shape, fromClauses = []) {
    resetVars();
    const focusVar = '?focusNode';
    const patterns = [];

    const targetPatterns = this._compileTargets(shape.targets, focusVar);
    if (targetPatterns.length === 0) {
      patterns.push(`{ ${focusVar} ?_anyP ?_anyO . } UNION { ?_anyS ?_anyP2 ${focusVar} . }`);
    } else {
      patterns.push(...targetPatterns);
    }

    for (const ps of shape.properties) {
      patterns.push(...this._compilePropertyShape(ps, focusVar));
    }
    patterns.push(...this._compileLogical(shape.logical, focusVar));

    const fromBlock = fromClauses.map(iri => `FROM <${iri}>`).join('\n');
    const fromLine  = fromBlock ? `\n${fromBlock}` : '';
    const body      = patterns.map(p => '  ' + p).join('\n');
    return `SELECT DISTINCT ?focusNode${fromLine}\nWHERE {\n${body}\n}`;
  }

  /** Compile a NodeShape to a CONSTRUCT query that returns all matching triples. */
  compileConstruct(shape, fromClauses = []) {
    resetVars();
    const focusVar = '?focusNode';
    const patterns = [];

    const targetPatterns = this._compileTargets(shape.targets, focusVar);
    if (targetPatterns.length === 0) {
      patterns.push(`{ ${focusVar} ?_anyP ?_anyO . } UNION { ?_anyS ?_anyP2 ${focusVar} . }`);
    } else {
      patterns.push(...targetPatterns);
    }

    for (const ps of shape.properties) {
      patterns.push(...this._compilePropertyShape(ps, focusVar));
    }
    patterns.push(...this._compileLogical(shape.logical, focusVar));

    const fromBlock = fromClauses.map(iri => `FROM <${iri}>`).join('\n');
    const fromLine  = fromBlock ? `\n${fromBlock}` : '';
    const body      = patterns.map(p => '  ' + p).join('\n');
    return `CONSTRUCT { ?focusNode ?_p ?_o . }${fromLine}\nWHERE {\n${body}\n  ?focusNode ?_p ?_o .\n}`;
  }

  // ── Targets ────────────────────────────────────────────────────────────────

  _compileTargets(targets, focusVar) {
    return targets.map(t => {
      switch (t.type) {
        case 'class':
          return `${focusVar} <${rdf('type')}>/<${RDFS}subClassOf>* ${termToSparql(t.value)} .`;
        case 'node':
          return `VALUES ${focusVar} { ${termToSparql(t.value)} }`;
        case 'subjectsOf':
          return `${focusVar} ${termToSparql(t.value)} ?_so .`;
        case 'objectsOf':
          return `?_oo ${termToSparql(t.value)} ${focusVar} .`;
        default:
          return `# Unknown target type: ${t.type}`;
      }
    });
  }

  // ── Property shapes ────────────────────────────────────────────────────────

  _compilePropertyShape(ps, focusVar) {
    if (!ps.path) return [`# PropertyShape without sh:path — skipped`];
    const patterns = [];

    // Count constraints → subquery with HAVING
    if (ps.minCount !== null || ps.maxCount !== null) {
      return this._compileCountConstraint(ps, focusVar);
    }

    // sh:hasValue — exact value(s) required
    if (ps.hasValue?.length) {
      for (const hv of ps.hasValue)
        patterns.push(`${focusVar} ${ps.path} ${termToSparql(hv)} .`);
      return patterns;
    }

    // SHACL 1.2 sh:values Node Expression
    if (ps.nodeExpression) {
      const exprResultVar = freshVar('nexpr');
      const { patterns: exprPatterns } =
        compileNodeExpr(ps.nodeExpression, focusVar, exprResultVar,
          (shapeRef, fv) => this.compileShapeConstraints(shapeRef, fv));
      patterns.push(...exprPatterns);
      patterns.push(`${focusVar} ${ps.path} ${exprResultVar} .`);
      patterns.push(...this._compileValueFilters(ps, exprResultVar));
      return patterns;
    }

    // General value constraint
    const valVar = freshVar('val');
    const isRequired = (ps.minCount ?? 0) > 0;
    const triple = `${focusVar} ${ps.path} ${valVar} .`;
    patterns.push(isRequired ? triple : `OPTIONAL { ${triple} }`);
    patterns.push(...this._compileValueFilters(ps, valVar));

    if (ps.node) {
      patterns.push(...this.compileShapeConstraints(ps.node, valVar));
    }
    patterns.push(...this._compileLogical(ps.logical, valVar));

    return patterns;
  }

  _compileValueFilters(ps, valVar) {
    const f = [];

    if (ps.datatype)
      f.push(`FILTER(DATATYPE(${valVar}) = ${termToSparql(ps.datatype)})`);

    if (ps.class)
      f.push(`${valVar} <${rdf('type')}>/<${RDFS}subClassOf>* ${termToSparql(ps.class)} .`);

    if (ps.nodeKind) {
      const fn = NODEKIND_TESTS[ps.nodeKind.value];
      if (fn) f.push(`FILTER(${fn(valVar)})`);
    }

    if (ps.minInclusive) f.push(`FILTER(${valVar} >= ${termToSparql(ps.minInclusive)})`);
    if (ps.maxInclusive) f.push(`FILTER(${valVar} <= ${termToSparql(ps.maxInclusive)})`);
    if (ps.minExclusive) f.push(`FILTER(${valVar} > ${termToSparql(ps.minExclusive)})`);
    if (ps.maxExclusive) f.push(`FILTER(${valVar} < ${termToSparql(ps.maxExclusive)})`);

    if (ps.minLength != null)
      f.push(`FILTER(STRLEN(STR(${valVar})) >= ${ps.minLength})`);
    if (ps.maxLength != null)
      f.push(`FILTER(STRLEN(STR(${valVar})) <= ${ps.maxLength})`);

    if (ps.pattern) {
      const flag = ps.flags ? `, "${ps.flags.value}"` : '';
      f.push(`FILTER(REGEX(STR(${valVar}), "${ps.pattern.value}"${flag}))`);
    }

    if (ps.in) {
      const members = ps.in.map(termToSparql).join(', ');
      f.push(`FILTER(${valVar} IN (${members}))`);
    }

    return f;
  }

  _compileCountConstraint(ps, focusVar) {
    const valVar = freshVar('cv');
    const valueFilters  = this._compileValueFilters(ps, valVar);
    const qualPatterns  = ps.qualifiedValueShape
      ? this.compileShapeConstraints(ps.qualifiedValueShape, valVar)
      : [];

    const having = [];
    if (ps.minCount !== null) having.push(`COUNT(${valVar}) >= ${ps.minCount}`);
    if (ps.maxCount !== null) having.push(`COUNT(${valVar}) <= ${ps.maxCount}`);

    return [
      `{`,
      `  SELECT ${focusVar} WHERE {`,
      `    ${focusVar} ${ps.path} ${valVar} .`,
      ...valueFilters.map(p => `    ${p}`),
      ...qualPatterns.map(p => `    ${p}`),
      `  }`,
      `  GROUP BY ${focusVar}`,
      `  HAVING (${having.join(' && ')})`,
      `}`,
    ];
  }

  // ── Logical operators ──────────────────────────────────────────────────────

  _compileLogical(logical, focusVar) {
    const patterns = [];

    // sh:and — all must be satisfied (inline join)
    for (const conjuncts of logical.and)
      for (const shapeRef of conjuncts)
        patterns.push(...this.compileShapeConstraints(shapeRef, focusVar));

    // sh:or — at least one must be satisfied (UNION)
    for (const disjuncts of logical.or) {
      if (disjuncts.length === 0) continue;
      const branches = disjuncts.map(shapeRef => {
        const ps = this.compileShapeConstraints(shapeRef, focusVar);
        return `  {\n${ps.map(p => '    ' + p).join('\n')}\n  }`;
      });
      patterns.push(branches.length > 1 ? branches.join('\n  UNION\n') : branches[0]);
    }

    // sh:not — must NOT satisfy
    for (const notShape of logical.not) {
      const ps = this.compileShapeConstraints(notShape, focusVar);
      if (ps.length)
        patterns.push(`FILTER NOT EXISTS {\n${ps.map(p => '  ' + p).join('\n')}\n}`);
    }

    // sh:xone — cannot compile faithfully to flat SPARQL
    for (const xoneList of logical.xone) {
      patterns.push(
        `# sh:xone (${xoneList.length} branches) — exclusive-or requires ` +
        `subquery-based counting; manual review needed`
      );
    }

    return patterns;
  }

  /**
   * Compile only the constraint patterns of a referenced shape (no SELECT wrapper).
   * Used for sh:not, sh:and, sh:or, sh:node, Node Expression filterShape.
   */
  compileShapeConstraints(shapeNodeOrId, focusVar) {
    const shapeId = shapeNodeOrId?.value ?? shapeNodeOrId;
    const patterns = [];

    // Walk property shapes hanging off the referenced shape node
    const psNodes = this.store.getObjects(
      { termType: 'NamedNode', value: shapeId },
      sh('property'),
      null
    );
    for (const psNode of psNodes) {
      const ps = extractPropertyShape(this.store, psNode);
      patterns.push(...this._compilePropertyShape(ps, focusVar));
    }

    // Also walk its logical operators
    const logical = extractLogical(this.store,
      { value: shapeId, termType: 'NamedNode' });
    patterns.push(...this._compileLogical(logical, focusVar));

    if (patterns.length === 0)
      patterns.push(`# <${shapeId}> — no compilable constraints`);

    return patterns;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a Turtle string and return an N3 Store.
 */
async function parseTurtle(turtleSource) {
  const store = new Store();
  return new Promise((resolve, reject) => {
    const parser = new Parser({ format: 'text/turtle' });
    parser.parse(turtleSource, (err, quad) => {
      if (err) return reject(new Error(`SHACL parse error: ${err.message}`));
      if (quad) store.addQuad(quad);
      else resolve(store);
    });
  });
}

/**
 * Convert a SHACL Turtle string to SPARQL queries.
 *
 * @param {string}   turtleSource   - SHACL shapes graph as Turtle
 * @param {object}   [opts]
 * @param {string[]} [opts.fromGraphs]     - IRIs to include as FROM clauses
 * @param {'select'|'construct'|'both'} [opts.queryType='select']
 * @param {string}   [opts.shapeIri]       - compile only this shape IRI
 * @returns {Promise<Array<{
 *   shapeId: string,
 *   label: string,
 *   select: string|null,
 *   construct: string|null,
 * }>>}
 */
export async function shaclToSparql(turtleSource, opts = {}) {
  const {
    fromGraphs = [],
    queryType  = 'select',
    shapeIri   = null,
  } = opts;

  const store    = await parseTurtle(turtleSource);
  const compiler = new SPARQLCompiler(store);
  let shapes     = extractShapes(store);

  if (shapeIri) {
    shapes = shapes.filter(s => s.id.value === shapeIri);
    if (shapes.length === 0)
      throw new Error(`No shape found with IRI <${shapeIri}>`);
  }

  return shapes.map(shape => {
    // Derive a human-readable label from the shape IRI
    const iri    = shape.id.value ?? `_:${shape.id.value}`;
    const label  = iri.replace(/[#/]([^#/]+)$/, '$1');

    return {
      shapeId:   iri,
      label,
      hasTargets: shape.targets.length > 0,
      select:    (queryType === 'select'    || queryType === 'both')
                   ? compiler.compileSelect(shape, fromGraphs) : null,
      construct: (queryType === 'construct' || queryType === 'both')
                   ? compiler.compileConstruct(shape, fromGraphs) : null,
    };
  });
}
