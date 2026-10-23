// Screenshot helper (not a test): v7 grid value + style toolbar and the rhythm row (triplets, brackets, 32nd/64th beams).
//   CHROME_PATH=/usr/bin/google-chrome OUT=/tmp/shots node shots.mjs      (BASE=... for the live site; PREFIX=v7)
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { startServer } from './serve.mjs';

const OUT = process.env.OUT || '/tmp/gt-shots', PREFIX = process.env.PREFIX || 'v7';
fs.mkdirSync(OUT, { recursive: true });
let server = null, BASE = process.env.BASE;
if (!BASE) { server = await startServer(); BASE = server.base; }
const APP = BASE.replace(/\/?$/, '/') + 'app/';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = async (s) => { await page.waitForSelector(s, { visible: true }); await page.click(s); };
const set = (s, v) => page.$eval(s, (el, x) => { el.value = x; el.dispatchEvent(new Event('change', { bubbles: true })); }, v);
const style = async (st) => { const g = await page.evaluate(() => window.__guitarTab.grid()), cur = g.dotted ? 'dotted' : g.tuplet ? 'triplet' : 'plain';
  if (cur !== st) await click(st === 'plain' ? (cur === 'dotted' ? '#grid-dot' : '#grid-trip') : st === 'dotted' ? '#grid-dot' : '#grid-trip'); };
async function run(col, str, frets) { // tap a cell, then fret, Next, fret, Next ... (step editor)
  await page.$eval(`.cell[data-col="${col}"][data-str="${str}"]`, (b) => b.scrollIntoView({ inline: 'center', block: 'nearest' }));
  await click(`.cell[data-col="${col}"][data-str="${str}"]`);
  for (const f of frets) { if (f !== null) await click(`.frow[data-fret="${f}"]`); await click('#picker-next'); }
  await click('#picker-done');
}
const tidy = async (scrollCol) => { await page.mouse.move(1, 1); await page.evaluate((c) => { document.getElementById('toast').hidden = true; const w = document.getElementById('editor-wrap'), col = document.querySelectorAll('#editor .col')[c]; w.scrollLeft = c && col ? col.offsetLeft - document.querySelector('#editor .labels').offsetWidth - 10 : 0; w.dispatchEvent(new Event('scroll')); }, scrollCol); await sleep(300); };
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(APP, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle0' });
if (!(await page.$eval('#hint', (h) => h.hidden))) await click('#hint-ok');
await click('#menu-btn'); await page.$eval('#title', (el) => { el.value = 'Triplet Study'; el.dispatchEvent(new Event('change', { bubbles: true })); }); await click('#drawer-close');
// Toolbar shot: 1/8 + Dotted lit (a few dotted eighths placed)
await set('#grid-select', 'eighth'); await style('dotted');
await run(0, 2, [7, 9, 10, 12]);
await click('#play-start'); await tidy(0);
await page.screenshot({ path: `${OUT}/${PREFIX}-grid-style-toolbar.png` });
await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle0' });
if (!(await page.$eval('#hint', (h) => h.hidden))) await click('#hint-ok');
await click('#menu-btn'); await page.$eval('#title', (el) => { el.value = 'Triplet Study'; el.dispatchEvent(new Event('change', { bubbles: true })); }); await click('#drawer-close');
// Bar 1 on 1/8 + Triplet: quarter triplets (bracket) on beats 1-2, eighth triplets (beamed, "3") on beat 3, then a beat-4 note
await set('#grid-select', 'quarter'); await style('triplet');
await run(0, 4, [3, 5, 7]);                 // 0, 320, 640  (Q³ Q³ Q³)
await set('#grid-select', 'eighth');        // 1/8T: beat 3 = steps 6-8
await run(6, 3, [5, 7, 8, 7]);              // 960, 1120, 1280 (E³ x3), 1440
await page.click('.trk-arm'); await page.mouse.move(1, 1);
await click('#play-start'); await tidy(0);
await page.screenshot({ path: `${OUT}/${PREFIX}-rhythm-triplets.png` });
// Bar 2 on 1/32: a beat of 32nds (3 beams), then 64ths (4 beams), a dotted 16th + 32nd pair
await set('#grid-select', 'thirtysecond'); await style('plain');
await run(32, 2, [5, 7, 8, 7, 5, 7, 8, 10, 12]);      // beat 1 of bar 2: eight 32nds, then beat 2
await set('#grid-select', 'sixtyfourth');
await run(64 + 32 + 1, 1, [null]); // move only
await run(64 + 32, 1, [8, 10, 12, 13, 12, 10, 8, 10]); // beat 3: 64ths
await set('#grid-select', 'thirtysecond');
await page.click('.ruler .rcol[data-step="32"]').catch(() => {}); await tidy(32);
await page.screenshot({ path: `${OUT}/${PREFIX}-rhythm-32nds.png` });
console.log(JSON.stringify(await page.evaluate(() => window.__guitarTab.rhythm().slice(32, 48).map((g) => g.len + g.beams))));
await browser.close(); if (server) server.srv.close();
console.log('shots in ' + OUT);
