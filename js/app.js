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
   'picker', 'scrim', 'picker-sub', 'neck', 'picker-strings', 'picker-dur', 'pick-mute', 'toast',
   'modal', 'modal-scrim', 'modal-h', 'modal-body', 'modal-actions'].forEach(function (id) { els[id.replace(/-(\w)/g, function (_, c) { return c.toUpperCase(); })] = $(id); });

  var lib = null;
  var cur = { step: 0, str: 0 };
  var pickerOpen = false;
  var playingStep = null;

  // ---------- accessors ----------
  function project() { return lib.projects.filter(function (p) { return p.id === lib.activeProjectId; })[0] || lib.projects[0]; }
  function track() { var p = project(); return p.tracks.filter(function (t) { return t.id === p.activeTrackId; })[0] || p.tracks[0]; }
  function step() { return track().steps[cur.step]; }
  function eventAt(s, stringNo) { return s.events.filter(function (e) { return e.string === stringNo; })[0] || null; }
  function cellText(ev) { return !ev ? '' : ev.fret === null ? 'x' : String(ev.fret); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function clampCur() { var n = track().steps.length; cur.step = Math.max(0, Math.min(n - 1, cur.step)); }

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
          return { lib: l, restored: true };
        }
      }
      var old = localStorage.getItem(OLD_KEY);
      if (old) {
        var r1 = M.parseFile(JSON.parse(old));
        if (!r1.error) { var l1 = M.newLibrary(); l1.projects = r1.projects; l1.activeProjectId = r1.projects[0].id; return { lib: l1, restored: true }; }
      }
    } catch (e) { /* fall through to a fresh library */ }
    return { lib: M.newLibrary(), restored: false };
  }
  function changed(opts) {
    M.recompute(track()); clampCur(); save(); render();
    if (opts && opts.scroll) scrollToCur();
  }

  // ---------- rhythm grouping (beams, triplet brackets, measures) ----------
  function groups(tr) {
    var mt = M.measureTicks(tr), bt = M.beatTicks(tr), steps = tr.steps;
    var info = steps.map(function (s) {
      return { measure: Math.floor(s.startTick / mt) + 1, barStart: false, beam: '', beamLevels: 0, tup: '', tupLabel: false };
    });
    // a barline goes before the first step that starts in a new measure (a note may ring over the bar)
    info.forEach(function (g, n) { g.barStart = n === 0 || g.measure !== info[n - 1].measure; });
    // beams: consecutive eighth/sixteenth steps that start and end inside the same beat
    var i = 0;
    while (i < steps.length) {
      var s = steps[i];
      var beamable = function (st) { return st.duration.value === 'eighth' || st.duration.value === 'sixteenth'; };
      if (!beamable(s)) { i++; continue; }
      var beat = Math.floor(s.startTick / bt), j = i;
      while (j + 1 < steps.length && beamable(steps[j + 1]) && Math.floor(steps[j + 1].startTick / bt) === beat &&
             Math.floor((steps[j].startTick + steps[j].durationTicks - 1) / bt) === beat) j++;
      for (var k = i; k <= j; k++) {
        info[k].beamLevels = steps[k].duration.value === 'sixteenth' ? 2 : 1;
        info[k].beam = i === j ? 'flag' : k === i ? 'start' : k === j ? 'end' : 'mid';
      }
      i = j + 1;
    }
    // triplet brackets: runs of tuplet steps, chunked so each bracket spans one tuplet group's worth of time
    i = 0;
    while (i < steps.length) {
      if (!steps[i].duration.tuplet) { i++; continue; }
      var target = M.durTicks({ value: steps[i].duration.value, dotted: false, tuplet: null }) * steps[i].duration.tuplet.normal, acc = 0, j2 = i;
      while (j2 < steps.length && steps[j2].duration.tuplet) {
        acc += steps[j2].durationTicks;
        if (acc >= target) break;
        j2++;
      }
      if (j2 >= steps.length) j2 = steps.length - 1;
      var mid = Math.floor((i + j2) / 2);
      for (var k2 = i; k2 <= j2; k2++) {
        info[k2].tup = i === j2 ? 'single' : k2 === i ? 'start' : k2 === j2 ? 'end' : 'mid';
        info[k2].tupLabel = k2 === mid ? String(steps[i].duration.tuplet.actual) : '';
      }
      i = j2 + 1;
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

  function renderEditor() {
    var tr = track(), labels = M.tuningLabels(tr.tuning), info = groups(tr), L = tr.loop;
    var frag = document.createDocumentFragment();
    var lab = document.createElement('div'); lab.className = 'labels';
    lab.innerHTML = '<div class="mh"></div>';
    labels.forEach(function (n) { var s = document.createElement('span'); s.textContent = n; lab.appendChild(s); });
    lab.insertAdjacentHTML('beforeend', '<div class="du">len</div><div class="bm"></div><div class="tp"></div>');
    frag.appendChild(lab);
    tr.steps.forEach(function (s, ci) {
      var g = info[ci], c = document.createElement('div');
      var inLoop = g.measure >= L.startMeasure && g.measure <= L.endMeasure;
      c.className = 'col' + (ci === cur.step ? ' cur' : '') + (g.barStart ? ' bar' : '') + (ci === playingStep ? ' playing' : '') +
        (inLoop ? (L.enabled ? ' loop' : ' loop-off') : '');
      c.setAttribute('role', 'row');
      var mh = document.createElement('div'); mh.className = 'mh';
      if (g.barStart) {
        var flags = (L.startMeasure === g.measure ? '⟦' : '') + g.measure + (L.endMeasure === g.measure ? '⟧' : '');
        mh.textContent = flags;
      }
      c.appendChild(mh);
      for (var si = 0; si < M.STRINGS; si++) {
        var ev = eventAt(s, si + 1), b = document.createElement('button');
        b.type = 'button';
        b.className = 'cell' + (ev ? ' has' : '') + (ev && ev.fret === null ? ' mute' : '') + (pickerOpen && ci === cur.step && si === cur.str ? ' sel' : '');
        b.dataset.col = ci; b.dataset.str = si;
        b.setAttribute('role', 'gridcell');
        b.setAttribute('aria-label', 'Step ' + (ci + 1) + ', ' + labels[si] + ' string, ' + (!ev ? 'empty' : ev.fret === null ? 'muted' : 'fret ' + ev.fret));
        var inner = document.createElement('b'); inner.textContent = cellText(ev); b.appendChild(inner);
        c.appendChild(b);
      }
      var du = document.createElement('div'); du.className = 'du'; du.textContent = M.durLabel(s.duration); c.appendChild(du);
      var bm = document.createElement('div'); bm.className = 'bm' + (g.beam ? ' b-' + g.beam + ' lv' + g.beamLevels : (s.duration.value !== 'whole' ? ' stem' : ''));
      bm.innerHTML = '<i></i><i></i>'; c.appendChild(bm);
      var tp = document.createElement('div'); tp.className = 'tp' + (g.tup ? ' t-' + g.tup : '');
      if (g.tupLabel) tp.innerHTML = '<em>' + g.tupLabel + '</em>';
      c.appendChild(tp);
      frag.appendChild(c);
    });
    els.editor.textContent = '';
    els.editor.appendChild(frag);
    var st = step();
    els.colInfo.textContent = 'Step ' + (cur.step + 1) + ' of ' + tr.steps.length + ' · measure ' + M.measureOfStep(tr, st);
    // step length controls
    Array.prototype.forEach.call(els.durChips.children, function (b) { b.classList.toggle('on', b.dataset.dur === st.duration.value); b.setAttribute('aria-checked', b.dataset.dur === st.duration.value); });
    setToggle(els.dotToggle, st.duration.dotted);
    setToggle(els.tripToggle, !!st.duration.tuplet);
    // loop controls
    setToggle(els.loopToggle, L.enabled);
    els.loopToggle.textContent = L.enabled ? 'Loop on' : 'Loop off';
    els.loopInfo.textContent = 'Measures ' + L.startMeasure + ' to ' + L.endMeasure + ' of ' + M.measureCount(tr);
  }
  function setToggle(b, on) { b.classList.toggle('on', !!on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }

  // Plain-text tab: barlines at measures, a length row under the strings.
  function toAscii(perLine) {
    var p = project(), lines = [];
    if (p.title) lines.push(p.title);
    p.tracks.forEach(function (tr) {
      var labels = M.tuningLabels(tr.tuning), w = Math.max.apply(null, labels.map(function (n) { return n.length; })), info = groups(tr);
      lines.push('');
      lines.push('[' + (tr.name || 'Track') + '] ' + (tr.tuning.name || '') + ' · ' + tr.timeSignature.join('/') + ' · ' + p.bpm + ' bpm' +
        (tr.loop.enabled ? ' · loop m' + tr.loop.startMeasure + '-' + tr.loop.endMeasure : ''));
      for (var start = 0; start < tr.steps.length; start += perLine) {
        var rows = labels.map(function (n) { return (n + '    ').slice(0, w) + '|'; });
        var dur = new Array(w + 2).join(' ');
        tr.steps.slice(start, start + perLine).forEach(function (s, k) {
          var g = info[start + k];
          if (g.barStart && k > 0) { rows = rows.map(function (r) { return r + '|'; }); dur += ' '; }
          var dl = M.durLabel(s.duration) + (s.duration.tuplet ? String(s.duration.tuplet.actual) : '');
          var texts = []; for (var si = 0; si < M.STRINGS; si++) texts.push(cellText(eventAt(s, si + 1)));
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
  function renderAscii() { els.ascii.textContent = toAscii(10); }

  function renderPicker() {
    var tr = track(), labels = M.tuningLabels(tr.tuning), st = step(), ev = eventAt(st, cur.str + 1);
    els.pickerSub.textContent = 'Step ' + (cur.step + 1) + ' · ' + labels[cur.str] + ' string (' + (cur.str + 1) + ')';
    Array.prototype.forEach.call(els.pickerStrings.children, function (b, i) {
      b.textContent = labels[i];
      b.classList.toggle('on', i === cur.str); b.setAttribute('aria-checked', i === cur.str ? 'true' : 'false');
      b.classList.toggle('has', !!eventAt(st, i + 1));
    });
    Array.prototype.forEach.call(els.neck.children, function (b) { b.classList.toggle('on', !!ev && ev.fret === Number(b.dataset.fret)); });
    els.pickMute.classList.toggle('on', !!ev && ev.fret === null);
    Array.prototype.forEach.call(els.pickerDur.children, function (b) { b.classList.toggle('on', b.dataset.dur === st.duration.value); });
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
      [els.durChips, els.pickerDur].forEach(function (host) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'chip'; b.dataset.dur = v; b.setAttribute('role', 'radio');
        b.innerHTML = '<b>' + M.DUR_LETTER[v] + '</b>' + (host === els.durChips ? '<small>' + v + '</small>' : '');
        b.setAttribute('aria-label', v + ' note');
        host.appendChild(b);
      });
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
  function setEvent(fret, muted) {
    var st = step(), no = cur.str + 1;
    st.events = st.events.filter(function (e) { return e.string !== no; });
    if (fret !== undefined) {
      st.events.push({ string: no, fret: muted ? null : fret, startTick: 0, durationTicks: 0, techniques: muted ? ['muted'] : [] });
      var tr = track();
      A.preview(tr.tuning.midi[cur.str] + (muted ? 0 : fret), muted);
    }
    changed();
  }
  function setDuration(patch) {
    var d = step().duration;
    if ('value' in patch) d.value = patch.value;
    if ('dotted' in patch) { d.dotted = patch.dotted; if (d.dotted) d.tuplet = null; }
    if ('tuplet' in patch) { d.tuplet = patch.tuplet; if (d.tuplet) d.dotted = false; }
    changed();
  }
  function moveStep(dlt) { cur.step += dlt; clampCur(); render(); scrollToCur(); }
  function nextStep() {
    var tr = track();
    if (cur.step === tr.steps.length - 1 && tr.steps.length < M.LIMITS.steps) { tr.steps.push(M.newStep(step().duration)); M.recompute(tr); save(); }
    moveStep(1);
  }
  function scrollToCur(idx) {
    var col = els.editor.children[(idx == null ? cur.step : idx) + 1];
    if (!col) return;
    var wrap = els.editorWrap, labelsW = els.editor.children[0] ? els.editor.children[0].offsetWidth : 40, left = col.offsetLeft - labelsW - 4, right = col.offsetLeft + col.offsetWidth;
    if (left < wrap.scrollLeft) wrap.scrollLeft = left;
    else if (right > wrap.scrollLeft + wrap.clientWidth) wrap.scrollLeft = right - wrap.clientWidth + 8;
  }
  function openPicker(col, str) {
    cur.step = col; cur.str = str; pickerOpen = true;
    els.picker.hidden = false; els.scrim.hidden = false;
    render(); scrollToCur();
  }
  function closePicker() {
    pickerOpen = false; els.picker.hidden = true; els.scrim.hidden = true; render();
    var cell = els.editor.querySelector('.cell[data-col="' + cur.step + '"][data-str="' + cur.str + '"]');
    if (cell) cell.focus({ preventScroll: true });
  }

  // ---------- playback ----------
  function playRange() {
    var tr = track(), L = tr.loop;
    if (L.enabled) {
      var idx = [];
      tr.steps.forEach(function (s, i) { var m = M.measureOfStep(tr, s); if (m >= L.startMeasure && m <= L.endMeasure) idx.push(i); });
      if (idx.length) return { from: idx[0], count: idx.length, loop: true };
    }
    return { from: cur.step, count: tr.steps.length - cur.step, loop: false };
  }
  function togglePlay() {
    if (A.isPlaying()) { stopPlay(); return; }
    var tr = track(), p = project(), r = playRange();
    var ok = A.play({
      count: r.count, loop: r.loop, ppq: M.PPQ,
      bpm: function () { return p.bpm; },
      stepAt: function (i) {
        var s = tr.steps[r.from + i];
        if (!s) return { ticks: M.PPQ, notes: [] };
        return { ticks: s.durationTicks, notes: s.events.map(function (e) { return { midi: tr.tuning.midi[e.string - 1] + (e.fret || 0), muted: e.fret === null }; }) };
      },
      onStep: function (i) {
        playingStep = i === null ? null : r.from + i;
        if (i === null) els.playBtn.textContent = '▶ Play';
        markPlaying(); if (playingStep !== null) scrollToCur(playingStep);
      }
    });
    if (ok) els.playBtn.textContent = '■ Stop'; else toast('Audio is not available in this browser');
  }
  function stopPlay() { A.stop(); playingStep = null; els.playBtn.textContent = '▶ Play'; markPlaying(); }
  function markPlaying() {
    Array.prototype.forEach.call(els.editor.children, function (c, k) { if (k) c.classList.toggle('playing', k - 1 === playingStep); });
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
          cur = { step: 0, str: 0 }; stopPlay(); changed();
          toast((choice === 'merge' ? 'Merged ' : 'Replaced with ') + n + ' project' + (n > 1 ? 's' : ''));
        });
    };
    r.onerror = function () { toast('Could not read that file.'); };
    r.readAsText(file);
  }

  // ---------- events ----------
  function on(id, ev, fn) { $(id).addEventListener(ev, fn); }
  function bind() {
    els.projectSelect.addEventListener('change', function () { stopPlay(); lib.activeProjectId = els.projectSelect.value; cur = { step: 0, str: 0 }; save(); render(); });
    on('project-new', 'click', function () {
      stopPlay(); var p = M.newProject(''); lib.projects.push(p); lib.activeProjectId = p.id; cur = { step: 0, str: 0 }; changed();
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
      lib.activeProjectId = lib.projects[0].id; cur = { step: 0, str: 0 }; changed();
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
      cur = { step: 0, str: 0 }; changed();
    });
    els.trackName.addEventListener('input', function () { track().name = els.trackName.value.slice(0, M.LIMITS.name); save(); renderAscii(); });
    els.trackName.addEventListener('change', renderProjectBar);
    on('track-del', 'click', function () {
      var p = project(), t = track();
      if (p.tracks.length <= 1) { toast('A project needs at least one track'); return; }
      if (!confirm('Delete track "' + (t.name || 'Untitled') + '"?')) return;
      stopPlay(); p.tracks = p.tracks.filter(function (x) { return x.id !== t.id; }); p.activeTrackId = p.tracks[0].id; cur = { step: 0, str: 0 }; changed();
    });
    els.tuning.addEventListener('change', function () { if (els.tuning.value !== 'custom') { track().tuning = M.tuningFromId(els.tuning.value); changed(); } });
    els.timesig.addEventListener('change', function () { track().timeSignature = els.timesig.value.split('/').map(Number); changed(); });

    els.editor.addEventListener('click', function (e) { var b = e.target.closest('.cell'); if (b) openPicker(Number(b.dataset.col), Number(b.dataset.str)); });
    els.neck.addEventListener('click', function (e) { var b = e.target.closest('.frow'); if (b) setEvent(Number(b.dataset.fret), false); });
    els.pickerStrings.addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (b) { cur.str = Number(b.dataset.str); render(); } });
    [els.durChips, els.pickerDur].forEach(function (h) { h.addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (b) setDuration({ value: b.dataset.dur }); }); });
    els.dotToggle.addEventListener('click', function () { setDuration({ dotted: !step().duration.dotted }); });
    els.tripToggle.addEventListener('click', function () { setDuration({ tuplet: step().duration.tuplet ? null : { actual: 3, normal: 2 } }); });
    els.pickMute.addEventListener('click', function () { setEvent(0, true); });
    on('pick-clear', 'click', function () { setEvent(undefined); });
    on('picker-next', 'click', nextStep);
    on('picker-done', 'click', closePicker);
    els.scrim.addEventListener('click', closePicker);

    on('prev-col', 'click', function () { moveStep(-1); });
    on('next-col', 'click', function () { moveStep(1); });
    on('add-col', 'click', function () {
      var tr = track(); if (tr.steps.length >= M.LIMITS.steps) return;
      tr.steps.splice(cur.step + 1, 0, M.newStep(step().duration)); cur.step++; changed({ scroll: true });
    });
    on('add-measure', 'click', function () {
      var tr = track(), mt = M.measureTicks(tr), eighths = tr.timeSignature[1] === 8;
      var unit = eighths ? { value: 'eighth', dotted: false, tuplet: null } : { value: 'quarter', dotted: false, tuplet: null };
      // First fill out an unfinished last measure (biggest lengths first), then add one full measure.
      var gap = (mt - tr.lengthTicks % mt) % mt;
      ['quarter', 'eighth', 'sixteenth'].forEach(function (v) {
        var d = { value: v, dotted: false, tuplet: null }, t = M.durTicks(d);
        while (gap >= t && tr.steps.length < M.LIMITS.steps) { tr.steps.push(M.newStep(d)); gap -= t; }
      });
      var first = tr.steps.length, n = Math.round(mt / M.durTicks(unit));
      for (var i = 0; i < n && tr.steps.length < M.LIMITS.steps; i++) tr.steps.push(M.newStep(unit));
      cur.step = Math.min(first, tr.steps.length - 1); changed({ scroll: true });
    });
    on('del-col', 'click', function () {
      var tr = track();
      if (tr.steps.length <= 1) { tr.steps[0].events = []; changed(); return; }
      tr.steps.splice(cur.step, 1); changed();
    });
    on('clear-col', 'click', function () { step().events = []; changed(); });

    els.playBtn.addEventListener('click', togglePlay);
    var setBpm = function (v) { var p = project(); p.bpm = Math.max(30, Math.min(300, Math.round(v) || 90)); els.bpm.value = p.bpm; save(); renderAscii(); };
    on('bpm-down', 'click', function () { setBpm(project().bpm - 5); });
    on('bpm-up', 'click', function () { setBpm(project().bpm + 5); });
    els.bpm.addEventListener('change', function () { setBpm(Number(els.bpm.value)); });
    els.loopToggle.addEventListener('click', function () { var L = track().loop; L.enabled = !L.enabled; if (A.isPlaying()) stopPlay(); changed(); });
    on('loop-start', 'click', function () { var tr = track(), m = M.measureOfStep(tr, step()); tr.loop.startMeasure = m; if (tr.loop.endMeasure < m) tr.loop.endMeasure = m; changed(); });
    on('loop-end', 'click', function () { var tr = track(), m = M.measureOfStep(tr, step()); tr.loop.endMeasure = m; if (tr.loop.startMeasure > m) tr.loop.startMeasure = m; changed(); });

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
      else if (k === 'ArrowLeft') { moveStep(-1); e.preventDefault(); }
      else if (k === 'ArrowRight') { moveStep(1); e.preventDefault(); }
      else if (k === 'ArrowUp' && pickerOpen) { cur.str = Math.max(0, cur.str - 1); render(); e.preventDefault(); }
      else if (k === 'ArrowDown' && pickerOpen) { cur.str = Math.min(M.STRINGS - 1, cur.str + 1); render(); e.preventDefault(); }
      else if (!pickerOpen) return;
      else if (/^[0-9]$/.test(k)) {
        buf += k; clearTimeout(bufT); var n = Number(buf); if (n > M.MAX_FRET) { buf = k; n = Number(k); }
        setEvent(n, false); bufT = setTimeout(function () { buf = ''; }, 700);
      } else if (k === 'x' || k === 'X') setEvent(0, true);
      else if (k === 'Backspace' || k === 'Delete') { setEvent(undefined); e.preventDefault(); }
    });
    // Another window of this site saved: pick up its library.
    window.addEventListener('storage', function (e) {
      if (e.key !== STORE_KEY || A.isPlaying()) return;
      var r = loadLibrary(); if (!r.restored) return;
      lib = r.lib; clampCur(); render();
    });
  }

  function init() {
    buildStatic();
    var r = loadLibrary();
    lib = r.lib;
    bind();
    if (canShareFiles()) els.shareBtn.hidden = false;
    render();
    if (r.restored) {
      var d = new Date(project().updatedAt);
      els.saveState.textContent = 'Restored · ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      els.saveState.className = 'save-state ok';
    } else save();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(function () {});
  }

  // Read-only hook for automated checks.
  window.__guitarTab = { get library() { return JSON.parse(JSON.stringify(lib)); }, toAscii: function () { return toAscii(16); }, audioState: A.state, isPlaying: A.isPlaying };
  init();
})();
