// MIDI export check (Node only, no browser): builds a 3-track sample with the app's own model + encoder,
// parses the bytes back with the independent `midi-file` parser and checks header, tempo, time signature,
// track names, channels, note counts, pitches, ticks and the muted / hammer-on rules, in both export modes.
// SAMPLE_DIR=/some/dir also writes sample.mid, sample-all.mid and sample-track1.mid there (and re-parses them).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import midiFile from 'midi-file';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ctx = { window: {}, crypto: globalThis.crypto };
vm.runInNewContext(fs.readFileSync(path.join(HERE, '../app/js/model.js'), 'utf8'), ctx);
const M = ctx.window.TabModel;
const TabMidi = require('../app/js/midi.js');

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) { passes++; console.log('PASS ' + msg); } else { fails++; console.log('FAIL ' + msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), msg + (JSON.stringify(a) === JSON.stringify(b) ? '' : ` (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`));

// ---- sample project: 3 tracks, 2 bars of 4/4 at 100 BPM, loop on ----
function sample() {
  const p = M.newProject('Sample Riff: "v5"');
  p.bpm = 100; p.loop = { enabled: true, startMeasure: 1, endMeasure: 2 };
  const t1 = p.tracks[0]; t1.name = 'Rhythm'; t1.tuning = M.tuningFromId('e-standard'); t1.volume = 80;
  const t2 = M.newTrack('Lead', 'drop-d'); t2.volume = 60; t2.mute = true;
  const t3 = M.newTrack('Low', 'c-standard'); t3.volume = 100;
  p.tracks.push(t2, t3);
  const n = (s, f, t, tech = []) => ({ string: s, fret: f, startTick: t, durationTicks: 0, techniques: f === null ? ['muted', ...tech] : tech });
  t1.notes = [n(6, 0, 0), n(5, 2, 0), n(4, 2, 0), n(6, null, 480), n(6, 3, 960), n(6, 5, 1200, ['hammer-on']), n(5, 7, 1440), n(5, 5, 1680, ['pull-off']), n(6, 0, 1920)];
  t2.notes = [n(1, 12, 0), n(2, 10, 960), n(1, 15, 2400)];
  t3.notes = [n(6, 0, 0), n(6, 5, 1920), n(5, 3, 3600)];
  return M.recompute(p);
}

function parse(bytes) {
  const m = midiFile.parseMidi(Buffer.from(bytes));
  return { header: m.header, tracks: m.tracks.map(tr => { let t = 0; return tr.map(e => ({ ...e, tick: (t += e.deltaTime) })); }) };
}
function notesOf(tr) {
  const open = {}, out = [];
  tr.forEach(e => {
    if (e.type === 'noteOn' && e.velocity > 0) (open[e.noteNumber] = open[e.noteNumber] || []).push(e);
    else if (e.type === 'noteOff' || (e.type === 'noteOn' && e.velocity === 0)) {
      const on = (open[e.noteNumber] || []).shift(); if (on) out.push({ pitch: e.noteNumber, on: on.tick, off: e.tick, vel: on.velocity, ch: on.channel });
    }
  });
  return out.sort((a, b) => a.on - b.on || a.pitch - b.pitch);
}
const expected = (t) => t.notes.map(n => {
  const muted = n.fret === null, legato = n.techniques.some(x => x === 'hammer-on' || x === 'pull-off');
  return { pitch: t.tuning.midi[n.string - 1] + (muted ? 0 : n.fret), on: n.startTick, vel: muted ? 30 : legato ? 67 : 96, len: muted ? Math.min(60, n.durationTicks) : n.durationTicks, n };
}).sort((a, b) => a.on - b.on || a.pitch - b.pitch);
const nameOf = tr => (tr.find(e => e.type === 'trackName') || {}).text;

// ---- encoder basics ----
eq(TabMidi.vlq(0), [0], 'VLQ 0');
eq(TabMidi.vlq(127), [0x7f], 'VLQ 127');
eq(TabMidi.vlq(128), [0x81, 0x00], 'VLQ 128');
eq(TabMidi.vlq(0x0fffffff), [0xff, 0xff, 0xff, 0x7f], 'VLQ max');

const p = sample();
eq(TabMidi.fileName(p), 'Sample Riff v5.mid', 'file name = project title (unsafe characters dropped)');
eq(TabMidi.fileName(p, p.tracks[0]), 'Sample Riff v5 - Rhythm.mid', 'single-track file name');
eq(TabMidi.fileName({ title: '' }), 'Untitled.mid', 'empty title -> Untitled.mid');

