/**
 * Frontmatter → Turtle reification.
 * Maps DataBook YAML frontmatter fields to RDF triples.
 * Used by `databook push --meta` and `databook reify`.
 */

/**
 * Serialise DataBook frontmatter as a Turtle string.
 * Subject is the DataBook `id` IRI (or a file:// URI as fallback).
 * @param {object} frontmatter
 * @param {string|null} filePath  - fallback for id generation
 * @returns {string}
 */
export function frontmatterToTurtle(frontmatter, filePath = null) {
  const id = frontmatter.id
    ? `<${frontmatter.id}>`
    : `<file://${filePath ?? 'unknown'}>`;

  const lines = [
    `@prefix dct:  <http://purl.org/dc/terms/> .`,
    `@prefix owl:  <http://www.w3.org/2002/07/owl#> .`,
    `@prefix prov: <http://www.w3.org/ns/prov#> .`,
    `@prefix void: <http://rdfs.org/ns/void#> .`,
    `@prefix sd:   <http://www.w3.org/ns/sparql-service-description#> .`,
    `@prefix foaf: <http://xmlns.com/foaf/0.1/> .`,
    `@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .`,
    `@prefix build: <https://w3id.org/databook/ns#> .`,
    ``,
    `${id}`,
    `    a build:DataBook ;`,
  ];

  const props = [];

  if (frontmatter.title)
    props.push(`    dct:title         ${ttlLiteral(frontmatter.title, 'en')} ;`);

  if (frontmatter.type)
    props.push(`    dct:type          build:${safeIdent(frontmatter.type)} ;`);

  if (frontmatter.version)
    props.push(`    owl:versionInfo   ${ttlLiteral(frontmatter.version)} ;`);

  if (frontmatter.created)
    props.push(`    dct:created       ${ttlDate(frontmatter.created)} ;`);

  if (frontmatter.description)
    props.push(`    dct:description   ${ttlLiteral(frontmatter.description, 'en')} ;`);

  if (frontmatter.license) {
    const lic = String(frontmatter.license);
    if (lic.startsWith('http')) {
      props.push(`    dct:license       <${lic}> ;`);
    } else {
      props.push(`    dct:license       ${ttlLiteral(lic)} ;`);
    }
  }

  // Authors
  const authors = toArray(frontmatter.author);
  for (const author of authors) {
    if (author.iri) {
      props.push(`    dct:creator       <${author.iri}> ;`);
    } else if (author.name) {
      props.push(`    dct:creator       [ foaf:name ${ttlLiteral(author.name)} ] ;`);
    }
  }

  // Graph metadata
  if (frontmatter.graph) {
    const g = frontmatter.graph;
    if (g.triple_count != null) props.push(`    void:triples      ${g.triple_count} ;`);
    if (g.subjects != null)     props.push(`    void:distinctSubjects ${g.subjects} ;`);
    if (g.named_graph)          props.push(`    sd:namedGraph     <${g.named_graph}> ;`);
  }

  // Process stamp
  if (frontmatter.process) {
    const p = frontmatter.process;
    if (p.timestamp)    props.push(`    prov:generatedAtTime ${ttlDateTime(p.timestamp)} ;`);
    if (p.agent?.iri)   props.push(`    prov:wasAttributedTo <${p.agent.iri}> ;`);
    if (p.transformer)  props.push(`    prov:wasGeneratedBy [ dct:title ${ttlLiteral(p.transformer)} ] ;`);
  }

  // Fix last semicolon to dot
  if (props.length > 0) {
    props[props.length - 1] = props[props.length - 1].replace(/ ;$/, ' .');
    lines.push(...props);
  } else {
    lines[lines.length - 1] += '.';
  }

  return lines.join('\n') + '\n';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ttlLiteral(value, lang = null) {
  const escaped = String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  if (lang) return `"${escaped}"@${lang}`;
  return `"${escaped}"`;
}

function ttlDate(value) {
  return `"${value}"^^xsd:date`;
}

function ttlDateTime(value) {
  return `"${value}"^^xsd:dateTime`;
}

function safeIdent(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
