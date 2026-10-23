// v9 checks: sampled Sounds. The per-track Sound list (5 tones, undo, persistence, Escape), Nylon default for old
// files, the optional "tone" field (JSON round trip, schema still 5, stripped from the v7 rollback copy), bass
// tones sounding 12 semitones under the tab (scheduler + rendered pitch), MIDI programs and octave, lazy loading
// (nothing from tones/ before first paint and the load event; only what the project uses), Play waiting for the
// samples (loading state, cancel), fallback to Nylon when a tone fails, offline replay from the cache, measured
// onset / pitch / loudness of every sample, the metronome's level, no synth left, credits, no scroll at 3 sizes,
// and (local only) first-load time against v8.2.
//
//   cd tests && node v9.mjs                                   (local server; also benches against a v8.2 worktree)
//   BASE=https://maximini22.github.io/github-tab/ node v9.mjs (live)
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseMidi } from 'midi-file';
import { startServer } from './serve.mjs';

const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const LIVE = !!process.env.BASE;
let server = null, BASE = process.env.BASE;
if (!BASE) { server = await startServer(); BASE = server.base; }
BASE = BASE.replace(/\/?$/, '/');
const APP = BASE + 'app/';
const DL = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-v9-')), FX = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-v9fx-'));
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail && !ok ? '\n     ' + detail : '')); }
function info(s) { console.log('     ' + s); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TONES = ['nylon', 'spanish', 'clean', 'upright', 'ebass'], BASS = { upright: 1, ebass: 1 };
const PROG = { nylon: 25, spanish: 25, clean: 28, upright: 33, ebass: 34 };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: process.env.HEADFUL ? false : 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const VIEW = { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true };

// ---------- one "user" = one page with helpers ----------
async function user(ctx, opts = {}) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.setViewport(VIEW);
  const cdp = await page.createCDPSession();
  const bc = await browser.target().createCDPSession();
  await bc.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL, ...(ctx.id ? { browserContextId: ctx.id } : {}) });
  const gt = (expr) => page.evaluate(new Function('return (' + expr + ')'));
  const u = { page, gt };
  u.proj = async () => { const l = await gt('window.__guitarTab.library'); return l.projects.find((p) => p.id === l.activeProjectId); };
  u.click = async (sel) => { await page.waitForSelector(sel, { visible: true }); await page.click(sel); };
  u.openDrawer = async () => { if (await page.$eval('#drawer', (d) => d.hidden)) await u.click('#menu-btn'); };
  u.closeDrawer = async () => { if (!(await page.$eval('#drawer', (d) => d.hidden))) await u.click('#drawer-close'); };
  u.hint = async () => { if (!(await page.$eval('#hint', (h) => h.hidden))) await u.click('#hint-ok'); };
  u.fresh = async () => { await page.goto(APP, { waitUntil: 'networkidle0' }); await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle0' }); await u.hint(); };
  u.place = async (col, str, fret) => {
    await page.$eval(`.cell[data-col="${col}"][data-str="${str}"]`, (b) => b.scrollIntoView({ inline: 'center', block: 'nearest' }));
    await u.click(`.cell[data-col="${col}"][data-str="${str}"]`); await u.click(`.frow[data-fret="${fret}"]`); await u.click('#picker-done');
  };
  u.toast = () => page.$eval('#toast', (t) => (t.hidden ? '' : t.textContent));
  u.hideToast = () => page.$eval('#toast', (t) => { t.hidden = true; });
  u.state = (id) => gt(`window.__guitarTab.toneState(${JSON.stringify(id)})`);
  u.ready = (id, ms = 15000) => page.waitForFunction((id) => window.__guitarTab.toneState(id) === 'ready', { timeout: ms }, id).then(() => true, () => false);
  u.importPath = async (file, choice) => {
    await u.openDrawer();
    const [chooser] = await Promise.all([page.waitForFileChooser(), u.click('#import-btn')]);
    await chooser.accept([file]); await u.click(`#modal-actions button[data-value="${choice}"]`); await sleep(300);
    for (let i = 0; i < 5 && !(await page.$eval('#modal', (m) => m.hidden)); i++) { await page.click('#modal-actions button'); await sleep(200); } // warnings notice
    await u.closeDrawer();
  };
  u.exportJson = async () => {
    for (const x of fs.readdirSync(DL)) fs.unlinkSync(path.join(DL, x));
    await u.openDrawer(); await u.click('#export-one');
    let f = null; for (let i = 0; i < 50 && !f; i++) { f = fs.readdirSync(DL).find((n) => n.endsWith('.json')); if (!f) await sleep(100); }
    await u.closeDrawer(); return f && JSON.parse(fs.readFileSync(path.join(DL, f), 'utf8'));
  };
  u.sndLabels = () => page.$$eval('.trk .trk-snd', (a) => a.map((b) => b.textContent.trim()));
  u.playFor = async (ms) => { await u.click('#play-start'); await u.click('#play-btn'); await page.waitForFunction(() => window.__guitarTab.isPlaying(), { timeout: 15000 }).catch(() => {}); await sleep(ms); const s = await gt('window.__guitarTab.scheduled()'); await u.click('#stop-btn'); await sleep(100); return s; };
  return u;
}
const writeJson = (name, obj) => { const f = path.join(FX, name); fs.writeFileSync(f, JSON.stringify(obj)); return f; };

