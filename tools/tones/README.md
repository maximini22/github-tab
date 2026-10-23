# Building the Sound sprites

`app/tones/<tone>.mp3` + `<tone>.json` are built from the original sample banks (sources and licences: `NOTICE`).
The banks are not in this repo. Put them under `$WORK/sf/` (default `tools/tones/work/sf/`):

| Tone | Bank | Where |
|---|---|---|
| nylon | `FluidR3_GM.sf2`, preset 0:24 | Debian `fluid-soundfont-gm` (MIT) |
| spanish | `SpanishClassicalGuitar-SF2-20190618/…sf2` | freepats.zenvoid.org (CC0) |
| clean | `EGuitarFSBS-clean bridge small SF2-20260807/…sf2` | freepats.zenvoid.org (CC0) |
| upright | `bass/dsmolken.double-bass/` (`d_smolken_rubner_bass_pizz.sfz`) | github.com/sfzinstruments/dsmolken.double-bass (CC0) |
| ebass | `bass/karoryfer.swagbass/` (`swagbass_clean.sfz`) | github.com/sfzinstruments/karoryfer.swagbass (CC0) |

```
npm install                        # spessasynth_core; python3 needs numpy, scipy, soundfile; ffmpeg with libmp3lame
./singles.sh                       # one-shots -> $WORK/v9/<tone>/ship/n<key>.wav
for t in nylon spanish clean upright ebass; do python3 sprite.py $t; done   # nylon first (the others match its level)
cp work/v9/*/*.mp3 work/v9/*/*.json ../../app/tones/
```

Guitars: 17 notes every 3 semitones from E2; basses: 10 notes every 3 semitones from E1. The app picks the nearest
sample and repitches it with `playbackRate`; `cents` in the JSON corrects each sample's measured tuning.

**Onset fix.** spessasynth's sequencer skips to the first noteOn by default, which threw every render window 0.5 s
off. `singles.mjs` sets `seq.skipToFirstNoteOn = false`, and `sprite.py` trims each note so its 5 %-of-peak crossing
sits 2 ms in. `tests/v9.mjs` measures it in the app: every decoded sample starts within 3 ms, and rendered notes sound
within 2 ms of the metronome click scheduled the same way (both sit 6 ms after the scheduled time, the output
compressor's fixed lookahead).
