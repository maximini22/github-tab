// First-load bench: cold load of /app/ at 390x844 (fresh browser context each run, no HTTP cache, no service worker yet).
// Reports bytes transferred by the page (encoded, over the wire) and request count, plus median DOMContentLoaded,
// load and "ready" (the editor grid drawn) over RUNS runs. No CPU or network throttling.
// v9: the sampled Sounds (app/tones/) load after first paint, so they are reported apart: shellBytes/shellRequests are
// the page itself (comparable with v8.2's bytes/requests), toneBytes the Nylon sprite + manifest fetched afterwards,
// and toneStartMs / fcpMs / loadMs say when the first tone request started relative to first paint and the load event.
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
  let bytes = 0, reqs = 0, tbytes = 0, treqs = 0; const types = {};
  const urls = {};
  cdp.on('Network.responseReceived', (e) => { urls[e.requestId] = e.response.url; });
  cdp.on('Network.loadingFinished', (e) => { const u0 = urls[e.requestId] || ''; if (u0.indexOf('/tones/') >= 0) { tbytes += e.encodedDataLength; treqs++; return; }
    bytes += e.encodedDataLength; reqs++; const u = u0; const ext = (u.split('?')[0].match(/\.(\w+)$/) || [, 'html'])[1]; types[ext] = (types[ext] || 0) + e.encodedDataLength; });
  await page.goto(APP, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.querySelector('#editor') && document.querySelector('#editor').children.length > 0);
  const t = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    const tr = performance.getEntriesByType('resource').filter((r) => r.name.indexOf('/tones/') >= 0).map((r) => r.startTime);
    return { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, fcp: fcp ? fcp.startTime : null, tone: tr.length ? Math.min.apply(null, tr) : null }; });
  runs.push({ bytes, reqs, tbytes, treqs, types, ...t });
  await ctx.close();
}
await browser.close(); if (server) server.srv.close();
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const r = { url: APP, runs: RUNS, bytes: med(runs.map((x) => x.bytes)), requests: med(runs.map((x) => x.reqs)), dclMs: +med(runs.map((x) => x.dcl)).toFixed(1), loadMs: +med(runs.map((x) => x.load)).toFixed(1), byType: runs[0].types,
  shellBytes: med(runs.map((x) => x.bytes)), shellRequests: med(runs.map((x) => x.reqs)), toneBytes: med(runs.map((x) => x.tbytes)), toneRequests: med(runs.map((x) => x.treqs)),
  fcpMs: +med(runs.map((x) => x.fcp || 0)).toFixed(1), toneStartMs: runs.every((x) => x.tone != null) ? +med(runs.map((x) => x.tone)).toFixed(1) : null,
  toneAfterLoad: runs.every((x) => x.tone == null || x.tone >= x.load), toneAfterFcp: runs.every((x) => x.tone == null || (x.fcp != null && x.tone >= x.fcp)) };
console.log(JSON.stringify(r));
