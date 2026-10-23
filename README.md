# Guitar Tab

Catch a guitar idea as tab on your phone before it's gone. It's free, you don't need an account, and nothing goes online. From Jeremy Legal Records.

- **Open it:** https://jeremylegalrecords.com/guitar-tab/ (app: https://jeremylegalrecords.com/guitar-tab/app/)
- **Old address:** https://maximini22.github.io/github-tab/ still works, but saved work doesn't carry over. See [Moving](#saving-and-loading).
- **Full guide:** [docs/USER-GUIDE.md](docs/USER-GUIDE.md)

## Features

- Up to **3 tracks** on one grid. The armed track is drawn in full and the others show faint and colour-coded.
- **Layered playback** with mute, solo and volume per track.
- **Six tunings** per track, and frets 0–22.
- A DAW-style transport, a bar|beat ruler, a loop brace, and 100 undo steps.
- Fits a phone screen with no page scroll. Only the tab grid scrolls sideways.
- Auto-save, plus Export and Import as `.json`.
- **MIDI export (.mid):** all tracks in one Type 1 file (one lane per track), or one track on its own.
- **Step editor:** the fret picker has Back/Next step, bar jumps, a yellow highlight on the selected string and a mini tab roll of the bar.

## Quick start

1. Open the app and tap **Got it** on the hint.
2. Tap a cell in a string lane, then tap a fret (0–22) or **x Muted**. Use **‹ Back step / Next step ›** and **« Bar / Bar »** to step through bars, then tap **Done**.
3. Press **Play** (or Space). Set **BPM** with − and +: tap for ±1, or hold to run faster.
4. Add a part with **+ Track**, then tap its name to arm it and write on it.
5. Drag across bar numbers in the ruler to loop a section.
6. **☰ → Export project (.json)** to keep a backup, or **Export MIDI (.mid)** for a DAW.

## Tracks and mixer

- Up to 3 tracks per project, colour-coded teal, amber and violet. Each one has its own name and tuning.
- **M** mutes a track. **S** solos it: once any track is soloed, only soloed tracks play. Mute wins over solo.
- **Volume** goes from 0 to 100 (default 80). Changes apply live, even during playback.
- Rename, retune or delete the armed track from **☰ → Armed track**.

## Grid, BPM and tunings

- **Grid** is the note value of one step: 1/1, 1/2, 1/4, 1/8, 1/16, 1/32 or 1/64. Next to it, the **· | 3** switch makes the step **Dotted** (1.5×) or a **Triplet** (3 in the time of 2). Tap one to turn it on and the other off. Tap the lit one again to go back to plain. So 1/8 + Triplet = 160 ticks a step, and 1/16 + Dotted = 180. Changing either never moves or deletes notes.
- **Note length** is automatic: a note lasts until the track's next note, up to one bar. The `len` row shows W, H, Q, E, S, T (32nd) or X (64th), with `.` for dotted and `³` for triplets. Underneath, notes of an eighth or shorter get 1–4 beams (a flag when alone) grouped by beat. Triplets are marked **3**, with a bracket over quarter, half and whole triplets.
- **BPM** is per project, 30–300 (default 90). Tap − or + for exactly 1 BPM. Hold it to repeat: after 0.4 s it steps every 250 ms, speeding up to every 36 ms by about 1.5 s, so 90 → 150 takes about 3.3 s. The whole hold is one undo step. **Time signature** is set in the menu: 4/4, 3/4, 2/4 or 6/8.
- **Tunings:** C standard, Drop C, D standard, Drop D, E standard and Open G. Other tunings from imported files are kept as Custom (imported).

## Timeline and transport

- **Ruler:**
  - The top lane shows bar numbers. Drag across it to set the loop brace, or drag either end to resize it.
  - The bottom lane shows beats. Tap or drag it to move the green playhead, even while playing.
- **Play/Pause** starts from the playhead, or from the loop start when the playhead is outside the loop.
- **Back to start** jumps to the loop start, or to bar 1 when the loop is off.
- **Stop** keeps the position. Press it again to go back to the start.
- **Loop** turns the loop brace on and off.
- **Keyboard:**

| Key | Action |
|---|---|
| Space | Play / pause |
| Home | Back to start |
| L | Loop on/off |
| ← → / ↑ ↓ | Move one step / move between strings |
| Enter | Open the fret picker (type 0–22, x, or Backspace) |
| [ / ] | Coarser / finer grid value |
| . / T | Dotted / Triplet on or off |
| Ctrl/⌘+Z, Shift+Ctrl/⌘+Z or Ctrl+Y | Undo / redo |
| Esc | Close the picker or menu |

## Saving and loading

- **Auto-save:** work saves automatically in this browser, for this site address only. Clearing site data deletes it.
- **☰ → Export project (.json)** saves the current project. **Export all** saves the whole library. Export is your real backup.
- **☰ → Import (.json)** offers two choices:
  - **Merge** adds the file's projects and skips identical copies.
  - **Replace** swaps your whole library for the file, after a confirm.
- **Moving between devices or addresses** (for example from maximini22.github.io/github-tab to jeremylegalrecords.com/guitar-tab): Export all on the old one, then Import with Merge on the new one.
- Older files (schemaVersion 1–3) open fine.
- **☰ → Export MIDI (.mid):** see [MIDI export](#midi-export).

## Tests

`roundtrip.mjs` builds a project through the real UI in headless Chrome. It exports, clears, re-imports, deep-compares and plays it, checks the step editor, and downloads and parses both MIDI exports. `midi.mjs` parse-tests the MIDI encoder in Node.

```sh
cd tests && npm install && node midi.mjs && CHROME_PATH=/usr/bin/google-chrome node roundtrip.mjs
```

Add `BASE=https://jeremylegalrecords.com/guitar-tab/` to test the live site.

## MIDI export

- **☰ → Export MIDI (.mid)** offers **All tracks**, saved as `<project>.mid`, or one track, saved as `<project> - <track>.mid`.
- It's a Type 1 file at PPQ 480, the same ticks as the JSON. Track 0 holds the tempo, time signature and loop markers. Each guitar track is its own named track on its own channel (1–3), with Program 25 and CC7 = volume.
- **All tracks includes muted or unsoloed tracks.** They're labelled `(muted)` / `(not soloed)` and keep their volume.
- Pitch = open string + fret. Each note carries a `s3f7`-style text event, so the string and fret can be rebuilt.
- Muted notes are short at velocity 30. Hammer-on and pull-off are legato. Bends, slides and vibrato are not exported yet.
- Details: [guide](docs/USER-GUIDE.md#midi-export).

## Roadmap

All of these are planned, with no promised dates:

- **MIDI: one channel per string** mode, bends/slides/vibrato as pitch bend, guitar sound choices
- **Hammer-on, pull-off, slide, bend and vibrato** in the editor (files already accept them)
- **Let-ring / sustain**, plus palm-mute, harmonics and tapping
- **Sliding-strip tuner mode**
- **Koala export**

## Publishing (maintainers)

This repo is the source. The live copy is the `guitar-tab/` folder of the site repo, maximini22/jeremylegalrecords.com, served by GitHub Pages like `/royalty-dashboard/`.

```sh
scripts/publish-to-jlr.sh ../jlr-site   # writes guitar-tab/ only; review, then commit and push the site repo
```

The script removes the old-address banner, swaps the app's moving note, and renames the offline cache to `jlr-guitar-tab-*`. It skips `robots.txt`, the root `sw.js`, `docs/` and `tests/`.

## Licence

MIT. See [LICENSE](LICENSE).