// ---- All tracks ----
const allBytes = TabMidi.build(p, { mode: 'all' });
const all = parse(allBytes);
eq([all.header.format, all.header.numTracks, all.header.ticksPerBeat], [1, 4, 480], 'all: Type 1, conductor + 3 tracks, PPQ 480');
eq(String.fromCharCode(...allBytes.slice(0, 4)), 'MThd', 'all: MThd chunk');
const cond = all.tracks[0];
eq(nameOf(cond), 'Sample Riff: "v5"', 'conductor named after the project');
eq(cond.filter(e => e.type === 'setTempo').map(e => [e.tick, e.microsecondsPerBeat]), [[0, 600000]], 'tempo 100 BPM = 600000 us/beat at tick 0');
eq(cond.filter(e => e.type === 'timeSignature').map(e => [e.numerator, e.denominator, e.metronome, e.thirtyseconds]), [[4, 4, 24, 8]], 'time signature 4/4');
eq(cond.filter(e => e.type === 'marker').map(e => [e.text, e.tick]), [['Loop start', 0], ['Loop end', 3840]], 'loop markers');
ok(!cond.some(e => /^note/.test(e.type)), 'conductor has no notes');
eq(all.tracks.slice(1).map(nameOf), ['Rhythm', 'Lead (muted)', 'Low'], 'all: track names, muted track still included and labelled');
all.tracks.slice(1).forEach((tr, i) => {
  const t = p.tracks[i], got = notesOf(tr), want = expected(t);
  eq(got.length, t.notes.length, `all: ${t.name} note count`);
  eq(got.map(x => x.pitch), want.map(x => x.pitch), `all: ${t.name} pitches = open string + fret`);
  eq(got.map(x => x.on), want.map(x => x.on), `all: ${t.name} note-on ticks = startTick`);
  eq(got.map(x => x.vel), want.map(x => x.vel), `all: ${t.name} velocities (96, muted 30, legato 67)`);
  ok(got.every(x => x.ch === i), `all: ${t.name} on channel ${i + 1}`);
  eq(tr.filter(e => e.type === 'programChange').map(e => [e.channel, e.programNumber]), [[i, 25]], `all: ${t.name} program 25 (steel guitar)`);
  eq(tr.filter(e => e.type === 'controller' && e.controllerType === 7).map(e => e.value), [Math.round(t.volume * 127 / 100)], `all: ${t.name} CC7 from volume ${t.volume}`);
  eq(tr.filter(e => e.type === 'text').length, t.notes.length, `all: ${t.name} one neck-position text event per note`);
  eq(tr.filter(e => e.type === 'instrumentName').map(e => e.text)[0].startsWith(t.tuning.name.split(' (')[0]), true, `all: ${t.name} tuning as instrument name`);
  const end = tr[tr.length - 1]; ok(end.type === 'endOfTrack' && end.tick === p.lengthTicks, `all: ${t.name} ends at song end (${p.lengthTicks})`);
});
// durations: gated length, muted short, legato overlap
const rh = notesOf(all.tracks[1]), rhNotes = expected(p.tracks[0]);
const chord = rh.filter(x => x.on === 0);
eq(chord.map(x => x.off - x.on), [480, 480, 480], 'durations = durationTicks (chord at 0 lasts until the muted note at 480)');
const mutedN = rh.find(x => x.on === 480);
eq([mutedN.pitch, mutedN.vel, mutedN.off - mutedN.on], [40, 30, 60], 'muted x: open-string pitch, velocity 30, 60 ticks');
eq(rh.find(x => x.on === 960).off, 1200 + 10, 'hammer-on: previous note on that string held 10 ticks into it (legato)');
eq(rh.find(x => x.on === 1440).off, 1680 + 10, 'pull-off: previous note held 10 ticks into it');
const texts = all.tracks[1].filter(e => e.type === 'text').map(e => e.tick + ':' + e.text);
ok(texts.includes('0:s6f0') && texts.includes('480:s6x') && texts.includes('1200:s6f5'), 'neck position text events (s6f0, s6x, s6f5)');
const firstOn = all.tracks[1].findIndex(e => e.type === 'noteOn'), firstText = all.tracks[1].findIndex(e => e.type === 'text');
ok(firstText < firstOn, 'position text comes before its note on');
const chordOrder = all.tracks[1].filter(e => e.type === 'noteOn' && e.tick === 0).map(e => e.noteNumber);
eq(chordOrder, [40, 47, 52], 'chord note-ons low string to high');

