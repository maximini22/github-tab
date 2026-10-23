#!/usr/bin/env python3
"""v9 shipping sprite for one tone: ../v9/<tone>/ship/n*.wav -> ../v9/<tone>/<tone>.mp3 (mono 64k CBR) + <tone>.json.
Per note: trim leading silence so the 5 %-of-peak crossing sits 2 ms in (1 ms fade-in if the cut is not silent),
measure the sustain pitch (YIN, 0.10-0.90 s) and store the correction in cents. The sprite opens with 50 ms of silence
and has 50 ms of silence between notes, so the app can re-find every onset in the decoded audio whatever the MP3
decoder's delay is. Loudness: ffmpeg ebur128 integrated loudness of the sprite, stored as 'lufs'."""
import sys, os, glob, json, subprocess, re, numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(__file__))
tone = sys.argv[1]; W = os.environ.get('WORK', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work')); d = f'{W}/v9/{tone}'; SR = 44100; GAP = int(0.05 * SR); PRE = int(0.002 * SR)
def f0(y, sr, lo, hi, a=0.10, b=0.70):   # YIN (cumulative-mean-normalised difference), parabolic interpolation
    x = y[int(a * sr): int(b * sr)].astype(np.float64); x -= x.mean()
    W = len(x) // 2; tmax = int(sr / lo) + 2; tmin = max(2, int(sr / hi))
    d = np.array([np.sum((x[:W] - x[t:t + W]) ** 2) for t in range(tmax)])
    c = np.ones(tmax); c[1:] = d[1:] * np.arange(1, tmax) / np.maximum(np.cumsum(d[1:]), 1e-12)
    idx = [t for t in range(tmin, tmax - 1) if c[t] < 0.15 and c[t] <= c[t - 1] and c[t] <= c[t + 1]]
    t = idx[0] if idx else tmin + int(np.argmin(c[tmin:tmax - 1]))
    p, q, r = c[t - 1], c[t], c[t + 1]; den = p - 2 * q + r; sh = 0.5 * (p - r) / den if den else 0
    return sr / (t + sh)
fs = sorted(glob.glob(f'{d}/ship/n*.wav'), key=lambda f: int(os.path.basename(f)[1:-4]))
parts, notes, pos = [np.zeros(GAP, np.float32)], [], GAP
for f in fs:
    y, sr = sf.read(f, dtype='float32'); k = int(os.path.basename(f)[1:-4])
    if y.ndim > 1: y = y.mean(axis=1)
    a = np.abs(y); pk = a.max(); c5 = int(np.argmax(a > 0.05 * pk)); cut = max(0, c5 - PRE)
    ref = 440 * 2 ** ((k - 69) / 12); cents = 1200 * np.log2(f0(y, sr, ref / 1.5, ref * 1.5) / ref)
    z = y[cut:].copy()
    if cut > 0: n = min(int(0.001 * SR), cut); z[:n] *= np.linspace(0, 1, n)
    x20 = (int(np.argmax(np.abs(z) > 0.2 * np.abs(z).max()))) / SR
    notes.append({'x20': x20, 'root': k, 'start': pos, 'len': len(z), 'pk': float(np.abs(z).max()), 'cents': round(float(cents), 1), 'trimMs': round(cut / SR * 1000, 1)})
    parts += [z, np.zeros(GAP, np.float32)]; pos += len(z) + GAP
x = np.concatenate(parts); g = 0.89 / np.abs(x).max(); x *= g
sf.write(f'{d}/sprite.wav', x, SR, subtype='PCM_16')
subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-y', '-i', f'{d}/sprite.wav', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', f'{d}/{tone}.mp3'], check=True)
r = subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-i', f'{d}/sprite.wav', '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
lufs = float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r)[-1])
REF = json.load(open(f'{W}/v9/nylon/nylon.json'))['lufs'] if tone != 'nylon' else lufs
# Level trim after LUFS matching, measured in the app (tests/v9.mjs method): momentary (400 ms) K-weighted loudness
# from note onset, through the app's output chain, mean of 8 notes, vs Nylon. Whole-note LUFS alone left these louder.
TRIM_DB = {'spanish': -1.76, 'clean': -0.49, 'upright': -1.73, 'ebass': -1.44}
man = {'v': 1, 'tone': tone, 'sr': SR, 'lufs': lufs, 'gain': round(10 ** ((REF - lufs + TRIM_DB.get(tone, 0)) / 20), 4),
       'notes': [{'root': n['root'], 'at': round(n['start'] / SR, 5), 'dur': round(n['len'] / SR, 4), 'x20': round(n['x20'], 5), 'cents': n['cents']} for n in notes]}
open(f'{d}/{tone}.json', 'w').write(json.dumps(man, separators=(',', ':')))
print(f'{tone:9s} notes={len(notes):2d} mp3={os.path.getsize(f"{d}/{tone}.mp3")} B json={os.path.getsize(f"{d}/{tone}.json")} B lufs={lufs}')
for n in notes: print(f"   n{n['root']} trim {n['trimMs']:5.1f} ms  cents {n['cents']:+5.1f}")
