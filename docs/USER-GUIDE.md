# Guitar Tab: user guide

Guitar Tab is a quick way to get a guitar idea down as tab on your phone before it's gone. It runs in the browser. There's no account and no subscription, and nothing is sent anywhere: your work stays in this browser until you export it.

- Open the app: https://jeremylegalrecords.com/guitar-tab/app/
- About page: https://jeremylegalrecords.com/guitar-tab/
- The old address, https://maximini22.github.io/github-tab/app/, still works. Saved work doesn't carry over between web addresses, so **Export** your projects at the old address and **Import** them at the new one.

Contents: [The screen](#the-screen) · [Writing notes](#writing-notes) · [The step editor](#the-step-editor) · [Tracks (up to 3)](#tracks-up-to-3) · [Mixer: volume, mute, solo](#mixer-volume-mute-solo) · [Transport, ruler and loop](#transport-ruler-and-loop) · [BPM, time signature and grid](#bpm-time-signature-and-grid) · [Tunings](#tunings) · [Undo and redo](#undo-and-redo) · [Idea notes](#idea-notes) · [The menu](#the-menu) · [Saving, export and import](#saving-export-and-import) · [Checking a round trip by hand](#checking-a-round-trip-by-hand) · [Automated test](#automated-test) · [If you know a DAW](#if-you-know-a-daw) · [Keyboard](#keyboard) · [File format](#file-format-schemaversion-4) · [MIDI export](#midi-export)

---

## The screen

The editor is built to fit a phone screen with no page scrolling. It has been checked at 390×844, 360×740 and 412×915. Only the tab grid scrolls, sideways, inside its own box. From top to bottom:

| Area | What it holds |
|---|---|
| Header | JLR · Guitar Tab (links to the about page), the save status, and **☰** to open the menu |
| Transport | **Back to start**, **Play/Pause**, **Stop**, **Loop**, and **BPM** with − and + |
| Toolbar | **Grid** (note value), **‹ ›** to move one grid step, the cursor position as `bar|beat|16th`, **Undo** and **Redo** |
| Track strip | One row per track: colour, name, tuning, **M**, **S** and a volume slider. Tap the name to arm that track for editing. **+ Track (n/3)** appears while there's room. |
| Ruler | Top lane: bar numbers and the loop brace. Bottom lane: beat counts (1 & 2 & …). The green playhead line runs through the ruler and the grid. |
| Tab grid | Six string lanes, high e at the top and low string at the bottom, the way you see them when you play. A `len` row underneath shows note values. |
| Idea notes | A text field pinned to the bottom. See [Idea notes](#idea-notes). |

On first use, a three-line hint explains tapping, arming and looping. **Got it** hides it for good, in this browser.

## Writing notes

- **Tap a cell** in a lane, and a vertical fretboard opens for that string and step. Tap a fret (0–16) to place it. **x Muted** places a muted (dead) note, and **Clear** removes the note.
- **Tap a placed note's fret again** (open and Muted included) to remove it. Tapping a different fret replaces it.
- **Next step ›** and **‹ Back step** move one grid step with the picker still open, so you can pencil in a whole bar without closing it. **Done** closes the picker. See [The step editor](#the-step-editor).
- **The edit cursor** is the teal outline. It shows where the next note goes. Arrows **‹ ›** move it one grid step. While stopped, the playhead follows the cursor, so Play starts where you're working.
- **Note length** is automatic. A note lasts until the next note on the same track starts, capped at one bar. The `len` row shows the resulting value (W, H, Q, E, S).
- Each string can hold one note per moment on a track. Chords are simply notes on several strings in the same step.
- Placing a note plays it once so you can hear it.

## The step editor

The fret picker doubles as a screen you can stay on and step through whole bars:

- **Left:** the vertical neck, open string (0) at the top down to fret 16, inlays at 3, 5, 7, 9 and a double dot at 12.
- **Right, top:** the six string buttons, high at the top and low at the bottom. The string you're on is **yellow**.
- **Right, under x Muted / Clear:**
  - **‹ Back step** and **Next step ›** move one grid step (the Grid setting decides how far).
  - **« Bar** goes to the start of this bar, or to the bar before if you're already at its start.
  - **Bar »** goes to the start of the next bar.
  - Next step and Bar » add a bar when you go past the end of the song (one undo step).
- **Mini tab roll (top of the sheet):** the current bar on all six strings, laid out like the main grid. The armed track's frets show in full, and the other tracks show faint in their colours, so you can see what else is going on. The current step is the lit column, and your string's row is yellow. Tap any cell in the roll to jump there (step and string).
- **↶ / ↷** in the sheet's header are Undo and Redo, so you can fix a slip without closing it.
- While stopped, the playhead follows every move, so Play starts where you're working.
- The neck shrinks to fit the screen, so the whole sheet shows without scrolling, even on a short phone screen with the browser's bars showing. It has been checked at 390×844, 390×650 and 360×640.

## Tracks (up to 3)

A project holds **up to 3 tracks**, for example rhythm, lead and a bass line played on guitar. All tracks sit on **one shared grid**:

- The **armed** track (highlighted row, tap its name to arm it) is drawn in full, and that's the track you edit.
- The other tracks show **faint and colour-coded** in the same lanes: teal for track 1, amber for track 2 and violet for track 3. When the armed track and another track both have a note in the same cell, a small coloured dot marks the other track's note.
- **+ Track (n/3)** adds a track. It disappears once a project has 3 tracks.
- Rename the armed track, change its tuning or delete it from the menu (**Armed track**).
- Each track keeps **its own tuning**. Tempo, time signature, loop and grid belong to the whole project.

## Mixer: volume, mute, solo

Every track row has:

- **Volume** (0–100, default 80), the slider.
- **M** (mute): the track is silent.
- **S** (solo): if *any* track is soloed, only soloed tracks play.
- **Mute wins:** a track that is both muted and soloed stays silent.

All audible tracks play **together, in sync**. Tracks that won't be heard are dimmed in the strip. Mixer changes apply straight away, even during playback. They're saved with the project and exported, but they aren't undo steps.

## Transport, ruler and loop

- **Play/Pause** plays from the playhead. When the loop is on and the playhead is outside it, play starts at the loop start. Pause keeps the position.
- **Stop** stops and keeps the position. Press **Stop** again while stopped to return to the start.
- **Back to start** jumps to the loop start, or to bar 1 when the loop is off. If you were playing, playback carries on from there.
- **The ruler** lets you tap or drag the bottom lane (beat numbers) to move the playhead, even while playing.
- **The loop brace** is set in the ruler's top lane (bar numbers). Drag across bars to set a loop range, or drag either end of the brace to change it. Setting a range switches the loop on. **Loop** in the transport toggles it on and off. In the menu, **Loop from this bar** and **Loop to this bar** set the ends at the cursor's bar.
- With the loop off, playback stops at the end of the song and the playhead returns to the start.

## BPM, time signature and grid

- **BPM** is set per project, 30–300 (default 90). Type a value, or use − and +.
- **Time signature** is set per project, in the menu: 4/4, 3/4, 2/4 or 6/8. In 6/8 the beat is a dotted quarter.
- **Grid** is the note value of one step, like a DAW's snap setting:

| Grid | Note | Ticks (PPQ 480) | Steps in a 4/4 bar |
|---|---|---|---|
| 1/1 | whole | 1920 | 1 |
| 1/2 | half | 960 | 2 |
| 1/4 | quarter | 480 | 4 |
| 1/8 | eighth | 240 | 8 |
| 1/16 | sixteenth | 120 | 16 |

Changing the grid **never moves or deletes notes**. Notes keep their exact time, and the grid only changes how fine the lanes are. A note that falls between grid lines on a coarse grid still shows in its cell. Switch to a finer grid to edit it exactly. Older files with dotted or triplet grids are opened on the nearest plain value (dotted → the same value, triplet → the next finer value), and the notes stay where they were.

## Tunings

Six tunings are available, set per track. They're listed high to low as shown in the lanes:

| Tuning | Strings (low → high) | MIDI notes, string 1 (high) → 6 (low) |
|---|---|---|
| C standard | C F Bb Eb G C | 60 55 51 46 41 36 |
| Drop C | C G C F A D | 62 57 53 48 43 36 |
| D standard | D G C F A D | 62 57 53 48 43 38 |
| Drop D | D A D G B E | 64 59 55 50 45 38 |
| E standard | E A D G B E | 64 59 55 50 45 40 |
| Open G | D G D G B D | 62 59 55 50 43 38 |

Changing a tuning keeps your fret numbers and changes the pitch. An imported track with any other tuning is kept exactly, with its notes and pitches, and shows as **Custom (imported)**. Older v3 tunings such as Eb, Open D and DADGAD are handled this way too.

## Undo and redo

Undo and redo are in the toolbar, with up to 100 steps per project. Undo covers notes, steps, bars, tracks (add, delete, rename, tuning), BPM, time signature, loop, grid and title. Mixer moves and idea notes aren't undo steps. Importing a file clears the history.

## Idea notes

The pinned field at the bottom ("Idea notes…") is a short scratchpad of up to 500 characters for the project: lyrics, a chord name, "try this faster". It saves as you type and is included in exports.

## The menu

**☰** opens a drawer holding everything that doesn't need to be on screen while you play:

- **Project:** switch project, rename it, **+ New**, **Duplicate**, **Delete**, and the time signature for the whole project.
- **Armed track:** name, tuning, **Delete this track**.
- **Edit at the cursor:**
  - **+ Insert step** and **− Delete step** shift later notes on *all* tracks by one grid step.
  - **+ Add bar** and **− Last bar** change the song length.
  - **Loop from this bar** and **Loop to this bar** set the loop ends.
  - **Clear this step (armed track)** clears notes on the armed track only.
- **Files:** **Export project (.json)**, **Export MIDI (.mid)**, **Export all (.json)**, **Import (.json)**, and **Share project** where the browser can share files.
- **Text tab:** a plain-text copy of the tab to paste anywhere, with **Copy**.

## Saving, export and import

- Everything **saves automatically in this browser**, on this device and at this web address. Clearing the browser's site data deletes it, so **export is your real backup**.
- **Moving from the old address?** Saved work doesn't carry over between web addresses (maximini22.github.io/github-tab and jeremylegalrecords.com/guitar-tab are separate to the browser). Export all at the old one, then Import at the new one.
- **Export project (.json)** saves the current project as a `.json` file. **Export all (.json)** saves the whole library. On a phone the file goes to your Downloads, and from there you can keep it in your files or cloud drive or send it to yourself. **Share project** hands the file straight to another app where the browser supports it.
- **Export MIDI (.mid)** opens a small sheet: **All tracks** (one file, one lane per track) or one row per track for a file with only that track. It's for opening your idea in a DAW or notation app. See [MIDI export](#midi-export). MIDI is export only, so keep the .json as your backup.
- **Import (.json)** checks the file first, then asks how to bring it in:
  - **Merge** keeps everything you have and adds the file's projects. An identical copy of a project you already have is skipped, and a changed copy is added as "(imported)".
  - **Replace** swaps your whole library for the file, after a confirm.
- If anything had to change on the way in, a summary lists it. For example:
  - a project with more than 3 tracks keeps its first 3
  - a tuning shows as Custom (imported)
  - a dotted or triplet grid becomes a plain value
  - tracks with mixed time signatures now share one
- To move to another device, export on one, then import with Merge on the other.
- Files from older versions (schemaVersion 1–3) open fine. A library saved by an older version in this browser is upgraded the first time v4 opens, and a one-off backup copy is kept under `jlr-guitar-tab:library-v3-backup` (or `-v2-`/`-v1-`).
- The app moved from `/github-tab/` to `/github-tab/app/`. Both are on the same web origin, so work saved by the old version is picked up automatically.

## Checking a round trip by hand

Use this when you want to be sure an export brings everything back:

1. Make a project with 3 tracks and give each track a different tuning. Add a few notes on each, including one **x Muted** note.
2. Set the BPM to something other than 90 (for example 137), and drag a loop over one bar in the ruler's top lane.
3. Mix the tracks: change the volumes, solo two tracks and mute one. Type something in Idea notes, and change the Grid.
4. Note what it looks and sounds like (press Play), then **☰ → Export project (.json)**.
5. Clear the site's data (browser settings → site settings → clear data), or open the app in another browser or device.
6. Open the app, then **☰ → Import (.json)** → choose the file → **Replace** (or Merge) → confirm.
7. Check the result: same title, BPM, time signature, loop, grid, idea notes; same tracks with their names, tunings, volumes and M/S states; same notes in the same places (switch between tracks to compare). Press Play: only the soloed, unmuted tracks should sound, at their volumes.

## Automated test

`tests/roundtrip.mjs` does all of the above in a headless Chrome and adds playback and import checks. It:

1. Builds the project through the real UI.
2. Captures the real export download.
3. Clears storage, reloads and imports with Replace.
4. **Deep-compares** the project: tracks, notes, tunings, BPM, time signature, loop, grid, mixer and idea.
5. Plays the song and checks that notes were scheduled from **every audible track**, with the right pitches and gains, and none from the muted track.
6. Checks the 3-track import limit, Custom (imported) tunings, grid migration and a real v3 export (`tests/fixtures/v3-project.json`).
7. Step editor: **‹ Back step** / **Next step ›** / bar jumps move the cursor and playhead, the selected string is yellow on the chip and in the mini roll, the roll shows the bar's notes and jumps on tap, the sheet fits 390×844 without scrolling, and Undo/Redo work inside it.
8. MIDI: opens the export sheet, downloads **All tracks** and a single track, and parses both files back (tracks, names, tempo, loop markers, every note's tick and pitch, channels, CC7, muted velocity).

`tests/midi.mjs` checks the encoder on its own in Node with an independent parser (`midi-file`, a test-only dependency). It covers both modes, 4/4, 3/4, 2/4 and 6/8, muted and hammer-on/pull-off rules and file names. `SAMPLE_DIR=… node midi.mjs` also writes `sample.mid`, `sample-all.mid` and `sample-track1.mid`.

```sh
cd tests
npm install                                   # puppeteer-core + midi-file (tests only); uses your installed Chrome
node midi.mjs                                 # MIDI encoder parse test (no browser)
CHROME_PATH=/usr/bin/google-chrome node roundtrip.mjs
# against the live site instead of a local copy:
BASE=https://jeremylegalrecords.com/guitar-tab/ node roundtrip.mjs
```

It prints one PASS/FAIL line per check and exits non-zero on any failure. `node tests/serve.mjs` serves the repo locally at `http://127.0.0.1:8080/github-tab/` if you want to click around.

## If you know a DAW

| In a DAW | In Guitar Tab |
|---|---|
| Transport: return to zero, play, stop, cycle | **Back to start**, **Play/Pause**, **Stop** (again = to start), **Loop** |
| Tempo field | **BPM** with − and + (per project) |
| Bar ruler, playhead, cycle/loop brace | Ruler: bar numbers and the loop brace on top, beats below. Drag to set the loop, tap or drag to move the playhead. |
| Track headers: record-arm/select, mute, solo, fader | Track strip: tap a name to **arm**, **M**, **S**, volume slider |
| Snap / quantize value | **Grid**: 1/1, 1/2, 1/4, 1/8, 1/16 |
| Piano roll (pitch rows × time) | Tab grid (string lanes × time). Tap to add, tap the same fret to remove. |
| Other tracks shown faint in the editor | Non-armed tracks drawn faint, colour-coded |
| Insert / delete time | **+ Insert step** / **− Delete step** (all tracks) |
| Undo history | **Undo / Redo** (100 steps) |
| Spacebar play | **Space** plays and pauses |
| Project notes / notepad | **Idea notes** field |
| Export MIDI | **☰ → Export MIDI (.mid)**: all tracks in one file, or one track. See [MIDI export](#midi-export). |
| Step-input / step-record | The [step editor](#the-step-editor): **‹ Back step**, **Next step ›**, **« Bar**, **Bar »** |

## Keyboard

When a keyboard is attached:

| Key | Action |
|---|---|
| Space | Play / pause |
| Home | Back to start |
| L | Loop on/off |
| ← → | Move one grid step |
| ↑ ↓ | Move between strings |
| Enter | Open the fret picker at the cursor |
| Ctrl/⌘+Z | Undo |
| Shift+Ctrl/⌘+Z or Ctrl+Y | Redo |
| Esc | Close the picker or menu |

With the picker open, type a fret number (0–16), **x** for muted, or Backspace/Delete to clear. ← → step back and forward, and ↑ ↓ change string, without closing it.

## File format (schemaVersion 4)

Times are in ticks at **480 per quarter note** (PPQ 480), and pitches are MIDI note numbers. That makes the format MIDI-ready. Notes sit at absolute ticks and don't depend on the grid.

```jsonc
{
  "schema": "jlr-guitar-tab",
  "schemaVersion": 4,
  "kind": "project",                 // or "library" for Export all
  "ppq": 480,
  "exportedAt": "2026-10-23T08:00:00.000Z",
  "activeProjectId": "…",
  "projects": [{
    "id": "…", "title": "Night drive riff",
    "bpm": 112,
    "grid": { "value": "eighth" },   // whole | half | quarter | eighth | sixteenth
    "timeSignature": [4, 4],
    "lengthTicks": 3840,              // whole bars
    "loop": { "enabled": true, "startMeasure": 1, "endMeasure": 2 },   // bars from 1, end included
    "idea": "Verse riff",
    "createdAt": "…", "updatedAt": "…", "activeTrackId": "…",
    "tracks": [{                      // 1 to 3 tracks
      "id": "…", "name": "Rhythm",
      "tuning": { "id": "drop-d", "name": "Drop D (D A D G B E)", "midi": [64, 59, 55, 50, 45, 38] },
      "volume": 80, "mute": false, "solo": false,
      "notes": [
        { "string": 6, "fret": 0,    "startTick": 0,    "durationTicks": 240, "techniques": [] },
        { "string": 4, "fret": null, "startTick": 1440, "durationTicks": 240, "techniques": ["muted"] }
      ]
    }]
  }]
}
```

- **Strings:** `string` runs from 1 (high) to 6 (low). `tuning.midi` lists the open strings in that order. **Pitch = `tuning.midi[string − 1] + fret`.**
- **Notes:** `fret` is 0–16, and `null` means muted, which always carries `"muted"`. `durationTicks` is worked out again on every change, so it doesn't need to be set on import. One note per string per `startTick` per track.
- **Techniques allowed in files:** muted, hammer-on, pull-off, slide, bend, vibrato, palm-mute, harmonic, tap, let-ring. Today the editor creates **muted** only. The others are kept if a file has them, but there are no buttons for them yet.
- **Not in files:** the playhead position, which is kept per project in this browser only.
- **Limits:** 3 tracks (larger imports keep the first 3), 999 bars, 20,000 notes per track, a 120-character title, 60-character track names and 500-character idea notes.

## MIDI export

**☰ → Export MIDI (.mid)** opens a sheet:

- **All tracks (n) · one file** → `<project title>.mid`. Each guitar track gets its own named MIDI track on its own channel, so a DAW opens it as up to 3 lanes.
- **One row per track** (name, tuning, and whether it's muted, soloed or not soloed) → `<project title> - <track name>.mid`, holding just that track.
- **Cancel.**

The file name is the project title (characters that file systems reject are dropped; an empty title becomes `Untitled`). The file goes to your Downloads like a .json export.

**Mute and solo:** **All tracks includes every track, whatever its mute/solo.** A DAW is where you'd mix anyway, and a muted part is still part of the idea. Your mixer state comes along: each track's **volume** goes out as **CC7**, and a track that's silent in the app gets ` (muted)` or ` (not soloed)` added to its MIDI track name. A single-track file is that track, whatever its mute/solo. To get only what you hear, export the audible tracks one at a time, or delete the muted lanes in the DAW.

### File layout

- **Standard MIDI File, Type 1, division 480** (the same PPQ as the JSON, so ticks copy straight across with no rounding).
- **Track 0, the conductor:** Track Name = project title, **Set Tempo** from BPM (µs per quarter = 60,000,000 / BPM), **Time Signature** (4/4 → `4 2 24 8`, 3/4 → `3 2 24 8`, 2/4 → `2 2 24 8`, 6/8 → `6 3 36 8`), and markers `Loop start` / `Loop end` when the loop is on, so you can set the DAW's cycle to match.
- **One MIDI track per guitar track:**
  - **Track Name** = track name. **Instrument Name** = tuning name plus its six MIDI notes.
  - **Channel** = track number: track 1 → channel 1, 2 → 2, 3 → 3. Channel 10 (drums) is never used. A single-track file keeps the track's channel.
  - **Program Change 25** (0-based: Acoustic Guitar (steel)), so it sounds like a guitar on a plain GM synth.
  - **CC7 volume** = round(volume × 127 / 100).
- **Notes:**
  - Pitch = **open-string MIDI note + fret** (E standard: E2=40 A2=45 D3=50 G3=55 B3=59 E4=64).
  - Note on at `startTick` and note off at `startTick + durationTicks`. That's the gated length shown in the `len` row: until the track's next note, at most one bar.
  - Velocity 96. Chords are written low string to high.
  - Every track ends at the song's end, so loops line up.

### Neck position (same pitch, different places)

On a guitar the same pitch can be played in several places. G3 (55), for example, is the open G string, fret 5 on the D string or fret 10 on the A string. Plain MIDI only stores the pitch, so:

- **Default: a Text meta event at each note**, just before its note on, such as `s3f7` (string 3, fret 7) or `s6x` (string 6, muted). A tool that understands it can rebuild the tab exactly, and everything else ignores it. This keeps one channel per track, which is what a DAW wants.
- **The JSON stays the source of truth.** It always keeps `string` + `fret`. MIDI is export only, and there's no MIDI import.
- Not built: a "one channel per string" mode (the MIDI-guitar convention, string 1 → channel 1 … 6 → 6) for tab software that reads that. It may come later as an option.

### Techniques

| Technique | In the editor today | In the file | MIDI mapping |
|---|---|---|---|
| Muted (x) | **Yes**: **x Muted** in the picker | `fret: null` + `"muted"` | **Exported:** a short, low-velocity note at the string's open pitch (velocity 30, 60 ticks = 1/32 or the note's length if shorter), read as a dead "chk" |
| Hammer-on / pull-off | Not yet; the file format accepts them (in the techniques list) | `"hammer-on"` / `"pull-off"` on the target note | **Exported as legato:** the previous note on that string is held 10 ticks into the target note, and the target is played at velocity 67 (about 70%), which most DAW guitar instruments read as a slur |
| Slide, bend, vibrato | Not yet; accepted in files | `"slide"`, `"bend"`, `"vibrato"` | **Not exported yet** (plain notes). Later: pitch bend (bend, slide; needs a known bend range such as ±2 or ±12 semitones, set with RPN 0) and CC1 modulation or pitch-bend wobble (vibrato) |
| Palm-mute, harmonic, tap, let-ring | Not yet; accepted in files | same names | Not exported yet (plain notes). Later: palm-mute as shorter notes with lower velocity, let-ring as longer note-offs, and harmonic and tap as text events only |

In short, the editor currently makes **muted** notes. The other techniques are already valid in the file format, so files that contain them load and save without losing them. They'll get buttons (and the remaining MIDI mappings) in a later version.
