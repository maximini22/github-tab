/* Guitar Tab: plain JS, no build step. Data lives in localStorage; export/import as .json. */
(function () {
  'use strict';

  var SCHEMA = 'jlr-guitar-tab';
  var SCHEMA_VERSION = 1;
  var STORE_KEY = 'jlr-guitar-tab:current';
  var STRINGS = 6;
  var MAX_FRET = 16;
  var MAX_COLS = 4000;
  var DEFAULT_COLS = 16;
  var INLAYS = { 3: 1, 5: 1, 7: 1, 9: 1, 12: 2, 15: 1 };

  // Notes listed string 1 (highest) to string 6 (lowest), the same order as the tab rows.
  var TUNINGS = [
    { id: 'standard', name: 'Standard (EADGBE)', notes: ['e', 'B', 'G', 'D', 'A', 'E'] },
    { id: 'drop-d', name: 'Drop D (DADGBE)', notes: ['e', 'B', 'G', 'D', 'A', 'D'] },
    { id: 'drop-c', name: 'Drop C (CGCFAD)', notes: ['d', 'A', 'F', 'C', 'G', 'C'] },
    { id: 'd-standard', name: 'D Standard (DGCFAD)', notes: ['d', 'A', 'F', 'C', 'G', 'D'] },
    { id: 'eb-standard', name: 'Eb / half-step down', notes: ['eb', 'Bb', 'Gb', 'Db', 'Ab', 'Eb'] },
    { id: 'open-g', name: 'Open G (DGDGBD)', notes: ['d', 'B', 'G', 'D', 'G', 'D'] },
    { id: 'open-d', name: 'Open D (DADF#AD)', notes: ['d', 'A', 'F#', 'D', 'A', 'D'] },
    { id: 'dadgad', name: 'DADGAD', notes: ['d', 'A', 'G', 'D', 'A', 'D'] }
  ];
  var TUNING_BY_ID = {};
  TUNINGS.forEach(function (t) { TUNING_BY_ID[t.id] = t; });

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    title: $('title'), tuning: $('tuning'), editor: $('editor'), ascii: $('ascii'), colInfo: $('col-info'),
    saveState: $('save-state'), picker: $('picker'), scrim: $('scrim'), pickerSub: $('picker-sub'),
    pickerStrings: $('picker-strings'), fretboard: $('fretboard'), pickMute: $('pick-mute'), pickClear: $('pick-clear'),
    importFile: $('import-file'), shareBtn: $('share-btn'), toast: $('toast')
  };

  var state = null;          // the tab document
  var cur = { col: 0, str: 0 };
  var pickerOpen = false;

  function nowIso() { return new Date().toISOString(); }
  function emptyCol() { var c = []; for (var i = 0; i < STRINGS; i++) c.push(null); return c; }
  function newTab() {
    var cols = []; for (var i = 0; i < DEFAULT_COLS; i++) cols.push(emptyCol());
    var t = nowIso();
    return { schema: SCHEMA, version: SCHEMA_VERSION, title: '', tuning: 'standard', columns: cols, createdAt: t, updatedAt: t };
  }
  function hasContent(tab) {
    if (!tab) return false;
    if (tab.title) return true;
    return tab.columns.some(function (c) { return c.some(function (v) { return v !== null; }); });
  }

  // ---------- validation (used for localStorage restore and import) ----------
  function validCell(v) {
    return v === null || v === 'x' || (typeof v === 'number' && v % 1 === 0 && v >= 0 && v <= MAX_FRET);
  }
  function validate(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return 'Not a tab file.';
    if (obj.schema !== SCHEMA) return 'This is not a Guitar Tab file (schema missing or different).';
    if (typeof obj.version !== 'number' || obj.version < 1) return 'Missing schema version.';
    if (obj.version > SCHEMA_VERSION) return 'This file was made by a newer version (v' + obj.version + ').';
    if (typeof obj.title !== 'string' || obj.title.length > 200) return 'Title is missing or too long.';
    if (!TUNING_BY_ID[obj.tuning]) return 'Unknown tuning "' + String(obj.tuning).slice(0, 30) + '".';
    if (!Array.isArray(obj.columns) || obj.columns.length < 1) return 'No columns in file.';
    if (obj.columns.length > MAX_COLS) return 'Too many columns (max ' + MAX_COLS + ').';
    for (var i = 0; i < obj.columns.length; i++) {
      var c = obj.columns[i];
      if (!Array.isArray(c) || c.length !== STRINGS) return 'Column ' + (i + 1) + ' must have 6 strings.';
      for (var s = 0; s < STRINGS; s++) if (!validCell(c[s])) return 'Column ' + (i + 1) + ' has a bad value.';
    }
    return null;
  }
  function normalise(obj) {
    var t = nowIso();
    return {
      schema: SCHEMA, version: SCHEMA_VERSION, title: obj.title, tuning: obj.tuning,
      columns: obj.columns.map(function (c) { return c.slice(); }),
      createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : t,
      updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : t
    };
  }

  // ---------- persistence ----------
  function save() {
    state.updatedAt = nowIso();
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      var d = new Date(state.updatedAt);
      els.saveState.textContent = 'Saved ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      els.saveState.className = 'save-state ok';
    } catch (e) {
      els.saveState.textContent = 'Not saved: storage full or blocked';
      els.saveState.className = 'save-state';
    }
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      return validate(obj) ? null : normalise(obj);
    } catch (e) { return null; }
  }
  function changed() { save(); render(); }

  // ---------- rendering ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function tuningNotes() { return TUNING_BY_ID[state.tuning].notes; }
  function cellText(v) { return v === null ? '' : String(v); }

  function renderEditor() {
    var notes = tuningNotes();
    var frag = document.createDocumentFragment();
    var labels = document.createElement('div');
    labels.className = 'labels';
    labels.innerHTML = '<div class="lh">#</div>';
    notes.forEach(function (n) { var s = document.createElement('span'); s.textContent = n; labels.appendChild(s); });
    frag.appendChild(labels);
    state.columns.forEach(function (col, ci) {
      var c = document.createElement('div');
      c.className = 'col' + (ci === cur.col ? ' cur' : '');
      c.setAttribute('role', 'row');
      var h = document.createElement('div'); h.className = 'ch'; h.textContent = ci + 1; c.appendChild(h);
      for (var s = 0; s < STRINGS; s++) {
        var b = document.createElement('button');
        var v = col[s];
        b.type = 'button';
        b.className = 'cell' + (v !== null ? ' has' : '') + (v === 'x' ? ' mute' : '') +
          (pickerOpen && ci === cur.col && s === cur.str ? ' sel' : '');
        b.dataset.col = ci; b.dataset.str = s;
        b.setAttribute('role', 'gridcell');
        b.setAttribute('aria-label', 'Step ' + (ci + 1) + ', ' + notes[s] + ' string, ' + (v === null ? 'empty' : v === 'x' ? 'muted' : 'fret ' + v));
        var inner = document.createElement('b'); inner.textContent = cellText(v); b.appendChild(inner);
        c.appendChild(b);
      }
      frag.appendChild(c);
    });
    els.editor.textContent = '';
    els.editor.appendChild(frag);
    els.colInfo.textContent = 'Step ' + (cur.col + 1) + ' of ' + state.columns.length;
  }

  // ASCII: each step is as wide as its widest value, separated by dashes. Wraps into systems for readability.
  function toAscii(perLine) {
    var notes = tuningNotes();
    var w = Math.max.apply(null, notes.map(function (n) { return n.length; }));
    var head = [];
    if (state.title) head.push(state.title);
    head.push('Tuning: ' + TUNING_BY_ID[state.tuning].name);
    var blocks = [];
    for (var start = 0; start < state.columns.length; start += perLine) {
      var slice = state.columns.slice(start, start + perLine);
      var lines = notes.map(function (n) { return (n + '    ').slice(0, w) + '|-'; });
      slice.forEach(function (col) {
        var cw = Math.max(1, Math.max.apply(null, col.map(function (v) { return cellText(v).length; })));
        for (var s = 0; s < STRINGS; s++) {
          var t = cellText(col[s]);
          lines[s] += t + new Array(cw - t.length + 1).join('-') + '-';
        }
      });
      blocks.push(lines.map(function (l) { return l + '|'; }).join('\n'));
    }
    return head.join('\n') + '\n\n' + blocks.join('\n\n') + '\n';
  }
  function renderAscii() { els.ascii.textContent = toAscii(window.innerWidth < 640 ? 12 : 24); }

  function renderPicker() {
    var notes = tuningNotes();
    var v = state.columns[cur.col][cur.str];
    els.pickerSub.textContent = 'Step ' + (cur.col + 1) + ' · ' + notes[cur.str] + ' string (' + (cur.str + 1) + ')';
    Array.prototype.forEach.call(els.pickerStrings.children, function (b, i) {
      b.textContent = notes[i];
      b.classList.toggle('on', i === cur.str);
      b.setAttribute('aria-checked', i === cur.str ? 'true' : 'false');
    });
    Array.prototype.forEach.call(els.fretboard.children, function (b) {
      b.classList.toggle('on', Number(b.dataset.fret) === v);
    });
    els.pickMute.classList.toggle('on', v === 'x');
  }

  function render() {
    renderEditor();
    renderAscii();
    if (pickerOpen) renderPicker();
  }

  function buildStatic() {
    TUNINGS.forEach(function (t) {
      var o = document.createElement('option'); o.value = t.id; o.textContent = t.name; els.tuning.appendChild(o);
    });
    for (var s = 0; s < STRINGS; s++) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.str = s; b.setAttribute('role', 'radio');
      els.pickerStrings.appendChild(b);
    }
    for (var f = 0; f <= MAX_FRET; f++) {
      var fb = document.createElement('button');
      fb.type = 'button'; fb.dataset.fret = f;
      fb.className = 'fret' + (f === 0 ? ' open' : '') + (INLAYS[f] ? ' inlay' : '');
      var dots = '';
      for (var d = 0; d < (INLAYS[f] || 0); d++) dots += '<i></i>';
      fb.innerHTML = '<span class="n">' + f + '</span><span class="dots" aria-hidden="true">' + dots + '</span>';
      fb.setAttribute('aria-label', f === 0 ? 'Open string (0)' : 'Fret ' + f + (INLAYS[f] === 2 ? ', double dot' : INLAYS[f] ? ', dot' : ''));
      els.fretboard.appendChild(fb);
    }
  }

  // ---------- editing ----------
  function setCell(v) { state.columns[cur.col][cur.str] = v; changed(); }
  function moveCol(d) {
    cur.col = Math.max(0, Math.min(state.columns.length - 1, cur.col + d));
    render(); scrollToCur();
  }
  function nextStep() {
    if (cur.col === state.columns.length - 1 && state.columns.length < MAX_COLS) { state.columns.push(emptyCol()); save(); }
    moveCol(1);
  }
  function scrollToCur() {
    var col = els.editor.children[cur.col + 1];
    if (col && col.scrollIntoView) col.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function openPicker(col, str) {
    cur.col = col; cur.str = str; pickerOpen = true;
    els.picker.hidden = false; els.scrim.hidden = false;
    render(); scrollToCur();
    var on = els.fretboard.querySelector('.fret.on') || els.fretboard.firstChild;
    if (on && window.matchMedia('(hover: hover)').matches) on.focus({ preventScroll: true });
  }
  function closePicker() {
    pickerOpen = false; els.picker.hidden = true; els.scrim.hidden = true; render();
    var cell = els.editor.querySelector('.cell[data-col="' + cur.col + '"][data-str="' + cur.str + '"]');
    if (cell) cell.focus({ preventScroll: true });
  }

  function toast(msg) {
    els.toast.textContent = msg; els.toast.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function () { els.toast.hidden = true; }, 2600);
  }

  // ---------- export / import ----------
  function fileName() {
    var slug = (state.title || 'untitled-tab').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'tab';
    var d = new Date();
    return slug + '-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.json';
  }
  function exportBlob() {
    var out = normalise(state);
    out.exportedAt = nowIso();
    return new Blob([JSON.stringify(out, null, 2) + '\n'], { type: 'application/json' });
  }
  function doExport() {
    var url = URL.createObjectURL(exportBlob());
    var a = document.createElement('a');
    a.href = url; a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    toast('Exported ' + a.download);
  }
  function canShareFiles() {
    try {
      return !!(navigator.canShare && navigator.canShare({ files: [new File(['{}'], 't.json', { type: 'application/json' })] }));
    } catch (e) { return false; }
  }
  function doShare() {
    var f = new File([exportBlob()], fileName(), { type: 'application/json' });
    navigator.share({ files: [f], title: state.title || 'Guitar tab' }).catch(function (e) {
      if (e && e.name !== 'AbortError') toast('Share failed. Use Export instead.');
    });
  }
  function doImport(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('That file is too big to be a tab.'); return; }
    var r = new FileReader();
    r.onload = function () {
      var obj;
      try { obj = JSON.parse(r.result); } catch (e) { alert('Could not read that file: it is not valid JSON.'); return; }
      var err = validate(obj);
      if (err) { alert('Could not import: ' + err); return; }
      var incoming = normalise(obj);
      if (hasContent(state) && !confirm('Replace the current tab "' + (state.title || 'Untitled') + '" with "' + (incoming.title || 'Untitled') + '"?\n\nExport first if you want to keep it.')) return;
      state = incoming; cur = { col: 0, str: 0 };
      syncInputs(); changed();
      toast('Imported ' + (state.title || 'tab') + ' (' + state.columns.length + ' steps)');
    };
    r.onerror = function () { alert('Could not read that file.'); };
    r.readAsText(file);
  }
  function syncInputs() { els.title.value = state.title; els.tuning.value = state.tuning; }

  // ---------- events ----------
  function bind() {
    els.title.addEventListener('input', function () { state.title = els.title.value.slice(0, 120); save(); renderAscii(); });
    els.tuning.addEventListener('change', function () { state.tuning = els.tuning.value; changed(); });
    els.editor.addEventListener('click', function (e) {
      var b = e.target.closest('.cell'); if (!b) return;
      openPicker(Number(b.dataset.col), Number(b.dataset.str));
    });
    els.fretboard.addEventListener('click', function (e) {
      var b = e.target.closest('.fret'); if (!b) return;
      setCell(Number(b.dataset.fret));
    });
    els.pickerStrings.addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      cur.str = Number(b.dataset.str); render();
    });
    els.pickMute.addEventListener('click', function () { setCell('x'); });
    els.pickClear.addEventListener('click', function () { setCell(null); });
    $('picker-next').addEventListener('click', nextStep);
    $('picker-done').addEventListener('click', closePicker);
    els.scrim.addEventListener('click', closePicker);
    $('prev-col').addEventListener('click', function () { moveCol(-1); });
    $('next-col').addEventListener('click', function () { moveCol(1); });
    $('add-col').addEventListener('click', function () {
      if (state.columns.length >= MAX_COLS) return;
      state.columns.splice(cur.col + 1, 0, emptyCol()); cur.col++; changed(); scrollToCur();
    });
    $('del-col').addEventListener('click', function () {
      if (state.columns.length <= 1) { state.columns[0] = emptyCol(); changed(); return; }
      state.columns.splice(cur.col, 1); cur.col = Math.min(cur.col, state.columns.length - 1); changed();
    });
    $('clear-col').addEventListener('click', function () { state.columns[cur.col] = emptyCol(); changed(); });
    $('copy-ascii').addEventListener('click', function () {
      var text = toAscii(24);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast('Tab copied as text'); }, function () { toast('Copy blocked by the browser'); });
      } else { toast('Copy not supported here'); }
    });
    $('export-btn').addEventListener('click', doExport);
    els.shareBtn.addEventListener('click', doShare);
    $('import-btn').addEventListener('click', function () { els.importFile.value = ''; els.importFile.click(); });
    els.importFile.addEventListener('change', function () { doImport(els.importFile.files[0]); });
    $('new-btn').addEventListener('click', function () {
      if (hasContent(state) && !confirm('Start a new tab? The current one will be replaced. Export first if you want to keep it.')) return;
      state = newTab(); cur = { col: 0, str: 0 }; syncInputs(); changed();
    });

    // Keyboard on desktop: arrows move, digits/x/Backspace edit, Esc closes the picker.
    var digitBuf = '', digitT = null;
    document.addEventListener('keydown', function (e) {
      if (e.target === els.title || e.target === els.tuning || e.ctrlKey || e.metaKey || e.altKey) return;
      var k = e.key;
      if (k === 'Escape' && pickerOpen) { closePicker(); e.preventDefault(); return; }
      if (k === 'ArrowLeft') { moveCol(-1); e.preventDefault(); }
      else if (k === 'ArrowRight') { moveCol(1); e.preventDefault(); }
      else if (k === 'ArrowUp') { cur.str = Math.max(0, cur.str - 1); render(); e.preventDefault(); }
      else if (k === 'ArrowDown') { cur.str = Math.min(STRINGS - 1, cur.str + 1); render(); e.preventDefault(); }
      else if (!pickerOpen) return;
      else if (/^[0-9]$/.test(k)) {
        digitBuf += k; clearTimeout(digitT);
        var n = Number(digitBuf);
        if (n > MAX_FRET) { digitBuf = k; n = Number(k); }
        setCell(n);
        digitT = setTimeout(function () { digitBuf = ''; }, 700);
      }
      else if (k === 'x' || k === 'X') setCell('x');
      else if (k === 'Backspace' || k === 'Delete') { setCell(null); e.preventDefault(); }
    });
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(renderAscii, 150); });
    // Another tab/window of the same site changed the saved tab: pick it up.
    window.addEventListener('storage', function (e) {
      if (e.key !== STORE_KEY) return;
      var t = load(); if (!t) return;
      state = t; cur.col = Math.min(cur.col, state.columns.length - 1); syncInputs(); render();
    });
  }

  function init() {
    buildStatic();
    var restored = load();
    state = restored || newTab();
    syncInputs();
    bind();
    if (canShareFiles()) els.shareBtn.hidden = false;
    render();
    if (restored) {
      var d = new Date(state.updatedAt);
      els.saveState.textContent = 'Restored · last saved ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      els.saveState.className = 'save-state ok';
    } else { save(); }
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('./sw.js').catch(function () { /* offline cache is optional */ });
    }
  }

  // Test hook (read-only snapshot) for the headless check.
  window.__guitarTab = { get state() { return JSON.parse(JSON.stringify(state)); }, toAscii: function () { return toAscii(24); } };
  init();
})();
