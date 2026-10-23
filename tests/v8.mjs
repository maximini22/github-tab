// v8 browser checks: Share fallbacks (mocked navigator.share / canShare / clipboard), per-track note style
// (badges, cells, cursor, undo, mixed straight + triplet round trip, playback timing), the chord library
// (grid, search, detail preview, drop / undo / arp / replace / skip-x), v8.1 movable power / barre chords (stepper,
// 6th/5th toggle, 2 notes, drop D r-r-r, search by fret code, chart-order codes) and no-scroll fits at 390x844, 390x650, 360x640.
//
//   cd tests && node v8.mjs                                   (local server)
//   BASE=https://maximini22.github.io/github-tab/ node v8.mjs (live)
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from './serve.mjs';

const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
let server = null, BASE = process.env.BASE;
if (!BASE) { server = await startServer(); BASE = server.base; }
const APP = BASE.replace(/\/?$/, '/') + 'app/';
const DL = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-v8-'));
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail && !ok ? '\n     ' + detail : '')); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: process.env.HEADFUL ? false : 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', (d) => d.accept());
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const cdp = await page.createCDPSession();
await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });

const gt = (expr) => page.evaluate(new Function('return (' + expr + ')'));
const lib = () => gt('window.__guitarTab.library');
const proj = async () => { const l = await lib(); return l.projects.find((p) => p.id === l.activeProjectId); };
async function click(sel) { await page.waitForSelector(sel, { visible: true }); await page.click(sel); }
async function openDrawer() { if (await page.$eval('#drawer', (d) => d.hidden)) await click('#menu-btn'); }
async function closeDrawer() { if (!(await page.$eval('#drawer', (d) => d.hidden))) await click('#drawer-close'); }
async function select(sel, value) { await page.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, value); }
async function openCell(col, str) {
  await page.$eval(`.cell[data-col="${col}"][data-str="${str}"]`, (b) => b.scrollIntoView({ inline: 'center', block: 'nearest' }));
  await click(`.cell[data-col="${col}"][data-str="${str}"]`);
}
async function place(col, str, fret) { await openCell(col, str); await click(`.frow[data-fret="${fret}"]`); await click('#picker-done'); }
async function arm(i) { await click(`.trk:nth-child(${i + 1}) .trk-arm`); }
async function fresh() {
  await page.goto(APP, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  if (!(await page.$eval('#hint', (h) => h.hidden))) await click('#hint-ok');
}
async function waitDownload(before, ext) {
  for (let i = 0; i < 50; i++) { const f = fs.readdirSync(DL).filter((n) => n.endsWith(ext) && !before.includes(n) && !n.endsWith('.crdownload')); if (f.length) return path.join(DL, f[0]); await sleep(100); }
  return null;
}
const toastText = () => page.$eval('#toast', (t) => (t.hidden ? '' : t.textContent));
const hideToast = () => page.$eval('#toast', (t) => { t.hidden = true; });
async function importPath(file, choice) {
  await openDrawer();
  const [chooser] = await Promise.all([page.waitForFileChooser(), click('#import-btn')]);
  await chooser.accept([file]);
  await click(`#modal-actions button[data-value="${choice}"]`);
  await sleep(300);
}
const fits = (sel) => page.$eval(sel, (s) => ({ sh: s.scrollHeight, ch: s.clientHeight, top: Math.round(s.getBoundingClientRect().top), page: document.scrollingElement.scrollHeight - innerHeight, pageX: document.scrollingElement.scrollWidth - innerWidth }));

try {
  console.log('App: ' + APP);
  await fresh();

  // ================= 1. Share fallbacks =================
  await place(0, 0, 3); await place(1, 1, 5);
  await openDrawer();
  check('share: the Share button is always shown', await page.$eval('#share-btn', (b) => !b.hidden && b.offsetHeight > 0));
  // mocks: mode decides what canShare / share / clipboard do; every call is recorded
  async function mock(m) {
    await page.evaluate((m) => {
      window.__sh = { calls: [], clip: null };
      const err = (n) => { const e = new Error(n); e.name = n; return e; };
      const def = (o, k, v) => Object.defineProperty(o, k, { configurable: true, writable: true, value: v });
      if (m.noShare) { def(navigator, 'share', undefined); def(navigator, 'canShare', undefined); }
      else {
        def(navigator, 'canShare', (d) => (d.files ? !!m.canFiles : m.canText !== false));
        def(navigator, 'share', async (d) => {
          const kind = d.files ? 'files' : 'text';
          const rec = { kind, title: d.title, text: d.text || null, files: d.files ? await Promise.all(d.files.map(async (f) => ({ name: f.name, type: f.type, body: await f.text() }))) : null };
          window.__sh.calls.push(rec);
          const r = m[kind]; if (r) throw err(r);
        });
      }
      def(navigator, 'clipboard', m.noClip ? undefined : { writeText: async (t) => { if (m.clipFail) throw err('NotAllowedError'); window.__sh.clip = t; } });
    }, m);
  }
  async function doShare(m) { await mock(m); await hideToast(); await click('#share-btn'); await sleep(400); return { log: await gt('window.__guitarTab.shareLog()'), sh: await gt('window.__sh'), toast: await toastText() }; }

  let r = await doShare({ canFiles: true });
  const f = r.sh.calls[0] && r.sh.calls[0].files && r.sh.calls[0].files[0];
  let body = null; try { body = JSON.parse(f.body); } catch (e) { body = null; }
  check('share A (files allowed): shares one file, log files -> done', r.log.join() === 'files,done' && r.sh.calls.length === 1 && r.sh.calls[0].kind === 'files', JSON.stringify(r.log));
  check('share A: the file is <name>.json.txt, type text/plain, and holds the schema-5 project JSON', f && /\.json\.txt$/.test(f.name) && f.type === 'text/plain' && body && body.schemaVersion === 5 && body.projects.length === 1, f && f.name + ' ' + f.type);
  check('share A: no toast on success', r.toast === '', r.toast);

  r = await doShare({ canFiles: false });
  const tc = r.sh.calls[0] || {};
  check('share B (canShare(files) false): falls to a text share, log files:skip -> text -> done', r.log.join() === 'files:skip,text,done' && r.sh.calls.length === 1 && tc.kind === 'text', JSON.stringify(r.log));
  check('share B: text share has the title + the tab text', tc.title && tc.text && tc.text.startsWith(tc.title + '\n\n') && /^e\|/m.test(tc.text) && /3/.test(tc.text), JSON.stringify(tc).slice(0, 200));

  r = await doShare({ canFiles: true, files: 'NotAllowedError', text: 'NotAllowedError' });
  check('share C (file share rejected, text rejected): copies the tab to the clipboard', r.log.join() === 'files,files:fail:NotAllowedError,text,text:fail:NotAllowedError,clipboard,done' && r.sh.clip && /^e\|/m.test(r.sh.clip), JSON.stringify(r.log));
  check('share C: toast says the tab was copied (no "Share failed")', /copied as text/.test(r.toast) && !/failed/i.test(r.toast), r.toast);

  for (const x of fs.readdirSync(DL)) fs.unlinkSync(path.join(DL, x));
  r = await doShare({ noShare: true, noClip: true });
  const dl = await waitDownload([], '.json');
  check('share D (no Web Share, no clipboard): downloads the project, log files:skip -> text:skip -> clipboard:skip -> download', r.log.join() === 'files:skip,text:skip,clipboard:skip,download,done' && dl && JSON.parse(fs.readFileSync(dl, 'utf8')).schemaVersion === 5, JSON.stringify(r.log) + ' ' + dl);
  check('share D: toast names the saved file', /saved .*\.json/.test(r.toast), r.toast);

  r = await doShare({ noShare: true, clipFail: true });
  check('share D2 (clipboard write refused): still downloads', r.log.join() === 'files:skip,text:skip,clipboard,clipboard:fail:NotAllowedError,download,done', JSON.stringify(r.log));

  r = await doShare({ canFiles: true, files: 'AbortError' });
  check('share E (user cancels the share sheet = AbortError): no error, no fallbacks, no toast', r.log.join() === 'files,abort' && r.sh.calls.length === 1 && r.toast === '', JSON.stringify(r.log) + ' toast=' + r.toast);
  r = await doShare({ canFiles: false, text: 'AbortError' });
  check('share E2 (cancel on the text share): silent too', r.log.join() === 'files:skip,text,abort' && r.toast === '', JSON.stringify(r.log) + ' toast=' + r.toast);
  r = await doShare({ canFiles: true, files: 'DataError', text: 'NotAllowedError', noClip: true });
  check('share F (any other error): falls through every step to the download', /files:fail:DataError,text,text:fail:NotAllowedError,clipboard:skip,download,done/.test(r.log.join()), JSON.stringify(r.log));
  // a shared .json.txt imports back
  const shared = path.join(DL, 'shared-copy.json.txt'); fs.writeFileSync(shared, f.body);
  await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle0' });
  if (!(await page.$eval('#hint', (h) => h.hidden))) await click('#hint-ok');
  await importPath(shared, 'replace');
  const imp = await proj();
  check('share: the shared .json.txt file imports back (notes intact)', imp.tracks[0].notes.length === 2, JSON.stringify(imp.tracks[0].notes));
  await closeDrawer();

  // ================= 2. Per-track feel =================
  await fresh();
  await click('#track-add');
  await arm(1);
  const before = await gt('window.__guitarTab.cells()');
  await click('#grid-trip');
  let p = await proj();
  check('feel: · / 3 set the ARMED track\'s style (track 2 triplet, track 1 plain), project grid keeps only the value', p.tracks[1].style === 'triplet' && p.tracks[0].style === 'plain' && JSON.stringify(p.grid) === '{"value":"eighth"}', JSON.stringify([p.grid, p.tracks.map((t) => t.style)]));
  const tb = await page.$eval('#grid-trk', (e) => ({ t: e.textContent, c: e.className, lab: document.getElementById('grid-trip').getAttribute('aria-label'), on: document.getElementById('grid-trip').getAttribute('aria-pressed') }));
  check('feel: toolbar shows which track the toggles apply to (track 2, its colour, aria names it)', tb.t === '2' && /\bc1\b/.test(tb.c) && /Guitar 2|track 2/i.test(tb.lab) && tb.on === 'true', JSON.stringify(tb));
  const badges = await page.$$eval('.trk .trk-arm', (a) => a.map((b) => { const e = b.querySelector('.st'); return e ? e.textContent : ''; }));
  check('feel: track rows badge a non-plain style ("3" on track 2, none on track 1)', badges.join('|') === '|3', JSON.stringify(badges));
  const toast1 = await toastText();
  check('feel: toast names the track and its effective grid', /Guitar 2: triplet · 1\/8T/.test(toast1) || /: triplet · 1\/8T/.test(toast1), toast1);
  const c1 = await gt('window.__guitarTab.trackCells(0)'), c2 = await gt('window.__guitarTab.trackCells(1)');
  check('feel: each track has its own steps (track 1: 240-tick 8ths, track 2: 160-tick triplets)', c1[1].start === 240 && c2[1].start === 160 && c2.length === c1.length * 1.5 && before[1].start === 240, JSON.stringify([c1.slice(0, 3), c2.slice(0, 3)]));
  check('feel: lanes follow the armed track (editor shows 24 triplet steps)', (await page.$$eval('.cell[data-str="0"]', (a) => a.length)) === c2.length);
  // place triplets on track 2 and straight 8ths on track 1
  for (const k of [0, 1, 2, 3, 4, 5]) await place(k, 1, k + 1);
  await arm(0);
  check('feel: arming track 1 switches the lanes back to 8ths and the toggles to off', (await page.$$eval('.cell[data-str="0"]', (a) => a.length)) === c1.length && (await page.$eval('#grid-trip', (b) => b.getAttribute('aria-pressed'))) === 'false');
  for (const k of [0, 1, 2, 3]) await place(k, 0, 10 + k);
  p = await proj();
  check('feel: notes at absolute ticks (track 1 at 0/240/480/720, track 2 at 0/160/.../800)', JSON.stringify(p.tracks[0].notes.map((n) => n.startTick)) === '[0,240,480,720]' && JSON.stringify(p.tracks[1].notes.map((n) => n.startTick)) === '[0,160,320,480,640,800]',
    JSON.stringify(p.tracks.map((t) => t.notes.map((n) => n.startTick))));
  // cursor keeps its tick across arm: put the cursor at tick 480 (track 1 step 2) and arm track 2 -> step 3
  await openCell(2, 0); await click('#picker-done'); await arm(1);
  const es = await gt('window.__guitarTab.editStep()');
  check('feel: arming a track keeps the cursor on the same tick (480: 8th step 2 -> triplet step 3)', es === 3, 'step ' + es);
  // rhythm row of the triplet track names E³
  const rh = await gt('window.__guitarTab.rhythm()');
  check('feel: track 2 rhythm row reads 8th triplets (E³ with the "3")', rh[0] && rh[0].len === 'E³' && rh.slice(0, 3).some((g) => g.num === true), JSON.stringify(rh.slice(0, 3)));
  // undo covers the style change
  const hist0 = await gt('window.__guitarTab.history()');
  await click('#grid-trip'); // triplet -> plain on track 2
  p = await proj();
  const offStyle = p.tracks[1].style;
  await click('#undo-btn'); p = await proj();
  check('feel: undo restores the style change (plain -> back to triplet), one undo step', offStyle === 'plain' && p.tracks[1].style === 'triplet' && (await gt('window.__guitarTab.history()')).undo === hist0.undo, JSON.stringify([offStyle, p.tracks[1].style, hist0]));
  await click('#redo-btn'); p = await proj(); const redone = p.tracks[1].style; await click('#undo-btn');
  check('feel: redo re-applies it', redone === 'plain' && (await proj()).tracks[1].style === 'triplet');
  // dotted on track 1 shows the · badge
  await arm(0); await click('#grid-dot');
  const badges2 = await page.$$eval('.trk .trk-arm', (a) => a.map((b) => { const e = b.querySelector('.st'); return e ? e.textContent : ''; }));
  check('feel: dotted track shows the "·" badge (1: ·, 2: 3)', badges2.join('|') === '·|3', JSON.stringify(badges2));
  await click('#undo-btn');
  // playback timing: mixed straight + triplet at 120 BPM (8th = 0.25 s, triplet 8th = 0.1667 s)
  await page.$eval('#bpm', (el) => { el.value = '120'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await click('#play-start'); await click('#play-btn'); await sleep(1300); await click('#play-btn');
  const sched = (await gt('window.__guitarTab.scheduled()')).filter((e) => e.at < 0.95);
  const t0s = sched.filter((e) => e.track === 0).map((e) => e.at), t1s = sched.filter((e) => e.track === 1).map((e) => e.at);
  check('feel playback: straight track at 0, 0.25, 0.5, 0.75 s', t0s.length === 4 && t0s.every((t, i) => Math.abs(t - i * 0.25) < 0.002), JSON.stringify(t0s));
  check('feel playback: triplet track at 0, 0.167, 0.333, 0.5, 0.667, 0.833 s', t1s.length === 6 && t1s.every((t, i) => Math.abs(t - i / 6) < 0.002), JSON.stringify(t1s));
  // text tab: each track line names its own grid
  const asc = await gt('window.__guitarTab.toAscii()');
  check('feel text tab: track lines say 1/8 and 1/8T', /\[Guitar 1\][^\n]*· 1\/8(\s|$)/m.test(asc) && /\[Guitar 2\][^\n]*· 1\/8T/m.test(asc), asc.split('\n').filter((l) => /^\[/.test(l)).join(' / '));
  // mixed round trip: export -> clear -> import -> identical (incl. styles)
  const orig = await proj();
  for (const x of fs.readdirSync(DL)) fs.unlinkSync(path.join(DL, x));
  await openDrawer(); await click('#export-one'); const fx = await waitDownload([], '.json'); await closeDrawer();
  const ej = JSON.parse(fs.readFileSync(fx, 'utf8'));
  check('feel export: schema 5, track styles plain + triplet, project grid {value}', ej.schemaVersion === 5 && ej.projects[0].tracks.map((t) => t.style).join() === 'plain,triplet' && JSON.stringify(ej.projects[0].grid) === '{"value":"eighth"}');
  await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle0' });
  if (!(await page.$eval('#hint', (h) => h.hidden))) await click('#hint-ok');
  await importPath(fx, 'replace'); await closeDrawer();
  const back = await proj();
  const cmp = (q) => JSON.stringify({ grid: q.grid, bpm: q.bpm, tracks: q.tracks.map((t) => ({ id: t.id, style: t.style, notes: t.notes })) });
  check('feel: mixed straight + triplet project round-trips identical (grid, styles, notes, durations)', cmp(back) === cmp(orig), cmp(back).slice(0, 300));
  // reload keeps styles (LIB_KEY), and the v7 rollback copy is written
  await page.reload({ waitUntil: 'networkidle0' });
  const rl = await proj();
  const v4 = await page.evaluate(() => JSON.parse(localStorage.getItem('jlr-guitar-tab:library')));
  check('feel: reload keeps per-track styles; v7 copy (schema 4) kept alongside', cmp(rl) === cmp(orig) && v4.schemaVersion === 4 && v4.projects[0].tracks.every((t) => !('style' in t)));
  // an older version saving after a rollback wins on the next load
  await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('jlr-guitar-tab:library')); o.projects[0].title = 'Edited in v7'; o.projects[0].grid = { value: 'sixteenth', dotted: true }; localStorage.setItem('jlr-guitar-tab:library', JSON.stringify(o)); });
  await page.reload({ waitUntil: 'networkidle0' });
  const rb = await proj();
  check('feel: if v7 saved since (after a rollback), v8 loads that copy (dotted 1/16 on every track)', rb.title === 'Edited in v7' && JSON.stringify(rb.grid) === '{"value":"sixteenth"}' && rb.tracks.every((t) => t.style === 'dotted'), JSON.stringify([rb.title, rb.grid, rb.tracks.map((t) => t.style)]));
  // newer-version file
  const nf = path.join(DL, 'from-the-future.json'); fs.writeFileSync(nf, JSON.stringify({ ...ej, schemaVersion: 6 }));
  await openDrawer();
  const [ch] = await Promise.all([page.waitForFileChooser(), click('#import-btn')]); await ch.accept([nf]); await sleep(300);
  const nm = await page.$eval('#modal-body', (e) => e.textContent);
  check('feel: a newer file gives a clear "newer version" message', /newer version of Guitar Tab \(schemaVersion 6; this app reads up to 5\)\. Reload the app to update it/.test(nm), nm);
  await click('#modal-actions button'); await closeDrawer();

  // ================= 3. Chord library =================
  await fresh();
  await place(4, 0, 7);                    // an existing note on high e at step 5 (bar 1) -> replaced by the chord
  await place(4, 5, 9);                    // and on low E
  await openCell(4, 2);
  await click('#chords-open');
  await page.waitForSelector('#chords:not([hidden]) .ccard');
  const g = await page.evaluate(() => ({ cards: document.querySelectorAll('#chords .ccard').length, chips: [...document.querySelectorAll('#chords-fam .chip')].map((c) => c.textContent.replace(/\s+/g, ' ').trim()),
    heads: [...document.querySelectorAll('#chords .cgh .sec-lab')].map((e) => e.textContent), sub: document.getElementById('chords-sub').textContent, foot: document.getElementById('chords-foot').textContent }));
  check('chords: library opens from the step editor with 30 chord boxes in 4 groups', g.cards === 30 && g.heads.join() === 'Open chords,Power chords,Barre chords,Other', JSON.stringify(g.heads));
  check('chords: family chips with counts (All 30, Open 10, Power 12, Barre 4, Other 4)', g.chips.join('|') === 'All 30|Open 10|Power 12|Barre 4|Other 4', g.chips.join('|'));
  check('chords: header says track, tuning, bar and step; foot says boxes and codes read low E → high e and shapes slide with ‹ fret ›', /Guitar 1 · E std · Bar 1 · step 5\/8/.test(g.sub) && /low E → high e/.test(g.foot) && /‹ fret ›/.test(g.foot), g.sub + ' / ' + g.foot);
  await page.type('#chords-q', 'power');
  const pw = await page.$$eval('#chords .ccard', (a) => a.map((c) => c.dataset.id));
  check('chords: search "power" shows the 12 power chords, one per root (E5 first)', pw.join() === 'P-E,P-F,P-F#,P-G,P-G#,P-A,P-A#,P-B,P-C,P-C#,P-D,P-D#', pw.join());
  await page.$eval('#chords-q', (e) => { e.value = ''; e.dispatchEvent(new Event('input')); });
  await click('#chords-fam .chip[data-fam="barre"]');
  check('chords: Barre chip filters to F, Bm, B, F#m', (await page.$$eval('#chords .ccard', (a) => a.map((c) => c.dataset.id))).join() === 'F,Bm,B,F#m');
  await click('#chords-fam .chip[data-fam="all"]');
  // box orientation (v8.1): like a chart, low E on the left. Em's finger dots (A + D strings) sit left of centre; strings labelled
  const emBox = await page.$eval('#chords .ccard[data-id="Em"]', (c) => ({ dots: [...c.querySelectorAll('svg circle[r="6"]')].map((e) => Number(e.getAttribute('cx'))), labs: [...c.querySelectorAll('svg text.bs')].map((t) => t.textContent).join(''), code: c.querySelector('.cf').textContent, aria: c.getAttribute('aria-label') }));
  check('chords: Em box has low E on the left (A/D dots at x<=40) and strings labelled E A D G B e', emBox.dots.length === 2 && emBox.dots.every((x) => x <= 40) && emBox.labs === 'EADGBe', JSON.stringify(emBox));
  const codes = await page.$$eval('#chords .ccard', (a) => Object.fromEntries(a.map((c) => [c.dataset.id, c.querySelector('.cf').textContent])));
  check('chords: card codes read low → high with no "e" prefix (Em 022000, A x02220, F 133211, F#5 244, A5 577, C5 x355)', codes.Em === '022000' && codes.A === 'x02220' && codes.F === '133211' && codes['P-F#'] === '244' && codes['P-A'] === '577' && codes['P-C'] === 'x355', JSON.stringify(codes));
  await fitAll('grid');
  await click('#chords .ccard[data-id="Em"]');
  const d = await page.evaluate(() => ({ name: document.getElementById('cd-name').textContent, info: document.getElementById('cd-info').textContent, pv: [...document.querySelectorAll('#cd-roll .rc.pv b')].map((b) => b.textContent),
    pvCols: [...new Set([...document.querySelectorAll('#cd-roll .rc.pv')].map((e) => e.parentNode && [...e.parentNode.children].indexOf(e) % 9))],
    marks: [...document.querySelectorAll('#cd-neck .mk')].map((m) => (m.classList.contains('o') ? 'o' : m.classList.contains('x') ? 'x' : '') + ':' + m.textContent + '@' + [...m.classList].find((k) => /^k\d$/.test(k))),
    chips: [...document.querySelectorAll('#cd-chips .chip')].map((c) => c.textContent), str: document.getElementById('cd-str').textContent, cap: document.getElementById('cd-cap').textContent }));
  check('chords detail: Em, code 022000 labelled "low E → high e"', d.name === 'Em' && /022000/.test(d.info) && /low E → high e/.test(d.info) && !/000220/.test(d.info), d.info);
  check('chords detail: preview roll shows the six notes stacked at the cursor step (high e 0 … low E 0)', d.pv.join('') === '000220' && /Strum · 6 notes/.test(d.cap), JSON.stringify(d));
  check('chords detail: neck marks open strings (rings) and fingers 2 + 3 on the A/D columns (right side)', d.marks.filter((m) => m.startsWith('o')).length === 4 && d.marks.includes(':2@k4') && d.marks.includes(':3@k3'), JSON.stringify(d.marks));
  const cap2 = await page.$eval('.cneck-cap', (e) => e.textContent);
  check('chords detail: string chips run low E first (like the chart); the neck stays the app neck (high e left) and says so', d.str.replace(/\s/g, '') === 'freteBGDAE' && /high e on the left/.test(cap2) && d.chips[0].startsWith('E') && d.chips[5].startsWith('e') && /fret 2 · finger 2/.test(d.chips[1]), d.str + ' ' + cap2 + ' ' + JSON.stringify(d.chips));
  check('chords detail: open shapes have no fret stepper', await page.$eval('#cd-move', (e) => e.hidden));
  await fitAll('detail');
  // drop (strum): 6 notes at the cursor step on the armed track, replacing high e 7 and low E 9, one undo step
  const h0 = await gt('window.__guitarTab.history()');
  await click('#cd-drop');
  p = await proj();
  const at = p.tracks[0].notes.filter((n) => n.startTick === 960).map((n) => n.string + ':' + n.fret).sort().join(' ');
  const tt = await toastText();
  check('chords drop: Em writes 6 notes at the step (tick 960), replacing the old high e 7 and low E 9', at === '1:0 2:0 3:0 4:2 5:2 6:0' && p.tracks[0].notes.length === 6, at + ' / ' + p.tracks[0].notes.length);
  check('chords drop: sheet closes back to the step editor; toast "Em added at bar 1, step 5" with Undo', (await page.$eval('#chords', (s) => s.hidden)) && !(await page.$eval('#picker', (s) => s.hidden)) && /Em added at bar 1, step 5/.test(tt) && /Undo/.test(tt), tt);
  check('chords drop: one undo step', (await gt('window.__guitarTab.history()')).undo === h0.undo + 1);
  await shot('v8-chord-dropped.png');
  await click('#toast-act');
  p = await proj();
  check('chords undo (toast button): back to the old notes (high e 7, low E 9)', p.tracks[0].notes.map((n) => n.string + ':' + n.fret).sort().join(' ') === '1:7 6:9', JSON.stringify(p.tracks[0].notes));
  // skip x strings: D (xx0232) leaves the low E 9 alone, replaces high e 7
  await click('#chords-open'); await page.waitForSelector('#chords:not([hidden]) .ccard'); await click('#chords .ccard[data-id="D"]'); await click('#cd-drop');
  p = await proj();
  check('chords drop: D (xx0232) skips the x strings (low E 9 kept), replaces high e 7', p.tracks[0].notes.filter((n) => n.startTick === 960).map((n) => n.string + ':' + n.fret).sort().join(' ') === '1:2 2:3 3:2 4:0 6:9', JSON.stringify(p.tracks[0].notes));
  await click('#picker-undo');
  check('chords: step editor Undo removes the D drop (old notes back)', (await proj()).tracks[0].notes.map((n) => n.string + ':' + n.fret).sort().join(' ') === '1:7 6:9');
  // Arp: Am (x02210) from step 7 of bar 1 (8th grid): 5 notes one step apart, low string first, runs into bar 2
  await click('#picker-done'); await openCell(6, 2);
  await click('#chords-open'); await page.waitForSelector('#chords:not([hidden]) .ccard'); await click('#chords .ccard[data-id="Am"]'); await click('#cd-arp');
  const cap = await page.$eval('#cd-cap', (e) => e.textContent);
  check('chords arp: preview says 5 steps, 3 into the next bar', /Arp · 5 steps \(3 into the next bar\)/.test(cap), cap);
  await click('#cd-drop');
  p = await proj();
  const arpN = p.tracks[0].notes.filter((n) => n.startTick >= 1440).sort((a, b) => a.startTick - b.startTick).map((n) => n.startTick + ':' + n.string + ':' + n.fret);
  check('chords arp: Am lands one 8th apart, low string first (1440 A0, 1680 D2, 1920 G2, 2160 B1, 2400 e0)', arpN.join() === '1440:5:0,1680:4:2,1920:3:2,2160:2:1,2400:1:0', arpN.join());
  check('chords arp: toast says "Am arpeggio added at bar 1, step 7"', /Am arpeggio added at bar 1, step 7/.test(await toastText()));
  // arp at the very end adds bars (song is 2 bars of 8 steps: from step 16, the Em arp needs 6 steps)
  await click('#picker-undo'); await click('#picker-done');
  const bars0 = (await proj()).lengthTicks;
  await openCell(15, 0); await click('#chords-open'); await page.waitForSelector('#chords:not([hidden]) .ccard'); await click('#chords .ccard[data-id="Em"]');
  check('chords: Arp choice is remembered', (await page.$eval('#cd-arp', (b) => b.getAttribute('aria-pressed'))) === 'true');
  await click('#cd-drop');
  p = await proj();
  check('chords arp at the end: adds a bar for the overflow (2 -> 3 bars), 6 notes', p.lengthTicks === bars0 + 1920 && p.tracks[0].notes.filter((n) => n.startTick >= 3600).length === 6, p.lengthTicks + ' ' + p.tracks[0].notes.length);
  await click('#picker-undo');
  p = await proj();
  check('chords arp undo: one step removes the notes and the added bar', p.lengthTicks === bars0 && p.tracks[0].notes.length === 2, p.lengthTicks + ' ' + p.tracks[0].notes.length);
  // other track + tuning names: D standard track, Em shape = Dm
  await click('#picker-done'); await click('#track-add'); await arm(1);
  await openDrawer(); await select('#tuning', 'd-standard'); await closeDrawer();
  await openCell(0, 0); await click('#chords-open'); await page.waitForSelector('#chords:not([hidden]) .ccard');
  const dn = await page.$eval('#chords .ccard[data-id="Em"]', (c) => c.querySelector('.cn').textContent + ' / ' + c.querySelector('.cq').textContent);
  check('chords: names follow the armed track\'s tuning (D standard: Em shape shows as Dm)', /^Dm \/ Em shape/.test(dn), dn);
  await click('#chords .ccard[data-id="Em"]');
  const note = await page.$eval('#cd-note', (e) => (e.hidden ? '' : e.textContent));
  check('chords: detail explains the transposed name', /Em shape sounds as Dm/.test(note), note);
  await click('#cd-strum'); await click('#cd-drop');
  p = await proj();
  check('chords drop goes to the ARMED track (track 2), track 1 untouched', p.tracks[1].notes.length === 6 && p.tracks[0].notes.length === 2 && /Dm added/.test(await toastText()));
  // Escape: detail -> grid -> closed
  await click('#chords-open'); await page.waitForSelector('#chords:not([hidden]) .ccard'); await click('#chords .ccard[data-id="G"]');
  await page.keyboard.press('Escape');
  const e1 = await page.evaluate(() => ({ open: !document.getElementById('chords').hidden, detail: document.getElementById('chords').classList.contains('detail') }));
  await page.keyboard.press('Escape');
  const e2 = await page.evaluate(() => ({ chords: !document.getElementById('chords').hidden, picker: !document.getElementById('picker').hidden }));
  check('chords: Escape goes detail -> grid -> closed (step editor stays open)', e1.open && !e1.detail && !e2.chords && e2.picker, JSON.stringify([e1, e2]));
  await click('#picker-done');

  // ================= 3b. v8.1 movable power + barre chords =================
  await fresh();
  const chs = () => gt('window.__guitarTab.chords()');
  const atTick = async (t, tr = 0) => (await proj()).tracks[tr].notes.filter((n) => n.startTick === t).map((n) => n.string + ':' + n.fret).sort().join(' ');
  await openCell(0, 0); await click('#chords-open'); await page.waitForSelector('#chords:not([hidden]) .ccard');
  await click('#chords-fam .chip[data-fam="power"]'); await sleep(100);
  await shot('v81-power-grid.png');
  await click('#chords-fam .chip[data-fam="all"]');
  await page.type('#chords-q', '244');
  const s244 = await page.$$eval('#chords .ccard', (a) => a.map((c) => c.dataset.id));
  check('power: search "244" finds F#5 (and F#m 244222), not B5 (x244)', s244.includes('P-F#') && !s244.includes('P-B') && s244.length <= 2, s244.join());
  await click('#chords .ccard[data-id="P-F#"]');
  let c = await chs();
  check('power: F#5 card = 244, fingers 1-3-4, on strings 6/5/4', c.cur.name === 'F#5' && c.cur.code === '244' && c.cur.notes.map((n) => n.string + ':' + n.fret).join(' ') === '6:2 5:4 4:4' && c.cur.fingers.slice(0, 3).join('') === '134', JSON.stringify(c.cur));
  await click('#cd-drop');
  check('power drop: F#5 writes 6:2 5:4 4:4 at the step, toast "F#5 added"', (await atTick(0)) === '4:4 5:4 6:2' && /F#5 added/.test(await toastText()), await atTick(0));
  await click('#picker-undo');
  check('power drop: one undo removes it', (await proj()).tracks[0].notes.length === 0);
  for (const q of ['577', 'A5']) {
    await click('#chords-open'); await page.waitForSelector('#chords:not([hidden]) .ccard');
    await page.$eval('#chords-q', (e, v) => { e.value = v; e.dispatchEvent(new Event('input')); }, q);
    const ids = await page.$$eval('#chords .ccard', (a) => a.map((x) => x.dataset.id));
    check(`power: search "${q}" finds A5`, ids[0] === 'P-A' && !ids.includes('P-D'), ids.join());
    await page.keyboard.press('Escape');
  }
  await click('#chords-open'); await page.waitForSelector('#chords:not([hidden]) .ccard');
  await page.$eval('#chords-q', (e) => { e.value = ''; e.dispatchEvent(new Event('input')); });
  await click('#chords-fam .chip[data-fam="power"]');
  await click('#chords .ccard[data-id="P-A"]'); await sleep(100);
  const ui = await page.evaluate(() => ({ mv: !document.getElementById('cd-move').hidden, fret: document.getElementById('cd-fret').textContent, info: document.getElementById('cd-info').textContent, s6: document.getElementById('cd-s6').getAttribute('aria-pressed'), n3: document.getElementById('cd-n3').getAttribute('aria-pressed'), name: document.getElementById('cd-name').textContent }));
  check('power stepper: A5 detail shows 577, "fret 5", 6th string and 3 notes selected', ui.mv && ui.name === 'A5' && /577/.test(ui.info) && ui.fret === 'fret 5' && ui.s6 === 'true' && ui.n3 === 'true', JSON.stringify(ui));
  await shot('v81-power-stepper.png');
  await click('#cd-up'); await click('#cd-up'); c = await chs();
  check('power stepper: › twice from A5 = B5 799, the B5 card is highlighted', c.cur.name === 'B5' && c.cur.code === '799' && c.sel === 'P-B' && (await page.$eval('#cd-fret', (e) => e.textContent)) === 'fret 7', JSON.stringify(c));
  for (let i = 0; i < 3; i++) await click('#cd-up');
  c = await chs();
  check('power stepper: two-digit frets read 10-12-12 (D5)', c.cur.name === 'D5' && c.cur.code === '10-12-12', c.cur.code);
  for (let i = 0; i < 20; i++) { if (await page.$eval('#cd-up', (b) => b.disabled)) break; await click('#cd-up'); }
  c = await chs();
  check('power stepper: stops at the top (root fret 20, top fret 22)', c.mv.r === 20 && Math.max(...c.cur.frets.filter((f) => f !== null)) === 22 && (await page.$eval('#cd-up', (b) => b.disabled)), JSON.stringify(c.mv) + ' ' + c.cur.code);
  check('power stepper: high positions fit (neck shows 0 then a window round the shape)', (await fits('#chords')).sh <= (await fits('#chords')).ch + 1 && (await page.$$eval('#cd-neck .frow.gap', (a) => a.length)) === 1);
  for (let i = 0; i < 25; i++) { if (await page.$eval('#cd-down', (b) => b.disabled)) break; await click('#cd-down'); }
  c = await chs();
  check('power stepper: stops at the bottom (E5 open, 022)', c.mv.r === 0 && c.cur.name === 'E5' && c.cur.code === '022' && (await page.$eval('#cd-down', (b) => b.disabled)), c.cur.code);
  for (let i = 0; i < 5; i++) await click('#cd-up');
  await click('#cd-s5'); c = await chs();
  check('power 6th/5th toggle: A5 moves to the A string and keeps its root (x022)', c.mv.shape === 'pow5' && c.cur.name === 'A5' && c.cur.code === 'x022', JSON.stringify(c.cur));
  await click('#cd-up'); await click('#cd-up'); await click('#cd-up'); c = await chs();
  check('power 5th string: fret 3 = C5 x355 on strings 5/4/3', c.cur.name === 'C5' && c.cur.code === 'x355' && c.cur.notes.map((n) => n.string + ':' + n.fret).join(' ') === '5:3 4:5 3:5', JSON.stringify(c.cur));
  await click('#cd-s6'); c = await chs();
  check('power 6th/5th toggle back: C5 on the 6th string = 8-10-10', c.cur.name === 'C5' && c.cur.code === '8-10-10' && c.mv.shape === 'pow6', c.cur.code);
  await click('#cd-n2'); c = await chs();
  check('power 2 notes (1·5): C5 = 8-10, root + 5th only', c.mv.n === 2 && c.cur.code === '8-10' && c.cur.notes.length === 2, c.cur.code);
  await click('#cd-drop');
  check('power drop: 2-note C5 writes 6:8 5:10', (await atTick(0)) === '5:10 6:8', await atTick(0));
  await click('#picker-undo');
  // C5 card itself (5th string)
  await click('#chords-open'); await page.waitForSelector('#chords:not([hidden]) .ccard'); await click('#chords .ccard[data-id="P-C"]'); c = await chs();
  check('power: C5 card is the A-string shape x355, 3 notes again', c.cur.code === 'x355' && c.mv.shape === 'pow5' && c.mv.n === 3 && (await page.$eval('#cd-s5', (b) => b.getAttribute('aria-pressed'))) === 'true', JSON.stringify(c.mv));
  await click('#cd-drop');
  check('power drop: C5 x355 writes 5:3 4:5 3:5 (low E left alone)', (await atTick(0)) === '3:5 4:5 5:3', await atTick(0));
  await click('#picker-undo');
  // movable barre: F (E shape) -> stepper -> A shape
  await click('#chords-open'); await page.waitForSelector('#chords:not([hidden]) .ccard'); await click('#chords-fam .chip[data-fam="barre"]'); await click('#chords .ccard[data-id="F"]'); c = await chs();
  const bl = await page.evaluate(() => [document.getElementById('cd-s6').textContent, document.getElementById('cd-s5').textContent, document.getElementById('cd-ns').hidden]);
  check('barre: F is movable (E shape / A shape toggle, no note-count toggle)', c.cur.code === '133211' && bl.join() === 'E shape,A shape,true' && JSON.stringify(c.cur.barre).includes('"fret":1'), JSON.stringify([c.cur, bl]));
  await click('#cd-up'); await click('#cd-up'); c = await chs();
  check('barre stepper: E shape fret 3 = G 355433', c.cur.name === 'G' && c.cur.code === '355433', c.cur.code);
  await click('#cd-s5'); c = await chs();
  check('barre toggle: A shape keeps G (x-10-12-12-12-10)', c.cur.name === 'G' && c.cur.code === 'x-10-12-12-12-10', c.cur.code);
  await click('#cd-drop');
  check('barre drop: G A-shape writes 5 notes from the A string', (await atTick(0)) === '1:10 2:12 3:12 4:12 5:10', await atTick(0));
  await click('#picker-undo'); await click('#picker-done');
  // drop D track: the power chord is a one-finger barre r, r, r
  await click('#track-add'); await arm(1);
  await openDrawer(); await select('#tuning', 'drop-d'); await closeDrawer();
  await openCell(0, 0); await click('#chords-open'); await page.waitForSelector('#chords:not([hidden]) .ccard'); await click('#chords-fam .chip[data-fam="all"]');
  const dd = await page.$eval('#chords .ccard[data-id="P-E"]', (x) => ({ n: x.querySelector('.cn').textContent, f: x.querySelector('.cf').textContent, labs: [...x.querySelectorAll('svg text.bs')].map((t) => t.textContent).join('') }));
  check('drop D: power cards follow the real strings (E5 = 222, box strings D A D G B e)', dd.n === 'E5' && dd.f === '222' && dd.labs === 'DADGBe', JSON.stringify(dd));
  await click('#chords .ccard[data-id="P-E"]'); c = await chs();
  check('drop D: E5 is a one-finger barre (fingers 1-1-1, barre at fret 2)', c.cur.fingers.slice(0, 3).join('') === '111' && c.cur.barre && c.cur.barre.fret === 2, JSON.stringify(c.cur));
  await click('#cd-up'); await click('#cd-up'); await click('#cd-up'); c = await chs();
  check('drop D stepper: fret 5 = G5 555', c.cur.name === 'G5' && c.cur.code === '555', c.cur.code);
  await click('#cd-drop');
  check('drop D drop: G5 lands on track 2 strings 6/5/4 at fret 5, track 1 untouched', (await atTick(0, 1)) === '4:5 5:5 6:5' && (await proj()).tracks[0].notes.length === 0, await atTick(0, 1));
  await click('#picker-done');

  // ================= 4. No scroll at three sizes =================
  for (const [w, h] of [[390, 844], [390, 650], [360, 640]]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: true, hasTouch: true }); await sleep(250);
    const pg = await page.evaluate(() => ({ y: document.scrollingElement.scrollHeight - innerHeight, x: document.scrollingElement.scrollWidth - innerWidth }));
    await openCell(0, 0);
    const pk = await fits('#picker');
    await click('#chords-open'); await page.waitForSelector('#chords:not([hidden]) .ccard');
    const cg = await fits('#chords');
    const cgIn = await page.$eval('#chords-list', (l) => l.scrollHeight > l.clientHeight);
    await click('#chords .ccard[data-id="F"]'); await sleep(100);
    const cd = await fits('#chords');
    const cdx = await page.evaluate(() => { const s = document.getElementById('chords'), bad = []; s.querySelectorAll('.cside .btn, .cside .chip, .cd-name b').forEach((e) => { if (e.scrollWidth > e.clientWidth + 1) bad.push(e.id || e.className); });
      const nk = document.getElementById('cd-neck'), drop = document.getElementById('cd-drop').getBoundingClientRect(), rows = nk.children.length, fr = nk.children[0].getBoundingClientRect().height;
      return { bad, rows, fr, dropIn: drop.bottom <= innerHeight, nolist: s.classList.contains('nolist') }; });
    check(`fit ${w}x${h}: page, step editor, chord grid and chord detail all fit with no scroll`, pg.y <= 0 && pg.x <= 0 && pk.sh <= pk.ch + 1 && cg.sh <= cg.ch + 1 && cd.sh <= cd.ch + 1 && cg.top >= 0 && cd.top >= 0 && cdx.dropIn && !cdx.bad.length && cdx.rows >= 6 && cdx.fr >= 16,
      JSON.stringify({ pg, pk, cg, cd, cdx }));
    console.log(`     ${w}x${h}: picker ${pk.sh}/${pk.ch}, grid ${cg.sh}/${cg.ch} (list scrolls inside: ${cgIn}), detail ${cd.sh}/${cd.ch}, neck ${cdx.rows} rows x ${cdx.fr}px${cdx.nolist ? ', list band hidden' : ''}`);
    await page.keyboard.press('Escape');
    await click('#chords .ccard[data-id="P-A"]'); await sleep(100);
    const pd = await fits('#chords');
    const pdx = await page.evaluate(() => { const bad = []; document.querySelectorAll('#cd-move .btn, #cd-fret, .cside .btn').forEach((e) => { const r = e.getBoundingClientRect(); if (e.scrollWidth > e.clientWidth + 1 || r.right > innerWidth || r.left < 0) bad.push(e.id || e.className); });
      return { bad, dropIn: document.getElementById('cd-drop').getBoundingClientRect().bottom <= innerHeight, row: Math.round(document.getElementById('cd-move').getBoundingClientRect().height) }; });
    check(`fit ${w}x${h}: power detail with the 6th/5th + ‹ fret › + 1·5·8 row fits, nothing clipped`, pd.sh <= pd.ch + 1 && pd.page <= 0 && pd.pageX <= 0 && pdx.dropIn && !pdx.bad.length && pdx.row <= 44, JSON.stringify({ pd, pdx }));
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await click('#picker-done');
  }
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });

  check('no page errors', errors.length === 0, errors.join('\n'));
} catch (e) {
  check('test run', false, e.stack);
} finally {
  await browser.close();
  if (server) server.srv.close();
}
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);

async function fitAll() { /* sizes are covered in section 4 */ }
async function shot(name) { if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, name) }); }
