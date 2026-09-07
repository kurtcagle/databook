// Guards lib/profiles.js (item 3: profiles[] resolution) and the
// typeToken-derived class lookup in lib/reify.js (item 6). All tests run
// with { offline: true } against the bundled registry, so this suite is
// deterministic in CI with no network access.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProfile, resolveProfiles, findUnregisteredPrefixes } from '../lib/profiles.js';
import { parseDataBook } from '../lib/parser.js';
import { frontmatterToTurtle, loadShapesIndex } from '../lib/reify.js';

test('the bundled holon profile stub resolves offline with its prefix registered', async () => {
  const r = await resolveProfile('https://w3id.org/holon/databook#', { offline: true });
  assert.equal(r.ok, true);
  assert.equal(r.source, 'bundled');
  assert.deepEqual(r.prefixes, { holon: 'https://ontologist.io/ns/holon#' });
  assert.equal(r.shapesText, '', 'the stub declares no additional shapes yet');
});

test('the bundled encryption profile stub resolves offline with no prefix and no shapes', async () => {
  const r = await resolveProfile('https://w3id.org/databook/profiles/encryption', { offline: true });
  assert.equal(r.ok, true);
  assert.equal(r.source, 'bundled');
  assert.deepEqual(r.prefixes, {});
  assert.equal(r.shapesText, '');
});

test('an unbundled IRI in offline mode fails to resolve without throwing', async () => {
  const r = await resolveProfile('https://example.org/not-a-real-profile', { offline: true });
  assert.equal(r.ok, false);
  assert.match(r.reason, /offline/);
});

test('resolveProfiles resolves a list in order and never throws', async () => {
  const results = await resolveProfiles(
    ['https://w3id.org/holon/databook#', 'https://example.org/nope'],
    { offline: true }
  );
  assert.equal(results.length, 2);
  assert.equal(results[0].ok, true);
  assert.equal(results[1].ok, false);
});

test('findUnregisteredPrefixes flags an unknown prefix but not a registered one', async () => {
  const resolved = await resolveProfiles(['https://w3id.org/holon/databook#'], { offline: true });
  const doc = [
    '---',
    'id: https://example.org/x', 'title: X', 'type: databook', 'version: 1.0.0', 'created: 2026-09-07',
    'process:', '  transformer: human', '  transformer_type: human',
    "  inputs: [{iri: 'urn:x', role: primary}]", '  timestamp: 2026-09-07T00:00:00Z',
    '---', '',
    '<!-- databook:id: a -->', '<!-- holon:layer: L2 -->',
    '```turtle', '@prefix ex: <https://example.org/> . ex:a ex:p ex:b .', '```', '',
    '<!-- databook:id: b -->', '<!-- okf:something: value -->',
    '```turtle', '@prefix ex: <https://example.org/> . ex:c ex:p ex:d .', '```',
  ].join('\n');
  const { blocks } = parseDataBook(doc);
  const warnings = findUnregisteredPrefixes(blocks, resolved);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /okf:something/);
  assert.match(warnings[0], /block 'b'/);
});

test('findUnregisteredPrefixes is silent when no profiles are declared and no prefixed keys are used', () => {
  const warnings = findUnregisteredPrefixes(
    [{ id: 'x', all_meta: { id: 'x', label: 'plain' } }],
    []
  );
  assert.deepEqual(warnings, []);
});

// --- item 6: typeToken-derived class lookup (regression + extensibility) ---

test('frontmatterToTurtle still resolves all three real document types via typeToken', () => {
  const base = {
    id: 'https://example.org/x', title: 'X', version: '1.0.0', created: '2026-09-07',
    process: { transformer: 'human', transformer_type: 'human', timestamp: '2026-09-07T00:00:00Z', inputs: [{ iri: 'urn:x', role: 'primary' }] },
  };
  const cases = {
    'databook': 'DataBookHeader',
    'transformer-library': 'TransformerLibraryHeader',
    'processor-registry': 'ProcessorRegistryHeader',
  };
  for (const [type, className] of Object.entries(cases)) {
    const ttl = frontmatterToTurtle({ ...base, type });
    assert.match(ttl, new RegExp(`a <https://w3id\\.org/databook/header#${className}> \\.`));
  }
});

test('an unrecognised type falls back to DataBookHeader', () => {
  const fm = {
    id: 'https://example.org/x', title: 'X', type: 'not-a-real-type', version: '1.0.0', created: '2026-09-07',
    process: { transformer: 'human', transformer_type: 'human', timestamp: '2026-09-07T00:00:00Z', inputs: [{ iri: 'urn:x', role: 'primary' }] },
  };
  const ttl = frontmatterToTurtle(fm);
  assert.match(ttl, /a <https:\/\/w3id\.org\/databook\/header#DataBookHeader> \./);
});

test('the shapes index exposes typeTokenToClass for all three core types', () => {
  const { typeTokenToClass } = loadShapesIndex();
  assert.equal(typeTokenToClass['databook'], 'https://w3id.org/databook/header#DataBookHeader');
  assert.equal(typeTokenToClass['transformer-library'], 'https://w3id.org/databook/header#TransformerLibraryHeader');
  assert.equal(typeTokenToClass['processor-registry'], 'https://w3id.org/databook/header#ProcessorRegistryHeader');
});
