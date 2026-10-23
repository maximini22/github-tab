// Screenshot helper (not a test): the v9.1 lyrics sheet (sections + chips), the sheet while a loop plays, and the
// main screen's lyrics preview.   CHROME_PATH=/usr/bin/google-chrome OUT=/tmp/shots node shots-v91.mjs   (BASE=... live)
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { startServer } from './serve.mjs';

const OUT = process.env.OUT || '/tmp/gt-shots';
fs.mkdirSync(OUT, { recursive: true });
let server = null, BASE = process.env.BASE;
if (!BASE) { server = await startServer(); BASE = server.base; }
const APP = BASE.replace(/\/?$/, '/') + 'app/';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = async (s) => { await page.waitForSelector(s, { visible: true }); await page.click(s); };
const run = async (col, str, frets) => {
  await page.$eval(`.cell[data-col="${col}"][data-str="${str}"]`, (b) => b.scrollIntoView({ inline: 'center', block: 'nearest' }));
  await click(`.cell[data-col="${col}"][data-str="${str}"]`);
  for (const f of frets) { await click(`.frow[data-fret="${f}"]`); await click('#picker-next'); }
  await click('#picker-done');
};
export const LYRICS = `[Verse]
Streetlights hum a borrowed tune
I count the cracks from June to June
Coffee's cold, the radio's low
Still humming lines I used to know

[Chorus]
So turn it up and let the night run long
Every wrong turn sounds a little like a song
Hold the wheel, hold the line, hold on
We'll be singing it until the dark is gone

[Bridge]
Paper maps and a quarter tank
Half a melody, the rest is blank
Loop it back, loop it back again
Till the words fall in`;
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(APP, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle0' });
if (!(await page.$eval('#hint', (h) => h.hidden))) await click('#hint-ok');
await click('#menu-btn'); await page.$eval('#title', (el) => { el.value = 'Night drive'; el.dispatchEvent(new Event('change', { bubbles: true })); }); await click('#drawer-close');
await run(0, 1, [0, 2, 3, 2]); await run(4, 2, [3, 2, 0, 0]);
await click('#idea-open'); await sleep(200);
await page.$eval('#idea', (t, v) => { t.value = v; t.dispatchEvent(new Event('input', { bubbles: true })); }, LYRICS);
await page.$eval('#idea', (t) => { t.scrollTop = 0; t.dispatchEvent(new Event('scroll')); });
await page.evaluate(() => { document.getElementById('toast').hidden = true; });
await sleep(300);
await page.screenshot({ path: `${OUT}/v91-lyrics-sheet.png` });
// loop bars 1-2 and play, then jump to the chorus
await click('#lyr-done'); await click('#menu-btn'); await sleep(200);
await page.evaluate(() => { const b = document.getElementById('loop-start'); if (b) b.click(); }); await click('#drawer-close');
await click('#idea-open'); await sleep(150);
await page.waitForFunction(() => window.__guitarTab.toneState('nylon') === 'ready', { timeout: 20000 }).catch(() => {});
await click('#lyr-play'); await sleep(900);
await page.$$eval('#lyr-chips .chip', (b) => b[1] && b[1].click()); await sleep(250);
await page.evaluate(() => { document.getElementById('toast').hidden = true; });
console.log('playing', await page.evaluate(() => window.__guitarTab.isPlaying()), 'target', await page.$eval('#lyr-target', (e) => e.textContent));
await page.screenshot({ path: `${OUT}/v91-lyrics-playing.png` });
await click('#lyr-stop'); await click('#lyr-done'); await sleep(200);
await page.evaluate(() => { document.getElementById('toast').hidden = true; });
await click('#play-start'); await sleep(300); await page.evaluate(() => { document.getElementById('toast').hidden = true; });
await page.screenshot({ path: `${OUT}/v91-notes-preview.png` });
await browser.close(); if (server) server.srv.close();
