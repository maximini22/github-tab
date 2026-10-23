/* Guitar Tab app: UI, library persistence, import/export. Uses TabModel (js/model.js) and TabAudio (js/audio.js). */
(function () {
  'use strict';
  var M = window.TabModel, A = window.TabAudio;
  var STORE_KEY = 'jlr-guitar-tab:library';
  var OLD_KEY = 'jlr-guitar-tab:current'; // first scaffold (single tab), migrated on load
  var INLAYS = { 3: 1, 5: 1, 7: 1, 9: 1, 12: 2 };

  var $ = function (id) { return document.getElementById(id); };
  var els = {};
  ['save-state', 'project-select', 'title', 'track-chips', 'track-name', 'tuning', 'timesig', 'editor', 'editor-wrap', 'col-info',
   'dur-chips', 'dot-toggle', 'trip-toggle', 'play-btn', 'bpm', 'loop-toggle', 'loop-info', 'ascii', 'import-file', 'share-btn',
   'picker', 'scrim', 'picker-sub', 'neck', 'picker-strings', 'picker-grid', 'pick-mute', 'toast',
   'modal', 'modal-scrim', 'modal-h', 'modal-body', 'modal-actions', 'ruler', 'ruler-wrap', 'play-start', 'stop-btn', 'play-label', 'ph-info', 'picker-tip'].forEach(function (id) { els[id.replace(/-(\w)/g, function (_, c) { return c.toUpperCase(); })] = $(id); });

  var lib = null;
  var cur = { cell: 0, str: 0 }; // edit cursor: grid step index + string index (0 = high e)
  var pickerOpen = false;
  var playingStep = null, playTrack = null;
  // Playhead: where Play resumes, as a tick. Kept apart from the edit cursor (cur.cell) and saved per track
  // under its own key, so it never goes into exported files.
  var PH_KEY = 'jlr-guitar-tab:playheads';
  var playheads = {};
  try { playheads = JSON.parse(localStorage.getItem(PH_KEY) || '{}') || {}; } catch (e) { playheads = {}; }

  // ---------- accessors ----------
  function project() { return lib.projects.filter(function (p) { return p.id === lib.activeProjectId; })[0] || lib.projects[0]; }
  function track() { var p = project(); return p.tracks.filter(function (t) { return t.id === p.activeTrackId; })[0] || p.tracks[0]; }
  function cellText(ev) { return !ev ? '' : ev.fret === null ? 'x' : String(ev.fret); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function clampCur() { cur.cell = Math.max(0, Math.min(CL.length - 1, cur.cell)); }

  // ---------- persistence ----------
  function save() {
    var p = project(); p.updatedAt = M.nowIso();
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(lib));
      var d = new Date();
      els.saveState.textContent = 'Saved ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      els.saveState.className = 'save-state ok';
    } catch (e) {
      els.saveState.textContent = 'Not saved: storage full or blocked';
      els.saveState.className = 'save-state';
    }
  }
  function loadLibrary() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var obj = JSON.parse(raw), r = M.parseFile(obj);
        if (!r.error) {
          var l = M.newLibrary(); l.projects = r.projects;
          l.activeProjectId = r.projects.some(function (p) { return p.id === obj.activeProjectId; }) ? obj.activeProjectId : r.projects[0].id;
          // An older library is upgraded in place; keep the original once as a backup.
          if (r.migratedFrom) { try { if (!localStorage.getItem(STORE_KEY + '-v' + r.migratedFrom + '-backup')) localStorage.setItem(STORE_KEY + '-v' + r.migratedFrom + '-backup', raw); } catch (e2) { /* full */ } }
          return { lib: l, restored: true, migratedFrom: r.migratedFrom };
        }
      }
      var old = localStorage.getItem(OLD_KEY);
      if (old) {
        var r1 = M.parseFile(JSON.parse(old));
        if (!r1.error) { var l1 = M.newLibrary(); l1.projects = r1.projects; l1.activeProjectId = r1.projects[0].id; return { lib: l1, restored: true, migratedFrom: 1 }; }
      }
    } catch (e) { /* fall through to a fresh library */ }
    return { lib: M.newLibrary(), restored: false };
  }
  function changed(opts) {
    M.recompute(track()); save(); render();
    if (opts && opts.scroll) scrollToCur();
  }

  // ---------- grid ----------
  // The grid (snap) is one setting per project. Each editor/ruler column is one grid step; notes keep
  // their absolute startTick, so changing the grid only changes how they are drawn.
  function grid() { var p = project(); if (!p.grid) p.grid = M.defaultGrid(); return p.grid; }
  function cellsOf(tr) { return M.cells(tr || track(), grid()); }
  var CL = []; // cells of the active track at the current grid, refreshed on every render
  function cell(i) { return CL[i == null ? cur.cell : i]; }
  function notesIn(tr, c) { return tr.notes.filter(function (n) { return n.startTick >= c.start && n.startTick < c.start + c.len; }); }
  function notesOn(tr, c, no) { return notesIn(tr, c).filter(function (n) { return n.string === no; }); }
  function gridName(g) { return g.value + (g.dotted ? ' dotted' : '') + (g.tuplet ? ' triplet' : ''); }
  function gridShort(g) { return M.DUR_LETTER[g.value] + (g.dotted ? '.' : '') + (g.tuplet ? '3' : ''); }
  function lenLabel(ticks) {
    var d = M.nameTicks(ticks);
    return d ? { text: M.DUR_LETTER[d.value] + (d.dotted ? '.' : ''), d: d } : { text: '~', d: null };
  }

  // ---------- rhythm row (derived from note spacing) ----------
  // For each column: the length of the note that starts there (the gap to the next note, capped at a
  // bar), beams over eighth/sixteenth onsets inside one beat, and 3-brackets over triplet spacing.
  function groups(tr, cl) {
    var bt = M.beatTicks(tr);
    var info = cl.map(function (c, i) {
      var ns = notesIn(tr, c), first = ns[0] || null;
      var L = first ? lenLabel(first.durationTicks) : null;
      return { measure: c.measure, barStart: i === 0 || c.measure !== cl[i - 1].measure, onset: !!first,
        len: L ? L.text : '', d: L ? L.d : null, beam: '', beamLevels: 0, stem: false, tup: '', tupLabel: '' };
    });
    var beamable = function (g) { return g.onset && g.d && (g.d.value === 'eighth' || g.d.value === 'sixteenth'); };
    info.forEach(function (g) { g.stem = g.onset && !(g.d && g.d.value === 'whole'); });
    // beams: onsets in the same beat
    var i = 0;
    while (i < cl.length) {
      if (!beamable(info[i])) { i++; continue; }
      var beat = Math.floor(cl[i].start / bt), j = i, last = i;
      while (j + 1 < cl.length && Math.floor(cl[j + 1].start / bt) === beat && (beamable(info[j + 1]) || !info[j + 1].onset)) { j++; if (beamable(info[j])) last = j; }
      for (var k = i; k <= last; k++) {
        var g = info[k];
        g.beamLevels = g.d && g.d.value === 'sixteenth' ? 2 : 1;
        g.beam = i === last ? 'flag' : k === i ? 'start' : k === last ? 'end' : 'mid';
        if (!g.onset) { g.beamLevels = 1; g.stem = false; }
      }
      i = last + 1;
    }
    // triplet brackets: runs of onsets with triplet spacing, one bracket per group of three
    i = 0;
    while (i < cl.length) {
      var gi = info[i];
      if (!(gi.onset && gi.d && gi.d.tuplet)) { i++; continue; }
      var target = M.durTicks({ value: gi.d.value, dotted: false, tuplet: null }) * 2, acc = 0, j2 = i, end = i;
      while (j2 < cl.length) {
        var gj = info[j2];
        if (gj.onset) { if (!(gj.d && gj.d.tuplet)) break; acc += M.durTicks(gj.d); end = j2; if (acc >= target) break; }
        j2++;
      }
      var mid = Math.floor((i + end) / 2);
      for (var k2 = i; k2 <= end; k2++) {
        info[k2].tup = i === end ? 'single' : k2 === i ? 'start' : k2 === end ? 'end' : 'mid';
        info[k2].tupLabel = k2 === mid ? '3' : '';
      }
      i = end + 1;
    }
    return info;
  }

  // ---------- rendering ----------
  function renderProjectBar() {
    var p = project();
    els.projectSelect.textContent = '';
    lib.projects.slice().sort(function (a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); }).forEach(function (pr) {
      var o = document.createElement('option'); o.value = pr.id; o.textContent = pr.title || 'Untitled project'; els.projectSelect.appendChild(o);
    });
    els.projectSelect.value = p.id;
    if (document.activeElement !== els.title) els.title.value = p.title;
    els.trackChips.textContent = '';
    p.tracks.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip' + (t.id === p.activeTrackId ? ' on' : ''); b.dataset.track = t.id;
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', t.id === p.activeTrackId ? 'true' : 'false');
      b.textContent = t.name || 'Untitled track';
      els.trackChips.appendChild(b);
    });
    var add = document.createElement('button');
    add.type = 'button'; add.className = 'chip add'; add.id = 'track-add'; add.textContent = '+ Track';
    els.trackChips.appendChild(add);
    var tr = track();
    if (document.activeElement !== els.trackName) els.trackName.value = tr.name;
    var custom = !M.TUNING_BY_ID[tr.tuning.id] || M.TUNING_BY_ID[tr.tuning.id].midi.join() !== tr.tuning.midi.join();
    var co = els.tuning.querySelector('option[value="custom"]');
    if (custom && !co) { co = document.createElement('option'); co.value = 'custom'; els.tuning.appendChild(co); }
    if (co) { co.textContent = 'Custom: ' + M.tuningLabels(tr.tuning).join(' '); co.hidden = !custom; }
    els.tuning.value = custom ? 'custom' : tr.tuning.id;
    els.timesig.value = tr.timeSignature.join('/');
    if (document.activeElement !== els.bpm) els.bpm.value = p.bpm;
  }

  // ---------- playhead ----------
  function phTick(tr) { tr = tr || track(); return Math.max(0, Math.min(tr.lengthTicks - 1, playheads[tr.id] || 0)); }
  function phCell(tr) { tr = tr || track(); var cl = tr === track() ? CL : cellsOf(tr); return M.cellIndexAt(cl, phTick(tr)); }
  function savePlayheads() {
    var live = {};
    lib.projects.forEach(function (p) { p.tracks.forEach(function (t) { if (playheads[t.id]) live[t.id] = playheads[t.id]; }); });
    playheads = live;
    try { localStorage.setItem(PH_KEY, JSON.stringify(playheads)); } catch (e) { /* not fatal */ }
  }
  function setPlayhead(i, opts) {
    var tr = track(); i = Math.max(0, Math.min(CL.length - 1, i));
    playheads[tr.id] = CL[i].start;
    savePlayheads(); markPlayhead();
    if (!opts || !opts.noScroll) scrollToCur(i);
  }
  function loopCells(tr, cl) {
    var L = tr.loop; if (!L.enabled) return null;
    var a = -1, b = -1;
    cl.forEach(function (c, i) { if (c.measure >= L.startMeasure && c.measure <= L.endMeasure) { if (a < 0) a = i; b = i; } });
    return a < 0 ? null : { a: a, b: b };
  }
  function posLabel(tr, tick) {
    var mt = M.measureTicks(tr), bt = M.beatTicks(tr), inBar = tick % mt, beat = Math.floor(inBar / bt), sub = inBar - beat * bt;
    return (Math.floor(tick / mt) + 1) + '.' + (beat + 1) + (sub ? '+' + sub : '');
  }
  function shownPh() { return A.isPlaying() && playingStep !== null && playTrack === track() ? playingStep : phCell(); }
  function markPlayhead(forced) {
    var tr = track(), ph = forced != null ? forced : shownPh();
    Array.prototype.forEach.call(els.editor.children, function (c, k) { if (k) c.classList.toggle('ph', k - 1 === ph); });
    Array.prototype.forEach.call(els.ruler.children, function (c, k) { if (k) { c.classList.toggle('ph', k - 1 === ph); c.setAttribute('aria-current', k - 1 === ph ? 'step' : 'false'); } });
    if (CL[ph]) els.phInfo.textContent = 'Playhead: step ' + (ph + 1) + ' · bar ' + posLabel(tr, CL[ph].start);
  }
  // Count label for a grid step: beat number on the beat, & on the half beat, e/a on sixteenths.
  function countLabel(tr, c) {
    var mt = M.measureTicks(tr), bt = M.beatTicks(tr), inBar = c.start % mt, off = inBar % bt;
    if (!off) return { text: String(Math.floor(inBar / bt) + 1), beat: true };
    if (off * 2 === bt) return { text: '&', beat: false };
    if (off * 4 === bt) return { text: 'e', beat: false };
    if (off * 4 === bt * 3) return { text: 'a', beat: false };
    return { text: '·', beat: false };
  }
  // Timeline ruler above the grid: one column per grid step, bar numbers + loop band, beat counts.
  function renderRuler(tr, info) {
    var L = tr.loop;
    var frag = document.createDocumentFragment();
    var sp = document.createElement('div'); sp.className = 'r-lab';
    sp.innerHTML = '<span>bar</span><span class="r-g"></span>';
    sp.lastChild.textContent = gridShort(grid());
    sp.title = 'Grid: ' + gridName(grid());
    frag.appendChild(sp);
    CL.forEach(function (c, ci) {
      var g = info[ci], inLoop = c.measure >= L.startMeasure && c.measure <= L.endMeasure, cnt = countLabel(tr, c);
      var b = document.createElement('button'); b.type = 'button';
      b.className = 'rcol' + (g.barStart ? ' bar' : '') + (cnt.beat ? ' beat' : '') + (inLoop ? (L.enabled ? ' loop' : ' loop-off') : '');
      b.dataset.step = ci;
      b.setAttribute('aria-label', 'Move playhead to step ' + (ci + 1) + ', bar ' + posLabel(tr, c.start));
      var m = document.createElement('span'); m.className = 'r-m';
      m.textContent = g.barStart ? (L.startMeasure === c.measure ? '⟦' : '') + c.measure + (L.endMeasure === c.measure ? '⟧' : '') : '';
      var n = document.createElement('span'); n.className = 'r-len'; n.textContent = cnt.text;
      b.appendChild(m); b.appendChild(n);
      frag.appendChild(b);
    });
    els.ruler.textContent = ''; els.ruler.appendChild(frag);
    syncRulerWidths();
  }
  function syncRulerWidths() {
    var ec = els.editor.children, rc = els.ruler.children;
    for (var k = 0; k < rc.length && k < ec.length; k++) rc[k].style.width = ec[k].getBoundingClientRect().width + 'px';
    els.rulerWrap.scrollLeft = els.editorWrap.scrollLeft;
  }

  function renderEditor() {
    var tr = track(), labels = M.tuningLabels(tr.tuning), L = tr.loop;
    CL = cellsOf(tr); clampCur();
    var info = groups(tr, CL), ph = shownPh();
    var frag = document.createDocumentFragment();
    var lab = document.createElement('div'); lab.className = 'labels';
    labels.forEach(function (n) { var s = document.createElement('span'); s.textContent = n; lab.appendChild(s); });
    lab.insertAdjacentHTML('beforeend', '<div class="du">len</div><div class="bm"></div><div class="tp"></div>');
    frag.appendChild(lab);
    CL.forEach(function (c, ci) {
      var g = info[ci], col = document.createElement('div');
      var inLoop = c.measure >= L.startMeasure && c.measure <= L.endMeasure;
      col.className = 'col' + (ci === ph ? ' ph' : '') + (ci === cur.cell ? ' cur' : '') + (g.barStart ? ' bar' : '') + (ci === playingStep && playTrack === tr ? ' playing' : '') +
        (inLoop ? (L.enabled ? ' loop' : ' loop-off') : '');
      col.setAttribute('role', 'row');
      var here = notesIn(tr, c);
      for (var si = 0; si < M.STRINGS; si++) {
        var mine = here.filter(function (n) { return n.string === si + 1; }), ev = mine[0] || null, b = document.createElement('button');
        var off = !!ev && ev.startTick !== c.start;
        b.type = 'button';
        b.className = 'cell' + (ev ? ' has' : '') + (ev && ev.fret === null ? ' mute' : '') + (off ? ' off' : '') + (mine.length > 1 ? ' multi' : '') +
          (pickerOpen && ci === cur.cell && si === cur.str ? ' sel' : '');
        b.dataset.col = ci; b.dataset.str = si;
        b.setAttribute('role', 'gridcell');
        b.setAttribute('aria-label', 'Step ' + (ci + 1) + ', ' + labels[si] + ' string, ' + (!ev ? 'empty' : ev.fret === null ? 'muted' : 'fret ' + ev.fret) +
          (off ? ', off the grid' : '') + (mine.length > 1 ? ', plus ' + (mine.length - 1) + ' more in this step' : ''));
        var inner = document.createElement('b'); inner.textContent = cellText(ev); b.appendChild(inner);
        if (mine.length > 1) { var sup = document.createElement('sup'); sup.textContent = '+' + (mine.length - 1); b.appendChild(sup); }
        col.appendChild(b);
      }
      var du = document.createElement('div'); du.className = 'du' + (g.onset ? '' : ' cont'); du.textContent = g.len; col.appendChild(du);
      var bm = document.createElement('div'); bm.className = 'bm' + (g.beam ? ' b-' + g.beam + ' lv' + g.beamLevels : '') + (g.stem ? ' stem' : ' nostem');
      bm.innerHTML = '<i></i><i></i>'; col.appendChild(bm);
      var tp = document.createElement('div'); tp.className = 'tp' + (g.tup ? ' t-' + g.tup : '');
      if (g.tupLabel) { var em = document.createElement('em'); em.textContent = g.tupLabel; tp.appendChild(em); }
      col.appendChild(tp);
      frag.appendChild(col);
    });
    els.editor.textContent = '';
    els.editor.appendChild(frag);
    renderRuler(tr, info);
    markPlayhead();
    var c0 = cell();
    els.colInfo.textContent = 'Step ' + (cur.cell + 1) + ' of ' + CL.length + ' · bar ' + posLabel(tr, c0.start) + ' · grid ' + gridShort(grid());
    // grid controls
    var gd = grid();
    Array.prototype.forEach.call(els.durChips.children, function (b) { var on = b.dataset.dur === gd.value; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
    setToggle(els.dotToggle, gd.dotted);
    setToggle(els.tripToggle, !!gd.tuplet);
    // loop controls
    setToggle(els.loopToggle, L.enabled);
    els.loopToggle.textContent = L.enabled ? 'Loop on' : 'Loop off';
    els.loopInfo.textContent = 'Measures ' + L.startMeasure + ' to ' + L.endMeasure + ' of ' + M.measureCount(tr);
  }
  function setToggle(b, on) { b.classList.toggle('on', !!on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }

  // Plain-text tab at the project grid: one column per grid step, barlines at measures, and a
  // length row naming each note's spacing (~ when it is not a standard length).
  function toAscii(perLine) {
    var p = project(), lines = [];
    if (p.title) lines.push(p.title);
    p.tracks.forEach(function (tr) {
      var labels = M.tuningLabels(tr.tuning), w = Math.max.apply(null, labels.map(function (n) { return n.length; })), cl = cellsOf(tr), info = groups(tr, cl);
      lines.push('');
      lines.push('[' + (tr.name || 'Track') + '] ' + (tr.tuning.name || '') + ' · ' + tr.timeSignature.join('/') + ' · ' + p.bpm + ' bpm · grid ' + gridName(grid()) +
        (tr.loop.enabled ? ' · loop m' + tr.loop.startMeasure + '-' + tr.loop.endMeasure : ''));
      var perBar = cl.filter(function (c) { return c.measure === 1; }).length, bars = Math.max(1, Math.floor(perLine / perBar));
      var mc = M.measureCount(tr);
      for (var m0 = 1; m0 <= mc; m0 += bars) {
        var rows = labels.map(function (n) { return (n + '    ').slice(0, w) + '|'; });
        var dur = new Array(w + 2).join(' ');
        var first = true;
        cl.forEach(function (c, ci) {
          if (c.measure < m0 || c.measure >= m0 + bars) return;
          var g = info[ci];
          if (g.barStart && !first) { rows = rows.map(function (r) { return r + '|'; }); dur += ' '; }
          first = false;
          var dl = g.onset ? g.len + (g.d && g.d.tuplet ? '3' : '') : '';
          var texts = []; for (var si = 0; si < M.STRINGS; si++) texts.push(cellText(notesOn(tr, c, si + 1)[0]));
          var cw = Math.max(dl.length, Math.max.apply(null, texts.map(function (t) { return t.length; })), 1);
          rows = rows.map(function (r, si) { return r + '-' + texts[si] + new Array(cw - texts[si].length + 1).join('-'); });
          dur += ' ' + dl + new Array(cw - dl.length + 1).join(' ');
        });
        lines.push(rows.map(function (r) { return r + '-|'; }).join('\n'));
        lines.push(dur.replace(/\s+$/, ''));
      }
    });
    return lines.join('\n') + '\n';
  }
  function renderAscii() { els.ascii.textContent = toAscii(16); }

  function renderPicker() {
    var tr = track(), labels = M.tuningLabels(tr.tuning), c = cell(), mine = notesOn(tr, c, cur.str + 1), ev = mine[0] || null;
    els.pickerSub.textContent = 'Step ' + (cur.cell + 1) + ' · bar ' + posLabel(tr, c.start) + ' · ' + labels[cur.str] + ' string (' + (cur.str + 1) + ')';
    // String list is player's view: string 1 (high e) at the top down to string 6 (low E) at the bottom.
    Array.prototype.forEach.call(els.pickerStrings.children, function (b) {
      var i = Number(b.dataset.str);
      b.innerHTML = '<b></b><small></small>';
      b.firstChild.textContent = labels[i];
      b.lastChild.textContent = i === 0 ? '1 high' : i === M.STRINGS - 1 ? '6 low' : String(i + 1);
      b.setAttribute('aria-label', 'String ' + (i + 1) + ', ' + labels[i] + (i === 0 ? ', highest' : i === M.STRINGS - 1 ? ', lowest' : ''));
      b.classList.toggle('on', i === cur.str); b.setAttribute('aria-checked', i === cur.str ? 'true' : 'false');
      b.classList.toggle('has', notesOn(tr, c, i + 1).length > 0);
    });
    Array.prototype.forEach.call(els.neck.children, function (b) {
      var on = !!ev && ev.fret === Number(b.dataset.fret); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var mOn = !!ev && ev.fret === null;
    els.pickMute.classList.toggle('on', mOn); els.pickMute.setAttribute('aria-pressed', mOn ? 'true' : 'false');
    els.pickMute.textContent = mOn ? 'x Muted ✓' : 'x Muted';
    var tip = ev ? 'Tap the lit ' + (ev.fret === null ? 'Muted button' : 'fret') + ' again to remove it.' : 'Tap a fret to place a note.';
    if (ev && ev.startTick !== c.start) tip += ' This note is off the grid (at ' + posLabel(tr, ev.startTick) + '); editing keeps its timing.';
    els.pickerTip.textContent = tip;
    els.pickerGrid.textContent = 'Grid: ' + gridName(grid()) + '. Next moves one grid step.';
  }

  function render() {
    renderProjectBar();
    renderEditor();
    renderAscii();
    if (pickerOpen) renderPicker();
    var tid = track().id;
    if (tid !== lastTrackId) { lastTrackId = tid; els.editorWrap.scrollLeft = 0; scrollToCur(); }
  }
  var lastTrackId = null;

  function buildStatic() {
    M.TUNINGS.forEach(function (t) { var o = document.createElement('option'); o.value = t.id; o.textContent = t.name; els.tuning.appendChild(o); });
    M.DUR_VALUES.forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.dur = v; b.setAttribute('role', 'radio');
      b.innerHTML = '<b>' + M.DUR_LETTER[v] + '</b><small>' + (v === 'sixteenth' ? '16th' : v) + '</small>';
      b.setAttribute('aria-label', v + ' grid');
      els.durChips.appendChild(b);
    });
    for (var s = 0; s < M.STRINGS; s++) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.str = s; b.setAttribute('role', 'radio');
      els.pickerStrings.appendChild(b);
    }
    // Vertical neck: open string above the nut, then frets 1..16 going down, inlays on the fretboard.
    for (var f = 0; f <= M.MAX_FRET; f++) {
      var fb = document.createElement('button');
      fb.type = 'button'; fb.dataset.fret = f;
      fb.className = 'frow' + (f === 0 ? ' open' : '') + (INLAYS[f] ? ' inlay' : '');
      var dots = ''; for (var d = 0; d < (INLAYS[f] || 0); d++) dots += '<i></i>';
      fb.innerHTML = '<span class="n">' + f + '</span><span class="board"><span class="dots" aria-hidden="true">' + dots + '</span></span>';
      fb.setAttribute('aria-label', f === 0 ? 'Open string, 0' : 'Fret ' + f + (INLAYS[f] === 2 ? ', double dot' : INLAYS[f] ? ', dot' : ''));
      els.neck.appendChild(fb);
    }
  }

  // ---------- editing ----------
  // The picker edits the note on this string in the current grid step (the first one if a coarse
  // grid holds several). An empty step gets a new note on the grid line. Tapping the value already
  // there (same fret, or Muted when muted) removes it, silently.
  function setEvent(fret, muted, noToggle) {
    var tr = track(), c = cell(), no = cur.str + 1, mine = notesOn(tr, c, no), had = mine[0] || null;
    if (fret === undefined) { // Clear: everything on this string in this step
      tr.notes = tr.notes.filter(function (n) { return mine.indexOf(n) < 0; });
    } else if (had && !noToggle && (muted ? had.fret === null : had.fret === fret)) {
      tr.notes.splice(tr.notes.indexOf(had), 1);
      toast((muted ? 'Mute' : 'Fret ' + fret) + ' removed');
    } else {
      var tech = had ? had.techniques.filter(function (t) { return t !== 'muted'; }) : [];
      if (muted) tech.push('muted');
      if (had) { had.fret = muted ? null : fret; had.techniques = tech; }
      else {
        if (tr.notes.length >= M.LIMITS.notes) { toast('Track is full'); return; }
        tr.notes.push({ string: no, fret: muted ? null : fret, startTick: c.start, durationTicks: 0, techniques: tech });
      }
      A.preview(tr.tuning.midi[cur.str] + (muted ? 0 : fret), muted);
    }
    changed();
  }
  // Grid change: notes stay put. The edit cursor and playhead stay at the same time position.
  function setGrid(patch) {
    var gd = grid(), tick = cell().start, wasPlaying = A.isPlaying() && playTrack === track(), playTick = wasPlaying && CL[playingStep] ? CL[playingStep].start : 0;
    if ('value' in patch) gd.value = patch.value;
    if ('dotted' in patch) { gd.dotted = patch.dotted; if (gd.dotted) gd.tuplet = null; }
    if ('tuplet' in patch) { gd.tuplet = patch.tuplet; if (gd.tuplet) gd.dotted = false; }
    CL = cellsOf(); cur.cell = M.cellIndexAt(CL, tick);
    changed({ scroll: true });
    if (wasPlaying) startPlayback(M.cellIndexAt(CL, playTick));
    toast('Grid: ' + gridName(gd));
  }
  // Moving the edit cursor while stopped also brings the playhead with it, so Play starts where you
  // are editing. While playing, editing never moves playback. The ruler moves only the playhead.
  function moveStep(dlt) {
    cur.cell += dlt; clampCur();
    if (!A.isPlaying()) { playheads[track().id] = cell().start; savePlayheads(); }
    render(); scrollToCur();
  }
  function nextStep() {
    var tr = track();
    if (cur.cell === CL.length - 1 && M.measureCount(tr) < M.LIMITS.measures) { tr.lengthTicks += M.measureTicks(tr); M.recompute(tr); CL = cellsOf(tr); save(); }
    moveStep(1);
  }
  function scrollToCur(idx) {
    var col = els.editor.children[(idx == null ? cur.cell : idx) + 1];
    if (!col) return;
    var wrap = els.editorWrap, labelsW = els.editor.children[0] ? els.editor.children[0].offsetWidth : 40, left = col.offsetLeft - labelsW - 4, right = col.offsetLeft + col.offsetWidth;
    if (left < wrap.scrollLeft) wrap.scrollLeft = left;
    else if (right > wrap.scrollLeft + wrap.clientWidth) wrap.scrollLeft = right - wrap.clientWidth + 8;
  }
  function openPicker(col, str) {
    cur.cell = col; cur.str = str; pickerOpen = true;
    if (!A.isPlaying()) { playheads[track().id] = CL[col].start; savePlayheads(); }
    els.picker.hidden = false; els.scrim.hidden = false;
    render(); scrollToCur();
  }
  function closePicker() {
    pickerOpen = false; els.picker.hidden = true; els.scrim.hidden = true; render();
    var b = els.editor.querySelector('.cell[data-col="' + cur.cell + '"][data-str="' + cur.str + '"]');
    if (b) b.focus({ preventScroll: true });
  }

  // ---------- playback / transport ----------
  // Walks the timeline one grid step at a time; each note sounds at its own startTick (so off-grid
  // notes keep their timing) for its durationTicks. Play resumes at the playhead; From start goes to
  // the loop start (loop on) or the top (loop off).
  function startPlayback(from) {
    var tr = track(), p = project(), cl = CL, lp = loopCells(tr, cl), n = cl.length;
    from = Math.max(0, Math.min(n - 1, from));
    var base, count, loop;
    if (lp) {
      if (from < lp.a || from > lp.b) from = lp.a;
      base = lp.a; count = lp.b - lp.a + 1; loop = true;
    } else { base = 0; count = n; loop = false; }
    A.stop();
    var ok = A.play({
      count: count, startAt: from - base, loop: loop, ppq: M.PPQ,
      bpm: function () { return p.bpm; },
      stepAt: function (i) {
        var c = cl[base + i];
        if (!c) return { ticks: M.PPQ, notes: [] };
        return { ticks: c.len, notes: notesIn(tr, c).map(function (e) {
          return { midi: tr.tuning.midi[e.string - 1] + (e.fret || 0), muted: e.fret === null, offset: e.startTick - c.start, ticks: e.durationTicks };
        }) };
      },
      onStep: function (i) {
        if (i === null) { // reached the end with the loop off: back to the top, ready to play again
          playingStep = null; playTrack = null; playheads[tr.id] = 0; savePlayheads();
          if (track() === tr) markPlayhead();
          transportUi(); markPlaying(); return;
        }
        playingStep = base + i;
        playheads[tr.id] = cl[playingStep] ? cl[playingStep].start : 0;
        markPlaying(); scrollToCur(playingStep);
      }
    });
    if (!ok) { toast('Audio is not available in this browser'); return; }
    playingStep = from; playTrack = tr; playheads[tr.id] = cl[from].start;
    transportUi(); markPlaying();
  }
  function playResume() { if (!A.isPlaying()) startPlayback(phCell()); }
  function playFromStart() { var lp = loopCells(track(), CL); startPlayback(lp ? lp.a : 0); }
  // Stop keeps the playhead where it stopped. Stop while already stopped returns it to the start.
  function stopPlay(opts) {
    var was = A.isPlaying();
    A.stop();
    if (was && playTrack) { savePlayheads(); }
    else if (!was && opts && opts.user) { var lp = loopCells(track(), CL); setPlayhead(lp ? lp.a : 0); toast('Playhead back to the start'); }
    playingStep = null; playTrack = null; transportUi(); markPlaying(); markPlayhead();
  }
  function transportUi() {
    var on = A.isPlaying();
    els.playBtn.classList.toggle('on', on); els.playLabel.textContent = on ? 'Playing' : 'Play';
    els.playBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  // Ruler: tap = jump; drag = scrub (applied on release). While playing, playback jumps there and keeps going.
  function bindRuler() {
    var rw = els.rulerWrap, drag = null;
    function stepAtX(x) {
      var cols = els.ruler.children, best = 0;
      for (var k = 1; k < cols.length; k++) { var r = cols[k].getBoundingClientRect(); if (x >= r.left && x < r.right) return k - 1; if (x >= r.left) best = k - 1; }
      return best;
    }
    function commit(i) {
      if (A.isPlaying()) {
        var lp = loopCells(track(), CL);
        if (lp && (i < lp.a || i > lp.b)) toast('Loop is on: jumped to the loop start');
        startPlayback(i);
      } else setPlayhead(i, { noScroll: true });
    }
    rw.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      drag = { id: e.pointerId, x0: e.clientX, moved: false, i: stepAtX(e.clientX) };
      try { rw.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    });
    rw.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.abs(e.clientX - drag.x0) < 8) return;
      drag.moved = true;
      var r = rw.getBoundingClientRect();
      if (e.clientX < r.left + 70) els.editorWrap.scrollLeft -= 12; else if (e.clientX > r.right - 30) els.editorWrap.scrollLeft += 12;
      drag.i = stepAtX(e.clientX); markPlayhead(drag.i);
      e.preventDefault();
    });
    function end(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var i = drag.moved ? drag.i : stepAtX(e.clientX); drag = null;
      if (e.type === 'pointercancel') { markPlayhead(); return; }
      commit(i);
    }
    rw.addEventListener('pointerup', end); rw.addEventListener('pointercancel', end);
    // Keyboard (Enter/Space on a focused ruler step) arrives as a click with no pointer.
    rw.addEventListener('click', function (e) { if (e.detail === 0) { var b = e.target.closest('.rcol'); if (b) commit(Number(b.dataset.step)); } });
    rw.addEventListener('wheel', function (e) { els.editorWrap.scrollLeft += (e.deltaX || e.deltaY); e.preventDefault(); }, { passive: false });
    els.editorWrap.addEventListener('scroll', function () { rw.scrollLeft = els.editorWrap.scrollLeft; }, { passive: true });
  }
  function markPlaying() {
    var mine = playTrack === track();
    Array.prototype.forEach.call(els.editor.children, function (c, k) { if (k) c.classList.toggle('playing', mine && k - 1 === playingStep); });
    markPlayhead();
  }

  // ---------- modal + toast ----------
  function toast(msg) {
    els.toast.textContent = msg; els.toast.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function () { els.toast.hidden = true; }, 2600);
  }
  function choose(title, body, buttons) {
    return new Promise(function (resolve) {
      els.modalH.textContent = title; els.modalBody.textContent = body; els.modalActions.textContent = '';
      buttons.forEach(function (b) {
        var el = document.createElement('button');
        el.type = 'button'; el.className = 'btn ' + (b.cls || ''); el.textContent = b.label; el.dataset.value = b.value;
        el.addEventListener('click', function () { els.modal.hidden = true; els.modalScrim.hidden = true; resolve(b.value); });
        els.modalActions.appendChild(el);
      });
      els.modal.hidden = false; els.modalScrim.hidden = false;
      els.modalActions.firstChild.focus();
    });
  }

  // ---------- export / import ----------
  function slug(s) { return (s || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'tab'; }
  function stamp() { var d = new Date(); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()); }
  function fileFor(kind) {
    var projects = kind === 'library' ? lib.projects : [project()];
    var out = { schema: M.SCHEMA, schemaVersion: M.SCHEMA_VERSION, kind: kind, ppq: M.PPQ, exportedAt: M.nowIso(),
      activeProjectId: lib.activeProjectId, projects: projects };
    var name = (kind === 'library' ? 'guitar-tab-library' : slug(project().title)) + '-' + stamp() + '.json';
    return { name: name, blob: new Blob([JSON.stringify(out, null, 2) + '\n'], { type: 'application/json' }) };
  }
  function download(kind) {
    var f = fileFor(kind), url = URL.createObjectURL(f.blob), a = document.createElement('a');
    a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    toast('Exported ' + f.name);
  }
  function canShareFiles() {
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['{}'], 't.json', { type: 'application/json' })] })); } catch (e) { return false; }
  }
  function share() {
    var f = fileFor('project');
    navigator.share({ files: [new File([f.blob], f.name, { type: 'application/json' })], title: project().title || 'Guitar tab' })
      .catch(function (e) { if (e && e.name !== 'AbortError') toast('Share failed. Use Export instead.'); });
  }
  function importFile(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast('That file is too big to be a tab.'); return; }
    var r = new FileReader();
    r.onload = function () {
      var obj;
      try { obj = JSON.parse(r.result); } catch (e) { choose('Import failed', 'That file is not valid JSON.', [{ label: 'OK', value: 0 }]); return; }
      var res = M.parseFile(obj);
      if (res.error) { choose('Import failed', res.error, [{ label: 'OK', value: 0 }]); return; }
      var n = res.projects.length, names = res.projects.slice(0, 3).map(function (p) { return '"' + (p.title || 'Untitled') + '"'; }).join(', ') + (n > 3 ? ' and ' + (n - 3) + ' more' : '');
      choose('Import ' + n + ' project' + (n > 1 ? 's' : ''), 'File has ' + names + '. Merge adds them to your library (a project you already have is kept, and a changed copy is added beside it). Replace deletes your current ' + lib.projects.length + ' project' + (lib.projects.length > 1 ? 's' : '') + ' first.',
        [{ label: 'Merge', value: 'merge', cls: 'go' }, { label: 'Replace all', value: 'replace', cls: 'warn' }, { label: 'Cancel', value: 'cancel' }])
        .then(function (choice) {
          if (choice === 'cancel') return;
          if (choice === 'replace') {
            if (!confirm('Replace your whole library with this file? This cannot be undone. Export all first if unsure.')) return;
            lib.projects = res.projects;
          } else {
            res.projects.forEach(function (p) {
              var have = lib.projects.filter(function (x) { return x.id === p.id; })[0];
              if (!have) { lib.projects.push(p); return; }
              if (JSON.stringify(have.tracks) === JSON.stringify(p.tracks) && have.title === p.title) return; // identical
              p.id = M.uid(); p.title = (p.title || 'Untitled') + ' (imported)'; lib.projects.push(p);
            });
            if (lib.projects.length > M.LIMITS.projects) lib.projects = lib.projects.slice(0, M.LIMITS.projects);
          }
          lib.activeProjectId = res.projects[0].id;
          cur = { cell: 0, str: 0 }; stopPlay(); changed();
          toast((choice === 'merge' ? 'Merged ' : 'Replaced with ') + n + ' project' + (n > 1 ? 's' : ''));
        });
    };
    r.onerror = function () { toast('Could not read that file.'); };
    r.readAsText(file);
  }

  // ---------- events ----------
  function on(id, ev, fn) { $(id).addEventListener(ev, fn); }
  function bind() {
    els.projectSelect.addEventListener('change', function () { stopPlay(); lib.activeProjectId = els.projectSelect.value; cur = { cell: 0, str: 0 }; save(); render(); });
    on('project-new', 'click', function () {
      stopPlay(); var p = M.newProject(''); lib.projects.push(p); lib.activeProjectId = p.id; cur = { cell: 0, str: 0 }; changed();
      els.title.focus();
    });
    on('project-dup', 'click', function () {
      var c = M.normaliseProject(JSON.parse(JSON.stringify(project())));
      c.id = M.uid(); c.title = (c.title || 'Untitled') + ' (copy)'; c.createdAt = M.nowIso();
      lib.projects.push(c); lib.activeProjectId = c.id; changed(); toast('Duplicated');
    });
    on('project-del', 'click', function () {
      var p = project();
      if (!confirm('Delete project "' + (p.title || 'Untitled') + '"? This cannot be undone.')) return;
      stopPlay();
      lib.projects = lib.projects.filter(function (x) { return x.id !== p.id; });
      if (!lib.projects.length) lib.projects.push(M.newProject(''));
      lib.activeProjectId = lib.projects[0].id; cur = { cell: 0, str: 0 }; changed();
    });
    els.title.addEventListener('input', function () { project().title = els.title.value.slice(0, M.LIMITS.title); save(); renderAscii(); });
    els.title.addEventListener('change', renderProjectBar);
    els.trackChips.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      stopPlay();
      var p = project();
      if (b.id === 'track-add') {
        if (p.tracks.length >= M.LIMITS.tracks) return;
        var t = M.newTrack('Track ' + (p.tracks.length + 1), track().tuning.id); t.tuning = JSON.parse(JSON.stringify(track().tuning));
        p.tracks.push(t); p.activeTrackId = t.id;
      } else p.activeTrackId = b.dataset.track;
      cur = { cell: 0, str: 0 }; changed();
    });
    els.trackName.addEventListener('input', function () { track().name = els.trackName.value.slice(0, M.LIMITS.name); save(); renderAscii(); });
    els.trackName.addEventListener('change', renderProjectBar);
    on('track-del', 'click', function () {
      var p = project(), t = track();
      if (p.tracks.length <= 1) { toast('A project needs at least one track'); return; }
      if (!confirm('Delete track "' + (t.name || 'Untitled') + '"?')) return;
      stopPlay(); p.tracks = p.tracks.filter(function (x) { return x.id !== t.id; }); p.activeTrackId = p.tracks[0].id; cur = { cell: 0, str: 0 }; changed();
    });
    els.tuning.addEventListener('change', function () { if (els.tuning.value !== 'custom') { track().tuning = M.tuningFromId(els.tuning.value); changed(); } });

    els.timesig.addEventListener('change', function () { stopPlay(); var tick = cell().start; track().timeSignature = els.timesig.value.split('/').map(Number); M.recompute(track()); CL = cellsOf(); cur.cell = M.cellIndexAt(CL, tick); changed(); });

    els.editor.addEventListener('click', function (e) { var b = e.target.closest('.cell'); if (b) openPicker(Number(b.dataset.col), Number(b.dataset.str)); });
    els.neck.addEventListener('click', function (e) { var b = e.target.closest('.frow'); if (b) setEvent(Number(b.dataset.fret), false); });
    els.pickerStrings.addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (b) { cur.str = Number(b.dataset.str); render(); } });
    els.durChips.addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (b) setGrid({ value: b.dataset.dur }); });
    els.dotToggle.addEventListener('click', function () { setGrid({ dotted: !grid().dotted }); });
    els.tripToggle.addEventListener('click', function () { setGrid({ tuplet: grid().tuplet ? null : { actual: 3, normal: 2 } }); });
    els.pickMute.addEventListener('click', function () { setEvent(0, true); });
    on('pick-clear', 'click', function () { setEvent(undefined); });
    on('picker-next', 'click', nextStep);
    on('picker-done', 'click', closePicker);
    els.scrim.addEventListener('click', closePicker);

    on('prev-col', 'click', function () { moveStep(-1); });
    on('next-col', 'click', nextStep);
    // Insert step: push every note from this step onward one grid step later.
    on('add-col', 'click', function () {
      var tr = track(), c = cell();
      if (M.measureCount(tr) >= M.LIMITS.measures) return;
      tr.notes.forEach(function (n) { if (n.startTick >= c.start) n.startTick += c.len; });
      tr.lengthTicks += c.len; changed({ scroll: true });
    });
    // Delete step: remove the notes in this step and pull later notes one grid step earlier.
    on('del-col', 'click', function () {
      var tr = track(), c = cell(), end = c.start + c.len;
      tr.notes = tr.notes.filter(function (n) { return n.startTick < c.start || n.startTick >= end; });
      tr.notes.forEach(function (n) { if (n.startTick >= end) n.startTick -= c.len; });
      changed();
    });
    on('add-measure', 'click', function () {
      var tr = track(); if (M.measureCount(tr) >= M.LIMITS.measures) return;
      var start = tr.lengthTicks; tr.lengthTicks += M.measureTicks(tr); M.recompute(tr); CL = cellsOf(tr);
      cur.cell = M.cellIndexAt(CL, start); changed({ scroll: true });
    });
    on('del-measure', 'click', function () {
      var tr = track(), mt = M.measureTicks(tr), mc = M.measureCount(tr);
      if (mc <= 1) { toast('A track needs at least one measure'); return; }
      var from = (mc - 1) * mt, lost = tr.notes.filter(function (n) { return n.startTick >= from; }).length;
      if (lost && !confirm('Remove the last measure and its ' + lost + ' note' + (lost > 1 ? 's' : '') + '?')) return;
      stopPlay();
      tr.notes = tr.notes.filter(function (n) { return n.startTick < from; }); tr.lengthTicks = from; changed();
    });
    on('clear-col', 'click', function () { var tr = track(), c = cell(); tr.notes = tr.notes.filter(function (n) { return n.startTick < c.start || n.startTick >= c.start + c.len; }); changed(); });

    on('play-btn', 'click', playResume);
    on('play-start', 'click', playFromStart);
    on('stop-btn', 'click', function () { stopPlay({ user: true }); });
    bindRuler();
    var setBpm = function (v) { var p = project(); p.bpm = Math.max(30, Math.min(300, Math.round(v) || 90)); els.bpm.value = p.bpm; save(); renderAscii(); };
    on('bpm-down', 'click', function () { setBpm(project().bpm - 5); });
    on('bpm-up', 'click', function () { setBpm(project().bpm + 5); });
    els.bpm.addEventListener('change', function () { setBpm(Number(els.bpm.value)); });
    els.loopToggle.addEventListener('click', function () {
      var L = track().loop; L.enabled = !L.enabled; var at = playingStep, was = A.isPlaying() && playTrack === track();
      changed(); if (was) startPlayback(at);
    });
    on('loop-start', 'click', function () { var tr = track(), m = cell().measure; tr.loop.startMeasure = m; if (tr.loop.endMeasure < m) tr.loop.endMeasure = m; changed(); });
    on('loop-end', 'click', function () { var tr = track(), m = cell().measure; tr.loop.endMeasure = m; if (tr.loop.startMeasure > m) tr.loop.startMeasure = m; changed(); });

    on('copy-ascii', 'click', function () {
      var text = toAscii(16);
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast('Tab copied as text'); }, function () { toast('Copy blocked by the browser'); });
      else toast('Copy not supported here');
    });
    on('export-one', 'click', function () { download('project'); });
    on('export-all', 'click', function () { download('library'); });
    els.shareBtn.addEventListener('click', share);
    on('import-btn', 'click', function () { els.importFile.value = ''; els.importFile.click(); });
    els.importFile.addEventListener('change', function () { importFile(els.importFile.files[0]); });

    // Hardware keyboard (optional): arrows move, digits/x/Backspace edit while the picker is open, Esc closes.
    var buf = '', bufT = null;
    document.addEventListener('keydown', function (e) {
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT') || e.ctrlKey || e.metaKey || e.altKey || !els.modal.hidden) return;
      var k = e.key;
      if (k === 'Escape' && pickerOpen) { closePicker(); e.preventDefault(); }
      else if (k === ' ' && !pickerOpen && !(t && t.tagName === 'BUTTON')) { if (A.isPlaying()) stopPlay(); else playResume(); e.preventDefault(); }
      else if (k === 'ArrowLeft') { moveStep(-1); e.preventDefault(); }
      else if (k === 'ArrowRight') { moveStep(1); e.preventDefault(); }
      else if (k === 'ArrowUp' && pickerOpen) { cur.str = Math.max(0, cur.str - 1); render(); e.preventDefault(); }
      else if (k === 'ArrowDown' && pickerOpen) { cur.str = Math.min(M.STRINGS - 1, cur.str + 1); render(); e.preventDefault(); }
      else if (!pickerOpen) return;
      else if (/^[0-9]$/.test(k)) {
        buf += k; clearTimeout(bufT); var n = Number(buf); if (n > M.MAX_FRET) { buf = k; n = Number(k); }
        setEvent(n, false, true); bufT = setTimeout(function () { buf = ''; }, 700);
      } else if (k === 'x' || k === 'X') setEvent(0, true);
      else if (k === 'Backspace' || k === 'Delete') { setEvent(undefined); e.preventDefault(); }
    });
    // Another window of this site saved: pick up its library.
    window.addEventListener('storage', function (e) {
      if (e.key !== STORE_KEY || A.isPlaying()) return;
      var r = loadLibrary(); if (!r.restored) return;
      lib = r.lib; render();
    });
  }

  function init() {
    buildStatic();
    var r = loadLibrary();
    lib = r.lib;
    bind();
    if (canShareFiles()) els.shareBtn.hidden = false;
    if (r.restored) {
      cur.cell = M.cellIndexAt(cellsOf(), phTick());
    }
    render();
    if (r.restored) {
      var d = new Date(project().updatedAt);
      els.saveState.textContent = 'Restored · ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      els.saveState.className = 'save-state ok';
      if (r.migratedFrom) { save(); toast('Library upgraded to the grid format (your old copy is kept as a backup)'); }
    } else save();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(function () {});
  }

  // Read-only hook for automated checks.
  window.__guitarTab = { get library() { return JSON.parse(JSON.stringify(lib)); }, toAscii: function () { return toAscii(16); }, audioState: A.state, isPlaying: A.isPlaying,
    playhead: function () { return phCell(); }, playheadTick: function () { return phTick(); }, playingStep: function () { return playingStep; },
    editStep: function () { return cur.cell; }, cells: function () { return JSON.parse(JSON.stringify(CL)); }, grid: function () { return JSON.parse(JSON.stringify(grid())); },
    lastNote: function () { return A.lastNote(); }, scheduled: function () { return A.scheduled(); } };
  init();
})();
