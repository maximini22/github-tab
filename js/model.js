/* Guitar Tab data model. MIDI-ready: ticks at a fixed PPQ, tuning as MIDI note numbers.
 * See README "Data model" for the schema. Exposed as window.TabModel. */
(function () {
  'use strict';
  var SCHEMA = 'jlr-guitar-tab';
  var SCHEMA_VERSION = 2;
  var PPQ = 480;
  var STRINGS = 6;
  var MAX_FRET = 16;
  var LIMITS = { projects: 500, tracks: 32, steps: 4000, title: 120, name: 60 };

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

  function newStep(duration) {
    return { id: uid(), duration: duration ? copyDur(duration) : { value: 'quarter', dotted: false, tuplet: null }, startTick: 0, durationTicks: 0, events: [] };
  }
  function copyDur(d) { return { value: d.value, dotted: !!d.dotted, tuplet: d.tuplet ? { actual: d.tuplet.actual, normal: d.tuplet.normal } : null }; }
  function newTrack(name, tuningId) {
    var t = { id: uid(), name: name || 'Guitar', tuning: tuningFromId(tuningId || 'standard'), timeSignature: [4, 4],
      loop: { enabled: false, startMeasure: 1, endMeasure: 1 }, steps: [] };
    for (var i = 0; i < 8; i++) t.steps.push(newStep());
    return recompute(t);
  }
  function newProject(title) {
    var tr = newTrack('Guitar');
    var now = nowIso();
    return { id: uid(), title: title || '', bpm: 90, createdAt: now, updatedAt: now, activeTrackId: tr.id, tracks: [tr] };
  }
  function newLibrary() {
    var p = newProject('');
    return { schema: SCHEMA, schemaVersion: SCHEMA_VERSION, ppq: PPQ, activeProjectId: p.id, projects: [p] };
  }

  // Keep derived timing in sync: startTick/durationTicks on steps and on every event.
  function recompute(track) {
    var tick = 0;
    track.steps.forEach(function (s) {
      s.durationTicks = durTicks(s.duration);
      s.startTick = tick;
      s.events.sort(function (a, b) { return a.string - b.string; });
      s.events.forEach(function (e) { e.startTick = tick; e.durationTicks = s.durationTicks; });
      tick += s.durationTicks;
    });
    track.lengthTicks = tick;
    var mc = measureCount(track);
    var L = track.loop;
    L.startMeasure = clampInt(L.startMeasure, 1, mc);
    L.endMeasure = clampInt(L.endMeasure, L.startMeasure, mc);
    return track;
  }
  function measureCount(track) { return Math.max(1, Math.ceil((track.lengthTicks || 0) / measureTicks(track))); }
  function measureOfStep(track, step) { return Math.floor(step.startTick / measureTicks(track)) + 1; }
  function clampInt(v, lo, hi) { v = Math.round(Number(v)); if (!isFinite(v)) v = lo; return Math.max(lo, Math.min(hi, v)); }

  // ---------- validation ----------
  function isInt(v, lo, hi) { return typeof v === 'number' && v % 1 === 0 && v >= lo && v <= hi; }
  function checkDur(d, where) {
    if (!d || DUR_VALUES.indexOf(d.value) < 0) return where + ': unknown note length.';
    if (d.tuplet != null && !(d.tuplet && isInt(d.tuplet.actual, 2, 9) && isInt(d.tuplet.normal, 1, 8))) return where + ': bad tuplet.';
    return null;
  }
  function checkTrack(t, where) {
    if (!t || typeof t !== 'object') return where + ' is not a track.';
    if (typeof t.name !== 'string' || t.name.length > 200) return where + ': bad name.';
    if (!t.tuning || !Array.isArray(t.tuning.midi) || t.tuning.midi.length !== STRINGS || !t.tuning.midi.every(function (m) { return isInt(m, 0, 127 - MAX_FRET); })) return where + ': tuning must be 6 MIDI notes.';
    if (!Array.isArray(t.timeSignature) || TIME_SIGS.indexOf(t.timeSignature.join('/')) < 0) return where + ': unsupported time signature.';
    if (!Array.isArray(t.steps) || t.steps.length < 1 || t.steps.length > LIMITS.steps) return where + ': needs 1 to ' + LIMITS.steps + ' steps.';
    for (var i = 0; i < t.steps.length; i++) {
      var s = t.steps[i], w = where + ' step ' + (i + 1);
      var e = checkDur(s && s.duration, w); if (e) return e;
      if (!Array.isArray(s.events) || s.events.length > STRINGS) return w + ': bad events.';
      var seen = {};
      for (var j = 0; j < s.events.length; j++) {
        var ev = s.events[j];
        if (!ev || !isInt(ev.string, 1, STRINGS) || seen[ev.string]) return w + ': bad or repeated string.';
        seen[ev.string] = 1;
        if (!(ev.fret === null || isInt(ev.fret, 0, MAX_FRET))) return w + ': fret must be 0 to ' + MAX_FRET + '.';
        if (!Array.isArray(ev.techniques) || !ev.techniques.every(function (x) { return typeof x === 'string' && x.length <= 30; })) return w + ': bad techniques.';
        if (ev.fret === null && ev.techniques.indexOf('muted') < 0) return w + ': a note with no fret must be muted.';
      }
    }
    return null;
  }
  function checkProject(p, where) {
    if (!p || typeof p !== 'object') return where + ' is not a project.';
    if (typeof p.id !== 'string' || !p.id || p.id.length > 64) return where + ': missing id.';
    if (typeof p.title !== 'string' || p.title.length > 200) return where + ': bad title.';
    if (!Array.isArray(p.tracks) || p.tracks.length < 1 || p.tracks.length > LIMITS.tracks) return where + ': needs 1 to ' + LIMITS.tracks + ' tracks.';
    for (var i = 0; i < p.tracks.length; i++) { var e = checkTrack(p.tracks[i], where + ' track ' + (i + 1)); if (e) return e; }
    return null;
  }
  // Returns { error } or { projects, kind } with normalised, recomputed data. Accepts v1 single-tab files too.
  function parseFile(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { error: 'Not a tab file.' };
    if (obj.schema !== SCHEMA) return { error: 'This is not a Guitar Tab file.' };
    if (obj.schemaVersion == null && obj.version === 1) return migrateV1(obj);
    if (!isInt(obj.schemaVersion, 1, 1000)) return { error: 'Missing schemaVersion.' };
    if (obj.schemaVersion > SCHEMA_VERSION) return { error: 'Made by a newer version (schemaVersion ' + obj.schemaVersion + ').' };
    if (obj.ppq !== PPQ) return { error: 'Unsupported ppq ' + obj.ppq + ' (expected ' + PPQ + ').' };
    if (!Array.isArray(obj.projects) || obj.projects.length < 1 || obj.projects.length > LIMITS.projects) return { error: 'No projects in file.' };
    for (var i = 0; i < obj.projects.length; i++) { var e = checkProject(obj.projects[i], 'Project ' + (i + 1)); if (e) return { error: e }; }
    return { kind: obj.kind === 'library' ? 'library' : 'project', projects: obj.projects.map(normaliseProject), activeProjectId: obj.activeProjectId };
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
        steps: t.steps.map(function (s) {
          return { id: typeof s.id === 'string' && s.id ? s.id.slice(0, 64) : uid(), duration: copyDur(s.duration), startTick: 0, durationTicks: 0,
            events: s.events.map(function (e) { return { string: e.string, fret: e.fret, startTick: 0, durationTicks: 0, techniques: e.techniques.slice(0, 10) }; }) };
        })
      };
      return recompute(tr);
    });
    var active = tracks.some(function (t) { return t.id === p.activeTrackId; }) ? p.activeTrackId : tracks[0].id;
    return { id: p.id, title: p.title.slice(0, LIMITS.title), bpm: clampInt(p.bpm || 90, 30, 300),
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : now, updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : now,
      activeTrackId: active, tracks: tracks };
  }
  // v1 scaffold files: { schema, version: 1, title, tuning: id, columns: [[6 values string 1..6]] }, every column a quarter note.
  function migrateV1(obj) {
    if (!TUNING_BY_ID[obj.tuning] || !Array.isArray(obj.columns) || !obj.columns.length || obj.columns.length > LIMITS.steps) return { error: 'Old tab file is damaged.' };
    var tr = newTrack('Guitar', obj.tuning);
    tr.steps = [];
    for (var i = 0; i < obj.columns.length; i++) {
      var c = obj.columns[i];
      if (!Array.isArray(c) || c.length !== STRINGS) return { error: 'Old tab file is damaged.' };
      var s = newStep();
      c.forEach(function (v, si) {
        if (v === 'x') s.events.push({ string: si + 1, fret: null, techniques: ['muted'] });
        else if (isInt(v, 0, MAX_FRET)) s.events.push({ string: si + 1, fret: v, techniques: [] });
      });
      tr.steps.push(s);
    }
    recompute(tr);
    var p = newProject(typeof obj.title === 'string' ? obj.title.slice(0, LIMITS.title) : '');
    p.tracks = [tr]; p.activeTrackId = tr.id;
    if (typeof obj.createdAt === 'string') p.createdAt = obj.createdAt;
    return { kind: 'project', projects: [p] };
  }

  // Flat, MIDI-friendly event list for a track (what a MIDI or other exporter would read).
  function flatEvents(track) {
    var out = [];
    track.steps.forEach(function (s) { s.events.forEach(function (e) { out.push(e); }); });
    return out;
  }
  function midiOf(track, ev) { return ev.fret === null ? null : track.tuning.midi[ev.string - 1] + ev.fret; }

  window.TabModel = {
    SCHEMA: SCHEMA, SCHEMA_VERSION: SCHEMA_VERSION, PPQ: PPQ, STRINGS: STRINGS, MAX_FRET: MAX_FRET, LIMITS: LIMITS,
    TUNINGS: TUNINGS, TUNING_BY_ID: TUNING_BY_ID, DUR_VALUES: DUR_VALUES, DUR_LETTER: DUR_LETTER, TIME_SIGS: TIME_SIGS, TECHNIQUES: TECHNIQUES,
    uid: uid, nowIso: nowIso, durTicks: durTicks, durLabel: durLabel, copyDur: copyDur, measureTicks: measureTicks, beatTicks: beatTicks,
    tuningLabels: tuningLabels, tuningFromId: tuningFromId, newStep: newStep, newTrack: newTrack, newProject: newProject, newLibrary: newLibrary,
    recompute: recompute, measureCount: measureCount, measureOfStep: measureOfStep, parseFile: parseFile, normaliseProject: normaliseProject,
    flatEvents: flatEvents, midiOf: midiOf
  };
})();
