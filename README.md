# Guitar Tab

Catch a guitar idea as tab on your phone before it's gone. It's free, you don't need an account, and nothing goes online. From Jeremy Legal Records.

- **Open it:** https://jeremylegalrecords.com/guitar-tab/ (app: https://jeremylegalrecords.com/guitar-tab/app/)
- **Old address:** https://maximini22.github.io/github-tab/ still works, but saved work doesn't carry over. See [Moving](#saving-and-loading).
- **Full guide:** [docs/USER-GUIDE.md](docs/USER-GUIDE.md)

## Features

- Up to **3 tracks** on one grid. The armed track is drawn in full and the others show faint and colour-coded.
- **Layered playback** with mute, solo and volume per track.
- **Six tunings** per track.
- A DAW-style transport, a bar|beat ruler, a loop brace, and 100 undo steps.
- Fits a phone screen with no page scroll. Only the tab grid scrolls sideways.
- Auto-save, plus Export and Import as `.json`.

## Quick start

1. Open the app and tap **Got it** on the hint.
2. Tap a cell in a string lane, tap a fret (0–16) or **x Muted**, then **Done**. **Next step ›** lets you enter a run quickly.
3. Press **Play** (or Space). Set **BPM** with − and +.
4. Add a part with **+ Track**, then tap its name to arm it and write on it.
5. Drag across bar numbers in the ruler to loop a section.
6. **☰ → Export project (.json)** to keep a backup.

## Tracks and mixer

- Up to 3 tracks per project, colour-coded teal, amber and violet. Each one has its own name and tuning.
- **M** mutes a track. **S** solos it: once any track is soloed, only soloed tracks play. Mute wins over solo.
- **Volume** goes from 0 to 100 (default 80). Changes apply live, even during playback.
- Rename, retune or delete the armed track from **☰ → Armed track**.

## Grid, BPM and tunings

- **Grid** is the note value of one step: 1/1, 1/2, 1/4, 1/8 or 1/16. Changing it never moves or deletes notes.
- **Note length** is automatic: a note lasts until the track's next note, up to one bar. The `len` row shows W, H, Q, E or S.
- **BPM** is per project, 30–300 (default 90). **Time signature** is set in the menu: 4/4, 3/4, 2/4 or 6/8.
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
| Enter | Open the fret picker (type 0–16, x, or Backspace) |
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

## JSON round-trip test

This builds a project through the real UI in headless Chrome, then exports, clears, re-imports, deep-compares and plays it:

```sh
cd tests && npm install && CHROME_PATH=/usr/bin/google-chrome node roundtrip.mjs
```

Add `BASE=https://jeremylegalrecords.com/guitar-tab/` to test the live site.

## MIDI (planned, not built yet)

- A Type 1 Standard MIDI File at PPQ 480, the same ticks as the JSON. Track 0 carries tempo, time signature and loop markers. Then there's one MIDI track per guitar track, with its name, channel and CC7 volume.
- Pitch = open string + fret. The JSON keeps string and fret, so it stays the source of truth.
- An optional **one channel per string** mode, plus text events such as `s3f7`, so tab software can rebuild exact positions.
- Muted notes export as short low-velocity notes, or can be skipped. A mute/solo option exports either "as heard" or all tracks.

## Roadmap

All of these are planned, with no promised dates:

- **MIDI export** (Type 1, with an option for one channel per string)
- **Hammer-on, pull-off, slide, bend and vibrato** in the editor (files already accept them)
- **Let-ring / sustain**, plus palm-mute, harmonics and tapping
- **Sliding-strip tuner mode**
- **Koala export**
- More from the [MIDI export plan](docs/USER-GUIDE.md#midi-export-plan), such as guitar sound choices for export

## Publishing (maintainers)

This repo is the source. The live copy is the `guitar-tab/` folder of the site repo, maximini22/jeremylegalrecords.com, served by GitHub Pages like `/royalty-dashboard/`.

```sh
scripts/publish-to-jlr.sh ../jlr-site   # writes guitar-tab/ only; review, then commit and push the site repo
```

The script removes the old-address banner, swaps the app's moving note, and renames the offline cache to `jlr-guitar-tab-*`. It skips `robots.txt`, the root `sw.js`, `docs/` and `tests/`.

## Licence

MIT. See [LICENSE](LICENSE).
