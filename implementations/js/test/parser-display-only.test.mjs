// Guards the mode <-> display_only reconciliation in lib/parser.js.
// Run: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDataBookFile } from '../lib/parser.js';

const db = loadDataBookFile(new URL('./mode-display-only.databook.md', import.meta.url).pathname);
const byId = Object.fromEntries(db.blocks.filter(b => b.id).map(b => [b.id, b]));

test('mode=printed forces display_only true on an RDF-labelled block', () => {
  const b = byId['printed-turtle'];
  assert.ok(b);
  assert.equal(b.mode, 'printed');
  assert.equal(b.display_only, true);
});

test('mode=hidden forces display_only true', () => {
  assert.equal(byId['hidden-sparql'].display_only, true);
});

test('mode=reference forces display_only true', () => {
  assert.equal(byId['reference-shacl'].display_only, true);
});

test('mode=executed does not force display_only', () => {
  const b = byId['executed-sparql'];
  assert.equal(b.mode, 'executed');
  assert.equal(b.display_only, false);
});

test('mode=rendered does not force display_only', () => {
  const b = byId['rendered-mermaid'];
  assert.equal(b.mode, 'rendered');
  assert.equal(b.display_only, false);
});

test('the legacy databook:display-only key still works with no mode present', () => {
  const b = byId['legacy-key'];
  assert.equal(b.mode, null);
  assert.equal(b.display_only, true);
});

test('label-based display-only is unaffected by this change', () => {
  const b = byId['python-no-mode'];
  assert.equal(b.mode, null);
  assert.equal(b.display_only, true);
});
