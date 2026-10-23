# Guitar Tab

Catch a guitar idea as tab on your phone before it's gone. It's free, you don't need an account, and nothing goes online. From Jeremy Legal Records.

- **Open it:** https://jeremylegalrecords.com/guitar-tab/ (app: https://jeremylegalrecords.com/guitar-tab/app/)
- **Old address:** https://maximini22.github.io/github-tab/ still works, but saved work doesn't carry over. See [Moving](#saving-and-loading).
- **Full guide:** [docs/USER-GUIDE.md](docs/USER-GUIDE.md)

## Features

- Up to **3 tracks** on one grid. The armed track is drawn in full and the others show faint and colour-coded.
- **Layered playback** with mute, solo and volume per track.
- **Six tunings** per track, and frets 0–22.
- A DAW-style transport with a metronome click, a bar|beat ruler, a loop brace, and 100 undo steps.
- Fits a phone screen with no page scroll. Only the tab grid scrolls sideways.
- Auto-save, plus Export and Import as `.json`.
- **MIDI export (.mid):** all tracks in one Type 1 file (one lane per track), or one track on its own.
- **Step editor:** the fret picker has Back/Next step, bar jumps, a yellow highlight on the selected string and a mini tab roll of the bar.
- **Per-track feel:** each track has its own note style (plain, Dotted or Triplet), so a straight rhythm part and a triplet lead can share one project.
- **Chord library:** 30 chord boxes: open chords, all 12 power chords (244, 577, x355…) and movable barre chords you slide up the neck with a fret stepper. Preview one on the neck and in the bar, then **Drop into measure** as a strum or an arpeggio. One Undo takes it back.
- **Share project** sends the project to another app, or falls back to copying the tab as text or saving the file.

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

- **Grid** is the note value of one step, for the whole project: 1/1, 1/2, 1/4, 1/8, 1/16, 1/32 or 1/64. Next to it, the **· | 3** switch makes the step **Dotted** (1.5×) or a **Triplet** (3 in the time of 2) **for the armed track only**. The small number in front of the switch shows which track it applies to, and a track with a style shows **·** or **3** by its name. Tap one to turn it on and the other off. Tap the lit one again to go back to plain. So 1/8 + Triplet = 160 ticks a step, and 1/16 + Dotted = 180. BPM, time signature and the grid value stay project-wide. Changing any of them never moves or deletes notes.
- **Note length** is automatic: a note lasts until the track's next note, up to one bar. The `len` row shows W, H, Q, E, S, T (32nd) or X (64th), with `.` for dotted and `³` for triplets. Underneath, notes of an eighth or shorter get 1–4 beams (a flag when alone) grouped by beat. Triplets are marked **3**, with a bracket over quarter, half and whole triplets.
- **BPM** is per project, 30–300 (default 90). Tap − or + for exactly 1 BPM. Hold it to repeat: after 0.4 s it steps every 250 ms, speeding up to every 36 ms by about 1.5 s, so 90 → 150 takes about 3.3 s. The whole hold is one undo step. **Time signature** is set in the menu: 4/4, 3/4, 2/4 or 6/8.
- **Tunings:** C standard, Drop C, D standard, Drop D, E standard and Open G. Other tunings from imported files are kept as Custom (imported).

## Chord library

