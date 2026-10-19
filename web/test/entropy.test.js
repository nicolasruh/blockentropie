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
  assert.strictEqual(E.hexOf('101'), '5');
  assert.strictEqual(E.hexOf('0000001'), '01');
});

test('Huffman-Längen und Vergleich', () => {
  const cs = [5, 2, 1, 1, 2];
  const ls = E.huffmanLengths(cs);
  assert.strictEqual(cs.reduce((s, c, x) => s + c * ls[x], 0), 23);
  assert.deepStrictEqual(E.huffmanLengths([7]), [1]);
  const c = E.compare('0000000011111111', 8);
  assert.strictEqual(c.k, 2);
  assert.strictEqual(c.payload, 2);
  assert.strictEqual(c.table, 2 * 8 + 2);
  const d = E.compare('0001110100101101', 2);
  assert.ok(d.ln >= d.hn - 1e-12 && d.ln < d.upper);
});