// ---- solo: All tracks still includes everything, labels the unsoloed ones ----
const ps = sample(); ps.tracks[2].solo = true;
eq(parse(TabMidi.build(ps, { mode: 'all' })).tracks.slice(1).map(nameOf), ['Rhythm (not soloed)', 'Lead (muted)', 'Low'], 'all + solo: every track kept, unsoloed/muted labelled');

// ---- single track ----
['Rhythm', 'Lead'].forEach((nm, k) => {
  const t = p.tracks[k], one = parse(TabMidi.build(p, { mode: t.id }));
  eq([one.header.format, one.header.numTracks, one.header.ticksPerBeat], [1, 2, 480], `single ${nm}: conductor + 1 track`);
  eq(nameOf(one.tracks[1]), nm, `single ${nm}: plain track name (mute/solo ignored)`);
  eq(one.tracks[0].filter(e => e.type === 'setTempo').length, 1, `single ${nm}: tempo in conductor`);
  eq(notesOf(one.tracks[1]).map(x => [x.pitch, x.on]), expected(t).map(x => [x.pitch, x.on]), `single ${nm}: same notes as in All tracks`);
  ok(notesOf(one.tracks[1]).every(x => x.ch === k), `single ${nm}: keeps its channel ${k + 1}`);
});
let threw = false; try { TabMidi.build(p, { mode: 'nope' }); } catch (e) { threw = true; } ok(threw, 'unknown track id throws');

// ---- other time signatures + tempo ----
[[[3, 4], [3, 4, 24, 8]], [[6, 8], [6, 8, 36, 8]], [[2, 4], [2, 4, 24, 8]]].forEach(([ts, want]) => {
  const q = sample(); q.timeSignature = ts; q.bpm = 120; q.loop.enabled = false; M.recompute(q);
  const r = parse(TabMidi.build(q));
  const s = r.tracks[0].find(e => e.type === 'timeSignature');
  eq([s.numerator, s.denominator, s.metronome, s.thirtyseconds], want, `time signature ${ts.join('/')}`);
  eq(r.tracks[0].find(e => e.type === 'setTempo').microsecondsPerBeat, 500000, `tempo 120 BPM (${ts.join('/')})`);
  ok(!r.tracks[0].some(e => e.type === 'marker'), `no loop markers when loop is off (${ts.join('/')})`);
});
const nopos = parse(TabMidi.build(p, { posText: false }));
ok(!nopos.tracks[1].some(e => e.type === 'text'), 'posText:false drops the neck-position text');

// ---- frets 17-22 (v6): pitch, position text, import accepts 22 and rejects 23 ----
eq(M.MAX_FRET, 22, 'model allows frets 0-22');
{
  const q = M.newProject('High frets'); const t = q.tracks[0]; t.tuning = M.tuningFromId('e-standard');
  const hn = (s, f, tk) => ({ string: s, fret: f, startTick: tk, durationTicks: 0, techniques: [] });
  t.notes = [17, 18, 19, 20, 21, 22].map((f, i) => hn(1, f, i * 240)).concat([hn(6, 22, 1440), hn(3, 22, 1680)]);
  M.recompute(q);
  const r = parse(TabMidi.build(q));
  eq(notesOf(r.tracks[1]).map(x => x.pitch), [81, 82, 83, 84, 85, 86, 62, 77], 'frets 17-22 on high e (64+f), fret 22 on low E (40+22=62) and G (55+22=77)');
  eq(r.tracks[1].filter(e => e.type === 'text').map(e => e.text), ['s1f17', 's1f18', 's1f19', 's1f20', 's1f21', 's1f22', 's6f22', 's3f22'], 'neck-position text for two-digit frets (s1f22, s6f22)');
  const file = (proj) => JSON.parse(JSON.stringify({ schema: M.SCHEMA, schemaVersion: M.SCHEMA_VERSION, ppq: M.PPQ, kind: 'project', projects: [proj] }));
  const back = M.parseFile(file(q));
  ok(!back.error && JSON.stringify(back.projects[0].tracks[0].notes.map(n => n.fret)) === JSON.stringify(t.notes.map(n => n.fret)), 'JSON with frets 17-22 imports unchanged (schemaVersion ' + M.SCHEMA_VERSION + ')');
  const bad = file(q); bad.projects[0].tracks[0].notes[5].fret = 23;
  ok(/fret must be 0 to 22/.test(M.parseFile(bad).error || ''), 'fret 23 is rejected on import: ' + M.parseFile(bad).error);
  const v4old = file(q); v4old.projects[0].tracks[0].notes = v4old.projects[0].tracks[0].notes.map(n => ({ ...n, fret: n.fret - 6 }));
  ok(!M.parseFile(v4old).error, 'an older file with frets up to 16 still imports');
}

