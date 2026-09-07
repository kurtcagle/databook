// Guards the pre-fence directive handling in lib/parser.js.
// Run: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDataBookFile, parseDirectiveLine } from '../lib/parser.js';

const db = loadDataBookFile(new URL('./directives.databook.md', import.meta.url).pathname);
const byId = Object.fromEntries(db.blocks.filter(b => b.id).map(b => [b.id, b]));

test('directive line last in the zone does not truncate the walk', () => {
  const b = byId.conventional;
  assert.ok(b, 'block "conventional" must keep its id');
  assert.equal(b.label, 'turtle');
  assert.equal(b.all_meta.label, 'Conventional zone ordering');
  assert.equal(b.mode, 'printed');
});

test('multiple directives on one line and across lines are all collected', () => {
  const b = byId.multi;
  assert.ok(b);
  assert.deepEqual(b.directives, {
    mode: 'executed',
    endpoint: '<urn:jena:local>',
    cache: 'true',
    authority: '<urn:org:test>',
    version: '1.2.0',
  });
});

test('directive before the id is tolerated', () => {
  const b = byId.unordered;
  assert.ok(b);
  assert.equal(b.mode, 'hidden');
});

test('a block with no directives has an empty map and null mode', () => {
  const b = byId.plain;
  assert.ok(b);
  assert.deepEqual(b.directives, {});
  assert.equal(b.mode, null);
});

test('a prose comment in the zone still ends the walk (pinned behaviour)', () => {
  assert.equal(byId.orphaned, undefined, 'block "orphaned" is expected to be anonymous');
  const anon = db.blocks.filter(b => !b.id);
  assert.equal(anon.length, 1);
});

test('a directive-shaped line inside the fence is payload, not a directive', () => {
  const b = byId.inside;
  assert.ok(b);
  assert.deepEqual(b.directives, {});
  assert.ok(b.content.includes('<!-- mode=printed -->'));
});

test('parseDirectiveLine helper', () => {
  assert.deepEqual(parseDirectiveLine('<!-- mode=executed endpoint=<urn:x> -->'), { mode: 'executed', endpoint: '<urn:x>' });
  assert.equal(parseDirectiveLine('<!-- databook:id: x -->'), null);
  assert.equal(parseDirectiveLine('<!-- just prose -->'), null);
});

test('the primer, the canonical v1.2 document, parses with no anonymous blocks', { skip: !process.env.PRIMER }, () => {
  const p = loadDataBookFile(process.env.PRIMER);
  assert.equal(p.blocks.filter(b => !b.id).length, 0);
});
