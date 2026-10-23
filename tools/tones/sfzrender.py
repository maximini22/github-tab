#!/usr/bin/env python3
"""Minimal SFZ one-voice renderer for the bass shootout (spessasynth can't read SFZ).
Usage: sfzrender.py <file.sfz> <base_dir_for_samples> <score.json|--singles> <out.wav|outdir> [maxkey_note_filter]
Implements: <control>/<global>/<master>/<group>/<region> inheritance, #include, sample, lokey/hikey/key,
lovel/hivel, lorand/hirand (seeded), seq_length/seq_position, pitch_keycenter, tune, transpose, volume,
amplitude, amp_velcurve_N, ampeg_attack/ampeg_release, group/off_by (fast 10 ms choke), trigger (only attack).
Playback = linear-interpolated resampling (what a browser AudioBufferSourceNode.playbackRate does). No effects.
Notes outside every region fall back to the nearest region and are repitched (reported on stderr)."""
import sys, os, re, json, random, numpy as np, soundfile as sf
SR = 44100
def parse(path, base_dir):
    txt = open(path, encoding='utf-8', errors='replace').read()
    def inc(t, d):
        return re.sub(r'#include\s+"([^"]+)"', lambda m: inc(open(os.path.join(d, m.group(1).replace('\\', '/'))).read(), d), t)
    txt = inc(txt, os.path.dirname(path))
    txt = re.sub(r'//[^\n]*', '', txt)
    toks = re.findall(r'<(\w+)>|([\w]+)=([^\n<]*?)(?=\s+[\w]+=|\s*<|\s*$)', txt, flags=re.M)
    levels = {'control': {}, 'global': {}, 'master': {}, 'group': {}}; cur = None; regions = []
    order = ['control', 'global', 'master', 'group']
    for hdr, k, v in toks:
        if hdr:
            if cur is not None and cur.get('_isregion'): regions.append(cur)
            if hdr == 'region':
                cur = {'_isregion': True}
                for lv in order: cur.update(levels[lv])
            else:
                if hdr in levels:
                    i = order.index(hdr)
                    for lv in order[i:]: levels[lv] = {}
                    cur = levels[hdr]
                else: cur = {}
        elif cur is not None: cur[k] = v.strip()
    if cur is not None and cur.get('_isregion'): regions.append(cur)
    out = []
    for r in regions:
        if 'sample' not in r or r.get('trigger', 'attack') != 'attack': continue
        if any(x in r for x in ('locc105',)) : continue
        g = lambda k, d: r.get(k, d)
        lo = int(g('lokey', g('key', 0))); hi = int(g('hikey', g('key', 127)))
        kc = int(g('pitch_keycenter', g('key', lo)))
        vc = [(int(k[13:]), float(v)) for k, v in r.items() if k.startswith('amp_velcurve_')]
        out.append(dict(file=os.path.join(base_dir, r.get('default_path', '').replace('\\', '/'), r['sample'].replace('\\', '/')),
            lo=lo, hi=hi, kc=kc, lovel=int(g('lovel', 0)), hivel=int(g('hivel', 127)), lorand=float(g('lorand', 0)), hirand=float(g('hirand', 1)),
            seqlen=int(g('seq_length', 1)), seqpos=int(g('seq_position', 1)), tune=float(g('tune', 0)) + 100 * float(g('transpose', 0)),
            vol=float(g('volume', 0)), amp=float(g('amplitude', 100)) / 100, vc=sorted(vc), att=float(g('ampeg_attack', 0)), rel=float(g('ampeg_release', 0.001)),
            group=g('group', None), off_by=g('off_by', None)))
    return out
_cache = {}
def load(f):
    if f not in _cache:
        d, sr = sf.read(f, dtype='float32', always_2d=True)
        _cache[f] = (d.mean(axis=1) if d.shape[1] > 1 else d[:, 0], sr) if MONO else (d, sr)
    return _cache[f]
MONO = False
def velgain(r, v):
    if not r['vc']: return (v / 127) ** 2
    pts = [(0, 0.0)] + r['vc'] + ([(127, 1.0)] if r['vc'][-1][0] < 127 else [])
    xs, ys = zip(*pts); return float(np.interp(v, xs, ys))
class Sampler:
    def __init__(s, regions, rng_seed=1):
        s.R = regions; s.rng = random.Random(rng_seed); s.seq = {}
    def pick(s, key, vel):
        c = [r for r in s.R if r['lo'] <= key <= r['hi'] and r['lovel'] <= vel <= r['hivel']]
        if not c:
            ks = [r for r in s.R if r['lovel'] <= vel <= r['hivel']] or s.R
            near = min(ks, key=lambda r: min(abs(key - r['lo']), abs(key - r['hi'])))
            c = [r for r in ks if r['lo'] == near['lo'] and r['hi'] == near['hi']]
            print(f'  key {key}: no region, repitched from {near["kc"]} ({near["file"].split("/")[-1]})', file=sys.stderr)
        sk = (c[0]['lo'], c[0]['hi'], c[0]['lovel'])
        n = s.seq.get(sk, 0); s.seq[sk] = n + 1
        rnd = s.rng.random()
        c2 = [r for r in c if (n % r['seqlen']) + 1 == r['seqpos'] and r['lorand'] <= rnd < r['hirand']] or [r for r in c if (n % r['seqlen']) + 1 == r['seqpos']] or c
        return c2  # all layered regions that match (usually 1)
