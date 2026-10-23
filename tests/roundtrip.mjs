// JSON round-trip test for Guitar Tab (v4).
//
// Builds a 3-track project through the real UI (different tunings, notes, a muted note, BPM 137, a loop,
// mixed volume/mute/solo, idea notes, a non-default grid), exports it (captures the real download),
// clears localStorage, reloads, imports the file, and deep-compares everything. Then plays it and checks
// that notes were scheduled from every audible track (and none from the muted one). Also checks the
// 3-track import limit, older-file migration (a v3 export) and undo/redo.
//
//   cd tests && npm install && CHROME_PATH=/usr/bin/google-chrome node roundtrip.mjs
//   BASE=https://maximini22.github.io/github-tab/ node roundtrip.mjs     (run against the live site)
//   HEADFUL=1 node roundtrip.mjs                                         (watch it)
//
// Exit code 0 = all checks passed.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
let server = null, BASE = process.env.BASE;
if (!BASE) { server = await startServer(); BASE = server.base; }
const APP = BASE.replace(/\/?$/, '/') + 'app/';
const DL = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-roundtrip-'));

const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail && !ok ? '\n     ' + detail : '')); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: process.env.HEADFUL ? false : 'new',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', (d) => d.accept()); // "Replace your whole library?" confirm
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const cdp = await page.createCDPSession();
await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });

