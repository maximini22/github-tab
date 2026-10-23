/* Guitar Tab data model. MIDI-ready: ticks at a fixed PPQ, tuning as MIDI note numbers.
 * See README "Data model" for the schema. Exposed as window.TabModel. */
(function () {
  'use strict';
  var SCHEMA = 'jlr-guitar-tab';
  var SCHEMA_VERSION = 3;
  var PPQ = 480;
  var STRINGS = 6;
  var MAX_FRET = 16;
  var LIMITS = { projects: 500, tracks: 32, measures: 999, notes: 20000, title: 120, name: 60 };

  // MIDI notes listed string 1 (highest) to string 6 (lowest), the same order as the tab rows.
  var TUNINGS = [
    { id: 'standard', name: 'Standard (EADGBE)', midi: [64, 59, 55, 50, 45, 40], labels: ['e', 'B', 'G', 'D', 'A', 'E'] },
    { id: 'drop-d', name: 'Drop D (DADGBE)', midi: [64, 59, 55, 50, 45, 38], labels: ['e', 'B', 'G', 'D', 'A', 'D'] },
    { id: 'drop-c', name: 'Drop C (CGCFAD)', midi: [62, 57, 53, 48, 43, 36], labels: ['d', 'A', 'F', 'C', 'G', 'C'] },
    { id: 'd-standard', name: 'D Standard (DGCFAD)', midi: [62, 57, 53, 48, 43, 38], labels: ['d', 'A', 'F', 'C', 'G', 'D'] },
    { id: 'eb-standard', name: 'Eb / half-step down', midi: [63, 58, 54, 49, 44, 39], labels: ['eb', 'Bb', 'Gb', 'Db', 'Ab', 'Eb'] },
    { id: 'open-g', name: 'Open G (DGDGBD)', midi: [62, 59, 55, 50, 43, 38], labels: ['d', 'B', 'G', 'D', 'G', 'D'] },
    { id: 'open-d', name: 'Open D (DADF#AD)', midi: [62, 57, 54, 50, 45, 38], labels: ['d', 'A', 'F#', 'D', 'A', 'D'] },
    { id: 'dadgad', name: 'DADGAD', midi: [62, 57, 55, 50, 45, 38], labels: ['d', 'A', 'G', 'D', 'A', 'D'] }
  ];
  var TUNING_BY_ID = {};
  TUNINGS.forEach(function (t) { TUNING_BY_ID[t.id] = t; });

  // Length of each base value in quarter notes.
  var DUR_VALUES = ['whole', 'half', 'quarter', 'eighth', 'sixteenth'];
  var DUR_QUARTERS = { whole: 4, half: 2, quarter: 1, eighth: 0.5, sixteenth: 0.25 };
  var DUR_LETTER = { whole: 'W', half: 'H', quarter: 'Q', eighth: 'E', sixteenth: 'S' };
  var TIME_SIGS = ['4/4', '3/4', '2/4', '6/8'];
  var TECHNIQUES = ['muted', 'hammer-on', 'pull-off', 'slide', 'bend', 'vibrato', 'palm-mute', 'harmonic', 'tap', 'let-ring'];

  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function nowIso() { return new Date().toISOString(); }

  function durTicks(d) {
    var t = PPQ * DUR_QUARTERS[d.value];
    if (d.dotted) t *= 1.5;
    if (d.tuplet) t = t * d.tuplet.normal / d.tuplet.actual;
    return Math.round(t);
  }
  function durLabel(d) { return DUR_LETTER[d.value] + (d.dotted ? '.' : ''); }
  function measureTicks(track) { var ts = track.timeSignature; return Math.round(ts[0] * PPQ * 4 / ts[1]); }
  function beatTicks(track) {
    var ts = track.timeSignature;
    return (ts[1] === 8 && ts[0] % 3 === 0) ? PPQ * 1.5 : Math.round(PPQ * 4 / ts[1]);
  }
  function tuningLabels(t) {
    var p = TUNING_BY_ID[t.id];
    if (p && p.midi.join() === t.midi.join()) return p.labels;
    var N = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return t.midi.map(function (m) { return N[m % 12]; });
  }
  function tuningFromId(id) { var p = TUNING_BY_ID[id] || TUNINGS[0]; return { id: p.id, name: p.name, midi: p.midi.slice() }; }

  function copyDur(d) { return { value: d.value, dotted: !!d.dotted, tuplet: d.tuplet ? { actual: d.tuplet.actual, normal: d.tuplet.normal } : null }; }
  function defaultGrid() { return { value: 'eighth', dotted: false, tuplet: null }; }

  // Every standard length a note's spacing can be named as (for the rhythm row and the text tab).
  var NAMED = [];
  DUR_VALUES.forEach(function (v) {
    [{ dotted: false, tuplet: null }, { dotted: true, tuplet: null }, { dotted: false, tuplet: { actual: 3, normal: 2 } }].forEach(function (x) {
      var d = { value: v, dotted: x.dotted, tuplet: x.tuplet }; NAMED.push({ d: d, ticks: durTicks(d) });
    });
  });
  function nameTicks(t) { for (var i = 0; i < NAMED.length; i++) if (NAMED[i].ticks === t) return copyDur(NAMED[i].d); return null; }

  function newTrack(name, tuningId) {
    var t = { id: uid(), name: name || 'Guitar', tuning: tuningFromId(tuningId || 'standard'), timeSignature: [4, 4],
      loop: { enabled: false, startMeasure: 1, endMeasure: 1 }, lengthTicks: 0, notes: [] };
    t.lengthTicks = measureTicks(t) * 2;
    return recompute(t);
  }
  function newProject(title) {
    var tr = newTrack('Guitar');
    var now = nowIso();
    return { id: uid(), title: title || '', bpm: 90, grid: defaultGrid(), createdAt: now, updatedAt: now, activeTrackId: tr.id, tracks: [tr] };
  }
  function newLibrary() {
    var p = newProject('');
    return { schema: SCHEMA, schemaVersion: SCHEMA_VERSION, ppq: PPQ, activeProjectId: p.id, projects: [p] };
  }

  // Keep derived data in sync. Notes are sorted by time then string; a note lasts until the next
  // note starts anywhere on the timeline, capped at one bar and at the end of the track.
  function recompute(track) {
    var mt = measureTicks(track);
    var notes = track.notes;
    notes.sort(function (a, b) { return a.startTick - b.startTick || a.string - b.string; });
    var last = notes.length ? notes[notes.length - 1].startTick : 0;
    var need = Math.max(mt, Math.ceil((last + 1) / mt) * mt);
    track.lengthTicks = Math.max(need, Math.ceil((track.lengthTicks || mt) / mt) * mt);
    if (track.lengthTicks > mt * LIMITS.measures) track.lengthTicks = mt * LIMITS.measures;
    var onsets = []; notes.forEach(function (n) { if (onsets[onsets.length - 1] !== n.startTick) onsets.push(n.startTick); });
    var k = 0;
    notes.forEach(function (n) {
      while (k < onsets.length && onsets[k] <= n.startTick) k++;
      var next = k < onsets.length ? onsets[k] : track.lengthTicks;
      n.durationTicks = Math.max(1, Math.min(next - n.startTick, mt, track.lengthTicks - n.startTick));
    });
    var mc = measureCount(track), L = track.loop;
    L.startMeasure = clampInt(L.startMeasure, 1, mc);
    L.endMeasure = clampInt(L.endMeasure, L.startMeasure, mc);
    return track;
  }
  function measureCount(track) { return Math.max(1, Math.ceil((track.lengthTicks || 0) / measureTicks(track))); }
  function measureOfTick(track, t) { return Math.floor(t / measureTicks(track)) + 1; }
  function clampInt(v, lo, hi) { v = Math.round(Number(v)); if (!isFinite(v)) v = lo; return Math.max(lo, Math.min(hi, v)); }

  // Grid cells for a track at a resolution. Cells restart at every barline, so a dotted grid that
  // does not divide the bar ends with one shorter cell. Returns [{start, len, measure}].
  function cells(track, grid) {
    var mt = measureTicks(track), g = durTicks(grid), out = [];
    for (var m0 = 0; m0 < track.lengthTicks; m0 += mt) {
      for (var t = 0; t < mt; t += g) out.push({ start: m0 + t, len: Math.min(g, mt - t), measure: m0 / mt + 1 });
    }
    return out;
  }
  function cellIndexAt(cl, tick) {
    var lo = 0, hi = cl.length - 1;
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (cl[mid].start <= tick) lo = mid; else hi = mid - 1; }
    return lo;
  }

  // ---------- validation ----------
  function isInt(v, lo, hi) { return typeof v === 'number' && v % 1 === 0 && v >= lo && v <= hi; }
  function checkDur(d, where) {
    if (!d || DUR_VALUES.indexOf(d.value) < 0) return where + ': unknown note length.';
    if (d.tuplet != null && !(d.tuplet && isInt(d.tuplet.actual, 2, 9) && isInt(d.tuplet.normal, 1, 8))) return where + ': bad tuplet.';
    return null;
  }
  function checkEvent(ev, w) {
    if (!ev || !isInt(ev.string, 1, STRINGS)) return w + ': bad string.';
    if (!(ev.fret === null || isInt(ev.fret, 0, MAX_FRET))) return w + ': fret must be 0 to ' + MAX_FRET + '.';
    if (!Array.isArray(ev.techniques) || ev.techniques.length > 10 || !ev.techniques.every(function (x) { return typeof x === 'string' && x.length <= 30; })) return w + ': bad techniques.';
    if (ev.fret === null && ev.techniques.indexOf('muted') < 0) return w + ': a note with no fret must be muted.';
    return null;
  }
  function checkTrackBase(t, where) {
    if (!t || typeof t !== 'object') return where + ' is not a track.';
    if (typeof t.name !== 'string' || t.name.length > 200) return where + ': bad name.';
    if (!t.tuning || !Array.isArray(t.tuning.midi) || t.tuning.midi.length !== STRINGS || !t.tuning.midi.every(function (m) { return isInt(m, 0, 127 - MAX_FRET); })) return where + ': tuning must be 6 MIDI notes.';
    if (!Array.isArray(t.timeSignature) || TIME_SIGS.indexOf(t.timeSignature.join('/')) < 0) return where + ': unsupported time signature.';
    return null;
  }
  // schemaVersion 2: steps with a duration each, events inside.
  function checkTrackV2(t, where) {
    var e0 = checkTrackBase(t, where); if (e0) return e0;
    if (!Array.isArray(t.steps) || t.steps.length < 1 || t.steps.length > 4000) return where + ': needs 1 to 4000 steps.';
    for (var i = 0; i < t.steps.length; i++) {
      var s = t.steps[i], w = where + ' step ' + (i + 1);
      var e = checkDur(s && s.duration, w); if (e) return e;
      if (!Array.isArray(s.events) || s.events.length > STRINGS) return w + ': bad events.';
      var seen = {};
      for (var j = 0; j < s.events.length; j++) {
        var ee = checkEvent(s.events[j], w); if (ee) return ee;
        if (seen[s.events[j].string]) return w + ': repeated string.'; seen[s.events[j].string] = 1;
      }
    }
    return null;
  }
  // schemaVersion 3: absolute-tick notes.
  function checkTrackV3(t, where) {
    var e0 = checkTrackBase(t, where); if (e0) return e0;
    var maxT = measureTicks(t) * LIMITS.measures;
    if (!isInt(t.lengthTicks, 1, maxT)) return where + ': bad lengthTicks.';
    if (!Array.isArray(t.notes) || t.notes.length > LIMITS.notes) return where + ': bad notes.';
    var seen = {};
    for (var i = 0; i < t.notes.length; i++) {
      var n = t.notes[i], w = where + ' note ' + (i + 1);
      var e = checkEvent(n, w); if (e) return e;
      if (!isInt(n.startTick, 0, maxT - 1)) return w + ': bad startTick.';
      var key = n.string + ':' + n.startTick; if (seen[key]) return w + ': two notes on one string at the same time.'; seen[key] = 1;
    }
    return null;
  }
  function checkProject(p, where, v) {
    if (!p || typeof p !== 'object') return where + ' is not a project.';
    if (typeof p.id !== 'string' || !p.id || p.id.length > 64) return where + ': missing id.';
    if (typeof p.title !== 'string' || p.title.length > 200) return where + ': bad title.';
    if (!Array.isArray(p.tracks) || p.tracks.length < 1 || p.tracks.length > LIMITS.tracks) return where + ': needs 1 to ' + LIMITS.tracks + ' tracks.';
    if (v >= 3 && p.grid != null) { var g = checkDur(p.grid, where + ' grid'); if (g) return g; }
    for (var i = 0; i < p.tracks.length; i++) {
      var e = (v >= 3 ? checkTrackV3 : checkTrackV2)(p.tracks[i], where + ' track ' + (i + 1)); if (e) return e;
    }
    return null;
  }
  // Returns { error } or { projects, kind, migratedFrom } with normalised, recomputed v3 data.
  // Reads v3, upgrades v2 (steps with durations) and v1 (single-tab scaffold) files.
  function parseFile(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { error: 'Not a tab file.' };
    if (obj.schema !== SCHEMA) return { error: 'This is not a Guitar Tab file.' };
    if (obj.schemaVersion == null && obj.version === 1) return migrateV1(obj);
    if (!isInt(obj.schemaVersion, 2, 1000)) return { error: 'Missing or unsupported schemaVersion.' };
    var v = obj.schemaVersion;
    if (v > SCHEMA_VERSION) return { error: 'Made by a newer version (schemaVersion ' + v + ').' };
    if (obj.ppq !== PPQ) return { error: 'Unsupported ppq ' + obj.ppq + ' (expected ' + PPQ + ').' };
    if (!Array.isArray(obj.projects) || obj.projects.length < 1 || obj.projects.length > LIMITS.projects) return { error: 'No projects in file.' };
    for (var i = 0; i < obj.projects.length; i++) { var e = checkProject(obj.projects[i], 'Project ' + (i + 1), v); if (e) return { error: e }; }
    var projects = obj.projects.map(function (p) { return v === 2 ? normaliseProject(upgradeV2Project(p)) : normaliseProject(p); });
    return { kind: obj.kind === 'library' ? 'library' : 'project', projects: projects, activeProjectId: obj.activeProjectId, migratedFrom: v < SCHEMA_VERSION ? v : null };
  }
  // v2 -> v3: each step's events become notes at the step's absolute start tick. The project grid
  // becomes its most common step length. Loop measures and everything else carry over.
  function upgradeV2Project(p) {
    var counts = {}, best = null;
    var tracks = p.tracks.map(function (t) {
      var tick = 0, notes = [];
      t.steps.forEach(function (s) {
        var d = copyDur(s.duration), k = JSON.stringify(d);
        counts[k] = (counts[k] || 0) + 1;
        if (!best || counts[k] > counts[best]) best = k;
        s.events.forEach(function (e) { notes.push({ string: e.string, fret: e.fret, startTick: tick, durationTicks: 0, techniques: e.techniques.slice() }); });
        tick += durTicks(d);
      });
      var mt = measureTicks(t);
      return { id: t.id, name: t.name, tuning: t.tuning, timeSignature: t.timeSignature, loop: t.loop,
        lengthTicks: Math.max(mt, Math.min(mt * LIMITS.measures, Math.ceil(tick / mt) * mt)), notes: notes };
    });
    var out = {}; for (var key in p) out[key] = p[key];
    out.tracks = tracks; out.grid = best ? JSON.parse(best) : defaultGrid();
    return out;
  }
  function normaliseProject(p) {
    var now = nowIso();
    var tracks = p.tracks.map(function (t) {
      var tr = {
        id: typeof t.id === 'string' && t.id ? t.id.slice(0, 64) : uid(),
        name: t.name.slice(0, LIMITS.name),
        tuning: { id: typeof t.tuning.id === 'string' ? t.tuning.id.slice(0, 40) : 'custom', name: typeof t.tuning.name === 'string' ? t.tuning.name.slice(0, 60) : 'Custom', midi: t.tuning.midi.slice() },
        timeSignature: t.timeSignature.slice(),
        loop: { enabled: !!(t.loop && t.loop.enabled), startMeasure: (t.loop && t.loop.startMeasure) || 1, endMeasure: (t.loop && t.loop.endMeasure) || 1 },
        lengthTicks: t.lengthTicks,
        notes: t.notes.map(function (n) { return { string: n.string, fret: n.fret, startTick: n.startTick, durationTicks: 0, techniques: n.techniques.slice(0, 10) }; })
      };
      return recompute(tr);
    });
    var active = tracks.some(function (t) { return t.id === p.activeTrackId; }) ? p.activeTrackId : tracks[0].id;
    return { id: p.id, title: p.title.slice(0, LIMITS.title), bpm: clampInt(p.bpm || 90, 30, 300), grid: p.grid ? copyDur(p.grid) : defaultGrid(),
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : now, updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : now,
      activeTrackId: active, tracks: tracks };
  }
  // v1 scaffold files: { schema, version: 1, title, tuning: id, columns: [[6 values string 1..6]] }, every column a quarter note.
  function migrateV1(obj) {
    if (!TUNING_BY_ID[obj.tuning] || !Array.isArray(obj.columns) || !obj.columns.length || obj.columns.length > 4000) return { error: 'Old tab file is damaged.' };
    var tr = newTrack('Guitar', obj.tuning);
    for (var i = 0; i < obj.columns.length; i++) {
      var c = obj.columns[i];
      if (!Array.isArray(c) || c.length !== STRINGS) return { error: 'Old tab file is damaged.' };
      c.forEach(function (v, si) {
        if (v === 'x') tr.notes.push({ string: si + 1, fret: null, startTick: i * PPQ, durationTicks: 0, techniques: ['muted'] });
        else if (isInt(v, 0, MAX_FRET)) tr.notes.push({ string: si + 1, fret: v, startTick: i * PPQ, durationTicks: 0, techniques: [] });
      });
    }
    tr.lengthTicks = Math.ceil(obj.columns.length * PPQ / measureTicks(tr)) * measureTicks(tr);
    recompute(tr);
    var p = newProject(typeof obj.title === 'string' ? obj.title.slice(0, LIMITS.title) : '');
    p.grid = { value: 'quarter', dotted: false, tuplet: null };
    p.tracks = [tr]; p.activeTrackId = tr.id;
    if (typeof obj.createdAt === 'string') p.createdAt = obj.createdAt;
    return { kind: 'project', projects: [p], migratedFrom: 1 };
  }

  function midiOf(track, ev) { return ev.fret === null ? null : track.tuning.midi[ev.string - 1] + ev.fret; }

  window.TabModel = {
    SCHEMA: SCHEMA, SCHEMA_VERSION: SCHEMA_VERSION, PPQ: PPQ, STRINGS: STRINGS, MAX_FRET: MAX_FRET, LIMITS: LIMITS,
    TUNINGS: TUNINGS, TUNING_BY_ID: TUNING_BY_ID, DUR_VALUES: DUR_VALUES, DUR_LETTER: DUR_LETTER, TIME_SIGS: TIME_SIGS, TECHNIQUES: TECHNIQUES,
    uid: uid, nowIso: nowIso, durTicks: durTicks, durLabel: durLabel, copyDur: copyDur, nameTicks: nameTicks, defaultGrid: defaultGrid,
    measureTicks: measureTicks, beatTicks: beatTicks, tuningLabels: tuningLabels, tuningFromId: tuningFromId,
    newTrack: newTrack, newProject: newProject, newLibrary: newLibrary, recompute: recompute, measureCount: measureCount,
    measureOfTick: measureOfTick, cells: cells, cellIndexAt: cellIndexAt, parseFile: parseFile, normaliseProject: normaliseProject, midiOf: midiOf
  };
})();
