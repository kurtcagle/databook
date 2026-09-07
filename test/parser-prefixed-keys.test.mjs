// Guards the generalised RE_META_COMMENT (item 4: profile-declared
// comment-key prefixes) in lib/parser.js.
// Run: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDataBookFile, parseAdjacentAnnotation } from '../lib/parser.js';

const db = loadDataBookFile(new URL('./prefixed-keys.databook.md', import.meta.url).pathname);
const byId = Object.fromEntries(db.blocks.filter(b => b.id).map(b => [b.id, b]));

test('a core key and a profile-prefixed key coexist correctly', () => {
  const b = byId['core-and-holon'];
  assert.ok(b);
  assert.equal(b.all_meta.id, 'core-and-holon');
  assert.equal(b.all_meta['holon:layer'], 'L2');
  assert.equal('databook:id' in b.all_meta, false, 'core keys must not be double-namespaced');
});

test('two different profile prefixes on one block are both captured', () => {
  const b = byId['two-prefixes'];
  assert.ok(b);
  assert.equal(b.all_meta['holon:layer'], 'L3');
  assert.equal(b.all_meta['okf:something'], 'value');
});

test('a profile-prefixed key does not truncate the walk before a directive', () => {
  const b = byId['prefix-then-directive'];
  assert.ok(b);
  assert.equal(b.all_meta['holon:layer'], 'L2');
  assert.equal(b.mode, 'hidden');
});

test('core-only blocks are unaffected by the generalisation', () => {
  const b = byId['core-only'];
  assert.ok(b);
  assert.deepEqual(Object.keys(b.all_meta).sort(), ['id', 'label']);
});

test('parseAdjacentAnnotation stores profile prefixes under the full key too', () => {
  assert.deepEqual(parseAdjacentAnnotation('<!-- holon:layer: L2 -->'), { 'holon:layer': 'L2' });
  assert.deepEqual(parseAdjacentAnnotation('<!-- databook:id: x -->'), { id: 'x' });
  assert.equal(parseAdjacentAnnotation('<!-- not an annotation -->'), null);
});
