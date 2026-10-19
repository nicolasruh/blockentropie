(function () {
  'use strict';
  const E = window.Entropy, I = window.I18n, t = I.t;
  const $ = id => document.getElementById(id);

  const SHOW_BITS = 2000;
  const MAX_ROWS = 300;
  const MAX_BUILD = 12;
  const MAX_TERMS_SHOWN = 8;

  const el = {
    text: $('text'), loadBtn: $('loadBtn'), file: $('file'), inputInfo: $('inputInfo'),
    bitsPanel: $('bitsPanel'), blockSize: $('blockSize'), spaces: $('spaces'), bits: $('bits'), bitsInfo: $('bitsInfo'),
    calcPanel: $('calcPanel'), cmpPanel: $('cmpPanel'), cmpBtn: $('cmpBtn'), cmp: $('cmp'), table: $('table'), rowsInfo: $('rowsInfo'), formula: $('formula'), lang: $('lang'),
  };

  const state = {
    file: null,        // { name, bytes } oder null
    bits: '',
    kind: 'text',
    cut: false,
    n: 8,
    blocks: [], pad: 0,
    rows: [], total: 0,
    mode: 'show',
    cmpShown: false,
    chk: { h: '', hn: '', res: { h: null, hn: null } },
    slots: [],
    selected: null,
    solved: false,
    msg: null,
  };

  const mk = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const fmt = (x, d = 4) => (x === 0 ? '0' : x.toFixed(d));
  const frac = r => `${r.count}/${state.total}`;

  // ---- Berechnung ----
  function readSource() {
    let bytes;
    if (state.file) {
      bytes = state.file.bytes;
    } else {
      bytes = E.textToBytes(el.text.value);
    }
    state.cut = false;
    if (bytes.length > E.MAX_BYTES) { bytes = bytes.slice(0, E.MAX_BYTES); state.cut = true; }
    const r = E.bytesToBitsAuto(bytes);
    state.bits = r.bits;
    state.kind = r.kind;
  }

  function recompute(resetBuild) {
    const { blocks, pad } = E.splitBlocks(state.bits, state.n);
    state.blocks = blocks;
    state.pad = pad;
    const s = E.stats(blocks);
    state.rows = s.rows;
    state.total = s.total;
    if (resetBuild) resetBuildState();
  }

  function resetBuildState() {
    state.slots = new Array(state.rows.length * 2).fill(null);
    state.selected = null;
    state.solved = false;
    state.msg = null;
    state.chk.res = { h: null, hn: null };
  }

  // ---- Darstellung ----
  function renderInput() {
    let info = '';
    if (state.file) info = t('fileInfo', { name: state.file.name, n: state.file.size }) + ' ';
    if (state.bits) {
      info += state.file && state.kind === 'text' ? t('kindFile') : t(state.kind === 'bits' ? 'kindBits' : 'kindText');
      if (state.cut) info += ' ' + t(state.file ? 'fileCut' : 'textCut', { max: E.MAX_BYTES });
    } else {
      info = t('empty');
    }
    el.inputInfo.textContent = info;
  }

  function renderBits() {
    const n = state.n;
    const shown = Math.max(1, Math.floor(SHOW_BITS / n));
    const part = state.blocks.slice(0, shown);
    const cutView = state.blocks.length > shown;
    el.bits.textContent = '';
    part.forEach((b, i) => {
      if (i > 0 && el.spaces.checked) el.bits.appendChild(document.createTextNode(' '));
      const isLast = i === state.blocks.length - 1 && state.pad > 0;
      if (isLast) {
        el.bits.appendChild(document.createTextNode(b.slice(0, n - state.pad)));
        el.bits.appendChild(mk('span', 'pad', b.slice(n - state.pad)));
      } else {
        el.bits.appendChild(document.createTextNode(b));
      }
    });
    if (cutView) el.bits.appendChild(document.createTextNode(' …'));
    let info = t('bitsInfo', { bits: state.bits.length, blocks: state.blocks.length, n });
    if (state.pad) info += ' ' + t('padInfo', { pad: state.pad });
    if (cutView) info += ' ' + t('cutInfo', { bits: shown * n });
    el.bitsInfo.textContent = info;
  }

  function renderTable() {
    const n = state.n;
    const col = n === 8 ? 'colChar' : (n === 4 || n === 12 || n === 16) ? 'colHexNo' : null;
    const build = state.mode === 'build' && buildPossible();
    const tb = mk('table');
    const hr = mk('tr');
    [t('colBlock'), col && t(col), t('colCount'), t('colProb')].filter(Boolean).forEach(h => hr.appendChild(mk('th', '', h)));
    tb.appendChild(mk('thead')).appendChild(hr);
    const body = mk('tbody');
    state.rows.slice(0, MAX_ROWS).forEach((r, i) => {
      const tr = mk('tr');
      tr.appendChild(mk('td', 'mono', r.block));
      if (col) tr.appendChild(mk('td', 'mono', n === 8 ? E.textOf(r.block) : E.hexOf(r.block)));
      tr.appendChild(mk('td', 'mono', String(r.count)));
      const td = mk('td', 'mono');
      if (build) {
        const chip = mk('span', 'pchip', frac(r));
        chip.dataset.row = i;
        chip.draggable = true;
        if (state.selected === i) chip.classList.add('sel');
        td.appendChild(chip);
        td.appendChild(document.createTextNode(' = ' + fmt(r.count / state.total)));
      } else {
        td.textContent = `${frac(r)} = ${fmt(r.count / state.total)}`;
      }
      tr.appendChild(td);
      body.appendChild(tr);
    });
    tb.appendChild(body);
    if (state.rows.length <= MAX_ROWS) {
      const f = mk('tr', 'sum');
      f.appendChild(mk('td', '', t('total')));
      if (col) f.appendChild(mk('td'));
      f.appendChild(mk('td', 'mono', String(state.total)));
      f.appendChild(mk('td', 'mono', '1'));
      tb.appendChild(mk('tfoot')).appendChild(f);
    }
    el.table.textContent = '';
    el.table.appendChild(tb);
    el.rowsInfo.textContent = state.rows.length > MAX_ROWS ? t('rowsCut', { max: MAX_ROWS, n: state.rows.length }) : '';
  }

  const buildPossible = () => state.rows.length <= MAX_BUILD;

  function eqLine(label, content) {
    const d = mk('div', 'eq');
    d.appendChild(mk('span', 'lbl', label));
    if (typeof content === 'string') d.appendChild(document.createTextNode(content));
    else d.appendChild(content);
    return d;
  }

  function results(h) {
    const box = mk('div', 'results');
    box.appendChild(eqLine('', t('resBlock', { h: fmt(h) })));
    box.appendChild(eqLine('', t('resBit', { h: fmt(h / state.n), n: state.n })));
    box.appendChild(eqLine('', t('resRel', { r: (100 * h / state.n).toFixed(2) })));
    box.appendChild(eqLine('', t('resMax', { n: state.n })));
    return box;
  }

  function renderGeneral(f) {
    f.appendChild(mk('h3', '', t('general')));
    f.appendChild(eqLine('', 'H = −Σ p(i) · log₂ p(i)'));
    f.appendChild(mk('p', 'note small', t('genWhere')));
    f.appendChild(eqLine('', t('genBit')));
    f.appendChild(mk('p', 'note small', t('genMax')));
  }

  function renderConcrete(f, h) {
    f.appendChild(mk('h3', '', t('concrete')));
    const shown = state.rows.slice(0, MAX_TERMS_SHOWN);
    const terms = shown.map(r => { const p = fmt(r.count / state.total); return `${p}·log₂(${p})`; });
    let s = 'H = −( ' + terms.join(' + ');
    if (state.rows.length > shown.length) s += ' + ' + t('more', { k: state.rows.length - shown.length });
    s += ' )';
    f.appendChild(mk('div', 'eq mono wrapeq', s));
    f.appendChild(mk('p', 'note small', t('concreteRound')));
    f.appendChild(results(h));
  }

  function slotEl(i) {
    const idx = state.slots[i];
    const s = mk('span', 'slot' + (idx === null ? ' empty' : ''), idx === null ? '' : frac(state.rows[idx]));
    s.dataset.slot = i;
    return s;
  }

  function renderBuild(f, h) {
    f.appendChild(mk('h3', '', t('buildTitle')));
    if (!buildPossible()) {
      f.appendChild(mk('p', 'message error', t('buildTooMany', { max: MAX_BUILD, k: state.rows.length })));
      return;
    }
    f.appendChild(mk('p', 'note small', t('buildHint')));
    const eq = mk('div', 'eq buildeq');
    eq.appendChild(document.createTextNode('H = −( '));
    const k = state.rows.length;
    for (let i = 0; i < k; i++) {
      if (i > 0) eq.appendChild(document.createTextNode(' + '));
      const term = mk('span', 'term');
      term.appendChild(slotEl(2 * i));
      term.appendChild(document.createTextNode(' · log₂('));
      term.appendChild(slotEl(2 * i + 1));
      term.appendChild(document.createTextNode(')'));
      eq.appendChild(term);
    }
    eq.appendChild(document.createTextNode(' )'));
    f.appendChild(eq);
    const bt = mk('div', 'buttons');
    [['check', 'check'], ['auto', 'auto'], ['reset', 'reset']].forEach(([id, key]) => {
      const b = mk('button', '', t(key));
      b.dataset.act = id;
      bt.appendChild(b);
    });
    f.appendChild(bt);
    if (state.msg) f.appendChild(mk('p', 'message ' + state.msg.kind, t(state.msg.key, state.msg.params)));
    if (state.solved) f.appendChild(results(h));
  }

  const parseNum = s => {
    const v = parseFloat(String(s).trim().replace(',', '.'));
    return Number.isFinite(v) && /^[-+]?\d*[.,]?\d+$/.test(String(s).trim()) ? v : NaN;
  };

  function renderCheck(f, h) {
    f.appendChild(mk('h3', '', t('chkTitle')));
    f.appendChild(mk('p', 'note small', t('chkHint')));
    const truth = { h, hn: h / state.n };
    const row = (key, label) => {
      const d = mk('div', 'chkrow');
      const l = mk('label', '', label + ' ');
      const inp = mk('input');
      inp.type = 'text'; inp.autocomplete = 'off'; inp.inputMode = 'decimal';
      inp.value = state.chk[key];
      inp.addEventListener('input', () => {
        state.chk[key] = inp.value;
        state.chk.res[key] = null;
        fb.textContent = '';
        fb.className = 'chkfb';
      });
      const go = () => { runCheck(key, truth[key]); render(); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      l.appendChild(inp);
      d.appendChild(l);
      const b = mk('button', '', t('chkBtn'));
      b.addEventListener('click', go);
      d.appendChild(b);
      const fb = mk('span', 'chkfb');
      const r = state.chk.res[key];
      if (r) { fb.textContent = t(r.key); fb.className = 'chkfb ' + r.kind; }
      d.appendChild(fb);
      return d;
    };
    f.appendChild(row('h', t('chkH')));
    f.appendChild(row('hn', t('chkHn')));
    if (state.chk.res.hn && state.chk.res.hn.kind === 'error' && !(state.chk.res.h && state.chk.res.h.kind === 'ok')) {
      f.appendChild(mk('p', 'note small', t('chkRelated', { n: state.n })));
    }
  }

  function runCheck(key, truth) {
    const v = parseNum(state.chk[key]);
    let r;
    if (Number.isNaN(v)) r = { kind: 'error', key: 'chkEmpty' };
    else if (Math.abs(v - truth) <= 0.0051) r = { kind: 'ok', key: 'chkOk' };
    else r = { kind: 'error', key: v > truth ? 'chkHigh' : 'chkLow' };
    state.chk.res[key] = r;
  }

  function renderFormula() {
    const h = E.entropy(state.rows, state.total);
    el.formula.textContent = '';
    renderGeneral(el.formula);
    if (state.mode === 'show') renderConcrete(el.formula, h);
    else if (state.mode === 'check') renderCheck(el.formula, h);
    else renderBuild(el.formula, h);
  }

  function renderCompare() {
    el.cmp.textContent = '';
    if (!state.cmpShown || !state.bits) return;
    const rows = [];
    for (let n = 1; n <= 16; n++) rows.push(E.compare(state.bits, n));
    const best = rows.reduce((b, r) => (r.total < b.total ? r : b), rows[0]);
    const tb = mk('table');
    const hr = mk('tr');
    [['cmpN'], ['cmpK'], ['cmpHn', 'tipHn'], ['cmpLn', 'tipLn'], ['cmpTot', 'tipTot'], ['cmpRatio', 'tipRatio']].forEach(([k, tip]) => {
      const th = mk('th', '', t(k));
      if (tip) { th.title = t(tip); th.classList.add('tip'); }
      hr.appendChild(th);
    });
    tb.appendChild(mk('thead')).appendChild(hr);
    const body = mk('tbody');
    rows.forEach(r => {
      const tr = mk('tr', r === best ? 'best' : r.n === state.n ? 'cur' : '');
      [String(r.n), String(r.k), fmt(r.hn), fmt(r.ln), String(r.total), (100 * r.ratio).toFixed(1) + ' %']
        .forEach(v => tr.appendChild(mk('td', 'mono', v)));
      body.appendChild(tr);
    });
    tb.appendChild(body);
    const wrap = mk('div', 'scroll full');
    wrap.appendChild(tb);
    el.cmp.appendChild(wrap);
    el.cmp.appendChild(mk('p', 'message ok', t('cmpBest', { n: best.n, r: (100 * best.ratio).toFixed(1) })));
    el.cmp.appendChild(mk('p', 'note small', t('cmpNote')));
  }

  function render() {
    const has = state.bits.length > 0;
    renderInput();
    el.bitsPanel.hidden = !has;
    el.calcPanel.hidden = !has;
    el.cmpPanel.hidden = !has;
    if (!has) return;
    renderBits();
    renderTable();
    renderFormula();
    renderCompare();
  }

  // ---- Manueller Modus ----
  function setMsg(kind, key, params) { state.msg = { kind, key, params }; }

  function check() {
    const k = state.rows.length;
    if (state.slots.some(s => s === null)) return setMsg('error', 'errEmpty');
    const have = new Map();
    for (let i = 0; i < k; i++) {
      const a = state.rows[state.slots[2 * i]].count, b = state.rows[state.slots[2 * i + 1]].count;
      if (a !== b) return setMsg('error', 'errPair', { i: i + 1 });
      have.set(a, (have.get(a) || 0) + 1);
    }
    const need = new Map();
    state.rows.forEach(r => need.set(r.count, (need.get(r.count) || 0) + 1));
    for (const [c, n] of need) if ((have.get(c) || 0) < n) return setMsg('error', 'errMissing', { p: `${c}/${state.total}` });
    for (const [c, n] of have) if (n > (need.get(c) || 0)) return setMsg('error', 'errExtra', { p: `${c}/${state.total}` });
    state.solved = true;
    setMsg('ok', 'okBuild');
  }

  function place(slot, row) {
    state.slots[slot] = row;
    state.selected = null;
    state.solved = false;
    state.msg = null;
    render();
  }

  function onFormulaClick(e) {
    const slot = e.target.closest('.slot');
    if (slot) {
      const i = Number(slot.dataset.slot);
      if (state.selected !== null) place(i, state.selected);
      else if (state.slots[i] !== null) place(i, null);
      return;
    }
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    if (btn.dataset.act === 'check') check();
    else if (btn.dataset.act === 'reset') resetBuildState();
    else if (btn.dataset.act === 'auto') {
      state.slots = state.rows.flatMap((_, i) => [i, i]);
      state.selected = null;
      check();
    }
    render();
  }

  el.table.addEventListener('click', e => {
    const chip = e.target.closest('.pchip');
    if (!chip) return;
    const i = Number(chip.dataset.row);
    state.selected = state.selected === i ? null : i;
    renderTable();
  });
  el.table.addEventListener('dragstart', e => {
    const chip = e.target.closest('.pchip');
    if (!chip) return;
    e.dataTransfer.setData('text/plain', chip.dataset.row);
    e.dataTransfer.effectAllowed = 'copy';
  });
  el.formula.addEventListener('click', onFormulaClick);
  el.formula.addEventListener('dragover', e => { if (e.target.closest('.slot')) e.preventDefault(); });
  el.formula.addEventListener('dragenter', e => { const s = e.target.closest('.slot'); if (s) s.classList.add('over'); });
  el.formula.addEventListener('dragleave', e => { const s = e.target.closest('.slot'); if (s) s.classList.remove('over'); });
  el.formula.addEventListener('drop', e => {
    const s = e.target.closest('.slot');
    if (!s) return;
    e.preventDefault();
    const row = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!Number.isNaN(row)) place(Number(s.dataset.slot), row);
  });

  // ---- Eingabe ----
  function update() {
    readSource();
    recompute(true);
    render();
  }

  function fillSizes() {
    el.blockSize.textContent = '';
    for (let n = 1; n <= 16; n++) {
      const o = mk('option', '', String(n));
      o.value = n;
      if (n === state.n) o.selected = true;
      el.blockSize.appendChild(o);
    }
  }

  const fit = () => {
    const focused = document.activeElement === el.text;
    el.text.wrap = focused ? 'soft' : 'off';
    el.text.style.height = '';
    if (focused) el.text.style.height = el.text.scrollHeight + 2 + 'px';
  };
  el.text.addEventListener('focus', fit);
  el.text.addEventListener('blur', () => { fit(); el.text.scrollTop = 0; el.text.scrollLeft = 0; });
  el.text.addEventListener('input', () => { state.file = null; fit(); update(); });

  el.cmpBtn.addEventListener('click', () => { state.cmpShown = true; renderCompare(); });
  el.loadBtn.addEventListener('click', () => el.file.click());
  el.file.addEventListener('change', async () => {
    const f = el.file.files[0];
    if (!f) return;
    const buf = await f.slice(0, E.MAX_BYTES + 1).arrayBuffer();
    state.file = { name: f.name, size: f.size, bytes: Array.from(new Uint8Array(buf)) };
    el.text.value = '';
    el.file.value = '';
    update();
  });

  el.blockSize.addEventListener('change', () => { state.n = Number(el.blockSize.value); recompute(true); render(); });
  el.spaces.addEventListener('change', () => { if (state.bits) renderBits(); });
  document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', () => {
    if (r.checked) { state.mode = r.value; state.selected = null; render(); }
  }));

  function applyI18n() {
    document.documentElement.lang = I.getLang();
    document.title = t('title');
    document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(e => { e.placeholder = t(e.dataset.i18nPlaceholder); });
  }
  el.lang.addEventListener('change', () => { I.setLang(el.lang.value); applyI18n(); render(); });

  fillSizes();
  applyI18n();
  update();
})();
