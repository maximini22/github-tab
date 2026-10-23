// v9.1 browser checks: the lyrics sheet (multi-line notes, newlines kept, autosave, reload, old-notes migration,
// JSON / share round trips, MIDI without lyrics, 5000 limit, section headers -> chips that jump, quick labels),
// writing while looping (opening the sheet keeps playing; Restart hands off inside the scheduler to the loop's first
// downbeat, or bar 1; stopped it moves the playhead; R / Home keys), rollback safety (v9 and v7 read the lyrics; a
// round trip through v9 restores the full text), no page scroll with the sheet open (3 phone sizes + keyboard) and
// first load vs v9.
//
//   cd tests && node v91.mjs                                   (local server; also benches against a v9 worktree)
//   BASE=https://maximini22.github.io/github-tab/ node v91.mjs (live)
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const LIVE = !!process.env.BASE;
let server = null, BASE = process.env.BASE;
if (!BASE) { server = await startServer(); BASE = server.base; }
BASE = BASE.replace(/\/?$/, '/');
const APP = BASE + 'app/';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DL = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-v91-'));
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail && !ok ? '\n     ' + detail : '')); }
function info(s) { console.log('     ' + s); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEW = { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
const LIB_KEY = 'jlr-guitar-tab:library-v5', STORE_KEY = 'jlr-guitar-tab:library', LYR_KEY = 'jlr-guitar-tab:lyrics-full';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: process.env.HEADFUL ? false : 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', (d) => d.accept());
await page.setViewport(VIEW);
const cdp = await page.createCDPSession();
await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });

