// Rough render / edit timing for the editor at 390x844 (headless Chrome, no CPU throttling).
// For 16 and 64 bars at 1/16 and 1/64T (two tracks, a note on every beat of both, plus a 4-note
// chord every bar), it times:
//   render = one full redraw (tap the track's arm button: save + render), median of 5
//   edit   = one note placed in the step editor (tap a fret: write, undo checkpoint, save, redraw), median of 5
// Both include forced layout. Seeds a v4 (v7-format) library so the same script runs on v7 and v8.
//   CHROME_PATH=/usr/bin/google-chrome node bench.mjs        BASE=https://.../ node bench.mjs
import puppeteer from 'puppeteer-core';
import { startServer } from './serve.mjs';

const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
let server = null, BASE = process.env.BASE;
if (!BASE) { server = await startServer(); BASE = server.base; }
const APP = BASE.replace(/\/?$/, '/') + 'app/';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.goto(APP, { waitUntil: 'networkidle0' });

const CASES = [[16, 'sixteenth', null], [16, 'sixtyfourth', 'triplet'], [64, 'sixteenth', null], [64, 'sixtyfourth', 'triplet']];
const out = [];
for (const [bars, value, style] of CASES) {
  const r = await page.evaluate(async (bars, value, style) => {
    const lib = JSON.parse(JSON.stringify(window.__guitarTab.library));
    const p = lib.projects.find((x) => x.id === lib.activeProjectId);
    p.grid = style === 'triplet' ? { value, tuplet: { actual: 3, normal: 2 } } : { value };
    p.lengthTicks = bars * 1920;
    const t0 = p.tracks[0], t1 = JSON.parse(JSON.stringify(t0)); t1.id = t0.id + 'b'; t1.name = 'Guitar 2'; p.tracks = [t0, t1];
    t0.notes = []; t1.notes = [];
    for (let b = 0; b < bars; b++) for (let q = 0; q < 4; q++) {
      const s = b * 1920 + q * 480;
      t0.notes.push({ string: 1 + (q % 3), fret: (b + q) % 12, startTick: s, durationTicks: 0, techniques: [] });
      t1.notes.push({ string: 6 - (q % 2), fret: (b * 3 + q) % 10, startTick: s + 240, durationTicks: 0, techniques: [] });
      if (q === 0) [3, 4, 5].forEach((st, k) => t0.notes.push({ string: st, fret: k + 2, startTick: s, durationTicks: 0, techniques: [] }));
    }
    lib.schemaVersion = 4; p.tracks.forEach((t) => delete t.style); // a real v4 (v7-format) file: style lives on the grid
    localStorage.clear(); localStorage.setItem('jlr-guitar-tab:library', JSON.stringify(lib));
    return true;
  }, bars, value, style);
  await page.reload({ waitUntil: 'networkidle0' });
  if (await page.$eval('#hint', (h) => !h.hidden)) await page.click('#hint-ok');
  const m = await page.evaluate(async () => {
    const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    const cells = document.querySelectorAll('.cell').length;
    const rend = [];
    for (let i = 0; i < 5; i++) { await frame(); const t = performance.now(); document.querySelector('.trk .trk-arm').click(); document.body.offsetHeight; rend.push(performance.now() - t); }
    const cell = document.querySelector('.cell[data-col="5"][data-str="2"]'); cell.click(); await frame();
    const edit = [];
    for (let i = 0; i < 5; i++) { await frame(); const t = performance.now(); document.querySelector(`.frow[data-fret="${(i % 5) + 1}"]`).click(); document.body.offsetHeight; edit.push(performance.now() - t); }
    document.getElementById('picker-done').click();
    return { cells, render: Math.round(med(rend)), edit: Math.round(med(edit)) };
  });
  const label = `${bars} bars @ 1/${value === 'sixteenth' ? 16 : 64}${style ? 'T' : ''}`;
  out.push({ label, ...m });
  console.log(`${label.padEnd(18)} cells ${String(m.cells).padStart(6)}  render ${String(m.render).padStart(5)} ms  edit ${String(m.edit).padStart(5)} ms`);
}
await browser.close();
if (server) server.srv.close();
