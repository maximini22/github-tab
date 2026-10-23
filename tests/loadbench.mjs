// First-load bench: cold load of /app/ at 390x844 (fresh browser context each run, no HTTP cache, no service worker yet).
// Reports bytes transferred by the page (encoded, over the wire) and request count, plus median DOMContentLoaded,
// load and "ready" (the editor grid drawn) over RUNS runs. No CPU or network throttling.
//   node loadbench.mjs        BASE=https://.../ node loadbench.mjs        RUNS=9 node loadbench.mjs
import puppeteer from 'puppeteer-core';
import { startServer } from './serve.mjs';

const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const RUNS = Number(process.env.RUNS || 7);
let server = null, BASE = process.env.BASE;
if (!BASE) { server = await startServer(); BASE = server.base; }
const APP = BASE.replace(/\/?$/, '/') + 'app/';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const runs = [];
for (let i = 0; i < RUNS; i++) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  let bytes = 0, reqs = 0; const types = {};
  const urls = {};
  cdp.on('Network.responseReceived', (e) => { urls[e.requestId] = e.response.url; });
  cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; reqs++; const u = urls[e.requestId] || ''; const ext = (u.split('?')[0].match(/\.(\w+)$/) || [, 'html'])[1]; types[ext] = (types[ext] || 0) + e.encodedDataLength; });
  await page.goto(APP, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.querySelector('#editor') && document.querySelector('#editor').children.length > 0);
  const t = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0];
    return { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd }; });
  runs.push({ bytes, reqs, types, ...t });
  await ctx.close();
}
await browser.close(); if (server) server.srv.close();
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const r = { url: APP, runs: RUNS, bytes: med(runs.map((x) => x.bytes)), requests: med(runs.map((x) => x.reqs)), dclMs: +med(runs.map((x) => x.dcl)).toFixed(1), loadMs: +med(runs.map((x) => x.load)).toFixed(1), byType: runs[0].types };
console.log(JSON.stringify(r));