// ---- samples ----

// ---- v7: grid value x style (plain / dotted / triplet), naming, migration, triplet MIDI ticks ----
const TICKS = { plain: [1920, 960, 480, 240, 120, 60, 30], dotted: [2880, 1440, 720, 360, 180, 90, 45], triplet: [1280, 640, 320, 160, 80, 40, 20] };
const FR = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/64'];
eq([...M.DUR_VALUES], ['whole', 'half', 'quarter', 'eighth', 'sixteenth', 'thirtysecond', 'sixtyfourth'], 'v7: grid values 1/1 .. 1/64');
for (const st of ['plain', 'dotted', 'triplet']) M.DUR_VALUES.forEach((v, i) => {
  const g = M.makeGrid(v, st), lab = FR[i] + (st === 'dotted' ? '.' : st === 'triplet' ? 'T' : '');
  const q = M.recompute(M.newProject('g')); const cl = M.cells(q, g);
  const step = Math.min(TICKS[st][i], 1920);
  ok(M.durTicks(g) === TICKS[st][i] && M.gridLabel(g) === lab && M.gridStyle(g) === st && cl[0].len === step && (cl.length < 2 || cl[1].start === step),
    `v7 grid ${lab} = ${TICKS[st][i]} ticks per step (${M.gridName(g)})`);
});
{ // steps restart at every barline (1/4. in 4/4: 720, 720, 480), and all 21 lengths name back to themselves
  const q = M.newProject('b'); q.lengthTicks = 3840; M.recompute(q);
  eq(M.cells(q, M.makeGrid('quarter', 'dotted')).map((c) => [c.start, c.len]), [[0, 720], [720, 720], [1440, 480], [1920, 720], [2640, 720], [3360, 480]], 'v7: 1/4. steps restart at the barline');
  eq(M.cells(q, M.makeGrid('sixtyfourth', 'triplet')).length, 192, 'v7: 1/64T = 96 steps a bar (2 bars = 192)');
  const all = []; for (const st of ['plain', 'dotted', 'triplet']) M.DUR_VALUES.forEach((v) => all.push(M.makeGrid(v, st)));
  ok(all.every((g) => JSON.stringify(M.nameTicks(M.durTicks(g))) === JSON.stringify(g)) && new Set(all.map(M.durTicks)).size === 21, 'v7: all 21 value x style lengths are distinct and named back (rhythm row)');
  eq(['E³', 'S.', 'T', 'X', 'X³', 'X.'], [M.nameTicks(160), M.nameTicks(180), M.nameTicks(60), M.nameTicks(30), M.nameTicks(20), M.nameTicks(45)].map(M.durLabel), 'v7: labels E³ S. T X X³ X.');
}
{ // migration: v3 dotted/triplet grids kept as value + style; odd tuplets and dotted triplets reported; v4 files unchanged
  const V3 = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'v3-project.json'), 'utf8'));
  const base = (v, grid) => {
    if (v === 3) { const f = JSON.parse(JSON.stringify(V3)); f.projects[0].grid = grid; f.projects[0].tracks[0].notes[0].startTick = 160; return f; }
    const q = M.newProject('m'); q.grid = grid; q.tracks[0].notes = [{ string: 1, fret: 3, startTick: 160, durationTicks: 0, techniques: [] }];
    return { schema: 'jlr-guitar-tab', schemaVersion: v, kind: 'project', ppq: 480, projects: [JSON.parse(JSON.stringify(q))] }; };
  const r1 = M.parseFile(base(3, { value: 'eighth', dotted: true, tuplet: null }));
  eq([r1.projects[0].grid, r1.warnings.length], [{ value: 'eighth', dotted: true }, 0], 'v7 migration: v3 dotted 1/8 kept as 1/8 + Dotted, no warning');
  const r2 = M.parseFile(base(3, { value: 'sixteenth', dotted: false, tuplet: { actual: 3, normal: 2 } }));
  eq([r2.projects[0].grid, r2.warnings.length, r2.projects[0].tracks[0].notes[0].startTick], [{ value: 'sixteenth', tuplet: { actual: 3, normal: 2 } }, 0, 160], 'v7 migration: v3 1/16 triplet kept as 1/16 + Triplet, notes unmoved');
  const r3 = M.parseFile(base(3, { value: 'quarter', tuplet: { actual: 5, normal: 4 } }));
  ok(JSON.stringify(r3.projects[0].grid) === '{"value":"quarter"}' && r3.warnings.length === 1 && /5:4 tuplet is now 1\/4/.test(r3.warnings[0]), 'v7 migration: v3 5:4 tuplet -> plain 1/4 with a warning: ' + r3.warnings[0]);
  const r4 = M.parseFile(base(3, { value: 'eighth', dotted: true, tuplet: { actual: 3, normal: 2 } }));
  ok(JSON.stringify(r4.projects[0].grid) === JSON.stringify({ value: 'eighth', tuplet: { actual: 3, normal: 2 } }) && r4.warnings.length === 1, 'v7 migration: dotted triplet keeps the triplet, with a warning');
  const r5 = M.parseFile(base(4, { value: 'sixteenth' }));
  eq([r5.projects[0].grid, r5.warnings.length, r5.migratedFrom || null], [{ value: 'sixteenth' }, 0, null], 'v7: a v4-v6 file (plain grid) loads unchanged');
  for (const g of [M.makeGrid('sixtyfourth', 'dotted'), M.makeGrid('eighth', 'triplet'), M.makeGrid('thirtysecond', 'plain')]) {
    const r = M.parseFile(JSON.parse(JSON.stringify(base(4, g))));
    eq([r.projects[0].grid, r.warnings.length], [g, 0], `v7: JSON round trip keeps grid ${M.gridLabel(g)}`);
  }
  eq(M.SCHEMA_VERSION, 4, 'v7: schema stays v4 (new grids are a superset)');
}
{ // note length gating and MIDI ticks with triplet / 64th notes
  const q = M.newProject('Triplets'); q.bpm = 120;
  const n = (s, f, t) => ({ string: s, fret: f, startTick: t, durationTicks: 0, techniques: [] });
  q.tracks[0].notes = [n(1, 0, 0), n(1, 2, 160), n(1, 3, 320), n(2, 5, 480), n(2, 7, 800), n(2, 8, 1120), n(3, 1, 1440), n(3, 2, 1460), n(3, 3, 1480), n(4, 4, 1500), n(4, 5, 1545), n(4, 6, 1590)];
  M.recompute(q);
  eq(q.tracks[0].notes.map((x) => x.durationTicks), [160, 160, 160, 320, 320, 320, 20, 20, 20, 45, 45, 1920], 'v7: note lengths gate to the next note (8th triplets 160, quarter triplets 320, 64T 20, 64. 45; the last capped at one bar)');
  const r = parse(TabMidi.build(q, { mode: 'all' })), got = notesOf(r.tracks[1]).map((x) => [x.on, x.off - x.on]);
  eq(got, q.tracks[0].notes.map((x) => [x.startTick, x.durationTicks]), 'v7 MIDI: triplet / 64T / dotted-64th notes land on exact ticks with exact lengths');
  ok(r.header.ticksPerBeat === 480 && got.slice(0, 3).every((x, i) => x[0] === i * 160), 'v7 MIDI: 8th triplets at 0, 160, 320 (PPQ 480)');
}

if (process.env.SAMPLE_DIR) {
  const dir = process.env.SAMPLE_DIR; fs.mkdirSync(dir, { recursive: true });
  const files = { 'sample.mid': allBytes, 'sample-all.mid': allBytes, 'sample-track1.mid': TabMidi.build(p, { mode: p.tracks[0].id }) };
  for (const [f, b] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, f), b);
    const r = parse(fs.readFileSync(path.join(dir, f)));
    const notes = r.tracks.slice(1).reduce((s, tr) => s + notesOf(tr).length, 0);
    ok(r.header.format === 1 && r.header.ticksPerBeat === 480, `${f} written and parses: ${r.header.numTracks} MTrk, ${notes} notes`);
  }
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
