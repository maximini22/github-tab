// Screenshot helper (not a test): the v9 Sound list open on a track, and a Nylon + Electric bass project.
//   CHROME_PATH=/usr/bin/google-chrome OUT=/tmp/shots node shots-v9.mjs      (BASE=... for the live site)
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { startServer } from './serve.mjs';

const OUT = process.env.OUT || '/tmp/gt-shots';
fs.mkdirSync(OUT, { recursive: true });
let server = null, BASE = process.env.BASE;
if (!BASE) { server = await startServer(); BASE = server.base; }
const APP = BASE.replace(/\/?$/, '/') + 'app/';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = async (s) => { await page.waitForSelector(s, { visible: true }); await page.click(s); };
const run = async (col, str, frets) => {
  await page.$eval(`.cell[data-col="${col}"][data-str="${str}"]`, (b) => b.scrollIntoView({ inline: 'center', block: 'nearest' }));
  await click(`.cell[data-col="${col}"][data-str="${str}"]`);
  for (const f of frets) { await click(`.frow[data-fret="${f}"]`); await click('#picker-next'); }
  await click('#picker-done');
};
const rename = async (name) => { await click('#menu-btn'); await sleep(300); await page.click('#track-name', { clickCount: 3 }); await page.keyboard.press('Backspace'); await page.type('#track-name', name); await page.keyboard.press('Enter'); await click('#drawer-close'); await sleep(200); };
const tidy = async () => { await page.mouse.move(1, 1); await page.evaluate(() => { document.getElementById('toast').hidden = true; const w = document.getElementById('editor-wrap'); w.scrollLeft = 0; w.dispatchEvent(new Event('scroll')); }); await click('#play-start'); await sleep(400); };
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(APP, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle0' });
if (!(await page.$eval('#hint', (h) => h.hidden))) await click('#hint-ok');
await click('#menu-btn'); await page.$eval('#title', (el) => { el.value = 'Night drive riff'; el.dispatchEvent(new Event('change', { bubbles: true })); }); await click('#drawer-close');
await rename('Guitar');
await run(0, 1, [0, 2, 3, 2]); await run(4, 2, [3, 2, 0, 0]);
await click('#track-add'); await sleep(200);
await rename('Bass');
{ const b = await page.$$('.trk-snd'); await b[1].click(); }
await click('.tone-opt[data-tone="ebass"]'); await sleep(300);
await run(0, 5, [0, 0, 0, 0]); await run(4, 5, [3, 3, 2, 2]);
await page.waitForFunction(() => window.__guitarTab.toneState('ebass') === 'ready' && window.__guitarTab.toneState('nylon') === 'ready', { timeout: 20000 }).catch(() => {});
await tidy();
await page.screenshot({ path: `${OUT}/v9-bass-track.png` });
const b = await page.$$('.trk-snd'); await b[0].click(); await sleep(300);
await page.screenshot({ path: `${OUT}/v9-tone-dropdown.png` });
console.log('labels', await page.$$eval('.trk-snd', (x) => x.map((e) => e.textContent)), 'pop', await page.$eval('#tone-pop', (p) => !p.hidden));
await browser.close(); if (server) server.srv.close();