- In the step editor (tap a cell), tap **Chords**. Search by name (`Em`, `F#5`, `A5`, `power`, `sus`), by fret code (`244`, `577`, `x355`), or filter with the **Open / Power / Barre / Other** chips.
- Tap a chord to preview it: it's drawn on the neck and stacked in the bar's mini roll at the cursor step, and you hear it.
- Choose **Strum ↓** (all notes on one step) or **Arp** (one note per grid step, low string first), then **Drop into measure**. Notes already on those strings at that step are replaced, muted (x) strings are left alone, and an arpeggio that runs past the end adds a bar. It's one undo step, and the toast has an **Undo** button.
- **Boxes and fret codes read like a chord chart: low E on the left, low → high** (Em = `022000`, A = `x02220`, F#5 = `244`), with the strings labelled under each box. Since v8.2 the big neck in the detail view reads the same way (E A D G B e left to right, or the tuning's letters, e.g. D A D G B e), and no finger numbers are drawn anywhere: dots are plain, with barre bars, × / o and the starting fret kept.
- **Power chords are movable:** 12 cards, one per root (6th-string shape up to fret 7: E5 `022` … F#5 `244` … A5 `577` … B5 `799`; then the 5th-string shape: C5 `x355` … D#5 `x688`). In the detail view, **6th / 5th** picks the root string, **‹ fret ›** slides the shape (the name follows the root; top fret 22), and **1·5·8 / 1·5** picks 3 notes or 2. In Drop D / Drop C the 6th-string shape is the one-finger barre (E5 = `222`).
- **Barre chords are movable too:** F, Bm, B and F#m have the same ‹ fret › stepper and an **E shape / A shape** toggle (F → fret 3 = G `355433`).
- Names of the open shapes follow the armed track's tuning: in D standard the Em shape is labelled Dm (Em shape); on an uneven tuning like Drop D it's just "Em shape". Movable shapes are always named from their real root.

## Timeline and transport

- **Ruler:**
  - The top lane shows bar numbers. Drag across it to set the loop brace, or drag either end to resize it.
  - The bottom lane shows beats. Tap or drag it to move the green playhead, even while playing.
- **Play/Pause** starts from the playhead, or from the loop start when the playhead is outside the loop.
- **Back to start** jumps to the loop start, or to bar 1 when the loop is off.
- **Stop** keeps the position. Press it again to go back to the start.
- **Loop** turns the loop brace on and off.
- **Metronome** (the metronome icon, key M) turns a soft, woody MPC-style click on or off. It's on/off only: its level is fixed at half a fresh track's default volume and ignores the track sliders. It clicks on every beat of the time signature (accent on beat 1), on the same scheduler as the notes, so it stays in time through loops, BPM changes and Back to start. Pressing Play from stopped with the click on gives a 1-bar count-in. The on/off is saved with the project (`"metronome": true` in the JSON; older files open with it off) and is not part of the MIDI export.
- **Keyboard:**

| Key | Action |
|---|---|
| Space | Play / pause |
| Home | Back to start |
| L | Loop on/off |
| ← → / ↑ ↓ | Move one step / move between strings |
| Enter | Open the fret picker (type 0–22, x, or Backspace) |
| [ / ] | Coarser / finer grid value |
| . / T | Dotted / Triplet on or off (armed track) |
| Ctrl/⌘+Z, Shift+Ctrl/⌘+Z or Ctrl+Y | Undo / redo |
| Esc | Close the chord library, picker or menu |

## Saving and loading

- **Auto-save:** work saves automatically in this browser, for this site address only. Clearing site data deletes it.
- **☰ → Export project (.json)** saves the current project. **Export all** saves the whole library. Export is your real backup.
- **☰ → Share project** hands the project to another app (as `<name>.json.txt`, which Android accepts; Import reads it back). If the browser can't share files it shares the tab as text, then copies it, then saves the file.
- **☰ → Import (.json)** offers two choices:
  - **Merge** adds the file's projects and skips identical copies.
  - **Replace** swaps your whole library for the file, after a confirm.
- **Moving between devices or addresses** (for example from maximini22.github.io/github-tab to jeremylegalrecords.com/guitar-tab): Export all on the old one, then Import with Merge on the new one.
- Older files (schemaVersion 1–4) open fine: an older project's note style is given to every track. A file from a newer version is refused with a message to reload the app.
- **☰ → Export MIDI (.mid):** see [MIDI export](#midi-export).

## Tests

`roundtrip.mjs` builds a project through the real UI in headless Chrome. It exports, clears, re-imports, deep-compares and plays it, checks the step editor, and downloads and parses both MIDI exports. `v8.mjs` checks the Share fallbacks, per-track feel, the chord library (including v8.1's movable power and barre chords, the fret stepper, chart-order codes and Drop D power chords; v8.2's low-E-left detail neck and no finger numbers), the metronome (beat ticks in 4/4, 3/4 and 6/8, the beat-1 accent, the count-in, the fixed 0.5× default-track level, sync through loops, BPM changes and Back to start, the JSON round trip and MIDI), and that nothing scrolls at 390×844, 390×650 and 360×640. `midi.mjs` parse-tests the MIDI encoder and the chord data in Node.

```sh
cd tests && npm install && CHROME_PATH=/usr/bin/google-chrome npm test   # midi.mjs, roundtrip.mjs, v8.mjs
```

Add `BASE=https://jeremylegalrecords.com/guitar-tab/` to test the live site. `node loadbench.mjs` measures a cold first load (bytes, requests, DOMContentLoaded and load), and `node bench.mjs` times redraws and edits. To go back to v7, see [docs/ROLLBACK.md](docs/ROLLBACK.md).

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
- **More chords** (more 7ths, add9, movable 7th/sus shapes, custom shapes) and a chord-name row above the tab
- **Koala export**

## Publishing (maintainers)

This repo is the source. The live copy is the `guitar-tab/` folder of the site repo, maximini22/jeremylegalrecords.com, served by GitHub Pages like `/royalty-dashboard/`.

```sh
scripts/publish-to-jlr.sh ../jlr-site   # writes guitar-tab/ only; review, then commit and push the site repo
```

The script removes the old-address banner, swaps the app's moving note, and renames the offline cache to `jlr-guitar-tab-*`. It skips `robots.txt`, the root `sw.js`, `docs/` and `tests/`.

## Licence

MIT. See [LICENSE](LICENSE).