const gt = (expr) => page.evaluate(new Function('return (' + expr + ')'));
const lib = () => gt('window.__guitarTab.library');
const proj = async () => { const l = await lib(); return l.projects.find((p) => p.id === l.activeProjectId); };
const L = () => gt('window.__guitarTab.lyrics()');
async function click(sel) { await page.waitForSelector(sel, { visible: true }); await page.click(sel); }
async function openDrawer() { if (await page.$eval('#drawer', (d) => d.hidden)) await click('#menu-btn'); await sleep(150); }
async function closeDrawer() { if (!(await page.$eval('#drawer', (d) => d.hidden))) await click('#drawer-close'); await sleep(100); }
async function dismissHint() { if (!(await page.$eval('#hint', (h) => h.hidden))) await click('#hint-ok'); }
async function fresh() { await page.goto(APP, { waitUntil: 'networkidle0' }); await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle0' }); await dismissHint(); }
const toastText = () => page.$eval('#toast', (t) => (t.hidden ? '' : t.textContent));
const hideToast = () => page.$eval('#toast', (t) => { t.hidden = true; });
async function waitDownload(before, ext) {
  for (let i = 0; i < 50; i++) { const f = fs.readdirSync(DL).filter((n) => n.endsWith(ext) && !before.includes(n) && !n.endsWith('.crdownload')); if (f.length) return path.join(DL, f[0]); await sleep(100); }
  return null;
}
async function importPath(file, choice) {
  await openDrawer();
  const [chooser] = await Promise.all([page.waitForFileChooser(), click('#import-btn')]);
  await chooser.accept([file]);
  await click(`#modal-actions button[data-value="${choice}"]`);
  await sleep(300);
}
const openSheet = async () => { if (!(await L()).open) { await click('#idea-open'); await sleep(200); } };
const closeSheet = async () => { if ((await L()).open) { await click('#lyr-done'); await sleep(150); } };
const setText = (v) => page.$eval('#idea', (t, v) => { t.value = v; t.dispatchEvent(new Event('input', { bubbles: true })); }, v);
// A known song: 120 BPM 4/4 (a bar = 2 s), 4 bars, one note on each downbeat (e string frets 1-4 -> MIDI 65-68).
async function fixture(o) {
  await page.evaluate((o, LIB_KEY, STORE_KEY) => {
    const l = window.__guitarTab.library, p = l.projects[0];
    l.activeProjectId = p.id; l.projects = [p];
    p.bpm = 120; p.timeSignature = [4, 4]; p.lengthTicks = 4 * 1920; p.metronome = !!o.metro; p.idea = o.idea || '';
    p.loop = { enabled: !!o.loop, startMeasure: 2, endMeasure: 3 };
    p.tracks[0].notes = [0, 1, 2, 3].map((b) => ({ string: 1, fret: b + 1, startTick: b * 1920, durationTicks: 1920, techniques: [] }));
    localStorage.clear(); localStorage.setItem(LIB_KEY, JSON.stringify(l)); localStorage.removeItem(STORE_KEY);
  }, o, LIB_KEY, STORE_KEY);
  await page.reload({ waitUntil: 'networkidle0' }); await dismissHint();
}
const playMeasure = () => gt('(function(){var s=window.__guitarTab.playingStep(); var c=window.__guitarTab.cells()[s]; return c ? c.measure : null;})()');
async function waitBar(m, t = 12000) { await page.waitForFunction(new Function('m', 'var s=window.__guitarTab.playingStep(); var c=window.__guitarTab.cells()[s]; return !!c && c.measure === m;'), { timeout: t, polling: 20 }, m); }
async function waitReady() { await page.waitForFunction(() => window.__guitarTab.isPlaying() && !window.__guitarTab.waiting(), { timeout: 15000, polling: 20 }); }
const audio = () => page.evaluate(() => ({ ls: TabAudio.lastStart(), now: TabAudio.now(), t0: TabAudio.t0(), sched: TabAudio.scheduled(), clicks: TabAudio.clicks(), playing: TabAudio.isPlaying() }));

const SONG = `[Verse]
Streetlights hum a borrowed tune
I count the cracks from June to June

[Chorus]
So turn it up and let the night run long
Every wrong turn sounds a little like a song

[Bridge]
Paper maps and a quarter tank
Loop it back, loop it back again`;
const LONG = Array.from({ length: 8 }, (_, k) => `[${['Intro', 'Verse 1', 'Pre-chorus', 'Chorus', 'Verse 2', 'Bridge', 'Hook', 'Outro'][k]}]\n` + Array.from({ length: 6 }, (_, j) => `line ${j + 1} of part ${k + 1}, a little longer to wrap now and then`).join('\n')).join('\n\n');

try {
  console.log('App: ' + APP + (LIVE ? '  (live)' : '  (local)'));
  await fresh();

  // ================= 1. Preview box and the sheet =================
  check('notes box: a button that opens the lyrics sheet (dialog), empty state invites lyrics', await page.$eval('#idea-open', (b) => b.tagName === 'BUTTON' && b.getAttribute('aria-controls') === 'lyrics' && b.offsetHeight >= 40 && /lyric/i.test(b.textContent)));
  await openSheet();
  let ly = await L();
  check('tapping the notes box opens the sheet with a multi-line textarea (maxlength 5000)', ly.open && await page.$eval('#idea', (t) => t.tagName === 'TEXTAREA' && t.maxLength === 5000 && t.offsetHeight > 200), JSON.stringify(ly));
  check('sheet: role=dialog, labelled, Done button, character count', await page.$eval('#lyrics', (s) => s.getAttribute('role') === 'dialog' && !!document.getElementById(s.getAttribute('aria-labelledby')) && !s.hidden) && /0\s*\/\s*5000/.test(await page.$eval('#lyr-count', (e) => e.textContent)));
  await page.click('#idea'); await page.keyboard.type('[Verse]\nfirst line\nsecond line');
  await sleep(450);
  let p = await proj();
  check('typing: newlines kept in the project notes', p.idea === '[Verse]\nfirst line\nsecond line', JSON.stringify(p.idea));
  const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).projects[0].idea, LIB_KEY);
  check('autosave: the lyrics are in localStorage within ~300 ms (newlines kept)', stored === p.idea, JSON.stringify(stored));
  check('count updates while typing', /30\s*\/\s*5000/.test(await page.$eval('#lyr-count', (e) => e.textContent)), await page.$eval('#lyr-count', (e) => e.textContent));
  await page.keyboard.type('\nthird'); // reload right away: the pagehide flush saves it before the debounce
  await page.reload({ waitUntil: 'networkidle0' }); await dismissHint();
  p = await proj();
  check('reload: lyrics persist (including text typed just before reload)', p.idea === '[Verse]\nfirst line\nsecond line\nthird', JSON.stringify(p.idea));
  const prev = await page.$eval('#idea-prev', (e) => ({ text: e.innerText, lines: e.querySelectorAll('.ih').length }));
  check('preview: the box shows the first lines (header + first lyric line), header styled', /Verse/.test(prev.text) && /first line/.test(prev.text) && prev.lines === 1, JSON.stringify(prev));
  check('preview: clamped to 2 lines', await page.$eval('#idea-prev', (e) => e.getBoundingClientRect().height <= 2 * parseFloat(getComputedStyle(e).lineHeight) + 2));
  await openSheet();
  check('reopened sheet shows the saved lyrics', (await L()).value === p.idea);
  await page.keyboard.press('Escape'); await sleep(150);
  check('Escape closes the sheet (even while typing)', !(await L()).open);

  // ================= 2. Old notes migrate =================
  await page.evaluate((LIB_KEY, STORE_KEY) => { const l = window.__guitarTab.library; l.projects[0].idea = 'riff idea: try it in drop D'; const v4 = TabModel.toV4(l); localStorage.clear(); localStorage.setItem(STORE_KEY, JSON.stringify(v4)); }, LIB_KEY, STORE_KEY);
  await page.reload({ waitUntil: 'networkidle0' }); await dismissHint();
  p = await proj();
  check('old notes: a v4 (v7-era) library\'s one-line notes load as the lyrics', p.idea === 'riff idea: try it in drop D' && /drop D/.test(await page.$eval('#idea-prev', (e) => e.textContent)), JSON.stringify(p.idea));
  await openSheet();
  check('old notes: shown in the sheet, editable, no headers/chips', (await L()).value === 'riff idea: try it in drop D' && (await L()).heads.length === 0 && await page.$$eval('#lyr-chips .chip', (c) => c.length === 0));
  await closeSheet();

  // ================= 3. Section headers, chips, mirror =================
  await fresh(); await openSheet();
  await setText('[Verse 1]\nla\n  [Chorus]  \nnot [a] header\n[a]b\n[]\n[Bridge]\n[x\n[Pre-chorus]');
  ly = await L();
  check('headers: a line that is only [Label] (spaces ok) is a header; text around brackets is not', JSON.stringify(ly.heads.map((h) => h.label)) === JSON.stringify(['Verse 1', 'Chorus', 'Bridge', 'Pre-chorus']), JSON.stringify(ly.heads));
  check('chips: one per header, in order', JSON.stringify(await page.$$eval('#lyr-chips .chip', (b) => b.map((x) => x.textContent))) === JSON.stringify(['Verse 1', 'Chorus', 'Bridge', 'Pre-chorus']));
  check('mirror: header lines painted as .lh (bold band) in the mirror layer', (await page.$$eval('#lyr-mirror .lh', (x) => x.map((e) => e.textContent))).join('|') === '[Verse 1]|  [Chorus]  |[Bridge]|[Pre-chorus]');
  await setText(LONG);
  ly = await L();
  check('long sheet: scrolls inside the textarea (not the page)', ly.scrollHeight > ly.clientHeight + 100 && await gt('document.scrollingElement.scrollHeight <= innerHeight'), JSON.stringify({ sh: ly.scrollHeight, ch: ly.clientHeight }));
  const mir = await page.evaluate(() => { const t = document.getElementById('idea'), m = document.getElementById('lyr-mirror'); return { ts: t.scrollHeight, ms: m.scrollHeight, tw: t.clientWidth, mw: m.clientWidth, tf: getComputedStyle(t).font, mf: getComputedStyle(m).font, tl: getComputedStyle(t).lineHeight, ml: getComputedStyle(m).lineHeight }; });
  check('mirror: same box, font and wrapping as the textarea (no caret drift)', mir.ts === mir.ms && mir.tw === mir.mw && mir.tf === mir.mf && mir.tl === mir.ml, JSON.stringify(mir));
  const lhFont = await page.$eval('#lyr-mirror .lh', (e) => { const s = getComputedStyle(e); return { fw: s.fontWeight, fs: s.fontSize, ls: s.letterSpacing, pad: s.paddingLeft }; });
  check('mirror: header decoration does not change the text metrics (weight/size/spacing/padding)', lhFont.fs === '16px' && (lhFont.ls === 'normal' || lhFont.ls === '0px') && lhFont.pad === '0px', JSON.stringify(lhFont));
  const chips = await page.$$('#lyr-chips .chip');
  await chips[5].click(); await sleep(200);
  ly = await L();
  const mst = await page.$eval('#lyr-mirror', (m) => m.scrollTop);
  check('chip tap: jump-scrolls the Bridge header to the top of the textarea', Math.abs(ly.scrollTop - ly.headTops[5]) <= 2 && ly.active === 5, JSON.stringify({ st: ly.scrollTop, want: ly.headTops[5], active: ly.active }));
  check('chip tap: the mirror scrolls with it', Math.abs(mst - ly.scrollTop) <= 1, mst + ' vs ' + ly.scrollTop);
  check('chip tap: the tapped chip is marked active (aria-current)', await page.$$eval('#lyr-chips .chip', (b) => b.findIndex((x) => x.getAttribute('aria-current') === 'true')) === 5);
  await chips[0].click(); await sleep(200);
  check('chip tap: back to the first section (top)', (await L()).scrollTop === 0 && (await L()).active === 0);
  await page.$eval('#idea', (t) => { t.scrollTop = t.scrollHeight; t.dispatchEvent(new Event('scroll')); }); await sleep(450);
  ly = await L();
  check('scrolling by hand: the active chip follows (at the bottom: the last section)', ly.active === 7, JSON.stringify({ st: ly.scrollTop, active: ly.active, tops: ly.headTops }));
  await page.$eval('#idea', (t, y) => { t.scrollTop = y; }, ly.headTops[3] + 5); await sleep(150);
  check('scrolling by hand: mid-sheet the chip is the section at the top', (await L()).active === 3, String((await L()).active));
  await (await page.$$('#lyr-chips .chip'))[6].click(); await sleep(150);
  check('chip tap near the end (cannot reach the top): the tapped chip stays active', (await L()).active === 6, String((await L()).active));

  // ================= 4. Quick insert =================
  await setText('');
  await page.focus('#idea');
  await click('#lyr-ins .chip[data-label="Verse"]');
  ly = await L();
  check('quick insert: + Verse on an empty sheet -> "[Verse]\\n", caret on the next line, keyboard stays (textarea keeps focus)', ly.value === '[Verse]\n' && ly.focused && await page.$eval('#idea', (t) => t.selectionStart === 8), JSON.stringify(ly.value));
  await page.keyboard.type('line one');
  await click('#lyr-ins .chip[data-label="Chorus"]');
  check('quick insert: + Chorus after text -> blank line, [Chorus], new line', (await L()).value === '[Verse]\nline one\n\n[Chorus]\n', JSON.stringify((await L()).value));
  await click('#lyr-ins .chip[data-label="Verse"]');
  check('quick insert: a second Verse is numbered "[Verse 2]"', /\n\n\[Verse 2\]\n$/.test((await L()).value), JSON.stringify((await L()).value));
  check('quick insert: all seven labels offered', JSON.stringify(await page.$$eval('#lyr-ins .chip', (b) => b.map((x) => x.dataset.label).sort())) === JSON.stringify(['Bridge', 'Chorus', 'Hook', 'Intro', 'Outro', 'Pre-chorus', 'Verse']));
  check('quick insert: chips show the new sections', (await page.$$eval('#lyr-chips .chip', (b) => b.length)) === 3);
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); await sleep(100);
  check('quick insert: native undo (Ctrl+Z) takes the label back out', !/Verse 2/.test((await L()).value), JSON.stringify((await L()).value));

  // ================= 5. 5000 limit =================
  await setText('x'.repeat(5100));
  await sleep(400);
  check('limit: pasted text over 5000 is cut to 5000 (sheet and project)', (await L()).value.length === 5000 && (await proj()).idea.length === 5000);
  check('limit: count shows 5000 / 5000 and is flagged (near-full colour)', await page.$eval('#lyr-count', (e) => /5000\s*\/\s*5000/.test(e.textContent) && e.classList.contains('near')), await page.$eval('#lyr-count', (e) => e.className + ' ' + e.textContent));
  await page.focus('#idea'); await page.keyboard.press('End'); await page.keyboard.type('yy');
  check('limit: typing at 5000 adds nothing', (await L()).value.length === 5000);
  await hideToast(); await click('#lyr-ins .chip[data-label="Hook"]');
  check('limit: a quick label that would overflow is refused with a toast', (await L()).value.length === 5000 && /full/i.test(await toastText()), await toastText());
  const big = 'ab\n'.repeat(1666) + 'ab';
  await setText(big); await sleep(400);
  await page.reload({ waitUntil: 'networkidle0' }); await dismissHint();
  check('limit: 5000 characters with 1666 newlines survive a reload', (await proj()).idea === big);
  const bad = await page.evaluate(() => { const l = window.__guitarTab.library; l.projects[0].idea = 'x'.repeat(5001); return TabModel.parseFile(l).error || ''; });
  check('validator: a file with notes over 5000 is rejected', /idea/i.test(bad), bad);

  // ================= 6. JSON, share, MIDI =================
  await fresh(); await openSheet(); await setText(SONG); await sleep(400); await closeSheet();
  let before = fs.readdirSync(DL);
  await openDrawer(); await click('#export-one');
  const jf = await waitDownload(before, '.json');
  const jobj = jf && JSON.parse(fs.readFileSync(jf, 'utf8'));
  check('JSON export: schemaVersion 5, lyrics with newlines', jobj && jobj.schemaVersion === 5 && jobj.projects[0].idea === SONG, jf);
  await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle0' }); await dismissHint();
  await importPath(jf, 'replace'); await closeDrawer();
  check('JSON import: the lyrics come back exactly (newlines, headers)', (await proj()).idea === SONG, JSON.stringify((await proj()).idea));
  await openSheet();
  check('JSON import: chips rebuilt', (await L()).heads.length === 3);
  await closeSheet();
  const mockShare = (files) => page.evaluate((files) => {
    window.__sh = { calls: [] }; window.__shFiles = files;
    const def = (o, k, v) => Object.defineProperty(o, k, { configurable: true, writable: true, value: v });
    def(navigator, 'canShare', (d) => !d.files || window.__shFiles);
    def(navigator, 'share', async (d) => { window.__sh.calls.push({ kind: d.files ? 'files' : 'text', text: d.text || null, files: d.files ? await Promise.all(d.files.map(async (f) => ({ name: f.name, body: await f.text() }))) : null }); });
  }, files);
  await mockShare(true);
  await openDrawer(); await click('#share-btn'); await sleep(400);
  let sh = await gt('window.__sh');
  const sbody = sh.calls[0] && sh.calls[0].files && JSON.parse(sh.calls[0].files[0].body);
  check('share (file): the shared project JSON keeps the lyrics with newlines', sbody && sbody.projects[0].idea === SONG);
  const sfile = path.join(DL, 'shared-lyrics.json.txt'); fs.writeFileSync(sfile, sh.calls[0].files[0].body);
  await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle0' }); await dismissHint();
  await importPath(sfile, 'replace'); await closeDrawer();
  check('share round trip: the shared .json.txt imports back with the lyrics intact', (await proj()).idea === SONG);
  await mockShare(false);
  await openDrawer(); await click('#share-btn'); await sleep(400);
  sh = await gt('window.__sh');
  const st = sh.calls[0] && sh.calls[0].text || '';
  check('share (text): the tab text ends with the lyrics under a "Lyrics" heading, newlines kept', st.trimEnd().endsWith('\n\nLyrics\n' + SONG) && /^e\|/m.test(st), JSON.stringify(st.slice(-200)));
  const ascii = await gt('window.__guitarTab.toAscii()');
  check('tab text: lyrics come after the tab (not before it)', ascii.indexOf('e|') < ascii.indexOf('Lyrics'));
  before = fs.readdirSync(DL);
  await click('#export-midi'); await sleep(200);
  const allBtn = await page.$('#modal-actions button[data-value="all"]'); if (allBtn) await allBtn.click();
  const mf = await waitDownload(before, '.mid');
  const mb = mf ? fs.readFileSync(mf) : Buffer.alloc(0);
  let lyricMeta = false; for (let i = 0; i + 1 < mb.length; i++) if (mb[i] === 0xff && mb[i + 1] === 0x05) lyricMeta = true;
  check('MIDI export: no lyrics (no lyric events, none of the text)', mb.length > 20 && mb.slice(0, 4).toString() === 'MThd' && !lyricMeta && !mb.includes('Streetlights') && !mb.includes('Chorus') && !mb.includes('Lyrics'), mf + ' ' + mb.length);
  await closeDrawer();

  // ================= 7. Writing while looping =================
  await fixture({ loop: true, metro: true, idea: SONG });
  check('fixture: 120 BPM, loop bars 2-3, metronome on', await gt('window.__guitarTab.cells().length') > 0 && (await proj()).loop.enabled);
  await click('#play-btn'); await waitReady();
  await sleep(300);
  const pre = await audio();
  await openSheet(); await sleep(600);
  const after = await audio();
  check('opening the sheet does not stop or restart playback', after.playing && after.ls.at === pre.ls.at && after.now > pre.now + 0.4, JSON.stringify({ pre: pre.ls.at, post: after.ls.at }));
  await page.click('#idea'); await page.keyboard.type('\nnew line while it loops'); await sleep(350);
  check('typing in the sheet does not stop or restart playback', (await audio()).playing && (await audio()).ls.at === pre.ls.at);
  check('mini transport: Pause shown while playing; Restart names the loop start', await page.$eval('#lyr-play', (b) => b.getAttribute('aria-pressed') === 'true') && /loop/i.test(await page.$eval('#lyr-target', (e) => e.textContent)) && /2/.test(await page.$eval('#lyr-target', (e) => e.textContent)), await page.$eval('#lyr-target', (e) => e.textContent));
  check('mini transport: position readout follows playback', /^\d+\|\d+\|\d+/.test(await page.$eval('#lyr-pos', (e) => e.textContent)));
  check('mini transport: Restart is the big button (>= 48 px tall, widest)', await page.$eval('#lyr-restart', (b) => { const r = b.getBoundingClientRect(); return r.height >= 48 && [...b.parentNode.querySelectorAll('button')].every((x) => x === b || x.getBoundingClientRect().width <= r.width); }));
  await waitBar(3);
  await click('#lyr-restart');
  let a = await audio();
  const pos = await playMeasure();
  check('Restart while playing: a scheduler hand-off (no stop/start), 40 ms ahead', a.playing && a.ls.handoff && Math.abs(a.ls.at - a.ls.now - 0.04) < 0.002 && a.t0 === a.ls.at, JSON.stringify({ at: a.ls.at, now: a.ls.now, t0: a.t0 }));
  check('Restart while playing: the first scheduled note is the loop-start downbeat (bar 2, MIDI 66) at exactly the hand-off time', a.sched.length > 0 && a.sched[0].at === 0 && a.sched[0].midi === 66 && a.sched[0].step === 0, JSON.stringify(a.sched.slice(0, 2)));
  check('Restart while playing: the metronome restarts on the same sample (accented click at tick of bar 2, time 0, no count-in)', a.clicks.length > 0 && a.clicks[0].at === 0 && a.clicks[0].accent && a.clicks[0].tick === 1920 && !a.clicks.some((c) => c.countIn), JSON.stringify(a.clicks.slice(0, 2)));
  const acts = a.ls.voices || [];
  check('Restart while playing: queued notes from the old pass are cancelled, ringing ones faded (none left ringing)', acts.length > 0 && acts.every((v) => (v.when > a.ls.now ? v.act === 'cancel' : v.act !== 'ring')), JSON.stringify(acts));
  check('Restart while playing: playhead shows bar 2 at once', pos === 2, 'bar ' + pos);
  await sleep(1300);
  a = await audio();
  const cl = a.clicks.filter((c) => !c.countIn);
  check('after Restart: clicks every 0.5 s from the downbeat (in sync), notes only from the loop', cl.slice(0, 3).map((c) => c.at).join() === '0,0.5,1' && cl.slice(0, 3).map((c) => c.tick).join() === '1920,2400,2880' && a.sched.every((n) => n.midi === 66 || n.midi === 67), JSON.stringify(cl.slice(0, 4)));
  check('after Restart: no doubled notes (each scheduled note time is unique)', new Set(a.sched.map((n) => n.at + ':' + n.midi)).size === a.sched.length);
  for (let i = 0; i < 6; i++) { await page.click('#lyr-restart'); await sleep(30); }
  await sleep(120); a = await audio();
  check('Restart spam (6 taps in ~0.2 s): still playing, last hand-off clean, first note/click at 0 on bar 2', a.playing && a.ls.handoff && a.sched[0].at === 0 && a.sched[0].midi === 66 && a.clicks[0].at === 0 && (a.ls.voices || []).every((v) => (v.when > a.ls.now ? v.act === 'cancel' : v.act !== 'ring')), JSON.stringify(a.ls));
  await page.$eval('#lyrics', (s) => s.focus());
  await waitBar(3); await page.keyboard.press('r'); await sleep(60); a = await audio();
  check('R key (sheet open, textarea not focused): Restart to the loop start', a.ls.handoff && a.sched[0].midi === 66 && a.sched[0].at === 0 && (await L()).value.endsWith('loops'));
  await waitBar(3); await page.keyboard.press('Home'); await sleep(60); a = await audio();
  check('Home key: Restart too', a.ls.handoff && a.sched[0].midi === 66 && (await playMeasure()) === 2);
  const lsBefore = a.ls.at;
  await page.focus('#idea'); await page.keyboard.press('End'); await page.keyboard.type(' r'); await sleep(60);
  check('R while typing in the textarea types an "r" (no restart)', (await audio()).ls.at === lsBefore && (await L()).value.endsWith(' r'));
  await page.$eval('#lyrics', (s) => s.focus()); await page.keyboard.press('Space'); await sleep(100);
  check('Space in the sheet (not typing): pauses', !(await audio()).playing);
  // stopped: Restart moves the playhead
  const phBefore = await gt('window.__guitarTab.playhead()');
  await click('#lyr-restart'); await sleep(80);
  const lp = await gt('(function(){var c=window.__guitarTab.cells();for(var i=0;i<c.length;i++) if(c[i].measure===2) return i;})()');
  check('Restart while stopped: moves the playhead to the loop start, does not start playing', (await gt('window.__guitarTab.playhead()')) === lp && !(await audio()).playing, phBefore + ' -> ' + (await gt('window.__guitarTab.playhead()')) + ' want ' + lp);
  await click('#lyr-click'); await sleep(80);
  check('mini transport: metronome toggle works from the sheet', (await proj()).metronome === false && await page.$eval('#lyr-click', (b) => b.getAttribute('aria-pressed') === 'false'));
  await click('#lyr-click'); await sleep(80);
  // no loop: bar 1
  await closeSheet(); await click('#loop-toggle'); await sleep(100);
  check('fixture: loop off', !(await proj()).loop.enabled);
  await openSheet();
  check('Restart label: "Bar 1" with the loop off', /bar 1/i.test(await page.$eval('#lyr-target', (e) => e.textContent)), await page.$eval('#lyr-target', (e) => e.textContent));
  await click('#lyr-play'); await waitReady(); await waitBar(2);
  await click('#lyr-restart'); a = await audio();
  check('Restart with no loop (playing): hands off to bar 1 (MIDI 65, tick 0) at time 0', a.playing && a.ls.handoff && a.sched[0].at === 0 && a.sched[0].midi === 65 && a.clicks[0].at === 0 && a.clicks[0].tick === 0 && a.clicks[0].accent && (await playMeasure()) === 1, JSON.stringify({ n: a.sched[0], c: a.clicks[0] }));
  await click('#lyr-stop'); await sleep(100);
  check('Stop from the sheet: stops, sheet stays open', !(await audio()).playing && (await L()).open);
  await click('#lyr-play'); await waitReady(); await waitBar(2); await click('#lyr-stop'); await sleep(100);
  const ph2 = await gt('window.__guitarTab.playhead()');
  await click('#lyr-restart'); await sleep(80);
  check('Restart with no loop (stopped): playhead to bar 1', ph2 > 0 && (await gt('window.__guitarTab.playhead()')) === 0 && !(await audio()).playing, ph2 + ' -> ' + (await gt('window.__guitarTab.playhead()')));
  await closeSheet();
  await click('#play-btn'); await waitReady(); await waitBar(2);
  await page.keyboard.press('r'); await sleep(60); a = await audio();
  check('R key on the main screen while playing: back to bar 1 without stopping', a.playing && a.ls.handoff && a.sched[0].midi === 65 && a.sched[0].at === 0);
  await click('#stop-btn'); await sleep(100);
  await click('#stop-btn'); await sleep(100);
  // plain Stop also cuts what the lookahead had queued
  await click('#play-btn'); await waitReady(); await sleep(700);
  await click('#stop-btn'); await sleep(50);
  check('Stop: nothing queued keeps playing after it (no stuck notes)', !(await audio()).playing);

  // ================= 8. No page scroll with the sheet open =================
  await openSheet(); await setText(LONG);
  const fit = () => page.evaluate(() => { const s = document.getElementById('lyrics').getBoundingClientRect(), r = document.getElementById('lyr-restart').getBoundingClientRect(), t = document.getElementById('idea').getBoundingClientRect();
    return { page: document.scrollingElement.scrollHeight - innerHeight, pageX: document.scrollingElement.scrollWidth - innerWidth, sy: scrollY, sheetBottom: Math.round(s.bottom), sheetTop: Math.round(s.top), vh: innerHeight, restartBottom: Math.round(r.bottom), restartTop: Math.round(r.top), ta: Math.round(t.height), kb: document.getElementById('lyrics').classList.contains('kb'), tiny: document.getElementById('lyrics').classList.contains('tiny') }; });
  for (const [w, h] of [[390, 844], [390, 650], [360, 640]]) {
    await page.setViewport({ ...VIEW, width: w, height: h }); await sleep(250);
    const f = await fit();
    check(`no page scroll ${w}x${h} with the sheet open; sheet fills the screen, Restart visible, text area >= 250 px`, f.page <= 0 && f.pageX <= 0 && f.sy === 0 && f.sheetTop === 0 && f.sheetBottom === h && f.restartBottom <= h && f.ta >= 250, JSON.stringify(f));
  }
  await page.setViewport(VIEW); await sleep(250);
  await page.focus('#idea'); await page.$eval('#idea', (t) => { const i = t.value.indexOf('part 6'); t.setSelectionRange(i, i); });
  for (const [w, h] of [[390, 470], [360, 330]]) {
    await page.setViewport({ ...VIEW, width: w, height: h }); await sleep(350);
    const f = await fit(); ly = await L();
    const caretIn = ly.caret && ly.caret.top - ly.scrollTop >= 0 && ly.caret.top + ly.caret.h - ly.scrollTop <= ly.clientHeight + 1;
    check(`keyboard up (${w}x${h} visual viewport): no page scroll, sheet fits above the keyboard, Restart visible, caret in view`, f.page <= 0 && f.sy === 0 && f.sheetBottom <= h && f.restartBottom <= h && f.kb && caretIn && ly.focused, JSON.stringify({ f, caret: ly.caret, st: ly.scrollTop, ch: ly.clientHeight }));
    if (h < 360) check('keyboard + short screen: chip rows fold away to keep room for text', f.tiny && f.ta >= 80, JSON.stringify(f));
  }
  await page.keyboard.press('Enter'); await page.keyboard.type('typed above the keyboard'); await sleep(80);
  ly = await L();
  check('keyboard up: the caret stays in view while typing', ly.caret && ly.caret.top - ly.scrollTop >= 0 && ly.caret.top + ly.caret.h - ly.scrollTop <= ly.clientHeight + 1, JSON.stringify({ caret: ly.caret, st: ly.scrollTop, ch: ly.clientHeight }));
  await page.setViewport(VIEW); await sleep(250);
  check('keyboard down: sheet back to full height', !(await fit()).kb && (await fit()).sheetBottom === 844);
  await closeSheet();
  for (const [w, h] of [[390, 844], [390, 650], [360, 640]]) {
    await page.setViewport({ ...VIEW, width: w, height: h }); await sleep(250);
    const f = await page.evaluate(() => ({ page: document.scrollingElement.scrollHeight - innerHeight, box: Math.round(document.getElementById('idea-open').getBoundingClientRect().bottom), vh: innerHeight }));
    check(`main screen ${w}x${h}: no page scroll, the lyrics preview box is on screen`, f.page <= 0 && f.box <= f.vh, JSON.stringify(f));
  }
  await page.setViewport(VIEW);

  // ================= 9. Version, docs =================
  const src = await page.evaluate(async (app) => { const g = async (u) => { const r = await fetch(u, { cache: 'no-store' }); return r.ok ? r.text() : ''; }; return { sw: await g(app + 'sw.js'), html: await g(app + 'index.html') }; }, APP);
  const jl = /jeremylegal/.test(BASE);
  check('sw.js: cache ' + (jl ? 'jlr-' : '') + 'guitar-tab-v9-1', src.sw.includes("var VERSION = '" + (jl ? 'jlr-' : '') + "guitar-tab-v9-1'"), (src.sw.match(/var VERSION = '[^']+'/) || [''])[0]);
  check('browser-only: no download / app-store links', !/apps\.apple\.com|play\.google\.com|\bdownload the app\b/i.test(src.html));

  // ================= 10. Rollback safety (local only: older versions from git) =================
  if (!LIVE) {
    const wt = (name, rev) => { const d = path.join(os.tmpdir(), name); if (!fs.existsSync(path.join(d, 'app'))) { try { execFileSync('git', ['-C', REPO, 'worktree', 'remove', '--force', d], { stdio: 'ignore' }); } catch (e) { /* none */ } execFileSync('git', ['-C', REPO, 'worktree', 'add', '--detach', d, rev], { stdio: 'ignore' }); } return d; };
    const v9dir = wt('gt-v9-worktree', '429abec'), v7dir = wt('gt-v7-worktree', 'v7-stable');
    const s9 = await startServer(0, v9dir), s7 = await startServer(0, v7dir);
    const BIG = (SONG + '\n\n').repeat(4).trim() + '\n[Outro]\nthe end';
    await fresh(); await openSheet(); await setText(BIG); await sleep(400); await closeSheet();
    const dump = () => page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
    const ours = await dump();
    check('long lyrics (' + BIG.length + ' chars) keep a full backup copy for rollbacks', JSON.parse(ours[LYR_KEY] || '{}')[(await proj()).id] === BIG);
    const other = await browser.newPage(); await other.setViewport(VIEW);
    const oerr = []; other.on('pageerror', (e) => oerr.push(e.message));
    async function visit(base, data) {
      await other.goto(base + 'app/', { waitUntil: 'networkidle0' });
      await other.evaluate((d) => { localStorage.clear(); for (const k in d) localStorage.setItem(k, d[k]); }, data);
      await other.reload({ waitUntil: 'networkidle0' });
      const h = await other.$('#hint-ok'); if (h && await h.isIntersectingViewport().catch(() => false)) await h.click().catch(() => {});
      return other.evaluate(() => { const l = window.__guitarTab.library; return l.projects.find((p) => p.id === l.activeProjectId).idea; });
    }
    let idea9 = await visit(s9.base, ours);
    check('rollback to v9: opens the v9.1 library, lyrics cut to its 500-char notes limit (newlines kept in the data)', idea9 === BIG.slice(0, 500), JSON.stringify(idea9 && idea9.slice(0, 60)));
    await other.click('#bpm-up'); await sleep(500);
    let back = await other.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
    await page.evaluate((d) => { localStorage.clear(); for (const k in d) localStorage.setItem(k, d[k]); }, back);
    await page.reload({ waitUntil: 'networkidle0' }); await dismissHint();
    p = await proj();
    check('roll forward from v9 (after v9 saved a change): the full lyrics come back from the backup, v9\'s change kept', p.idea === BIG && p.bpm === 91, JSON.stringify({ len: p.idea.length, bpm: p.bpm }));
    const idea7 = await visit(s7.base, await dump());
    check('rollback to v7: its v4 copy is accepted (notes up to 5000 pass its validator), shown cut to 500', idea7 === BIG.slice(0, 500), JSON.stringify(idea7 && idea7.slice(0, 60)));
    await other.click('#bpm-up'); await sleep(500);
    back = await other.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
    await page.evaluate((d) => { localStorage.clear(); for (const k in d) localStorage.setItem(k, d[k]); }, back);
    await page.reload({ waitUntil: 'networkidle0' }); await dismissHint();
    p = await proj();
    check('roll forward from v7 (after v7 saved): v7\'s copy wins, full lyrics restored from the backup', p.idea === BIG && p.bpm === 92, JSON.stringify({ len: p.idea.length, bpm: p.bpm }));
    // notes edited in the older version are left alone
    await visit(s9.base, await dump());
    await other.$eval('#idea', (i) => { i.value = 'rewritten in v9'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(600);
    back = await other.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
    await page.evaluate((d) => { localStorage.clear(); for (const k in d) localStorage.setItem(k, d[k]); }, back);
    await page.reload({ waitUntil: 'networkidle0' }); await dismissHint();
    check('roll forward after editing the notes in v9: that edit is kept (no stale restore)', (await proj()).idea === 'rewritten in v9', JSON.stringify((await proj()).idea));
    check('older versions ran without page errors', oerr.length === 0, oerr.join(' | '));
    await other.close(); s7.srv.close();

    // ================= 11. First load vs v9 =================
    const bench = async (url) => { const ctx = await browser.createBrowserContext(), bp = await ctx.newPage(); await bp.setViewport(VIEW);
      const c = await bp.createCDPSession(); await c.send('Network.enable'); await c.send('Network.setCacheDisabled', { cacheDisabled: true });
      let bytes = 0, reqs = 0; c.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; reqs++; });
      await bp.goto(url, { waitUntil: 'load' }); await bp.waitForFunction(() => document.querySelector('#editor') && document.querySelector('#editor').children.length > 0);
      const t = await bp.evaluate(() => { const n = performance.getEntriesByType('navigation')[0], f = performance.getEntriesByName('first-contentful-paint')[0]; return { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, fcp: f ? f.startTime : 0 }; });
      await ctx.close(); return { ...t, bytes, reqs }; };
    const A9 = [], B9 = [];
    for (let i = 0; i < 9; i++) { A9.push(await bench(s9.base + 'app/')); B9.push(await bench(APP)); }
    s9.srv.close();
    const med = (r, k) => { const s = r.map((x) => x[k]).sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const cmp = ['dcl', 'load', 'fcp'].map((k) => ({ k, v9: +med(A9, k).toFixed(1), v91: +med(B9, k).toFixed(1) }));
    check('loadbench: v9.1 first load (DCL, load, first paint; median of 9, interleaved) within noise of v9 (<= +25% or +15 ms)', cmp.every((c) => c.v91 <= Math.max(c.v9 * 1.25, c.v9 + 15)), JSON.stringify(cmp));
    const by = { v9: med(A9, 'bytes'), v91: med(B9, 'bytes'), r9: med(A9, 'reqs'), r91: med(B9, 'reqs') };
    check('loadbench: same request count, bytes within +10%', by.r91 === by.r9 && by.v91 <= by.v9 * 1.1, JSON.stringify(by));
    info('first load median v9 -> v9.1: ' + cmp.map((c) => `${c.k} ${c.v9} -> ${c.v91} ms`).join(', ') + `; bytes ${by.v9} -> ${by.v91}; requests ${by.r9} -> ${by.r91}`);
  }

  check('no page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
} catch (e) {
  check('suite ran to the end', false, e.stack);
}
await browser.close(); if (server) server.srv.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
