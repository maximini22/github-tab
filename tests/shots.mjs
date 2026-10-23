// Screenshot helper (not a test): the step editor (fret picker, frets 0-22) mid-bar and the MIDI export sheet.
//   CHROME_PATH=/usr/bin/google-chrome OUT=/tmp/shots node shots.mjs      (BASE=... for the live site; PREFIX=v6)
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { startServer } from './serve.mjs';

const OUT = process.env.OUT || '/tmp/gt-shots', PREFIX = process.env.PREFIX || 'v6';
fs.mkdirSync(OUT, { recursive: true });
let server = null, BASE = process.env.BASE;
if (!BASE) { server = await startServer(); BASE = server.base; }
const APP = BASE.replace(/\/?$/, '/') + 'app/';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const click = async (s) => { await page.waitForSelector(s, { visible: true }); await page.click(s); };
const set = (s, v) => page.$eval(s, (el, x) => { el.value = x; el.dispatchEvent(new Event('change', { bubbles: true })); }, v);
async function place(col, str, fret) {
  await page.$eval(`.cell[data-col="${col}"][data-str="${str}"]`, (b) => b.scrollIntoView({ inline: 'center', block: 'nearest' }));
  await click(`.cell[data-col="${col}"][data-str="${str}"]`);
  if (fret === 'x') await click('#pick-mute'); else await click(`.frow[data-fret="${fret}"]`);
  await click('#picker-done');
}
const sizes = (process.env.SIZES || '390x844,390x650,360x640').split(',').map((s) => s.split('x').map(Number));
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(APP, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle0' });
if (!(await page.$eval('#hint', (h) => h.hidden))) await click('#hint-ok');
await click('#menu-btn'); await page.$eval('#title', (el) => { el.value = 'Night Drive'; el.dispatchEvent(new Event('change', { bubbles: true })); });
await set('#tuning', 'c-standard'); await click('#drawer-close');
await set('#grid-select', 'sixteenth');
// Track 1: a riff on strings 3-6; Track 2: a lead line (shows faint in the roll)
for (const [c, s, f] of [[0, 5, 0], [2, 5, 3], [4, 4, 5], [6, 3, 5], [6, 2, 22], [8, 2, 7], [10, 5, 'x'], [12, 4, 3], [14, 3, 2]]) await place(c, s, f);
await click('#track-add'); await click('#menu-btn'); await page.$eval('#track-name', (el) => { el.value = 'Lead'; el.dispatchEvent(new Event('change', { bubbles: true })); }); await click('#drawer-close');
for (const [c, s, f] of [[1, 0, 8], [5, 1, 10], [9, 0, 19], [13, 1, 17]]) await place(c, s, f);
await click('.trk:nth-child(1) .trk-arm');
for (const [w, h] of sizes) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await click('.cell[data-col="6"][data-str="2"]'); // bar 1, step 7, string 3 (Eb)
  await page.mouse.move(1, 1); await page.evaluate(() => { document.getElementById('toast').hidden = true; });
  await new Promise((r) => setTimeout(r, 250));
  const m = await page.evaluate(() => { const s = document.getElementById('picker'); return { sh: s.scrollHeight, ch: s.clientHeight, top: s.getBoundingClientRect().top, frow: getComputedStyle(s).getPropertyValue('--frow'), neck: (({ scrollHeight: a, clientHeight: b, scrollTop: t }) => `${b}/${a} top ${Math.round(t)}`)(document.getElementById('neck')), f22: (() => { const r = document.querySelector('.frow[data-fret="22"]').getBoundingClientRect(), n = document.getElementById('neck').getBoundingClientRect(); return r.top >= n.top - 1 && r.bottom <= n.bottom + 1; })(), chip: getComputedStyle(s).getPropertyValue('--chip') }; });
  console.log(`${w}x${h}`, JSON.stringify(m));
  await page.screenshot({ path: `${OUT}/${PREFIX}-frets22-${w}x${h}.png` });
  await click('#picker-done');
}
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await click('.trk:nth-child(2) .ms.m');
await click('#menu-btn'); await click('#export-midi'); await page.mouse.move(1, 1); await page.evaluate(() => { document.getElementById('toast').hidden = true; }); await new Promise((r) => setTimeout(r, 250));
await page.screenshot({ path: `${OUT}/${PREFIX}-export-midi-sheet.png` });
await browser.close(); if (server) server.srv.close();
console.log('shots in ' + OUT);