def voice(r, key, vel, dur_s):
    d, sr = load(r['file'])
    if d.ndim == 1: d = d[:, None]
    ratio = 2 ** (((key - r['kc']) * 100 + r['tune']) / 1200) * sr / SR
    nout = int((len(d) - 1) / ratio)
    t = np.arange(nout) * ratio; i = t.astype(np.int64); f = (t - i)[:, None]
    y = d[i] * (1 - f) + d[np.minimum(i + 1, len(d) - 1)] * f
    g = velgain(r, vel) * 10 ** (r['vol'] / 20) * r['amp']
    env = np.ones(nout, np.float32)
    if r['att'] > 0: a = int(r['att'] * SR); env[:a] = np.linspace(0, 1, min(a, nout))[:min(a, nout)]
    off = int(dur_s * SR)
    if off < nout:
        rl = max(int(r['rel'] * SR), 1); n = nout - off
        env[off:] *= np.exp(np.log(0.001) * np.arange(n) / rl).astype(np.float32)  # -60 dB over ampeg_release
    return (y * (env * g)[:, None]).astype(np.float32)
def render_events(regions, events, total_s, bpm, lead_beats):
    S = Sampler(regions); spb = 60 / bpm
    out = np.zeros((int(total_s * SR) + SR, 2), np.float32); active = []  # (group, start, end_idx, ...)
    for e in events:
        st = int((e['beat'] + lead_beats) * spb * SR)
        for r in S.pick(e['midi'], e['vel']):
            if r['off_by']:  # choke earlier voices in the off_by group (off_mode=fast)
                for v in active:
                    if v['group'] == r['off_by'] and v['end'] > st:
                        fl = int(0.01 * SR); seg = out[st:st + fl]; ramp = 1 - np.linspace(0, 1, len(seg))[:, None]
                        tail = v['y'][st - v['st']: st - v['st'] + len(seg)]
                        if len(tail): out[st:st + len(tail)] -= tail * (1 - ramp[:len(tail)])
                        rest = v['y'][st - v['st'] + fl:]; out[st + fl: st + fl + len(rest)] -= rest[: max(0, len(out) - st - fl)]
                        v['end'] = st
            y = voice(r, e['midi'], e['vel'], e['dur'] * spb)
            if y.shape[1] == 1: y = np.repeat(y, 2, axis=1)
            y = y[: len(out) - st]; out[st: st + len(y)] += y
            active.append(dict(group=r['group'], st=st, end=st + len(y), y=y))
    return out[: int(total_s * SR)]
if __name__ == '__main__':
    sfz, base, score, outp = sys.argv[1:5]
    regs = parse(sfz, base)
    maxk = int(sys.argv[5]) if len(sys.argv) > 5 else 127
    regs = [r for r in regs if r['lo'] <= maxk]   # drop noise/fx regions mapped above the playable range
    print(f'{sfz}: {len(regs)} note regions, keys {min(r["lo"] for r in regs)}-{max(r["hi"] for r in regs)}', file=sys.stderr)
    if score == '--singles':   # like singles-bass.mjs: KEYS (csv), HOLD s, LEN s, vel 96, mono, last 0.3 s faded
        keys = [int(k) for k in os.environ.get('KEYS', '28,31,34,37,40,43,46,49,52,55').split(',')]
        hold, ln = float(os.environ.get('HOLD', 1.7)), float(os.environ.get('LEN', 2.0))
        os.makedirs(outp, exist_ok=True); S = Sampler(regs); N = int(ln * SR); fl = int(0.3 * SR)
        for k in keys:
            y = sum(voice(r, k, 96, hold).mean(axis=1)[:N] for r in S.pick(k, 96)); y = np.pad(y, (0, max(0, N - len(y))))[:N]
            y[-fl:] *= np.linspace(1, 0, fl); sf.write(f'{outp}/n{k}.wav', y, SR, subtype='FLOAT')
        print(outp, ','.join(map(str, keys)))
    else:
        sc = json.load(open(score)); spb = 60 / sc['BPM']
        end_beat = max(e['beat'] + e['dur'] for e in sc['events'])
        total = (sc['leadInBeats'] + end_beat + sc['tailBeats']) * spb + sc['tailSec']
        y = render_events(regs, sc['events'], total, sc['BPM'], sc['leadInBeats'])
        sf.write(outp, y, SR, subtype='FLOAT'); print(outp, f'{total:.1f}s peak {np.abs(y).max():.3f}')
