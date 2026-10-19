const test = require('node:test');
const assert = require('node:assert');
const E = require('../js/entropy.js');

test('Text wird als Bits interpretiert, 0/1-Text direkt', () => {
  assert.strictEqual(E.bytesToBitsAuto(E.textToBytes('A')).bits, '01000001');
  const r = E.bytesToBitsAuto(E.textToBytes('01 10\n1'));
  assert.deepStrictEqual([r.bits, r.kind], ['01101', 'bits']);
  assert.strictEqual(E.bytesToBitsAuto(E.textToBytes('0a1')).kind, 'text');
});

test('Blöcke und Auffüllen', () => {
  const r = E.splitBlocks('10110', 2);
  assert.deepStrictEqual(r, { blocks: ['10', '11', '00'], pad: 1 });
});

test('Entropie', () => {
  const s = E.stats(['00', '01', '10', '11']);
  assert.strictEqual(E.entropy(s.rows, s.total), 2);
  const t = E.stats(['0', '0', '0', '0']);
  assert.strictEqual(E.entropy(t.rows, t.total), 0);
  const u = E.stats(['0', '0', '0', '1']);
  assert.ok(Math.abs(E.entropy(u.rows, u.total) - 0.8112781244591328) < 1e-12);
});

test('Darstellung', () => {
  assert.strictEqual(E.textOf('01000001'), 'A');
  assert.strictEqual(E.textOf('0100000101000010'), 'AB');
  assert.strictEqual(E.hexOf('101'), '0x5');
  assert.strictEqual(E.hexOf('0000001'), '0x01');
});