const gt = (expr) => page.evaluate(new Function('return (' + expr + ')'));
async function click(sel) { await page.waitForSelector(sel, { visible: true }); await page.click(sel); }
async function openDrawer() { if (await page.$eval('#drawer', (d) => d.hidden)) await click('#menu-btn'); }
async function closeDrawer() { if (!(await page.$eval('#drawer', (d) => d.hidden))) await click('#drawer-close'); }
async function select(sel, value) { await page.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, value); }
async function typeInto(sel, text) { await page.$eval(sel, (el) => { el.value = ''; }); await page.type(sel, text); await page.$eval(sel, (el) => el.dispatchEvent(new Event('change', { bubbles: true }))); }
async function place(col, str, fret) { // tap a lane cell, then a fret on the neck (or Muted)
  await page.$eval(`.cell[data-col="${col}"][data-str="${str}"]`, (b) => b.scrollIntoView({ inline: 'center', block: 'nearest' }));
  await click(`.cell[data-col="${col}"][data-str="${str}"]`);
  if (fret === 'x') await click('#pick-mute'); else await click(`.frow[data-fret="${fret}"]`);
  await click('#picker-done');
}
async function armTrack(i) { await click(`.trk:nth-child(${i + 1}) .trk-arm`); }
async function setVolume(i, v) { await page.$eval(`.trk:nth-child(${i + 1}) .vol`, (el, x) => { el.value = x; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, v); }
function project(lib) { return lib.projects.find((p) => p.id === lib.activeProjectId); }
function comparable(p) { // what must survive a round trip (updatedAt is a save stamp)
  return JSON.parse(JSON.stringify({ id: p.id, title: p.title, bpm: p.bpm, grid: p.grid, timeSignature: p.timeSignature, lengthTicks: p.lengthTicks,
    loop: p.loop, idea: p.idea, createdAt: p.createdAt, activeTrackId: p.activeTrackId,
    tracks: p.tracks.map((t) => ({ id: t.id, name: t.name, tuning: t.tuning, volume: t.volume, mute: t.mute, solo: t.solo, notes: t.notes })) }));
}
function diff(a, b, at = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = diff(a[k], b[k], at + '.' + k); if (d) return d; }
  }
  return at + ': ' + JSON.stringify(a) + ' != ' + JSON.stringify(b);
}
async function waitDownload(before) {
  for (let i = 0; i < 50; i++) {
    const f = fs.readdirSync(DL).filter((n) => n.endsWith('.json') && !before.includes(n));
    if (f.length) return path.join(DL, f[0]);
    await sleep(100);
  }
  return null;
}
async function importPath(file, choice) {
  await openDrawer();
  const [chooser] = await Promise.all([page.waitForFileChooser(), click('#import-btn')]);
  await chooser.accept([file]);
  await click(`#modal-actions button[data-value="${choice}"]`);
  await sleep(300);
}
async function fresh() {
  await page.goto(APP, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  if (!(await page.$eval('#hint', (h) => h.hidden))) await click('#hint-ok');
}

try {
  console.log('App: ' + APP);
  await fresh();

  // ---------- build the project in the UI ----------
  await openDrawer();
  await typeInto('#title', 'Round trip v4');
  await select('#tuning', 'drop-d');
  await closeDrawer();
  await page.$eval('#bpm', (el) => { el.value = '137'; el.dispatchEvent(new Event('change', { bubbles: true })); });

  // Track 1 (Drop D): low D on 1, fret 2 on the A string on the "&" of 2, a muted G string on 3, fret 3 high e in bar 2
  await place(0, 5, 0); await place(2, 4, 2); await place(4, 3, 'x'); await place(8, 0, 3);

  // undo / redo
  const before = (await gt('window.__guitarTab.library')); const n0 = project(before).tracks[0].notes.length;
  await click('#undo-btn'); const nU = project(await gt('window.__guitarTab.library')).tracks[0].notes.length;
  await click('#redo-btn'); const nR = project(await gt('window.__guitarTab.library')).tracks[0].notes.length;
  check('undo removes the last note, redo puts it back', n0 === 4 && nU === 3 && nR === 4, `notes ${n0} -> undo ${nU} -> redo ${nR}`);

  // Track 2 (Open G, "Lead")
  await click('#track-add');
  await openDrawer(); await typeInto('#track-name', 'Lead'); await select('#tuning', 'open-g'); await closeDrawer();
  await place(1, 1, 5); await place(9, 2, 7);
  // Track 3 (C standard)
  await click('#track-add');
  await openDrawer(); await select('#tuning', 'c-standard'); await closeDrawer();
  await place(3, 5, 3); await place(10, 0, 12);
  check('track limit: "+ Track" is gone at 3 tracks', !(await page.$('#track-add')));

  // Mixer: T1 solo + vol 55, T2 mute, T3 solo + vol 30  ->  audible = T1, T3
  await setVolume(0, 55); await setVolume(2, 30);
  await click('.trk:nth-child(1) .ms.s'); await click('.trk:nth-child(2) .ms.m'); await click('.trk:nth-child(3) .ms.s');
  // Loop bar 2 only (cursor in bar 2, then "Loop from this bar")
  await armTrack(0);
  await click('.cell[data-col="8"][data-str="0"]'); await click('#picker-done');
  await openDrawer(); await click('#loop-start'); await closeDrawer();
  await page.type('#idea', 'riff idea: answer phrase in bar 2');
  await select('#grid-select', 'sixteenth');

  const original = project(await gt('window.__guitarTab.library'));
  check('built: 3 tracks, 3 tunings, 8 notes, BPM 137, loop bar 2, grid 1/16',
    original.tracks.length === 3 && new Set(original.tracks.map((t) => t.tuning.id)).size === 3 &&
    original.tracks.reduce((a, t) => a + t.notes.length, 0) === 8 && original.bpm === 137 &&
    original.loop.enabled && original.loop.startMeasure === 2 && original.loop.endMeasure === 2 && original.grid.value === 'sixteenth',
    JSON.stringify({ tracks: original.tracks.length, bpm: original.bpm, loop: original.loop, grid: original.grid }));
  check('mixer as set (T1 solo 55, T2 muted, T3 solo 30)', JSON.stringify(original.tracks.map((t) => [t.volume, t.mute, t.solo])) === JSON.stringify([[55, false, true], [80, true, false], [30, false, true]]),
    JSON.stringify(original.tracks.map((t) => [t.volume, t.mute, t.solo])));

  // ---------- export (real download) ----------
  await openDrawer();
  const had = fs.readdirSync(DL);
  await click('#export-one');
  const file = await waitDownload(had);
  check('export downloaded a .json file', !!file, 'no file in ' + DL);
  const exported = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('file header: schema jlr-guitar-tab v4, ppq 480, 1 project', exported.schema === 'jlr-guitar-tab' && exported.schemaVersion === 4 && exported.ppq === 480 && exported.projects.length === 1);
  const d1 = diff(comparable(original), comparable(exported.projects[0]));
  check('exported file equals the project in the app', !d1, d1);

  // ---------- clear storage, reload, import ----------
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  const blank = await gt('window.__guitarTab.library');
  check('after clearing storage the app starts empty', blank.projects.length === 1 && project(blank).tracks.length === 1 && project(blank).tracks[0].notes.length === 0);
  if (!(await page.$eval('#hint', (h) => h.hidden))) await click('#hint-ok');
  await importPath(file, 'replace');
  const back = project(await gt('window.__guitarTab.library'));
  const d2 = diff(comparable(original), comparable(back));
  check('imported project deep-equals the original (tracks, notes, BPM, loop, grid, tunings, mixer, idea)', !d2, d2);
  check('idea field shows the imported text', (await page.$eval('#idea', (e) => e.value)) === original.idea);
  check('track strip shows 3 tracks, T2 drawn as silent', (await page.$$eval('.trk', (r) => r.map((x) => x.classList.contains('silent')))).join() === 'false,true,false');

  // ---------- play back: layered scheduling ----------
  await click('#play-btn');
  await sleep(2600); // > one bar at 137 BPM (1.75 s)
  const playing = await gt('window.__guitarTab.isPlaying()');
  await click('#play-btn'); // pause
  const sched = await gt('window.__guitarTab.scheduled()');
  const tracksHeard = [...new Set(sched.map((e) => e.track))].sort();
  const midis = [...new Set(sched.map((e) => e.midi))].sort();
  check('playback ran', playing && sched.length > 0, 'scheduled ' + sched.length);
  check('scheduled notes come from both audible tracks (1 and 3), none from muted track 2', tracksHeard.join() === '0,2', 'tracks ' + tracksHeard.join());
  // loop = bar 2: T1 fret 3 on high e (Drop D e = 64) -> 67; T3 fret 12 on high C (C std = 60) -> 72; T2 (muted) would be 66
  check('pitches: 67 (T1, Drop D e+3) and 72 (T3, C std C+12), no 66 from T2', midis.join() === '67,72', 'midi ' + midis.join());
  check('per-track volume applied as gain (0.55, 0.30)', sched.every((e) => (e.track === 0 ? Math.abs(e.gain - 0.55) < 1e-9 : Math.abs(e.gain - 0.3) < 1e-9)),
    JSON.stringify(sched.slice(0, 4)));
  check('loop kept playback in bar 2 (notes repeat)', sched.filter((e) => e.midi === 67).length >= 2, 'count67 ' + sched.filter((e) => e.midi === 67).length);

  // ---------- import limit + migration ----------
  const four = JSON.parse(JSON.stringify(exported));
  const p4 = four.projects[0]; p4.id = 'four-tracks'; p4.title = 'Four tracks';
  p4.tracks.push({ ...JSON.parse(JSON.stringify(p4.tracks[0])), id: 'extra-4', name: 'Extra' });
  p4.tracks[0].tuning = { id: 'nashville', name: 'Nashville', midi: [64, 59, 67, 62, 57, 52] };
  p4.grid = { value: 'eighth', dotted: true };
  const f4 = path.join(DL, 'four-tracks.json'); fs.writeFileSync(f4, JSON.stringify(four));
  await importPath(f4, 'merge');
  const warn = await page.$eval('#modal-body', (e) => e.textContent);
  const modalShown = !(await page.$eval('#modal', (m) => m.hidden));
  if (modalShown) await click('#modal-actions button');
  const lib4 = await gt('window.__guitarTab.library');
  const got4 = lib4.projects.find((p) => p.id === 'four-tracks');
  check('import keeps the first 3 of 4 tracks and warns', got4 && got4.tracks.length === 3 && modalShown && /kept the first 3/.test(warn), warn);
  check('unknown tuning kept as "Custom (imported)" with its MIDI notes', got4 && got4.tracks[0].tuning.id === 'custom' && JSON.stringify(got4.tracks[0].tuning.midi) === '[64,59,67,62,57,52]', got4 && JSON.stringify(got4.tracks[0].tuning));
  check('dotted grid migrated to a plain value, notes unmoved', got4 && got4.grid.value === 'eighth' && !('dotted' in got4.grid) &&
    JSON.stringify(got4.tracks.map((t) => t.notes.map((n) => n.startTick))) === JSON.stringify(p4.tracks.slice(0, 3).map((t) => t.notes.map((n) => n.startTick))));

  const v3file = path.join(HERE, 'fixtures', 'v3-project.json');
  const v3 = JSON.parse(fs.readFileSync(v3file, 'utf8'));
  await importPath(v3file, 'merge');
  if (!(await page.$eval('#modal', (m) => m.hidden))) await click('#modal-actions button');
  const libv3 = await gt('window.__guitarTab.library');
  const gotv3 = libv3.projects.find((p) => p.id === v3.projects[0].id);
  const notesV3 = v3.projects[0].tracks.map((t) => t.notes.map((n) => [n.string, n.fret, n.startTick]));
  check('v3 export imports: same tracks, tunings, notes and BPM', gotv3 && gotv3.bpm === v3.projects[0].bpm &&
    JSON.stringify(gotv3.tracks.map((t) => t.tuning.midi)) === JSON.stringify(v3.projects[0].tracks.map((t) => t.tuning.midi)) &&
    JSON.stringify(gotv3.tracks.map((t) => t.notes.map((n) => [n.string, n.fret, n.startTick]))) === JSON.stringify(notesV3));

  check('no page errors', errors.length === 0, errors.join(' | '));
} catch (e) {
  check('test ran to the end', false, e.stack);
} finally {
  await browser.close();
  if (server) server.srv.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed` + (failed ? '' : ' - round trip OK'));
process.exit(failed ? 1 : 0);