// ---------- signal helpers (Node) ----------
function kw(x) { // K-weighting, BS.1770 48 kHz coefficients
  const st = [[[1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]], [[1, -2, 1], [1, -1.99004745483398, 0.99007225036621]]];
  let y = Float64Array.from(x);
  for (const [b, a] of st) { const o = new Float64Array(y.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < y.length; i++) { const v = b[0] * y[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2; x2 = x1; x1 = y[i]; y2 = y1; y1 = v; o[i] = v; } y = o; }
  return y;
}
const msDb = (x, a, n) => { let s = 0; for (let i = a; i < a + n && i < x.length; i++) s += x[i] * x[i]; return 10 * Math.log10(s / n + 1e-20); };
function yin(x, sr, fmin = 30, fmax = 1500) { // returns Hz (or 0)
  const tmin = Math.floor(sr / fmax), tmax = Math.ceil(sr / fmin), W = Math.min(Math.floor(x.length - tmax - 2), Math.round(sr * 0.1));
  if (W < tmax) return 0;
  const d = new Float64Array(tmax + 2);
  for (let t = 1; t <= tmax + 1; t++) { let s = 0; for (let i = 0; i < W; i++) { const v = x[i] - x[i + t]; s += v * v; } d[t] = s; }
  const c = new Float64Array(tmax + 2); c[0] = 1; let run = 0;
  for (let t = 1; t <= tmax + 1; t++) { run += d[t]; c[t] = d[t] * t / (run || 1); }
  let tau = -1;
  for (let t = tmin; t <= tmax; t++) if (c[t] < 0.15) { while (t + 1 <= tmax && c[t + 1] < c[t]) t++; tau = t; break; }
  if (tau < 0) { let b = tmin; for (let t = tmin; t <= tmax; t++) if (c[t] < c[b]) b = t; tau = b; }
  const a = c[tau - 1], b = c[tau], e = c[tau + 1], den = a - 2 * b + e, sh = den ? 0.5 * (a - e) / den : 0;
  return sr / (tau + sh);
}
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const centsOff = (f, m) => 1200 * Math.log2(f / hz(m));

try {
  console.log('App: ' + APP + (LIVE ? '  (live)' : '  (local)'));

  // ================= 1. Lazy loading (fresh profile, service worker on) =================
  const ctxA = await browser.createBrowserContext();
  const A = await user(ctxA);
  const net = [];
  A.page.on('request', (r) => { if (r.url().indexOf('/tones/') >= 0) net.push(r.url().split('/tones/')[1]); });
  await A.page.goto(APP, { waitUntil: 'networkidle0' });
  await A.hint();
  const nyOk = await A.ready('nylon');
  const tm = await A.page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0], f = performance.getEntriesByName('first-contentful-paint')[0];
    const t = window.__guitarTab.toneRequests(); return { load: n.loadEventEnd, fcp: f ? f.startTime : null, first: t.length ? Math.min(...t.map((r) => r.t)) : null, n: t.length }; });
  check('lazy: Nylon loads by itself on a fresh profile and is ready', nyOk);
  check('lazy: no tones/ request before first paint or before the load event', tm.first != null && tm.fcp != null && tm.first >= tm.fcp && tm.first >= tm.load, JSON.stringify(tm));
  info(`first paint ${tm.fcp && tm.fcp.toFixed(0)} ms, load ${tm.load.toFixed(0)} ms, first tone request ${tm.first && tm.first.toFixed(0)} ms`);
  check('lazy: a fresh Nylon project fetches only nylon.json + nylon.mp3', net.slice().sort().join() === 'nylon.json,nylon.mp3', net.join());
  check('lazy: the track row shows a Sound button reading "Nylon"', (await A.sndLabels()).join() === 'Nylon', (await A.sndLabels()).join());

  // ================= 2. Model =================
  const md = await A.page.evaluate(() => { const M = window.TabModel, t = M.newTrack ? M.newTrack('x') : null;
    const old = { id: 'a', name: 'A', tuning: M.tuningFromId ? M.tuningFromId('standard') : null };
    return { ids: M.TONES.map((x) => x.id).join(), names: M.TONES.map((x) => x.name).join('|'), bass: M.TONES.filter((x) => x.bass).map((x) => x.id).join(),
      def: M.DEFAULT_TONE, nt: t && t.tone, miss: M.trackTone({}), bad: M.trackTone({ tone: 'banjo' }), up: M.trackTone({ tone: 'upright' }), sv: M.SCHEMA_VERSION }; });
  check('model: 5 tones nylon, spanish, clean, upright, ebass with the agreed names; the two basses are marked bass', md.ids === TONES.join() && md.names === 'Nylon|Spanish nylon|Clean electric|Upright bass|Electric bass' && md.bass === 'upright,ebass', JSON.stringify(md));
  check('model: default Nylon; new tracks get tone "nylon"; missing or unknown tone reads as nylon; schemaVersion still 5', md.def === 'nylon' && md.nt === 'nylon' && md.miss === 'nylon' && md.bad === 'nylon' && md.up === 'upright' && md.sv === 5, JSON.stringify(md));

  // ================= 3. The Sound list =================
  await A.place(0, 5, 0); await A.place(1, 0, 12);
  await A.click('.trk:nth-child(1) .trk-snd');
  await A.page.waitForSelector('#tone-pop:not([hidden])', { visible: true });
  let pop = await A.page.evaluate(() => { const p = document.getElementById('tone-pop'), b = document.querySelector('.trk .trk-snd');
    return { role: p.getAttribute('role'), opts: [...p.querySelectorAll('.tone-opt')].map((o) => o.dataset.tone + ':' + o.getAttribute('aria-selected') + ':' + o.firstChild.textContent).join('|'), exp: b.getAttribute('aria-expanded'), haspop: b.getAttribute('aria-haspopup') }; });
  check('dropdown: opens a listbox of 5 options, Nylon selected, button aria-expanded', pop.role === 'listbox' && pop.opts === 'nylon:true:Nylon|spanish:false:Spanish nylon|clean:false:Clean electric|upright:false:Upright bass|ebass:false:Electric bass' && pop.exp === 'true' && pop.haspop === 'listbox', JSON.stringify(pop));
  await A.page.keyboard.press('Escape'); await sleep(100);
  const esc = await A.page.evaluate(() => ({ hidden: document.getElementById('tone-pop').hidden, focus: document.activeElement && document.activeElement.classList.contains('trk-snd') }));
  check('dropdown: Escape closes it and gives focus back to the Sound button', esc.hidden && esc.focus, JSON.stringify(esc));
  check('dropdown: closing without choosing requests no other tone', net.filter((n) => !/^nylon\./.test(n)).length === 0, net.join());
  await A.click('.trk:nth-child(1) .trk-snd'); await A.click('#tone-pop .tone-opt[data-tone="upright"]');
  const t1 = await A.toast();
  check('dropdown: choosing Upright bass sets track.tone, relabels the button and says it sounds an octave below', (await A.proj()).tracks[0].tone === 'upright' && (await A.sndLabels())[0] === 'Upright' && /Upright bass.*octave below/.test(t1), t1);
  check('dropdown: the Upright sprite is fetched only now, and becomes ready', (await A.ready('upright')) && net.filter((n) => /^upright\./.test(n)).length === 2 && net.filter((n) => /^(spanish|clean|ebass)\./.test(n)).length === 0, net.join());
  await A.page.keyboard.down('Control'); await A.page.keyboard.press('z'); await A.page.keyboard.up('Control'); await sleep(150);
  const un = (await A.proj()).tracks[0].tone;
  await A.page.keyboard.down('Control'); await A.page.keyboard.down('Shift'); await A.page.keyboard.press('z'); await A.page.keyboard.up('Shift'); await A.page.keyboard.up('Control'); await sleep(150);
  const re = (await A.proj()).tracks[0].tone;
  check('dropdown: the change is undoable (undo -> nylon, redo -> upright)', un === 'nylon' && re === 'upright', JSON.stringify({ un, re }));
  await A.page.reload({ waitUntil: 'networkidle0' });
  check('persistence: Upright survives a reload (tone saved, button label)', (await A.proj()).tracks[0].tone === 'upright' && (await A.sndLabels())[0] === 'Upright');
  const v4 = await A.page.evaluate(() => { const k = Object.keys(localStorage).find((x) => /:library$/.test(x)); return k ? JSON.parse(localStorage.getItem(k)) : null; });
  check('model: the v7/v8 rollback copy (toV4) leaves tone out', !!v4 && v4.projects.every((p) => p.tracks.every((t) => !('tone' in t))), v4 ? 'tone present in v4 copy' : 'no v4 copy');

  // second track: new tracks are Nylon
  await A.click('#track-add'); await sleep(200);
  const p2 = await A.proj();
  check('new track: defaults to Nylon (it copies tuning/style, not the Sound)', p2.tracks.length === 2 && p2.tracks[1].tone === 'nylon' && (await A.sndLabels()).join() === 'Upright,Nylon', (await A.sndLabels()).join());
  await A.click('.trk:nth-child(2) .trk-arm'); await A.place(0, 5, 0); await A.place(1, 0, 12);

  // ================= 4. Bass plays an octave down; the tab doesn't change =================
  const sch = await A.playFor(700);
  const ids = (await A.proj()).tracks.map((t) => t.id);
  const bassN = sch.filter((n) => n.track === ids[0] || n.track === 0), nyN = sch.filter((n) => n.track === ids[1] || n.track === 1);
  check('bass -12: Upright track notes are scheduled 12 semitones under their tab pitch (E2 tab -> E1)', bassN.length >= 2 && bassN.every((n) => n.tone === 'upright' && n.sound === n.midi - 12) && bassN.some((n) => n.midi === 40 && n.sound === 28), JSON.stringify(bassN.slice(0, 3)));
  check('bass -12: the Nylon track plays at tab pitch', nyN.length >= 2 && nyN.every((n) => n.tone === 'nylon' && n.sound === n.midi), JSON.stringify(nyN.slice(0, 3)));
  const p4 = await A.proj();
  check('bass -12: the tab itself is unchanged (string 6 fret 0 and string 1 fret 12 on both tracks)', p4.tracks.every((t) => t.notes.some((e) => e.string === 6 && e.fret === 0) && t.notes.some((e) => e.string === 1 && e.fret === 12)), JSON.stringify(p4.tracks.map((t) => t.notes)));

  // ================= 5. MIDI (in-page encoder) =================
  const mbytes = await A.page.evaluate(() => Array.from(window.TabMidi.build(JSON.parse(JSON.stringify(window.__guitarTab.library.projects.find((p) => p.id === window.__guitarTab.library.activeProjectId))), { mode: 'all' })));
  const mid = parseMidi(Uint8Array.from(mbytes));
  const lanes = mid.tracks.slice(1).map((tr) => ({ prog: (tr.find((e) => e.type === 'programChange') || {}).programNumber, notes: tr.filter((e) => e.type === 'noteOn' && e.velocity > 0).map((e) => e.noteNumber) }));
  check('MIDI: Upright lane is GM program 33 (byte 32) an octave down; Nylon lane program 25 (byte 24) at tab pitch', lanes.length === 2 && lanes[0].prog === 32 && lanes[1].prog === 24 && lanes[0].notes.join() === '28,64' && lanes[1].notes.join() === '40,76', JSON.stringify(lanes));

  // ================= 6. JSON round trip =================
  const ej = await A.exportJson();
  check('JSON export: schema 5, tracks carry tone upright / nylon', ej && ej.schemaVersion === 5 && ej.projects[0].tracks.map((t) => t.tone).join() === 'upright,nylon', ej && JSON.stringify(ej.projects[0].tracks.map((t) => t.tone)));
  ej.projects[0].tracks[1].tone = 'ebass'; ej.projects[0].tracks[0].tone = 'clean';
  const f2 = writeJson('two-tones.json', ej);
  await A.page.evaluate(() => localStorage.clear()); await A.page.reload({ waitUntil: 'networkidle0' }); await A.hint();
  const before = net.length;
  await A.importPath(f2, 'replace');
  check('JSON import: tones come back (clean, ebass) and the buttons say Clean / E-bass', (await A.proj()).tracks.map((t) => t.tone).join() === 'clean,ebass' && (await A.sndLabels()).join() === 'Clean,E-bass', (await A.sndLabels()).join());
  check('lazy: importing a project that uses Clean + E-bass loads those two (once each)', (await A.ready('clean')) && (await A.ready('ebass')) && net.slice(before).sort().join() === 'clean.json,clean.mp3,ebass.json,ebass.mp3', net.slice(before).join());
  const ej2 = await A.exportJson();
  check('JSON round trip: export -> import -> export keeps the tones', ej2 && ej2.projects[0].tracks.map((t) => t.tone).join() === 'clean,ebass');
  ej2.projects[0].tracks.forEach((t) => { delete t.tone; });
  await A.importPath(writeJson('no-tone.json', ej2), 'replace');
  check('old files: a v8.2 file with no tone field opens as Nylon on every track', (await A.proj()).tracks.every((t) => t.tone === 'nylon') && (await A.sndLabels()).every((s) => s === 'Nylon'), (await A.sndLabels()).join());
  const fx = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'v3-project.json');
  await A.importPath(fx, 'merge');
  const l3 = await A.gt('window.__guitarTab.library');
  check('old files: the v3 fixture imports with Nylon tracks', l3.projects.length >= 2 && l3.projects.every((p) => p.tracks.every((t) => t.tone === 'nylon')), JSON.stringify(l3.projects.map((p) => p.tracks.map((t) => t.tone))));

  // ================= 7. Offline replay from the cache =================
  await A.importPath(f2, 'replace');
  await A.page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await A.page.reload({ waitUntil: 'networkidle0' });
  const ctl = await A.page.evaluate(() => !!navigator.serviceWorker.controller);
  await A.page.setOfflineMode(true);
  await A.page.reload({ waitUntil: 'load' }); await sleep(300);
  const offReady = (await A.ready('nylon', 5000)) && (await A.ready('clean', 5000)) && (await A.ready('ebass', 5000));
  check('offline: the app reloads from the service worker and Nylon + Clean + E-bass come from the tone cache, no network', ctl && offReady && (await A.gt('window.__guitarTab.toneRequests().length')) === 0, JSON.stringify({ ctl, offReady, reqs: await A.gt('window.__guitarTab.toneRequests()') }));
  const offSch = await A.playFor(500);
  check('offline: Play plays the cached samples (clean + ebass scheduled)', offSch.some((n) => n.tone === 'clean') && offSch.some((n) => n.tone === 'ebass' && n.sound === n.midi - 12), JSON.stringify(offSch.slice(0, 4)));
  const cs = await A.page.evaluate(async () => { const out = {}; for (const k of await caches.keys()) { const c = await caches.open(k); out[k] = (await c.keys()).map((r) => new URL(r.url).pathname.split('/').slice(-2).join('/')); } return out; });
  const shellK = Object.keys(cs).find((k) => /guitar-tab-v9$/.test(k));
  check('caches: gt-tones-v1 holds exactly the tones used (nylon, upright, clean, ebass: json + mp3); the v9 shell cache holds no tones', cs['gt-tones-v1'] && cs['gt-tones-v1'].length === 8 && !cs['gt-tones-v1'].some((x) => /spanish/.test(x)) && shellK && !cs[shellK].some((x) => /^tones\//.test(x)), JSON.stringify(Object.fromEntries(Object.entries(cs).map(([k, v]) => [k, k === 'gt-tones-v1' ? v : v.length]))));
  await A.page.setOfflineMode(false);

  // ================= 8. Play waits for samples, cancel, fallback =================
  const ctxB = await browser.createBrowserContext();
  const B = await user(ctxB);
  await B.page.setBypassServiceWorker(true);
  await B.page.setRequestInterception(true);
  const rule = { hold: 0, abort: [] };
  B.page.on('request', (r) => {
    const u = r.url();
    if (rule.abort.some((x) => u.indexOf('/tones/' + x + '.') >= 0)) return r.abort();
    if (rule.hold && u.indexOf('/tones/nylon.mp3') >= 0) return void setTimeout(() => r.continue().catch(() => {}), rule.hold);
    r.continue();
  });
  await B.fresh(); await B.ready('nylon');
  await B.place(0, 5, 0); await B.place(1, 0, 12); await B.place(2, 1, 3);
  const cold = async (hold) => { await B.page.evaluate(() => caches.delete('gt-tones-v1')); rule.hold = hold; await B.page.reload({ waitUntil: 'domcontentloaded' }); await B.page.waitForSelector('#play-btn'); };
  await cold(2500);
  await B.click('#play-btn'); await sleep(250);
  const w1 = await B.page.evaluate(() => { const b = document.getElementById('play-btn'); return { waiting: window.__guitarTab.waiting(), loading: b.classList.contains('loading'), busy: b.getAttribute('aria-busy'), label: b.getAttribute('aria-label'), playing: window.__guitarTab.isPlaying(), n: window.__guitarTab.scheduled().length }; });
  check('play waits: before the samples arrive Play shows a loading state (spinner class, aria-busy, label) and schedules nothing', w1.waiting && w1.loading && w1.busy === 'true' && /Loading sound/.test(w1.label) && !w1.playing && w1.n === 0, JSON.stringify(w1));
  await B.page.waitForFunction(() => window.__guitarTab.isPlaying(), { timeout: 10000 }).catch(() => {});
  await sleep(300);
  const w2 = await B.page.evaluate(() => ({ playing: window.__guitarTab.isPlaying(), waiting: window.__guitarTab.waiting(), busy: document.getElementById('play-btn').getAttribute('aria-busy'), s: window.__guitarTab.scheduled() }));
  check('play waits: then it starts by itself with the Nylon samples (no synth stand-in)', w2.playing && !w2.waiting && w2.busy === 'false' && w2.s.length > 0 && w2.s.every((n) => n.tone === 'nylon'), JSON.stringify({ ...w2, s: w2.s.slice(0, 2) }));
  await B.click('#stop-btn'); await sleep(100);
  await cold(2000);
  await B.click('#play-btn'); await sleep(200); await B.click('#play-btn'); await sleep(2600);
  const w3 = await B.page.evaluate(() => ({ playing: window.__guitarTab.isPlaying(), waiting: window.__guitarTab.waiting(), loading: document.getElementById('play-btn').classList.contains('loading'), ready: window.__guitarTab.toneState('nylon') }));
  check('play waits: pressing Play again while loading cancels; nothing starts when the samples land', !w3.playing && !w3.waiting && !w3.loading && w3.ready === 'ready', JSON.stringify(w3));
  rule.hold = 0;
  // fallback: Upright can't load -> amber button, toast, Play uses Nylon at tab pitch
  rule.abort = ['upright'];
  await B.click('.trk:nth-child(1) .trk-snd'); await B.click('#tone-pop .tone-opt[data-tone="upright"]');
  await B.page.waitForFunction(() => window.__guitarTab.toneState('upright') === 'error', { timeout: 8000 }).catch(() => {});
  await sleep(200);
  const fb = { toast: await B.toast(), failed: await B.page.$eval('.trk .trk-snd', (b) => b.classList.contains('failed')), tone: (await B.proj()).tracks[0].tone };
  check('fallback: a tone that fails to load shows a toast, marks the button and keeps the choice (tone still upright)', /Upright bass didn't load.*Nylon/.test(fb.toast) && fb.failed && fb.tone === 'upright', JSON.stringify(fb));
  const fs1 = await B.playFor(600);
  check('fallback: Play goes ahead with Nylon at the tab pitch for that track', fs1.length > 0 && fs1.every((n) => n.tone === 'nylon' && n.sound === n.midi), JSON.stringify(fs1.slice(0, 3)));
  rule.abort = ['nylon', 'upright']; await B.page.evaluate(() => caches.delete('gt-tones-v1')); await B.page.reload({ waitUntil: 'networkidle0' }); await B.hideToast();
  await B.click('#play-btn');
  await B.page.waitForFunction(() => !window.__guitarTab.waiting(), { timeout: 10000 }).catch(() => {}); await sleep(200);
  const fb2 = { toast: await B.toast(), playing: await B.gt('window.__guitarTab.isPlaying()'), loading: await B.page.$eval('#play-btn', (b) => b.classList.contains('loading')) };
  check('fallback: if Nylon itself can\'t load, Play says so and stays stopped (no synth)', /Couldn't load the guitar sound/.test(fb2.toast) && !fb2.playing && !fb2.loading, JSON.stringify(fb2));
  rule.abort = [];
  await ctxB.close();

  // ================= 9. No synth; sources; credits =================
  const src = await A.page.evaluate(async (app) => { const g = async (u) => { const r = await fetch(u, { cache: 'no-store' }); return r.ok ? r.text() : ''; };
    return { audio: await g(app + 'js/audio.js'), sw: await g(app + 'sw.js'), app: await g(app + 'index.html'), land: await g(app + '../index.html'), notice: await g(app + '../NOTICE') }; }, APP);
  const oscs = (src.audio.match(/createOscillator/g) || []).length;
  check('no synth: audio.js has no pluck / Karplus voice; the only oscillator is the metronome blip', src.audio.length > 0 && !/pluck|karplus/i.test(src.audio) && oscs <= 1, 'oscillators ' + oscs);
  check('sw.js: cache ' + (LIVE && /jeremylegal/.test(BASE) ? 'jlr-guitar-tab-v9' : 'guitar-tab-v9') + ', tones cache gt-tones-v1', new RegExp("var VERSION = '" + (/jeremylegal/.test(BASE) ? 'jlr-' : '') + "guitar-tab-v9'").test(src.sw) && /'gt-tones-v1'/.test(src.sw), (src.sw.match(/var VERSION = '[^']+'/) || [''])[0]);
  check('credits: NOTICE has the FluidR3 MIT notice and the CC0 courtesy credits', /Copyright \(c\) 2000-2002, 2008 Frank Wen; 2008 Toby Smithe/.test(src.notice) && /Permission is hereby granted/.test(src.notice) && /FreePats/.test(src.notice) && /D\. Smolken/.test(src.notice) && /Karoryfer Samples/.test(src.notice) && /CC0 1\.0/.test(src.notice), 'NOTICE ' + src.notice.length + ' chars');
  check('credits: app menu and landing footer name FluidR3 GM (MIT), FreePats, D. Smolken, Karoryfer Samples (CC0) and link NOTICE', [src.app, src.land].every((h) => /FluidR3 GM/.test(h) && /Frank Wen/.test(h) && /FreePats/.test(h) && /D\. Smolken/.test(h) && /Karoryfer Samples/.test(h) && /CC0/.test(h) && /blob\/main\/NOTICE/.test(h)));
  check('browser-only: no download / app-store links', [src.app, src.land].every((h) => !/apps\.apple\.com|play\.google\.com|\bdownload the app\b/i.test(h)));

  // ================= 10. Measured: onset, attack, pitch of every sample =================
  for (const id of TONES) await A.page.evaluate((id) => window.TabAudio.load(id), id);
  const per = {};
  for (const id of TONES) {
    const nInfo = await A.page.evaluate((id) => window.TabAudio.toneInfo(id), id);
    const rows = [];
    for (let i = 0; i < nInfo.notes.length; i++) {
      const d = await A.page.evaluate((id, i) => { const b = window.TabAudio._toneBuf(id, i), sr = window.TabAudio.toneInfo(id).notes[i].sr, N = Math.min(b.length, Math.round(sr * 0.6));
        let pk = 0; for (let k = 0; k < N; k++) pk = Math.max(pk, Math.abs(b[k]));
        let on = -1; for (let k = 0; k < N; k++) if (Math.abs(b[k]) > pk * 0.05) { on = k; break; }
        let p90 = -1; for (let k = 0; k < N; k++) if (Math.abs(b[k]) >= pk * 0.5) { p90 = k; break; }
        const s0 = on + Math.round(sr * 0.08); return { sr, on, p90, seg: Array.from(b.subarray(s0, s0 + Math.round(sr * 0.2))) }; }, id, i);
      const n = nInfo.notes[i], f = yin(d.seg, d.sr), dev = centsOff(f, n.root + n.cents / 100);
      rows.push({ root: n.root, cents: n.cents, onMs: +(d.on / d.sr * 1000).toFixed(2), attackMs: +((d.p90 - d.on) / d.sr * 1000).toFixed(2), dev: +dev.toFixed(1) });
    }
    per[id] = rows;
    const worstOn = Math.max(...rows.map((r) => r.onMs)), worstAt = Math.max(...rows.map((r) => r.attackMs)), worstDev = Math.max(...rows.map((r) => Math.abs(r.dev)));
    check(`onset ${id}: every sample (${rows.length}) starts within 3 ms (no leading silence) and reaches half its peak within 45 ms (the instrument's own attack)`, worstOn <= 3 && worstAt <= 45, JSON.stringify(rows.filter((r) => r.onMs > 3 || r.attackMs > 45)));
    check(`pitch ${id}: every sample measures within 20 cents of its manifest root+cents (YIN)`, worstDev <= 20, JSON.stringify(rows.filter((r) => Math.abs(r.dev) > 20)));
    info(`${id}: ${rows.length} samples, onset <= ${worstOn} ms, half-peak <= ${worstAt} ms, pitch within ${worstDev.toFixed(1)} cents, gain ${nInfo.gain}`);
  }

  // ================= 11. Rendered through the real output chain: timing, pitch, loudness, metronome =================
  const NOTES = [40, 45, 50, 55, 59, 64, 67, 72], SLOT = 3, SR = 48000;
  const ctxC = await browser.createBrowserContext();
  const rend = {};
  for (const id of TONES) {
    const p = await ctxC.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.evaluateOnNewDocument((len) => { const O = window.OfflineAudioContext; window.AudioContext = function () { const c = new O(1, len, 48000); c.resume = () => Promise.resolve(); return c; }; }, SR * (SLOT * NOTES.length + 3));
    await p.goto(APP, { waitUntil: 'networkidle0' });
    await p.evaluate((id) => window.TabAudio.load(id), id);
    rend[id] = await p.evaluate(async (id, NOTES, SLOT) => {
      window.TabAudio.unlock(); const c = window.TabAudio._ctx();
      NOTES.forEach((m, k) => window.TabAudio._note(m, k * SLOT + 0.1, 0.9, { gain: 0.8, tone: id }));
      const ct = NOTES.length * SLOT + 0.5; window.TabAudio._click(ct, true);
      const buf = await c.startRendering(), x = buf.getChannelData(0), sr = buf.sampleRate, cut = (t, d) => Array.from(x.subarray(Math.round(t * sr), Math.round((t + d) * sr)));
      return { notes: NOTES.map((m, k) => cut(k * SLOT + 0.09, 0.6)), click: cut(ct - 0.01, 0.6) };
    }, id, NOTES, SLOT);
    await p.close();
  }
  await ctxC.close();
  const lv = {};
  for (const id of TONES) {
    const r = rend[id], ck = kw(r.click), c100 = msDb(ck, 480, 4800), c400 = msDb(ck, 480, 19200);
    const rows = r.notes.map((x, k) => { const y = kw(x); let on = -1; for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > 1e-3) { on = i; break; }
      const want = NOTES[k] - (BASS[id] ? 12 : 0), seg = x.slice(480 + Math.round(0.1 * SR), 480 + Math.round(0.35 * SR)), f = yin(seg, SR, 25, 1500);
      return { m: NOTES[k], want, onMs: +((on - 480) / SR * 1000).toFixed(2), cents: +centsOff(f, want).toFixed(1), n100: msDb(y, 480, 4800), n400: msDb(y, 480, 19200) }; });
    const mean = (k) => rows.reduce((a, b) => a + b[k], 0) / rows.length;
    lv[id] = { d100: +(c100 - mean('n100')).toFixed(2), d400: +(c400 - mean('n400')).toFixed(2), n400: mean('n400') };
    const lateOn = Math.max(...rows.map((q) => Math.abs(q.onMs))), worstC = Math.max(...rows.map((q) => Math.abs(q.cents)));
    // Chrome's DynamicsCompressor delays everything by a fixed 6 ms lookahead, the click included, so notes are timed
    // against the click rendered through the same graph (and absolutely within 8 ms).
    let cOn = -1; for (let i = 0; i < r.click.length; i++) if (Math.abs(r.click[i]) > 1e-3) { cOn = i; break; }
    const clickMs = +((cOn - 480) / SR * 1000).toFixed(2), rel = Math.max(...rows.map((q) => Math.abs(q.onMs - clickMs)));
    check(`rendered ${id}: notes sound on time (within 2 ms of the metronome click, 8 ms of the scheduled start)`, rel <= 2 && lateOn <= 8, JSON.stringify({ clickMs, notes: rows.map((q) => q.onMs) }));
    if (id === 'nylon') info(`compressor lookahead: click ${clickMs} ms after its scheduled time; notes ${rows.map((q) => q.onMs).join('/')} ms`);
    check(`rendered ${id}: pitch within 15 cents of ${BASS[id] ? 'tab pitch - 12 (E2 tab -> E1 41.2 Hz)' : 'tab pitch'} on E2..C5`, worstC <= 15, JSON.stringify(rows.map((q) => q.m + '->' + q.want + ':' + q.cents)));
    info(`${id}: onset error <= ${lateOn} ms, pitch error <= ${worstC} cents`);
  }
  check('metronome: the level-0.2 click is half a default-volume Nylon note (-6 dB +-1, K-weighted, first 100 ms)', Math.abs(lv.nylon.d100 + 6) <= 1, JSON.stringify(lv.nylon));
  const spread = Math.max(...TONES.map((id) => Math.abs(lv[id].n400 - lv.nylon.n400)));
  check('loudness: all 5 tones within 1.5 dB of Nylon (K-weighted, first 400 ms, mean of 8 notes)', spread <= 1.5, JSON.stringify(lv));
  info('click vs note dB (100 ms / 400 ms): ' + TONES.map((id) => `${id} ${lv[id].d100}/${lv[id].d400}`).join(', '));

  // ================= 12. No scroll at three sizes (3 tracks, Sound list open) =================
  await A.click('#track-add'); await sleep(150);
  for (const [w, h] of [[390, 844], [390, 650], [360, 640]]) {
    await A.page.setViewport({ ...VIEW, width: w, height: h }); await sleep(250);
    const pg = await A.page.evaluate(() => ({ y: document.scrollingElement.scrollHeight - innerHeight, x: document.scrollingElement.scrollWidth - innerWidth, n: document.querySelectorAll('.trk').length }));
    const rowsOk = await A.page.evaluate(() => [...document.querySelectorAll('.trk')].every((r) => { const b = r.querySelector('.trk-snd'), rr = r.getBoundingClientRect(), br = b.getBoundingClientRect(); return br.right <= rr.right + 1 && b.scrollWidth <= b.clientWidth + 1; }));
    await A.click('.trk:nth-child(3) .trk-snd'); await A.page.waitForSelector('#tone-pop:not([hidden])', { visible: true });
    const pp = await A.page.evaluate(() => { const r = document.getElementById('tone-pop').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, y: document.scrollingElement.scrollHeight - innerHeight, x: document.scrollingElement.scrollWidth - innerWidth }; });
    await A.page.keyboard.press('Escape');
    check(`fit ${w}x${h}: no page scroll with ${pg.n} tracks; Sound buttons fit their rows; the open Sound list stays on screen`, pg.n === 3 && pg.y <= 0 && pg.x <= 0 && rowsOk && pp.top >= 0 && pp.left >= 0 && pp.bottom <= h && pp.right <= w && pp.y <= 0 && pp.x <= 0, JSON.stringify({ pg, rowsOk, pp }));
  }
  await A.page.setViewport(VIEW);
  await ctxA.close();

  // ================= 13. First load vs v8.2 (local only) =================
  if (!LIVE) {
    const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), wt = path.join(os.tmpdir(), 'gt-v82-worktree');
    if (!fs.existsSync(path.join(wt, 'app'))) { try { execFileSync('git', ['-C', repo, 'worktree', 'remove', '--force', wt], { stdio: 'ignore' }); } catch (e) { /* none */ } execFileSync('git', ['-C', repo, 'worktree', 'add', '--detach', wt, '3fd67d9'], { stdio: 'ignore' }); }
    const old = await startServer(0, wt);
    const bench = async (url) => { const ctx = await browser.createBrowserContext(), p = await ctx.newPage(); await p.setViewport(VIEW);
      const c = await p.createCDPSession(); await c.send('Network.enable'); await c.send('Network.setCacheDisabled', { cacheDisabled: true });
      await p.goto(url, { waitUntil: 'load' }); await p.waitForFunction(() => document.querySelector('#editor') && document.querySelector('#editor').children.length > 0);
      const t = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0], f = performance.getEntriesByName('first-contentful-paint')[0]; return { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, fcp: f ? f.startTime : 0 }; });
      await ctx.close(); return t; };
    const a = [], b = [];
    for (let i = 0; i < 9; i++) { a.push(await bench(old.base + 'app/')); b.push(await bench(APP)); }
    old.srv.close();
    const med = (r, k) => { const s = r.map((x) => x[k]).sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const cmp = ['dcl', 'load', 'fcp'].map((k) => ({ k, v82: +med(a, k).toFixed(1), v9: +med(b, k).toFixed(1) }));
    check('loadbench: v9 first load (DCL, load, first paint; median of 9, interleaved) within noise of v8.2 (<= +25% or +15 ms)', cmp.every((c) => c.v9 <= Math.max(c.v82 * 1.25, c.v82 + 15)), JSON.stringify(cmp));
    info('first load median v8.2 -> v9: ' + cmp.map((c) => `${c.k} ${c.v82} -> ${c.v9} ms`).join(', '));
  }

  check('no page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
} catch (e) {
  console.error(e); check('suite ran to the end', false, String(e && e.stack));
} finally {
  await browser.close(); if (server) server.srv.close();
}
const pass = results.filter((r) => r.ok).length;
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
