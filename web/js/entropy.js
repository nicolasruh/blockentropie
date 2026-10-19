(function (root) {
  'use strict';

  const MAX_BYTES = 10240;

  function bytesToBits(bytes) {
    let s = '';
    for (const b of bytes) s += b.toString(2).padStart(8, '0');
    return s;
  }

  // Nur 0/1 (Leerraum ignoriert) -> Bitfolge, sonst Text (UTF-8, für ASCII identisch)
  function bytesToBitsAuto(bytes) {
    let onlyBits = bytes.length > 0;
    let seen = false;
    for (const b of bytes) {
      if (b === 0x30 || b === 0x31) seen = true;
      else if (!(b === 0x20 || b === 0x0a || b === 0x0d || b === 0x09)) { onlyBits = false; break; }
    }
    if (onlyBits && seen) {
      let s = '';
      for (const b of bytes) if (b === 0x30 || b === 0x31) s += String.fromCharCode(b);
      return { bits: s, kind: 'bits' };
    }
    return { bits: bytesToBits(bytes), kind: 'text' };
  }

  function textToBytes(text) {
    return Array.from(new TextEncoder().encode(text));
  }

  function splitBlocks(bits, n) {
    const pad = (n - (bits.length % n)) % n;
    const full = bits + '0'.repeat(pad);
    const blocks = [];
    for (let i = 0; i < full.length; i += n) blocks.push(full.slice(i, i + n));
    return { blocks, pad };
  }

  function stats(blocks) {
    const m = new Map();
    for (const b of blocks) m.set(b, (m.get(b) || 0) + 1);
    const rows = Array.from(m, ([block, count]) => ({ block, count }));
    rows.sort((a, b) => (a.block < b.block ? -1 : a.block > b.block ? 1 : 0));
    return { rows, total: blocks.length };
  }

  function entropy(rows, total) {
    let h = 0;
    for (const r of rows) {
      const p = r.count / total;
      h -= p * Math.log2(p);
    }
    return h === 0 ? 0 : h;
  }

  function hexOf(block) {
    const digits = Math.ceil(block.length / 4);
    return '0x' + parseInt(block, 2).toString(16).toUpperCase().padStart(digits, '0');
  }

  function textOf(block) {
    let out = '';
    for (let i = 0; i < block.length; i += 8) {
      const c = parseInt(block.slice(i, i + 8), 2);
      if (c === 0x20) out += '␣';
      else if (c > 0x20 && c < 0x7f) out += String.fromCharCode(c);
      else out += '\\x' + c.toString(16).toUpperCase().padStart(2, '0');
    }
    return out;
  }

  const api = { MAX_BYTES, bytesToBits, bytesToBitsAuto, textToBytes, splitBlocks, stats, entropy, hexOf, textOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Entropy = api;
})(typeof self !== 'undefined' ? self : this);
