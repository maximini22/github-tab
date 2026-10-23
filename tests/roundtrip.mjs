// JSON round-trip test for Guitar Tab (v4 data, v6 app), plus the step editor, frets 0-22 and MIDI export through the UI.
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
import midiFile from 'midi-file';

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
    tracks: p.tracks.map((t) => ({ id: t.id, name: t.name, tuning: t.tuning, style: t.style, volume: t.volume, mute: t.mute, solo: t.solo, notes: t.notes })) }));
}
function diff(a, b, at = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = diff(a[k], b[k], at + '.' + k); if (d) return d; }
  }
  return at + ': ' + JSON.stringify(a) + ' != ' + JSON.stringify(b);
}
async function waitDownload(before, ext = '.json') {
  for (let i = 0; i < 50; i++) {
    const f = fs.readdirSync(DL).filter((n) => n.endsWith(ext) && !before.includes(n));
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

  // ---------- v5 step editor (fret picker): Back/Next, bar jumps, yellow string, mini roll, undo inside ----------
  // Grid is 1/8 here: 8 steps a bar, 2 bars. Notes at steps 0 (str 6), 2 (str 5), 4 (str 4, muted), 8 (str 1).
  const st = async () => [await gt('window.__guitarTab.editStep()'), await gt('window.__guitarTab.playhead()')];
  await click('.cell[data-col="3"][data-str="2"]');
  check('picker: Back step, Next step and bar jumps are on the sheet', (await Promise.all(['#picker-prev', '#picker-next', '#picker-prev-bar', '#picker-next-bar'].map((x) => page.$eval(x, (b) => !!b.offsetWidth)))).every(Boolean));
  const chip = await page.$eval('#picker-strings .chip.on', (b) => ({ str: b.dataset.str, bg: getComputedStyle(b).backgroundColor }));
  check('selected string chip is yellow (#f5d547)', chip.str === '2' && chip.bg === 'rgb(245, 213, 71)', JSON.stringify(chip));
  const roll = await page.evaluate(() => {
    const r = document.getElementById('picker-roll'), q = (s) => [...r.querySelectorAll(s)];
    return { cells: q('.rc').length, now: q('.rc.now').map((d) => d.dataset.col), selRow: q('.rc.sel').map((d) => d.dataset.str), selLab: q('.rl.sel').map((d) => d.textContent),
      n2: (r.querySelector('.rc[data-col="2"][data-str="4"]') || {}).textContent, mute: (r.querySelector('.rc[data-col="4"][data-str="3"]') || {}).textContent, bar: document.getElementById('roll-bar').textContent };
  });
  check('mini roll: this bar x 6 strings, current step marked, notes shown', roll.cells === 48 && roll.now.length === 6 && roll.now.every((c) => c === '3') && roll.n2 === '2' && roll.mute === 'x' && /Bar 1 of 2/.test(roll.bar), JSON.stringify(roll));
  check('mini roll: selected string row highlighted (yellow)', roll.selRow.length === 8 && roll.selRow.every((x) => x === '2') && roll.selLab.length === 1 &&
    (await page.$eval('#picker-roll .rl.sel', (d) => getComputedStyle(d).backgroundColor)) === 'rgb(245, 213, 71)', JSON.stringify(roll.selRow));
  const fit = await page.$eval('#picker', (s) => ({ sh: s.scrollHeight, ch: s.clientHeight, top: s.getBoundingClientRect().top, page: document.documentElement.scrollHeight - innerHeight }));
  check('picker fits 390x844 with no scroll (sheet or page)', fit.sh <= fit.ch + 1 && fit.top >= 0 && fit.page <= 0, JSON.stringify(fit));
  await click('#picker-prev'); const sB = await st();
  await click('#picker-next'); await click('#picker-next'); const sN = await st();
  check('Back step / Next step move the edit cursor and (stopped) the playhead', sB.join() === '2,2' && sN.join() === '4,4', `${sB} / ${sN}`);
  await click('#picker-next-bar'); const sNB = await st();
  await click('#picker-prev-bar'); const sPB = await st();
  await click('#picker-next-bar'); await click('#picker-next'); await click('#picker-prev-bar'); const sPB2 = await st();
  check('bar jumps: Bar » to next bar start, « Bar to this bar start, then the bar before', sNB.join() === '8,8' && sPB.join() === '0,0' && sPB2.join() === '8,8', `${sNB} / ${sPB} / ${sPB2}`);
  const len0 = project(await gt('window.__guitarTab.library')).lengthTicks;
  await click('#picker-next-bar'); const len1 = project(await gt('window.__guitarTab.library')).lengthTicks; const sAdd = await st();
  await click('#picker-undo'); const len2 = project(await gt('window.__guitarTab.library')).lengthTicks;
  check('Bar » on the last bar adds a bar; Undo in the picker takes it back', len1 === len0 + 1920 && sAdd[0] === 16 && len2 === len0, `${len0} -> ${len1} -> ${len2}, step ${sAdd}`);
  await page.$eval('#picker-roll .rc[data-col="14"][data-str="1"]', (d) => d.click());
  const sTap = await st(); const strTap = await page.$eval('#picker-strings .chip.on', (b) => b.dataset.str);
  check('tapping the mini roll moves the cursor (step + string)', sTap[0] === 14 && strTap === '1', `${sTap} str ${strTap}`);
  const cnt = async () => project(await gt('window.__guitarTab.library')).tracks[0].notes.length;
  await click('.frow[data-fret="7"]'); const cP = await cnt();
  const rollShows = await page.$eval('#picker-roll .rc[data-col="14"][data-str="1"]', (d) => d.textContent);
  await click('#picker-undo'); const cU = await cnt(); await click('#picker-redo'); const cR = await cnt(); await click('#picker-undo'); const cU2 = await cnt();
  check('placing in the picker shows in the roll; picker Undo/Redo work', cP === 5 && rollShows === '7' && cU === 4 && cR === 5 && cU2 === 4, `${cP} ${rollShows} ${cU} ${cR} ${cU2}`);
  check('picker still open after undo/redo', !(await page.$eval('#picker', (s) => s.hidden)));
  await click('#picker-done');

  // Track 2 (Open G, "Lead")
  await click('#track-add');
  await openDrawer(); await typeInto('#track-name', 'Lead'); await select('#tuning', 'open-g'); await closeDrawer();
  await place(1, 1, 5); await place(9, 2, 7);
  // Track 3 (C standard)
  await click('#track-add');
  await openDrawer(); await select('#tuning', 'c-standard'); await closeDrawer();
  await place(3, 5, 3); await place(10, 0, 12);
  // ---------- v6: frets 0-22 (fret 22 on the Eb string in bar 1: C std Eb3 = 51 -> 73) ----------
  await page.$eval('.cell[data-col="5"][data-str="2"]', (b) => b.scrollIntoView({ inline: 'center', block: 'nearest' }));
  await click('.cell[data-col="5"][data-str="2"]');
  const neckRows = await page.$$eval('#neck .frow', (rs) => rs.map((r) => [Number(r.dataset.fret), r.querySelectorAll('.dots i').length]));
  check('neck has frets 0-22 (23 rows)', neckRows.length === 23 && neckRows.every((r, i) => r[0] === i), JSON.stringify(neckRows.map((r) => r[0])));
  const dotMap = Object.fromEntries(neckRows.filter((r) => r[1]));
  check('inlays: 3, 5, 7, 9, double 12, then 17, 19, 21 (none at 15)', JSON.stringify(dotMap) === JSON.stringify({ 3: 1, 5: 1, 7: 1, 9: 1, 12: 2, 17: 1, 19: 1, 21: 1 }), JSON.stringify(dotMap));
  await click('.frow[data-fret="22"]');
  const f22 = await page.evaluate(() => ({ lib: window.__guitarTab.library, pre: window.TabAudio.lastNote(), roll: (document.querySelector('#picker-roll .rc.now.sel b') || {}).textContent,
    lit: (document.querySelector('#neck .frow.on') || {}).dataset?.fret, ascii: window.__guitarTab.toAscii() }));
  const t3now = project(f22.lib).tracks[2];
  check('fret 22 placed: stored, lit, plays 73 (C std Eb 51 + 22)', t3now.notes.some((n) => n.string === 3 && n.fret === 22 && n.startTick === 1200) && f22.lit === '22' && f22.pre.midi === 73, JSON.stringify(f22.pre));
  check('fret 22 shows in the mini roll and the text tab', f22.roll === '22' && /\nEb\|[^\n]*-22-/.test(f22.ascii), f22.roll + ' / ' + f22.ascii.slice(0, 400));
  for (const [w, h] of [[390, 650], [360, 640]]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: true, hasTouch: true }); await sleep(250);
    const sm = await page.evaluate(() => { const sh = document.getElementById('picker'), nk = document.getElementById('neck'), r22 = nk.querySelector('.frow[data-fret="22"]').getBoundingClientRect(), nr = nk.getBoundingClientRect();
      return { sh: sh.scrollHeight, ch: sh.clientHeight, top: sh.getBoundingClientRect().top, page: document.scrollingElement.scrollHeight - innerHeight, nScroll: nk.scrollHeight > nk.clientHeight, row: r22.height, inView: r22.top >= nr.top - 1 && r22.bottom <= nr.bottom + 1 }; });
    check(`${w}x${h}: sheet fits with no scroll, only the neck scrolls (rows >= 24px), lit fret 22 scrolled into view`, sm.sh <= sm.ch + 1 && sm.top >= 0 && sm.page <= 0 && sm.nScroll && sm.row >= 24 && sm.inView, JSON.stringify(sm));
  }
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }); await sleep(250);
  const big = await page.evaluate(() => { const sh = document.getElementById('picker'), nk = document.getElementById('neck'); return { fits: sh.scrollHeight <= sh.clientHeight + 1, nScroll: nk.scrollHeight > nk.clientHeight + 1 }; });
  check('390x844: all 23 frets on screen, no scrolling at all', big.fits && !big.nScroll, JSON.stringify(big));
  await click('#picker-done');
  check('track limit: "+ Track" is gone at 3 tracks', !(await page.$('#track-add')));

  // Mixer: T1 solo + vol 55, T2 mute, T3 solo + vol 30  ->  audible = T1, T3
  await setVolume(0, 55); await setVolume(2, 30);
  await click('.trk:nth-child(1) .ms.s'); await click('.trk:nth-child(2) .ms.m'); await click('.trk:nth-child(3) .ms.s');
  // Loop bar 2 only (cursor in bar 2, then "Loop from this bar")
  await armTrack(0);
  await click('.cell[data-col="8"][data-str="0"]'); await click('#picker-done');
  await openDrawer(); await click('#loop-start'); await closeDrawer();
  // v9.1: the notes field lives in the lyrics sheet (the footer box opens it)
  await click('#idea-open'); await page.type('#idea', 'riff idea: answer phrase in bar 2'); await click('#lyr-done');
  await select('#grid-select', 'sixteenth');

  const original = project(await gt('window.__guitarTab.library'));
  check('built: 3 tracks, 3 tunings, 9 notes (one at fret 22), BPM 137, loop bar 2, grid 1/16',
    original.tracks.length === 3 && new Set(original.tracks.map((t) => t.tuning.id)).size === 3 &&
    original.tracks.reduce((a, t) => a + t.notes.length, 0) === 9 && original.bpm === 137 &&
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
  check('file header: schema jlr-guitar-tab v5, ppq 480, 1 project', exported.schema === 'jlr-guitar-tab' && exported.schemaVersion === 5 && exported.ppq === 480 && exported.projects.length === 1);
  const d1 = diff(comparable(original), comparable(exported.projects[0]));
  check('exported file equals the project in the app', !d1, d1);
  check('exported .json keeps fret 22', exported.projects[0].tracks[2].notes.some((n) => n.fret === 22 && n.string === 3));

  // ---------- MIDI export through the UI: the sheet, All tracks, one track ----------
  const ticksOf = (tr) => { let t = 0; return tr.map((e) => ({ ...e, tick: (t += e.deltaTime) })); };
  const onsOf = (tr) => ticksOf(tr).filter((e) => e.type === 'noteOn' && e.velocity > 0);
  await closeDrawer(); await openDrawer();
  await click('#export-midi');
  const sheet = await page.$$eval('#modal-actions button', (b) => b.map((x) => x.textContent));
  check('MIDI sheet: All tracks + one row per track + Cancel', sheet.length === 5 && /^All tracks \(3\)/.test(sheet[0]) && /muted/.test(sheet[2]) && sheet[4] === 'Cancel', JSON.stringify(sheet));
  let had2 = fs.readdirSync(DL);
  await click('#modal-actions button[data-value="all"]');
  const midAll = await waitDownload(had2, '.mid');
  check('All tracks downloaded "<project>.mid"', midAll && path.basename(midAll) === 'Round trip v4.mid', midAll);
  if (midAll) {
    const m = midiFile.parseMidi(fs.readFileSync(midAll));
    const names = m.tracks.map((tr) => (tr.find((e) => e.type === 'trackName') || {}).text);
    const tempo = m.tracks[0].find((e) => e.type === 'setTempo');
    check('All tracks .mid: Type 1, PPQ 480, conductor + 3 named tracks (muted one kept + labelled)', m.header.format === 1 && m.header.ticksPerBeat === 480 && m.tracks.length === 4 &&
      names[0] === 'Round trip v4' && names[2] === 'Lead (muted)', JSON.stringify(names));
    check('All tracks .mid: tempo 137 BPM, loop markers at bar 2', tempo && tempo.microsecondsPerBeat === Math.round(60e6 / 137) &&
      JSON.stringify(ticksOf(m.tracks[0]).filter((e) => e.type === 'marker').map((e) => e.tick)) === '[1920,3840]', JSON.stringify(tempo));
    const want = original.tracks.map((t) => t.notes.map((n) => [n.startTick, t.tuning.midi[n.string - 1] + (n.fret === null ? 0 : n.fret)]).sort((a, b) => a[0] - b[0] || a[1] - b[1]));
    const got = m.tracks.slice(1).map((tr) => onsOf(tr).map((e) => [e.tick, e.noteNumber]).sort((a, b) => a[0] - b[0] || a[1] - b[1]));
    check('All tracks .mid: every note at its tick and pitch (open string + fret), per track', JSON.stringify(got) === JSON.stringify(want), JSON.stringify(got) + ' vs ' + JSON.stringify(want));
    check('All tracks .mid: channels 1-3, CC7 from volume (55, 80, 30)', m.tracks.slice(1).every((tr, i) => onsOf(tr).every((e) => e.channel === i)) &&
      JSON.stringify(m.tracks.slice(1).map((tr) => tr.find((e) => e.type === 'controller' && e.controllerType === 7).value)) === JSON.stringify([55, 80, 30].map((v) => Math.round(v * 127 / 100))));
    check('All tracks .mid: fret 22 exported as pitch 73 on track 3', onsOf(m.tracks[3]).some((e) => e.noteNumber === 73 && e.tick === 1200));
    check('All tracks .mid: muted note velocity 30', onsOf(m.tracks[1]).filter((e) => e.velocity === 30).length === 1);
  }
  await click('#export-midi');
  had2 = fs.readdirSync(DL);
  const t1 = original.tracks[0];
  await click(`#modal-actions button[data-value="${t1.id}"]`);
  const midOne = await waitDownload(had2, '.mid');
  check('single track downloaded "<project> - <track>.mid"', midOne && path.basename(midOne) === `Round trip v4 - ${t1.name}.mid`, midOne);
  if (midOne) {
    const m1 = midiFile.parseMidi(fs.readFileSync(midOne));
    check('single track .mid: conductor + 1 track with its notes', m1.tracks.length === 2 && onsOf(m1.tracks[1]).length === t1.notes.length &&
      (m1.tracks[1].find((e) => e.type === 'trackName') || {}).text === t1.name);
    if (process.env.SAMPLE_DIR) { fs.copyFileSync(midAll, path.join(process.env.SAMPLE_DIR, 'ui-all.mid')); fs.copyFileSync(midOne, path.join(process.env.SAMPLE_DIR, 'ui-track1.mid')); }
  }
  await click('#export-midi'); await click('#modal-actions button[data-value="cancel"]');
  check('Cancel closes the MIDI sheet', await page.$eval('#modal', (m) => m.hidden));

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
  check('fret 22 survives export -> clear -> import', project(await gt('window.__guitarTab.library')).tracks[2].notes.some((n) => n.fret === 22 && n.string === 3 && n.startTick === 1200));
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
  four.schemaVersion = 4; p4.tracks.forEach((t) => { delete t.style; }); // a v7 (schema 4) file: the style lives on the project grid
  const f4 = path.join(DL, 'four-tracks.json'); fs.writeFileSync(f4, JSON.stringify(four));
  await importPath(f4, 'merge');
  const warn = await page.$eval('#modal-body', (e) => e.textContent);
  const modalShown = !(await page.$eval('#modal', (m) => m.hidden));
  if (modalShown) await click('#modal-actions button');
  const lib4 = await gt('window.__guitarTab.library');
  const got4 = lib4.projects.find((p) => p.id === 'four-tracks');
  check('import keeps the first 3 of 4 tracks and warns', got4 && got4.tracks.length === 3 && modalShown && /kept the first 3/.test(warn), warn);
  check('unknown tuning kept as "Custom (imported)" with its MIDI notes', got4 && got4.tracks[0].tuning.id === 'custom' && JSON.stringify(got4.tracks[0].tuning.midi) === '[64,59,67,62,57,52]', got4 && JSON.stringify(got4.tracks[0].tuning));
  check('v8: a v4 file\'s dotted grid becomes value 1/8 + every track Dotted, notes unmoved', got4 && JSON.stringify(got4.grid) === JSON.stringify({ value: 'eighth' }) && got4.tracks.every((t) => t.style === 'dotted') &&
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


  // ================= v7: grid value x style, rhythm row, fine grids, BPM hold =================
  const G = () => gt('window.__guitarTab.grid()');
  const styleOf = (g) => (g.dotted ? 'dotted' : g.tuplet ? 'triplet' : 'plain');
  async function setStyle(st) {
    const cur = styleOf(await G());
    if (cur === st) return;
    if (st === 'plain') await click(cur === 'dotted' ? '#grid-dot' : '#grid-trip'); else await click(st === 'dotted' ? '#grid-dot' : '#grid-trip');
  }
  const pressed = () => page.evaluate(() => [document.getElementById('grid-dot').getAttribute('aria-pressed'), document.getElementById('grid-trip').getAttribute('aria-pressed')].join());
  await fresh();
  const opts = await page.$$eval('#grid-select option', (o) => o.map((x) => x.textContent + '=' + x.value));
  check('v7: Grid dropdown is plain lengths only: 1/1 1/2 1/4 1/8 1/16 1/32 1/64', opts.join(' ') === '1/1=whole 1/2=half 1/4=quarter 1/8=eighth 1/16=sixteenth 1/32=thirtysecond 1/64=sixtyfourth', opts.join(' '));
  check('v7: default grid still 1/8 plain, both style toggles off', JSON.stringify(await G()) === '{"value":"eighth"}' && (await pressed()) === 'false,false');
  const TK = { plain: [1920, 960, 480, 240, 120, 60, 30], dotted: [2880, 1440, 720, 360, 180, 90, 45], triplet: [1280, 640, 320, 160, 80, 40, 20] };
  const VALS = ['whole', 'half', 'quarter', 'eighth', 'sixteenth', 'thirtysecond', 'sixtyfourth'], FRS = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/64'];
  for (const st of ['plain', 'dotted', 'triplet']) for (let i = 0; i < 7; i++) {
    await select('#grid-select', VALS[i]); await setStyle(st);
    const r = await page.evaluate(() => { const c = window.__guitarTab.cells(), lib = window.__guitarTab.library, p = lib.projects.find((x) => x.id === lib.activeProjectId);
      return { len: c[0].len, second: c[1] ? c[1].start : null, grid: window.__guitarTab.grid(), pgrid: p.grid, style: p.tracks[0].style, saved: JSON.parse(localStorage.getItem('jlr-guitar-tab:library-v5') || 'null'), v4: JSON.parse(localStorage.getItem('jlr-guitar-tab:library') || 'null'), label: document.querySelector('.r-lab .r-g').textContent }; });
    const want = Math.min(TK[st][i], 1920), lab = FRS[i] + (st === 'dotted' ? '.' : st === 'triplet' ? 'T' : '');
    const savedP = r.saved ? r.saved.projects.find((x) => x.id === r.saved.activeProjectId) : null, v4P = r.v4 ? r.v4.projects.find((x) => x.id === r.v4.activeProjectId) : null;
    check(`v7 grid ${lab}: step = ${TK[st][i]} ticks` + (TK[st][i] > 1920 ? ' (1 step a 4/4 bar)' : ''), r.len === want && r.second === want && styleOf(r.grid) === st && r.grid.value === VALS[i] && r.label === lab &&
      JSON.stringify(r.pgrid) === JSON.stringify({ value: VALS[i] }) && r.style === st && savedP && JSON.stringify(savedP.grid) === JSON.stringify({ value: VALS[i] }) && savedP.tracks[0].style === st &&
      r.v4.schemaVersion === 4 && v4P && JSON.stringify(v4P.grid) === JSON.stringify(r.grid) && v4P.tracks.every((t) => !('style' in t)), JSON.stringify({ ...r, saved: savedP && savedP.grid, v4: v4P && v4P.grid }));
  }
  // toggles: exclusive, tap active = plain, undo/redo
  await select('#grid-select', 'eighth'); await setStyle('plain');
  await click('#grid-dot'); const p1 = await pressed(); await click('#grid-trip'); const p2 = await pressed(); const g2 = await G(); await click('#grid-trip'); const p3 = await pressed();
  check('v7 toggles: Dotted on; Triplet turns Dotted off; tapping the active one returns to plain', p1 === 'true,false' && p2 === 'false,true' && g2.tuplet && !g2.dotted && p3 === 'false,false', [p1, p2, p3].join(' / '));
  await click('#grid-trip'); await click('#undo-btn'); const gu = await G(); await click('#redo-btn'); const gr = await G();
  check('v7 toggles: grid style change is one undo step (undo -> 1/8, redo -> 1/8T)', JSON.stringify(gu) === '{"value":"eighth"}' && styleOf(gr) === 'triplet', JSON.stringify([gu, gr]));
  // keyboard: ] finer, [ coarser, . dotted, T triplet
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press(']'); const k1 = await G(); await page.keyboard.press('.'); const k2 = await G(); await page.keyboard.press('t'); const k3 = await G(); await page.keyboard.press('t'); await page.keyboard.press('['); const k4 = await G();
  check('v7 keys: ] finer (1/16T), . dotted (1/16.), T triplet (1/16T), T again + [ (1/8)', k1.value === 'sixteenth' && styleOf(k1) === 'triplet' && styleOf(k2) === 'dotted' && styleOf(k3) === 'triplet' && JSON.stringify(k4) === '{"value":"eighth"}', JSON.stringify([k1, k2, k3, k4]));

  // ---- rhythm row: eighth triplets (beamed + "3"), quarter triplets (bracket), notes stay put ----
  await click('#grid-trip'); // 1/8T
  await click('.cell[data-col="0"][data-str="0"]');
  for (const f of [0, 2, 3, 5]) { await click(`.frow[data-fret="${f}"]`); await click('#picker-next'); }
  const stepsAfter = await gt('window.__guitarTab.editStep()');
  await click('#picker-done');
  const rh = await gt('window.__guitarTab.rhythm()');
  check('v7 1/8T: picker Next steps 160 ticks (notes at 0, 160, 320, 480), cursor on step 4', JSON.stringify(project(await gt('window.__guitarTab.library')).tracks[0].notes.map((n) => n.startTick)) === '[0,160,320,480]' && stepsAfter === 4);
  check('v7 rhythm: 8th triplets = E³, one beam start/mid/end, "3" on the middle, no bracket', JSON.stringify(rh.slice(0, 3).map((g) => [g.len, g.beams, g.beam, g.tp, g.num, g.bracket])) ===
    JSON.stringify([['E³', 1, 'start', 'start', false, false], ['E³', 1, 'mid', 'mid', true, false], ['E³', 1, 'end', 'end', false, false]]), JSON.stringify(rh.slice(0, 3)));
  const ascii = await gt('window.__guitarTab.toAscii()');
  check('v8 text tab: header says grid 1/8, the track line says 1/8T and the len row names E³', /grid 1\/8( |$)/m.test(ascii) && /\[Guitar 1\] [^\n]*· 1\/8T/.test(ascii) && /E³/.test(ascii), ascii.slice(0, 300));
  await select('#grid-select', 'quarter'); // 1/4T, 6 steps a bar; bar 2 = steps 6, 7, 8
  await page.$eval('.cell[data-col="6"][data-str="1"]', (b) => b.scrollIntoView({ inline: 'center', block: 'nearest' }));
  await click('.cell[data-col="6"][data-str="1"]');
  for (const f of [5, 7, 8, 10]) { await click(`.frow[data-fret="${f}"]`); await click('#picker-next'); }
  await click('#picker-done');
  const rq = (await gt('window.__guitarTab.rhythm()')).slice(6, 9);
  const dom = await page.evaluate(() => { const cols = [...document.querySelectorAll('#editor .col')].slice(6, 9); return cols.map((c) => { const t = c.querySelector('.tp'); return [t.className, (t.querySelector('span') || {}).textContent || '', getComputedStyle(t, '::before').borderBottomStyle]; }); });
  check('v7 rhythm: quarter triplets = Q³, no beams, bracket over all three with "3" in the middle', JSON.stringify(rq.map((g) => [g.len, g.beams, g.tp, g.bracket, g.num])) ===
    JSON.stringify([['Q³', 0, 'start', true, false], ['Q³', 0, 'mid', true, true], ['Q³', 0, 'end', true, false]]) && dom.every((d) => /\bbr\b/.test(d[0]) && d[2] === 'solid') && dom[1][1] === '3', JSON.stringify([rq, dom]));
  const notesNow = project(await gt('window.__guitarTab.library')).tracks[0].notes.map((n) => n.startTick);
  for (const v of ['sixtyfourth', 'whole', 'sixteenth']) await select('#grid-select', v);
  await setStyle('dotted');
  check('v7: notes keep their ticks through grid changes (1/64T, 1/1T, 1/16T, 1/16.)', JSON.stringify(project(await gt('window.__guitarTab.library')).tracks[0].notes.map((n) => n.startTick)) === JSON.stringify(notesNow) &&
    JSON.stringify(notesNow) === '[0,160,320,480,1920,2240,2560,2880]', JSON.stringify(notesNow));
  // playback timing of the triplets at 120 BPM: 1/6 s apart
  await page.$eval('#bpm', (el) => { el.value = '120'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await select('#grid-select', 'eighth'); await setStyle('triplet');
  await click('#play-start'); await click('#play-btn'); await sleep(900); await click('#play-btn');
  const sc = (await gt('window.__guitarTab.scheduled()')).filter((e) => e.at < 0.45);
  check('v7 playback: 8th triplets sound at 0, 0.167, 0.333 s (120 BPM)', sc.length === 3 && sc.every((e, i) => Math.abs(e.at - i / 6) < 0.002), JSON.stringify(sc));
  // JSON round trip of a triplet grid and of a dotted grid (real export -> clear -> import)
  for (const [v, st] of [['quarter', 'triplet'], ['sixtyfourth', 'dotted']]) {
    await select('#grid-select', v); await setStyle(st);
    const orig = project(await gt('window.__guitarTab.library'));
    for (const f of fs.readdirSync(DL)) fs.unlinkSync(path.join(DL, f));
    await openDrawer(); const had3 = fs.readdirSync(DL); await click('#export-one'); const fj = await waitDownload(had3); await closeDrawer();
    const ej = JSON.parse(fs.readFileSync(fj, 'utf8'));
    await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle0' });
    if (!(await page.$eval('#hint', (h) => h.hidden))) await click('#hint-ok');
    await importPath(fj, 'replace');
    const back2 = project(await gt('window.__guitarTab.library')), dd = diff(comparable(orig), comparable(back2));
    check(`v8 JSON round trip: grid ${JSON.stringify(orig.grid)} + ${st} track exported (schema v5) and imported identical`, ej.schemaVersion === 5 && JSON.stringify(ej.projects[0].grid) === JSON.stringify(orig.grid) && ej.projects[0].tracks[0].style === st && !dd &&
      (await pressed()) === (st === 'dotted' ? 'true,false' : 'false,true'), dd || JSON.stringify(ej.projects[0].grid));
  }

  // ---- 32nd and 64th beams, fine-grid step editor + mini roll ----
  await fresh();
  await select('#grid-select', 'thirtysecond');
  await click('.cell[data-col="0"][data-str="2"]');
  for (const f of [1, 2, 3, 4, 5, 6, 7, 8]) { await click(`.frow[data-fret="${f}"]`); await click('#picker-next'); }
  await click('.frow[data-fret="9"]'); await click('#picker-done'); // a whole beat of 32nds + the next beat (a note lasts until the next one)
  await select('#grid-select', 'sixtyfourth'); // bar 2 starts at step 64
  await page.$eval('.cell[data-col="64"][data-str="3"]', (b) => b.scrollIntoView({ inline: 'center', block: 'nearest' }));
  await click('.cell[data-col="64"][data-str="3"]');
  for (const f of [5, 6, 7, 8, 9]) { await click(`.frow[data-fret="${f}"]`); await click('#picker-next'); }
  const rollFine = await page.evaluate(() => ({ cols: getComputedStyle(document.getElementById('picker-roll')).getPropertyValue('--rc').trim(), cells: document.querySelectorAll('#picker-roll .rc').length, bar: document.getElementById('roll-bar').textContent,
    sh: document.getElementById('picker').scrollHeight, ch: document.getElementById('picker').clientHeight, page: document.scrollingElement.scrollHeight - innerHeight }));
  check('v7 1/64 step editor: Next = 30 ticks, mini roll shows a 16-step window ("step 6/64 · showing 1–16") and the sheet fits', (await gt('window.__guitarTab.editStep()')) === 69 && rollFine.cols === '16' && rollFine.cells === 96 &&
    /step 6\/64 · showing 1–16/.test(rollFine.bar) && rollFine.sh <= rollFine.ch + 1 && rollFine.page <= 0, JSON.stringify(rollFine));
  await click('#picker-prev-bar'); const pb = await gt('window.__guitarTab.editStep()'); await click('#picker-done');
  check('v7 1/64: « Bar goes to the bar start (step 64)', pb === 64, String(pb));
  await select('#grid-select', 'thirtysecond');
  const r32 = await gt('window.__guitarTab.rhythm()'), n32 = r32.slice(0, 8), n64 = (await (async () => { await select('#grid-select', 'sixtyfourth'); return gt('window.__guitarTab.rhythm()'); })()).slice(64, 68);
  const beamsDom = await page.evaluate(() => [...document.querySelectorAll('#editor .col')].slice(64, 68).map((c) => [...c.querySelectorAll('.bm i')].filter((i) => getComputedStyle(i).display !== 'none').length));
  check('v7 rhythm: a beat of eight 32nds = T with 3 beams, one beam group (start, mid x6, end)', JSON.stringify(n32.map((g) => [g.len, g.beams, g.beam])) === JSON.stringify([['T', 3, 'start']].concat(Array(6).fill(['T', 3, 'mid']), [['T', 3, 'end']])) && r32[8].beam !== 'mid', JSON.stringify(n32));
  check('v7 rhythm: 64ths = X with 4 beams, 4 beam lines drawn per step', JSON.stringify(n64.map((g) => [g.len, g.beams])) === JSON.stringify([['X', 4], ['X', 4], ['X', 4], ['X', 4]]) && beamsDom.join() === '4,4,4,4', JSON.stringify([n64, beamsDom]));
  await select('#grid-select', 'sixteenth'); await setStyle('dotted');
  // dotted 16ths: put notes at 0, 180, 360 in a fresh bar 2 region is not needed; the 32nd notes at 0/60/120/180 read as 1/16. spacing only if 180 apart
  const ph1 = await gt('window.__guitarTab.cells()');
  check('v7 1/16.: steps at 0, 180, 360 ... (bar of 4/4 = 11 steps, last 120)', ph1.slice(0, 3).map((c) => c.start).join() === '0,180,360' && ph1.filter((c) => c.measure === 1).length === 11 && ph1[10].len === 120, JSON.stringify(ph1.slice(0, 12)));

  // ---- no page scroll at 390x844, 390x650, 360x640 on the finest grid; toolbar fits ----
  await select('#grid-select', 'sixtyfourth'); await setStyle('triplet');
  for (const [w, h] of [[390, 844], [390, 650], [360, 640]]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: true, hasTouch: true }); await sleep(250);
    const lay = await page.evaluate(() => { const tb = document.querySelector('.toolbar'), kids = [...tb.children].map((c) => c.getBoundingClientRect()), pos = document.getElementById('ph-info').getBoundingClientRect();
      return { page: document.scrollingElement.scrollHeight - innerHeight, pageX: document.scrollingElement.scrollWidth - innerWidth, tbOver: tb.scrollWidth - tb.clientWidth, right: Math.max(...kids.map((r) => r.right)), w: innerWidth, pos: Math.round(pos.width), posText: document.getElementById('ph-info').textContent, posClip: document.getElementById('ph-info').scrollWidth - document.getElementById('ph-info').clientWidth,
        editor: document.getElementById('editor').getBoundingClientRect().height, wrap: document.querySelector('.editor-wrap') ? document.querySelector('.editor-wrap').clientHeight : null }; });
    check(`v7 ${w}x${h}: no page scroll, toolbar (grid + style + steps + position + undo/redo) fits on one row, at 1/64T`, lay.page <= 0 && lay.pageX <= 0 && lay.tbOver <= 0 && lay.right <= lay.w && lay.pos >= 30 && lay.posClip <= 0, JSON.stringify(lay));
  }
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }); await sleep(250);

  // ---- BPM hold-to-accelerate ----
  const bpmNow = async () => project(await gt('window.__guitarTab.library')).bpm;
  const setBpmTo = (v) => page.$eval('#bpm', (el, x) => { el.value = String(x); el.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  const centre = async (sel) => { const r = await page.$eval(sel, (b) => { const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }); return r; };
  const hist0 = async () => (await gt('window.__guitarTab.history()')).undo;
  await setBpmTo(90);
  let [ux, uy] = await centre('#bpm-up'); const [dx, dy] = await centre('#bpm-down');
  let h0 = await hist0();
  await page.mouse.move(ux, uy); await page.mouse.down(); await sleep(60); await page.mouse.up(); await sleep(450);
  const tapUp = await bpmNow(), h1 = await hist0();
  await page.mouse.move(dx, dy); await page.mouse.down(); await sleep(60); await page.mouse.up(); await sleep(450);
  const tapDn = await bpmNow();
  check('v7 BPM: a tap on + is exactly +1 (90 -> 91, one undo step), a tap on − is exactly −1 (-> 90)', tapUp === 91 && tapDn === 90 && h1 === h0 + 1, `${tapUp} ${tapDn} undo ${h0}->${h1}`);
  // hold + from 90 until 150
  await page.evaluate(() => { window.__sets = 0; const o = Storage.prototype.setItem; if (!window.__wrapped) { window.__wrapped = 1; Storage.prototype.setItem = function (k) { if (k === 'jlr-guitar-tab:library-v5') window.__sets++; return o.apply(this, arguments); }; } });
  h0 = await hist0();
  await page.mouse.move(ux, uy); await page.mouse.down();
  await page.waitForFunction(() => Number(document.getElementById('bpm').value) >= 150, { polling: 'raf', timeout: 8000 });
  const setsDuring = await gt('window.__sets');
  await page.mouse.up();
  const relBpm = await bpmNow(), hold1 = await gt('window.__guitarTab.bpmHold()');
  await sleep(600);
  const after = await bpmNow(), setsAfter = await gt('window.__sets');
  const log = hold1.log, t150 = (log.find((e) => e.bpm === 150) || {}).t, gaps = log.slice(1).map((e, i) => e.t - log[i].t);
  const mono = gaps.slice(2).every((g, i) => g <= gaps[i + 1] + 15); // allow timer jitter
  const tail = gaps.slice(-10), tailAvg = tail.reduce((a, b) => a + b, 0) / tail.length;
  console.log(`     BPM hold log: 90->150 in ${t150} ms; gaps ms ${gaps.join(',')}`);
  check(`v7 BPM hold: 90 -> 150 in ${t150} ms (<= 5000), first repeat after ~400 ms, gaps shrink monotonically to a steady ~36 ms (tail avg ${tailAvg.toFixed(1)})`,
    t150 <= 5000 && t150 >= 2500 && gaps[1] >= 380 && gaps[1] <= 470 && mono && tailAvg >= 30 && tailAvg <= 50 && log.every((e, i) => !i || e.bpm === log[i - 1].bpm + 1), JSON.stringify(gaps));
  check('v7 BPM hold: release stops at once (no change 600 ms later, no timer left)', after === relBpm && !hold1.holding && !(await gt('window.__guitarTab.bpmHold()')).holding, `${relBpm} -> ${after}`);
  check('v7 BPM hold: nothing saved while holding, saved once on release', setsDuring === 0 && setsAfter === 1, `during ${setsDuring}, after ${setsAfter}`);
  const hU = await hist0(); await click('#undo-btn'); const undone = await bpmNow(); await click('#redo-btn'); const redone = await bpmNow();
  check('v7 BPM hold: the whole hold is one undo step (undo -> 90, redo -> ' + relBpm + ')', hU === h0 + 1 && undone === 90 && redone === relBpm, `${h0}->${hU}, ${undone}, ${redone}`);
  // hold − the same way (90 -> 60)
  await setBpmTo(90); await page.mouse.move(dx, dy); await page.mouse.down();
  await page.waitForFunction(() => Number(document.getElementById('bpm').value) <= 30 + 30, { polling: 'raf', timeout: 8000 }); await page.mouse.up();
  const logD = (await gt('window.__guitarTab.bpmHold()')).log, t60 = (logD.find((e) => e.bpm === 60) || {}).t;
  check(`v7 BPM hold −: 90 -> 60 in ${t60} ms, 1 BPM per step`, t60 > 1500 && t60 <= 3500 && logD.every((e, i) => !i || e.bpm === logD[i - 1].bpm - 1), JSON.stringify(logD.slice(0, 5)));
  // clamps
  await setBpmTo(296); await page.mouse.move(ux, uy); await page.mouse.down(); await sleep(1300); const topHeld = await gt('window.__guitarTab.bpmHold()'); await page.mouse.up(); const top = await bpmNow();
  await setBpmTo(33); await page.mouse.move(dx, dy); await page.mouse.down(); await sleep(1300); const botHeld = await gt('window.__guitarTab.bpmHold()'); await page.mouse.up(); const bot = await bpmNow();
  check('v7 BPM hold: clamps at 300 and 30 and stops its timer there', top === 300 && bot === 30 && !topHeld.holding && !botHeld.holding && topHeld.log.at(-1).bpm === 300 && botHeld.log.at(-1).bpm === 30, `${top} ${bot}`);
  // pointerleave stops it; tempo follows live while playing
  await setBpmTo(100); await page.mouse.move(ux, uy); await page.mouse.down(); await sleep(700); await page.mouse.move(ux, uy - 120); const leftAt = await bpmNow(); await sleep(400); const leftAfter = await bpmNow(); await page.mouse.up();
  check('v7 BPM hold: sliding off the button (pointerleave) stops it', leftAfter === leftAt && leftAt > 100, `${leftAt} ${leftAfter}`);
  await click('#play-btn'); await page.mouse.move(ux, uy); await page.mouse.down(); await sleep(900); await page.mouse.up();
  const playingStill = await gt('window.__guitarTab.isPlaying()'), liveBpm = await bpmNow(); await click('#play-btn');
  check('v7 BPM hold while playing: playback keeps going at the new tempo', playingStill && liveBpm > leftAfter, `${leftAfter} -> ${liveBpm}`);

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
