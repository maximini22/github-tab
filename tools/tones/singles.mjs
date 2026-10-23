// One-shots from a SoundFont: node singles.mjs <bank> <msb> <prog> <outDir> <keysCSV> <holdSec> <lenSec> [vel=96]
// Each note: noteOn, noteOff after holdSec, written as mono WAV of lenSec (last 0.3 s faded), effects off. Used for the
// shipping set (28..55 every 3 semitones, 1.7/2.0 s) and for the long sustain measurements (hold 6 s, len 8 s).
import fs from 'fs';
import { audioToWav, BasicMIDI, SoundBankLoader, SpessaSynthProcessor, SpessaSynthSequencer } from 'spessasynth_core';
const [bankPath, msb, prog, outDir, keysCSV, hold, len, vel = '96'] = process.argv.slice(2);
const keys = keysCSV.split(',').map(Number), slot = +len + 1, PPQ = 480, tps = PPQ * 2; // 120 BPM: 960 ticks/s
const vlq = n => { const b = [n & 0x7f]; while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80); return b; };
const raw = [[0, [0xff, 0x51, 3, 0x07, 0xa1, 0x20]], [0, [0xb0, 0, +msb]], [0, [0xc0, +prog]], [0, [0xb0, 91, 0]], [0, [0xb0, 93, 0]]];
keys.forEach((k, i) => { const t = Math.round((0.5 + i * slot) * tps); raw.push([t, [0x90, k, +vel]], [t + Math.round(+hold * tps), [0x80, k, 0]]); });
raw.sort((a, b) => a[0] - b[0]);
let last = 0; const trk = []; for (const [t, b] of raw) { trk.push(...vlq(t - last), ...b); last = t; } trk.push(...vlq(tps * 2), 0xff, 0x2f, 0);
const tl = trk.length, mid = Uint8Array.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, PPQ >> 8, PPQ & 255, 0x4d, 0x54, 0x72, 0x6b, tl >>> 24, tl >> 16 & 255, tl >> 8 & 255, tl & 255, ...trk]);
const sr = 44100, sf = fs.readFileSync(bankPath);
const synth = new SpessaSynthProcessor(sr, { eventsEnabled: false });
synth.soundBankManager.addSoundBank(SoundBankLoader.fromArrayBuffer(sf.buffer.slice(sf.byteOffset, sf.byteOffset + sf.length)), 'main');
await synth.processorInitialized; synth.setSystemParameter('autoAllocateVoices', true); synth.setSystemParameter('effectsEnabled', false);
const seq = new SpessaSynthSequencer(synth); seq.skipToFirstNoteOn = false; /* singles.mjs lacked this: spessasynth skips to the first noteOn, so every window started 0.5 s late */ seq.loadNewSongList([BasicMIDI.fromArrayBuffer(mid.buffer)]); seq.play();
const n = Math.ceil(sr * (0.5 + keys.length * slot + 0.5)), L = new Float32Array(n), R = new Float32Array(n);
for (let f = 0; f < n; f += 128) { seq.processTick(); synth.process(L, R, f, Math.min(128, n - f)); }
fs.mkdirSync(outDir, { recursive: true });
keys.forEach((k, i) => {
  const s0 = Math.round(sr * (0.5 + i * slot)), N = Math.round(sr * +len), m = new Float32Array(N), fl = 0.3 * sr;
  for (let j = 0; j < N; j++) { const g = j > N - fl ? (N - j) / fl : 1; m[j] = 0.5 * (L[s0 + j] + R[s0 + j]) * g; }
  fs.writeFileSync(`${outDir}/n${k}.wav`, new Uint8Array(audioToWav([m], sr)));
});
console.log(outDir, keys.join(','));
