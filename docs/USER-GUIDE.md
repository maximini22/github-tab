# Guitar Tab: user guide

Guitar Tab is a quick way to get a guitar idea down as tab on your phone before it's gone. It runs in the browser. There's no account and no subscription, and nothing is sent anywhere: your work stays in this browser until you export it.

- Open the app: https://jeremylegalrecords.com/guitar-tab/app/
- About page: https://jeremylegalrecords.com/guitar-tab/
- The old address, https://maximini22.github.io/github-tab/app/, still works. Saved work doesn't carry over between web addresses, so **Export** your projects at the old address and **Import** them at the new one.

Contents: [The screen](#the-screen) · [Writing notes](#writing-notes) · [The step editor](#the-step-editor) · [Tracks (up to 3)](#tracks-up-to-3) · [Mixer: volume, mute, solo](#mixer-volume-mute-solo) · [Transport, ruler and loop](#transport-ruler-and-loop) · [BPM, time signature and grid](#bpm-time-signature-and-grid) · [The rhythm row](#the-rhythm-row) · [Tunings](#tunings) · [Undo and redo](#undo-and-redo) · [Lyrics and notes](#lyrics-and-notes) · [The menu](#the-menu) · [Saving, export and import](#saving-export-and-import) · [Checking a round trip by hand](#checking-a-round-trip-by-hand) · [Automated test](#automated-test) · [If you know a DAW](#if-you-know-a-daw) · [Keyboard](#keyboard) · [File format](#file-format-schemaversion-4) · [MIDI export](#midi-export)

---

## The screen

The editor is built to fit a phone screen with no page scrolling. It has been checked at 390×844, 360×740 and 412×915. Only the tab grid scrolls, sideways, inside its own box. From top to bottom:

| Area | What it holds |
|---|---|
| Header | JLR · Guitar Tab (links to the about page), the save status, and **☰** to open the menu |
| Transport | **Back to start**, **Play/Pause**, **Stop**, **Loop**, **Metronome** (click on/off), and **BPM** with − and + (tap for ±1, hold to run) |
| Toolbar | **Grid** (note value, 1/1 to 1/64), the armed track's number and its **· | 3** note-style switch (Dotted, Triplet), **‹ ›** to move one grid step, the cursor position as `bar|beat|16th` (plus `+ticks` on fine grids, for example `1|2|3+40`), **Undo** and **Redo** |
| Track strip | One row per track: colour, name, tuning, **M**, **S** and a volume slider. Tap the name to arm that track for editing. **+ Track (n/3)** appears while there's room. |
| Ruler | Top lane: bar numbers and the loop brace. Bottom lane: beat counts (1 e & a 2 …, and `trip`/`let` on triplet grids). The green playhead line runs through the ruler and the grid. |
| Tab grid | Six string lanes, high e at the top and low string at the bottom, the way you see them when you play. Underneath, the rhythm rows: `len` (note values), beams and flags, and triplet marks. See [The rhythm row](#the-rhythm-row). |
| Lyrics / notes | A box pinned to the bottom showing the first lines. Tap it to open the lyrics sheet. See [Lyrics and notes](#lyrics-and-notes). |

On first use, a three-line hint explains tapping, arming and looping. **Got it** hides it for good, in this browser.

## Writing notes

- **Tap a cell** in a lane, and a vertical fretboard opens for that string and step. Tap a fret (0–22) to place it. **x Muted** places a muted (dead) note, and **Clear** removes the note.
- **Tap a placed note's fret again** (open and Muted included) to remove it. Tapping a different fret replaces it.
- **Next step ›** and **‹ Back step** move one grid step with the picker still open, so you can pencil in a whole bar without closing it. **Done** closes the picker. See [The step editor](#the-step-editor).
- **The edit cursor** is the teal outline. It shows where the next note goes. Arrows **‹ ›** move it one grid step. While stopped, the playhead follows the cursor, so Play starts where you're working.
- **Note length** is automatic. A note lasts until the next note on the same track starts, capped at one bar. The `len` row shows the resulting value (W, H, Q, E, S, T, X, with `.` for dotted and `³` for triplets).
- Each string can hold one note per moment on a track. Chords are simply notes on several strings in the same step, or drop a whole shape from the [chord library](#chord-library).
- Placing a note plays it once so you can hear it.

## The step editor

The fret picker doubles as a screen you can stay on and step through whole bars:

- **Left:** the vertical neck, open string (0) at the top down to fret 22. Dots at 3, 5, 7, 9, a double dot at 12, then 17, 19 and 21 (15 is left plain on purpose).
- **Right, top:** the six string buttons, high at the top and low at the bottom. The string you're on is **yellow**.
- **Right, under x Muted / Clear:**
  - **‹ Back step** and **Next step ›** move one grid step (the Grid setting decides how far).
  - **« Bar** goes to the start of this bar, or to the bar before if you're already at its start.
  - **Bar »** goes to the start of the next bar.
  - Next step and Bar » add a bar when you go past the end of the song (one undo step).
- **Mini tab roll (top of the sheet):** the current bar on all six strings, laid out like the main grid. On fine grids (more than 16 steps in a bar, such as 1/32 and 1/64) it shows the 16-step page holding the cursor, and the caption says which steps are showing, for example `Bar 2 of 4 · step 21/64 · showing 17–32`. The armed track's frets show in full, and the other tracks show faint in their colours, so you can see what else is going on. The current step is the lit column, and your string's row is yellow. Tap any cell in the roll to jump there (step and string).
- **Chords** (under x Muted / Clear) opens the [chord library](#chord-library) at this step.
- **↶ / ↷** in the sheet's header are Undo and Redo, so you can fix a slip without closing it.
- While stopped, the playhead follows every move, so Play starts where you're working.
- The sheet always fits the screen without scrolling, checked at 390×844, 390×650 and 360×640. The fret rows shrink to fit, down to a 24px minimum so they stay easy to tap. On a tall screen (390×844) all 23 frets show at once. On a shorter one, or with the browser's bars showing, only the neck scrolls inside the sheet: swipe it to reach the top or bottom frets. When the step already has a note, the neck scrolls so that fret is in view.

## Chord library

Tap **Chords** in the step editor. The library opens over it, for the armed track and the cursor's bar and step (the header says which, for example `Guitar 1 · E std · Bar 2 · step 5/8`).

- **30 boxes** in four groups: **Open** (C, G, D, Dm, Em, E, A, Am, E7, A7), **Power** (all 12 roots, E5 to D#5), **Barre** (F, Bm, B, F#m, all movable) and **Other** (Bdim, Caug, Dsus4, Asus2). Search by name or quality (`Em`, `F#5`, `A5`, `Gb5`, `power`, `sus`, `minor`, `dim`), by fret code (`244` finds F#5 and F#m `244222`; `577` finds A5; codes match from the low E end, so `244` doesn't find B5 `x244`), or tap a family chip.
- **How to read a box** (since v8.1): like a chord book, **low E on the left, high e on the right**, nut at the top, with the string names (E A D G B e, or the track's tuning, e.g. D A D G B e) under the box. Rings above the nut are open strings, × is a string you don't play, a dot is a fretted note, a bar across the strings is a barre, and a number left of the box is the starting fret. Finger numbers aren't drawn (since v8.2), so F5 `133` is simply three dots. The fret code under the name reads the same way, low E first: Em = `022000`, A = `x02220`, F#5 = `244`. Frets above 9 are separated by dashes (`10-12-12`).
- **One way round everywhere in the chord library** (since v8.2): the big neck in the detail view also has **low E on the left** (E A D G B e, or the track's tuning, e.g. D A D G B e in Drop D), so it matches the box, the code and the string list beside it. Its dots are plain highlighted dots. The tab lanes, the mini roll and the fret picker's string list still put high e at the top, as before.
- **Power chords (movable):** one card per root. Roots on the 6th string up to fret 7 use the 6th-string shape r, r+2, r+2 on strings 6-5-4 (E5 `022`, F5 `133`, F#5 `244`, G5 `355`, G#5 `466`, A5 `577`, A#5 `688`, B5 `799`); the rest use the 5th-string shape on strings 5-4-3 (C5 `x355`, C#5 `x466`, D5 `x577`, D#5 `x688`). Open a power chord and:
  - **6th / 5th** moves it to the other root string at the same pitch (A5 `577` ↔ `x022`);
  - **‹ fret ›** slides it a fret at a time; the name follows the root (A5 › A#5 › B5), down to the open position and up until the top note reaches fret 22;
  - **1·5·8 / 1·5** chooses 3 notes (root, 5th, octave) or 2 (root and 5th).
  - Frets come from the real string intervals of the armed track's tuning, so in **Drop D / Drop C** the 6th-string power chord is a one-finger barre r, r, r (Drop D: D5 `000`, E5 `222`, G5 `555`).
- **Barre chords (movable):** F (`133211`), Bm (`x24432`), B (`x24442`) and F#m (`244222`) have the same ‹ fret › stepper and an **E shape / A shape** toggle, which moves the chord to the other shape at the same root (F at fret 3 = G `355433`, then A shape = G `x-10-12-12-12-10`). In another tuning the card keeps its root note at the lowest fret that gives it (F in Drop D = `333211`).
- **Preview:** tap a chord. It's drawn on the neck, the string list beside it shows each string (low E first) as **fret 5**, **open** or **muted**, the mini roll shows where its notes would land in the bar (in yellow), and you hear it. On a short screen the chord list hides while you look at one; **Cancel** or Esc goes back to it.
- **Strum ↓** puts all its notes on the cursor step. **Arp** spreads them out, one note per grid step, lowest string first (so on a 1/8 grid an Em arpeggio takes 6 eighths). The choice is remembered.
- **Drop into measure** writes the notes on the armed track:
  - strings marked × are skipped, and any note already on them stays;
  - a note already on one of the chord's strings at that step is replaced;
  - an arpeggio that runs past the last bar adds bars;
  - it's **one undo step**. The toast ("Em added at bar 2, step 5") has an **Undo** button, and the sheet's ↶ and Ctrl+Z work too.
  - A note lasts until the track's next note, so arpeggio notes cut each other off (there's no let-ring yet).
- **Names follow the tuning.** Power and barre chords are always named from their real root in the armed track's tuning. The open shapes are standard-tuning fingerings. On a track in another tuning, the same fingering sounds different, so it's labelled honestly: if every string is shifted the same amount (C standard, D standard), the box shows the real name with the shape, for example **Dm (Em shape)** in D standard. If the strings move by different amounts (Drop D, Drop C, Open G), it's shown as **Em shape**, with a note that the tuning changes it unevenly.
- The library is a small file, `app/chords.json`, cached for offline use with the rest of the app. In that file, `frets` and `fingers` run **low E first** (index 0 = string 6) and `null` is a string you don't play; `barre` is `{ fret, from, to }` in the same low-to-high positions (1–6). Movable entries have a `movable` field instead of frets: the power entry (`{ "roots": "all", "shape": "pow6", "maxRootFret6": 7 }`) expands to the 12 cards, and each barre entry names its shape (`maj6`, `min6`, `maj5`, `min5`) and starting fret. Shapes are interval lists, so the frets are worked out for each tuning.

## Tracks (up to 3)

A project holds **up to 3 tracks**, for example rhythm, lead and a bass line played on guitar. All tracks sit on **one shared grid**:

- The **armed** track (highlighted row, tap its name to arm it) is drawn in full, and that's the track you edit.
- The other tracks show **faint and colour-coded** in the same lanes: teal for track 1, amber for track 2 and violet for track 3. When the armed track and another track both have a note in the same cell, a small coloured dot marks the other track's note.
- **+ Track (n/3)** adds a track. It disappears once a project has 3 tracks.
- Rename the armed track, change its tuning or delete it from the menu (**Armed track**).
- Each track keeps **its own tuning** and **its own Sound**. Tempo, time signature, loop and grid belong to the whole project.

## Sounds (v9)

Each track row has a **Sound** button showing the track's instrument. Tap it for the list:

| Sound | What it is | Plays | MIDI program (GM, 1-based) |
|---|---|---|---|
| **Nylon** (default) | FluidR3 GM nylon guitar | as written | 25 Acoustic Guitar (nylon) |
| **Spanish nylon** | FreePats Spanish classical guitar | as written | 25 |
| **Clean electric** | FreePats electric guitar FSBS, clean, bridge pickup | as written | 28 Electric Guitar (clean) |
| **Upright bass** | D. Smolken double bass, pizzicato | an octave lower | 33 Acoustic Bass |
| **Electric bass** | Karoryfer Samples Swagbass, clean | an octave lower | 34 Electric Bass (finger) |

- The tab doesn't change when you pick a bass Sound: an open low E on a bass track still reads `0` on the 6th string and sounds E1 (a guitar's E2 an octave down), like a real bass. Use a guitar tuning as a bass's top four strings, or write on strings 6–3.
- The list works with the keyboard (arrows, Enter, Escape). A change is one Undo step and is saved with the project and in its JSON file.
- New tracks and every file from before v9 use **Nylon**.
- **Loading:** each Sound is one small file (133–225 KB) fetched the first time a track uses it; Nylon starts loading just after the page appears. If you press Play before a Sound has arrived, the Play button shows a loading state and playback starts by itself when it's ready; press Play again to cancel. Once played, Sounds are kept in the browser and work offline.
- **If a Sound can't load** (for example offline before it was ever used), that track plays Nylon and a short message says so. If Nylon itself can't load, a message says the guitar sound couldn't load and nothing plays; try again when you're online.
- Every note is a real recording, repitched from the nearest sampled note. Credits and licences: [NOTICE](../NOTICE), and the **Sounds** line in the menu.

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
- **Metronome** (the metronome icon next to Loop, or key **M**) turns a click on and off. There is no volume control: the level is fixed at **half of what a fresh track's default volume gives**, and the track volume sliders don't change it.
  - The sound is a short, soft, woody tick (a filtered noise burst plus a tiny sine blip, about 15 ms), made in the browser; it is the only synthesised sound in the app.
  - **Metronome level (measured, v9):** `tests/v9.mjs` renders a default-volume note of every Sound and a beat-1 click through the app's real output chain (master gain and compressor) at 48 kHz and compares their K-weighted loudness over the first 100 ms. The click is 6.8 dB below Nylon (target −6 dB ±1, i.e. half). Against the v8.2 click voice the sampled Nylon was 12.3 dB louder, so the click has a fixed make-up gain (`CLICK_CAL = 2.06` in `audio.js`); its nominal level stays 0.2. The other Sounds are matched to Nylon within 1.5 dB, so the click sits at about half of any of them.
  - It clicks once per beat of the time signature (quarters in 4/4, 3/4 and 2/4; the dotted quarter in 6/8). Beat 1 is a little higher and louder.
  - It runs on the same scheduler as the notes, so it stays in time through loops, BPM changes (including holding − / +) and **Back to start**, and you can switch it on or off while playing.
  - **Count-in:** pressing Play from stopped with the click on gives one bar of clicks first.
  - On/off is saved with each project and in its JSON file. It is not written to MIDI.

## BPM, time signature and grid

- **BPM** is set per project, 30–300 (default 90). Type a value, or use − and +:
  - **Tap** − or + to change it by exactly 1.
  - **Hold** to keep going and speed up: the first repeat comes after 0.4 s, then steps of 1 BPM every 250 ms, each gap 20% shorter than the last, down to every 36 ms (reached about 1.5 s into the hold). 90 → 150 takes about 3.3 s. It's the same speed both ways.
  - The tempo changes live, even while playing. Lifting your finger, sliding off the button or leaving the app stops it at once, and it stops by itself at 30 or 300.
  - A whole hold is **one undo step**, and it saves once, when you let go.
- **Time signature** is set per project, in the menu: 4/4, 3/4, 2/4 or 6/8. In 6/8 the beat is a dotted quarter.
- **Grid** is the note value of one step, like a DAW's snap setting. The dropdown holds the plain values 1/1, 1/2, 1/4, 1/8, 1/16, 1/32 and 1/64 (default 1/8).
- The **note style** switch next to it, **·** (Dotted) and **3** (Triplet), changes the step: Dotted is 1.5 × the value, and Triplet is 3 in the time of 2 (⅔ of the value). Only one can be on. Tapping one turns it on and the other off, and tapping the lit one goes back to plain.
- **The note style is per track** (since v8). The switch changes the **armed track** only, and the coloured number in front of it shows which track that is. A track with a style shows **·** or **3** by its name. So track 1 can play straight eighths while track 2 plays eighth triplets over it: each track's lanes, ruler counts and rhythm row follow its own style, and playback and MIDI put every note at its exact time. BPM, time signature and the grid value stay project-wide. Arming another track keeps the cursor at the same moment (on the nearest step of that track's grid). The style is saved, exported and undoable, and a new track starts with the armed track's style.

| Grid | Note | Plain ticks | Dotted (·) | Triplet (3) |
|---|---|---|---|---|
| 1/1 | whole | 1920 | 2880 | 1280 |
| 1/2 | half | 960 | 1440 | 640 |
| 1/4 | quarter | 480 | 720 | 320 |
| 1/8 | eighth | 240 | 360 | 160 |
| 1/16 | sixteenth | 120 | 180 | 80 |
| 1/32 | 32nd | 60 | 90 | 40 |
| 1/64 | 64th | 30 | 45 | 20 |

Ticks are at PPQ 480. Steps restart at every barline, so a step that doesn't divide the bar evenly ends with a shorter one (for example 1/4 dotted in 4/4 gives 720 + 720 + 480). The ruler and toolbar show the grid as `1/8`, `1/8.` or `1/8T`. Plain 1/64 has 64 steps in a 4/4 bar and 1/64 triplet has 96. The tab grid scrolls sideways and keeps its readable column width, and the step editor's roll pages through the bar 16 steps at a time.

Changing the grid **never moves or deletes notes**. Notes keep their exact time, and the grid only changes how fine the lanes are. A note that falls between grid lines on a coarse grid still shows in its cell. Switch to a finer grid to edit it exactly. Older (v3) files with dotted or triplet grids open with the same value and style. A tuplet other than a triplet (for example 5:4) opens as the plain value, and a grid that was both dotted and triplet opens as the triplet. Both of those are listed in the import summary, and the notes stay where they were.

## The rhythm row

Under the six string lanes, three thin rows show the rhythm of the armed track. They're worked out from the note spacing, like the `len` row:

- **`len`:** the note value: W (whole), H (half), Q (quarter), E (eighth), S (16th), T (32nd) or X (64th). A dot is added for dotted values (`E.`) and `³` for triplets (`E³`). `~` marks a length with no single name.
- **Stems and beams:** eighths and shorter get 1, 2, 3 or 4 beams (eighth, 16th, 32nd, 64th), beamed together within a beat. A lone one gets flags. Dotted values show a dot after the stem. Whole notes have no stem.
- **Triplets:** notes of one triplet group are marked **3**. Beamed triplets (eighth and shorter) show just the number. Quarter, half and whole triplets get a bracket with the 3 in the middle.

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

Undo and redo are in the toolbar, with up to 100 steps per project. Undo covers notes, steps, bars, tracks (add, delete, rename, tuning), BPM, time signature, loop, grid and title. Mixer moves and lyrics aren't undo steps (while typing lyrics, the text box's own Ctrl/⌘+Z works). Importing a file clears the history.

## Lyrics and notes

The box pinned to the bottom of the screen shows the first one or two lines of the project's lyrics or notes. Tap it to open the **lyrics sheet** (v9.1), which covers the screen:

- **Writing:** a multi-line text area for up to **5000 characters**, with a count at the top. Line breaks are kept. It saves as you type (about 0.3 s after you stop, and straight away if you close or leave the page). **Done** or Esc closes it. Long lyrics scroll inside the sheet; the page itself never scrolls.
- **Section headers:** a line that is only a label in square brackets, such as `[Verse]`, `[Chorus]`, `[Bridge]` or `[Verse 2]`, is a header. Headers are drawn bold on a teal band, and each becomes a **chip** in the row at the top. Tap a chip to jump to that section; the chip of the section you're reading stays lit as you scroll. Brackets inside a line (`play it [softly]`) are just text.
- **Quick labels:** the second row (**+ Verse**, **+ Pre-chorus**, **+ Chorus**, **+ Bridge**, **+ Hook**, **+ Intro**, **+ Outro**) puts that header on its own line at the cursor, after a blank line, with the cursor ready on the line below. A second Verse becomes `[Verse 2]`, then `[Verse 3]`. Tapping a label or chip keeps the phone keyboard up.
- **Keyboard on screen:** the sheet shrinks to the space above the phone keyboard and keeps the line you're typing in view. On a very short screen the chip rows fold away while the keyboard is up.
- **Writing over a loop:** opening the sheet, typing and closing it never stop the music. The **mini transport** at the bottom of the sheet has **Restart**, **Play/Pause**, **Stop**, the **metronome** and the bar|beat position.
  - **Restart** (the big button; it says **Loop · bar N** or **Bar 1**) goes back to the loop's first downbeat, or to bar 1 with the loop off. While playing, the jump happens inside the audio scheduler 40 ms ahead, so the downbeat note and the beat-1 click start together on the same sample; notes that were already queued are dropped and notes still ringing fade out in a few milliseconds, so nothing doubles up or hangs. While stopped it moves the playhead there.
  - With a keyboard attached: **R** or **Home** restarts and **Space** plays or pauses, when you're not typing in the text (while typing, keys type).
- **Saving and files:** the lyrics are the project's `idea` field, so they're auto-saved and included in exports, Import and Share with their line breaks. When Share falls back to text, the lyrics go under the tab after a "Lyrics" line. They are not in the MIDI file.
- Notes written in older versions (one line, up to 500 characters) open here as they are.

## The menu

**☰** opens a drawer holding everything that doesn't need to be on screen while you play:

- **Project:** switch project, rename it, **+ New**, **Duplicate**, **Delete**, and the time signature for the whole project.
- **Armed track:** name, tuning, **Delete this track**.
- **Edit at the cursor:**
  - **+ Insert step** and **− Delete step** shift later notes on *all* tracks by one grid step.
  - **+ Add bar** and **− Last bar** change the song length.
  - **Loop from this bar** and **Loop to this bar** set the loop ends.
  - **Clear this step (armed track)** clears notes on the armed track only.
- **Files:** **Export project (.json)**, **Export MIDI (.mid)**, **Export all (.json)**, **Import (.json)**, and **Share project**.
- **Text tab:** a plain-text copy of the tab to paste anywhere, with **Copy**.

## Saving, export and import

- Everything **saves automatically in this browser**, on this device and at this web address. Clearing the browser's site data deletes it, so **export is your real backup**.
- **Moving from the old address?** Saved work doesn't carry over between web addresses (maximini22.github.io/github-tab and jeremylegalrecords.com/guitar-tab are separate to the browser). Export all at the old one, then Import at the new one.
- **Export project (.json)** saves the current project as a `.json` file. **Export all (.json)** saves the whole library. On a phone the file goes to your Downloads, and from there you can keep it in your files or cloud drive or send it to yourself. **Share project** hands the project straight to another app (Messages, Drive, email). It tries, in order:
  1. **the file**, named `<project>.json.txt` as plain text. Android's share sheet only takes a short list of file types and refuses `.json`, so the file is sent as text. **Import** reads a `.json.txt` back as normal (rename it to `.json` if you like);
  2. if files can't be shared, **the tab as text** (title and the text tab);
  3. if that fails too, it **copies the tab** to the clipboard and says so;
  4. as a last resort, it **saves the .json file** (like Export) and says so.
  Closing the share sheet without choosing an app does nothing, with no error.
- **Export MIDI (.mid)** opens a small sheet: **All tracks** (one file, one lane per track) or one row per track for a file with only that track. It's for opening your idea in a DAW or notation app. See [MIDI export](#midi-export). MIDI is export only, so keep the .json as your backup.
- **Import (.json)** checks the file first, then asks how to bring it in:
  - **Merge** keeps everything you have and adds the file's projects. An identical copy of a project you already have is skipped, and a changed copy is added as "(imported)".
  - **Replace** swaps your whole library for the file, after a confirm.
- If anything had to change on the way in, a summary lists it. For example:
  - a project with more than 3 tracks keeps its first 3
  - a tuning shows as Custom (imported)
  - a 5:4 (or other non-triplet) tuplet grid becomes a plain value
  - tracks with mixed time signatures now share one
- To move to another device, export on one, then import with Merge on the other.
- Files from older versions (schemaVersion 1–4) open fine. In a v4 file (v7 and earlier) the note style belonged to the whole project, so every track gets that style. A file from a **newer** version is refused with "This file was made by a newer version of Guitar Tab … Reload the app to update it".
- A library saved by an older version in this browser is upgraded the first time a new version opens, and a one-off backup copy is kept under `jlr-guitar-tab:library-v4-backup` (or `-v3-`, `-v2-`, `-v1-`). v8 saves under `jlr-guitar-tab:library-v5` and also keeps a v7-readable copy under the old key, so rolling back to v7 loses nothing but the per-track styles. See [ROLLBACK.md](ROLLBACK.md).
- The app moved from `/github-tab/` to `/github-tab/app/`. Both are on the same web origin, so work saved by the old version is picked up automatically.

## Checking a round trip by hand

Use this when you want to be sure an export brings everything back:

1. Make a project with 3 tracks and give each track a different tuning. Add a few notes on each, including one **x Muted** note.
2. Set the BPM to something other than 90 (for example 137), and drag a loop over one bar in the ruler's top lane.
3. Mix the tracks: change the volumes, solo two tracks and mute one. Type a few lines in the lyrics sheet (with a `[Chorus]` header), and change the Grid.
4. Note what it looks and sounds like (press Play), then **☰ → Export project (.json)**.
5. Clear the site's data (browser settings → site settings → clear data), or open the app in another browser or device.
6. Open the app, then **☰ → Import (.json)** → choose the file → **Replace** (or Merge) → confirm.
7. Check the result: same title, BPM, time signature, loop, grid, lyrics (with their line breaks); same tracks with their names, tunings, volumes and M/S states; same notes in the same places (switch between tracks to compare). Press Play: only the soloed, unmuted tracks should sound, at their volumes.

## Automated test

`tests/roundtrip.mjs` does all of the above in a headless Chrome and adds playback and import checks. It:

1. Builds the project through the real UI.
2. Captures the real export download.
3. Clears storage, reloads and imports with Replace.
4. **Deep-compares** the project: tracks, notes, tunings, BPM, time signature, loop, grid, mixer and idea.
5. Plays the song and checks that notes were scheduled from **every audible track**, with the right pitches and gains, and none from the muted track.
6. Checks the 3-track import limit, Custom (imported) tunings, grid migration and a real v3 export (`tests/fixtures/v3-project.json`).
7. Step editor: **‹ Back step** / **Next step ›** / bar jumps move the cursor and playhead, the selected string is yellow on the chip and in the mini roll, the roll shows the bar's notes and jumps on tap, the sheet fits 390×844 without scrolling, and Undo/Redo work inside it.
8. Frets 0–22: the neck has 23 rows with the right dots (none at 15), fret 22 is placed, plays, and shows in the roll and text tab. The picker fits at 390×844 with no scrolling, and at 390×650 and 360×640 only the neck scrolls and the lit fret is kept in view. Fret 22 survives the JSON round trip and exports as the right MIDI pitch.
9. v7 grids: the dropdown holds exactly the 7 plain values; every value × style (21 grids) gives the right step size, label and saved grid; the toggles are exclusive and undoable; [ ] . T work; notes never move when the grid changes; 8th triplets (beamed, "3"), quarter triplets (bracket), 32nds (3 beams) and 64ths (4 beams) in the rhythm row; triplet playback timing; step editor and the 16-step roll window at 1/64; the JSON round trip of a triplet and a dotted grid; and no page scroll with the toolbar on one row at 390×844, 390×650 and 360×640.
10. BPM hold: a tap is ±1; holding + runs 90 → 150 in under 5 s with gaps that only shrink; letting go or sliding off stops it at once; it clamps at 30 and 300; nothing saves during the hold and it saves once on release; one Undo reverts the whole hold; and the tempo changes live while playing.
11. MIDI: opens the export sheet, downloads **All tracks** and a single track, and parses both files back (tracks, names, tempo, loop markers, every note's tick and pitch, channels, CC7, muted velocity).

`tests/v8.mjs` covers v8 in the same headless Chrome:

1. **Share:** with `navigator.share`, `canShare` and the clipboard mocked, every branch: the file share (a `.json.txt`, `text/plain`, holding the project), the text share, the clipboard copy, the download, cancel (AbortError) staying silent, and a shared `.json.txt` importing back.
2. **Per-track feel:** the toggles change the armed track only, the toolbar track number and row badges, per-track steps and lanes, the cursor keeping its tick when arming, undo/redo of a style, playback timing of a straight track against a triplet track, the text tab, a mixed straight + triplet project round-tripping through Export/Import, the v7 copy and rollback pick-up, and the "newer version" message.
3. **Chord library:** opening from the step editor, 30 boxes in 4 groups with chip counts, search, the low-E-left boxes with string labels and chart-order codes (Em 022000, A x02220), the detail view (code labelled low E → high e, preview roll, low-E-first chips; since v8.2 the neck columns read E A D G B e with Em's dots on the A and D columns, no orientation caption, and no finger numbers in boxes, on the neck or in the string list), Strum drop (6 notes, replacing old ones), the toast's Undo, × strings skipped (D), Arp one step apart low string first, an Arp that adds a bar and its one-step undo, tuning-aware names (Dm (Em shape)), dropping onto the armed track, and Escape.
4. **Movable shapes (v8.1):** search by `244` (F#5, not B5), `577` and `A5`; F#5 = 244 dropped on strings 6/5/4; the A5 detail (577, fret 5); the stepper (B5 799, D5 10-12-12, stops at fret 20/22 and at the open E5 022); the 6th/5th toggle keeping the root (x022, C5 x355 on strings 5/4/3, back to 8-10-10); 2-note mode; the E/A-shape barre toggle (G 355433 → x-10-12-12-12-10); and a Drop D track where E5 = 222 with a one-finger barre and the box strings read D A D G B e. v8.2 adds A5 `577` on the neck's leftmost three columns with × over G B e, the Drop D neck labels D A D G B e with the barre across the first three columns, and a check that the fret picker's string list is still e B G D A E.
5. **No scroll:** the page, step editor, chord grid, chord detail and a power-chord detail with its stepper row at 390×844, 390×650 and 360×640.
6. **Metronome (v8.2):** the toggle (aria-label Metronome, off by default, no volume control), clicks on beat ticks in 4/4, 3/4 and 6/8 with the accent on beat 1, the 1-bar count-in, the level fixed at 0.5 × a fresh track's default-volume gain and unchanged by the track slider, sync with the notes through the loop, Back to start and a BPM change mid-play, no clicks when off, identical MIDI with it on or off, the JSON round trip (and older files opening with it off), and the transport fitting at 390×844, 390×650 and 360×640.

`tests/v9.mjs` covers the sampled Sounds (v9):

1. **Lazy loading:** no Sound file is requested before first paint and the load event; then only `nylon.json` and `nylon.mp3`.
2. **Sound list:** 5 options, keyboard and Escape, a pick loads only that Sound, Undo/Redo, saved across a reload, left out of the v7/v4 copy, new tracks Nylon.
3. **Bass octave:** a bass track sounds MIDI − 12 (open E → 28), Nylon as written, the tab unchanged; MIDI lanes get programs 25/33 (bytes 24/32) and bass notes an octave down.
4. **Files:** the Sound is exported and imported (loading exactly the Sounds used), files without it and a v3 file open as Nylon.
5. **Offline:** after one play, a reload offline plays from the `gt-tones-v1` cache with no network requests.
6. **Waiting and fallback:** with Nylon held back, Play shows the loading state and starts by itself; Play again cancels; a failed bass Sound falls back to Nylon at tab pitch with a message; a failed Nylon shows the error and stays stopped.
7. **Measured sound:** every sample starts within 3 ms (no leading silence) and is within 20 cents of its tuning note; rendered notes of every Sound sound within 2 ms of a metronome click scheduled the same way and within 15 cents of the tab (− 12 for bass); the metronome level; Sounds matched within 1.5 dB.
8. **No synth left, credits (NOTICE, menu, landing), the service-worker cache name, no scroll at 390×844, 390×650 and 360×640, and (locally) first-load timing against v8.2.**

`tests/v91.mjs` covers the lyrics sheet (v9.1):

1. **Text:** typed line breaks are saved, autosaved within ~0.3 s, kept through a reload (even one right after typing), shown in the 2-line preview; Escape closes.
2. **Old notes:** a v4 (v7-era) library's one-line notes open in the sheet.
3. **Headers:** only lines that are just `[Label]` count; chips in order; header lines painted by the mirror layer with the same font, box and wrapping as the text; a chip tap scrolls that header to the top (mirror follows), the active chip follows hand scrolling.
4. **Quick labels:** placement, the caret, the keyboard staying up, `[Verse 2]` numbering, native undo.
5. **Limit:** 5000 characters (paste cut, typing stops, a label that would overflow is refused, a 5000-character text with 1666 line breaks survives a reload, files over 5000 are rejected).
6. **Files:** JSON export/import and the shared `.json.txt` keep the lyrics exactly; the text share has them under the tab; the MIDI has no lyric events or text.
7. **Writing while looping:** opening the sheet and typing don't stop or restart playback; Restart while playing is a hand-off 40 ms ahead whose first scheduled note (the loop's bar-2 note) and accented click are both at time 0, with every queued old note cancelled and none left ringing; clicks then every beat in sync; no doubled notes; 6 quick taps; R and Home; R while typing types; Restart with the loop off (bar 1) and while stopped (moves the playhead); the metronome toggle in the sheet; R on the main screen.
8. **Fit:** no page scroll with the sheet open at 390×844, 390×650 and 360×640, or with the keyboard up (390×470, 360×330 viewports), the caret kept in view, Restart always visible; the main screen still fits with the preview box.
9. **Rollback (local):** v9 and v7 (from git worktrees) open the library and cut the notes to 500 characters; coming back after they saved a change restores the full lyrics from the backup copy, but an edit made to the notes in the older version is kept. Also the service-worker cache name and first-load time against v9.

`tests/midi.mjs` checks the encoder on its own in Node with an independent parser (`midi-file`, a test-only dependency). It covers both modes, 4/4, 3/4, 2/4 and 6/8, muted and hammer-on/pull-off rules, file names, frets 17–22 (pitch, position text, and that import accepts 22 and rejects 23), and the v7 grids: all 21 value × style tick sizes, bar-line restarts, length names, v3 grid migration, and that triplet, 64th-triplet and dotted-64th notes land on exact MIDI ticks. For v8 it also checks schema 5 (a mixed straight + triplet project's MIDI ticks, parse-back, the v7 copy, unknown styles, newer files) and the chord data: all 30 E-standard cards give the right notes with the root in the bass, × strings skipped, chart-order codes, the 12 power cards (F#5 244, A5 577, C5 x355), 2-note versions, the fret-22 cap, the 6th↔5th pair, Drop D r-r-r power chords, the movable barre shapes, box orientation and string labels, code search, and the tuning-aware names. `SAMPLE_DIR=… node midi.mjs` also writes `sample.mid`, `sample-all.mid` and `sample-track1.mid`.

```sh
cd tests
npm install                                   # puppeteer-core + midi-file (tests only); uses your installed Chrome
node midi.mjs                                 # MIDI encoder, model and chord data (no browser)
CHROME_PATH=/usr/bin/google-chrome node roundtrip.mjs
CHROME_PATH=/usr/bin/google-chrome node v8.mjs
CHROME_PATH=/usr/bin/google-chrome node v9.mjs
CHROME_PATH=/usr/bin/google-chrome node v91.mjs
npm test                                      # all five
# against the live site instead of a local copy:
BASE=https://jeremylegalrecords.com/guitar-tab/ node roundtrip.mjs
```

It prints one PASS/FAIL line per check and exits non-zero on any failure. `node tests/serve.mjs` serves the repo locally at `http://127.0.0.1:8080/github-tab/` if you want to click around.

## If you know a DAW

| In a DAW | In Guitar Tab |
|---|---|
| Transport: return to zero, play, stop, cycle, click | **Back to start**, **Play/Pause**, **Stop** (again = to start), **Loop**, **Metronome** |
| Tempo field | **BPM** with − and + (per project) |
| Bar ruler, playhead, cycle/loop brace | Ruler: bar numbers and the loop brace on top, beats below. Drag to set the loop, tap or drag to move the playhead. |
| Track headers: record-arm/select, mute, solo, fader | Track strip: tap a name to **arm**, **M**, **S**, volume slider |
| Snap / quantize value | **Grid**: 1/1 … 1/64, plus **·** Dotted / **3** Triplet |
| Piano roll (pitch rows × time) | Tab grid (string lanes × time). Tap to add, tap the same fret to remove. |
| Other tracks shown faint in the editor | Non-armed tracks drawn faint, colour-coded |
| Insert / delete time | **+ Insert step** / **− Delete step** (all tracks) |
| Undo history | **Undo / Redo** (100 steps) |
| Spacebar play | **Space** plays and pauses |
| Project notes / notepad / lyric sheet | The **lyrics sheet** (tap the notes box) |
| Export MIDI | **☰ → Export MIDI (.mid)**: all tracks in one file, or one track. See [MIDI export](#midi-export). |
| Step-input / step-record | The [step editor](#the-step-editor): **‹ Back step**, **Next step ›**, **« Bar**, **Bar »** |

## Keyboard

When a keyboard is attached:

| Key | Action |
|---|---|
| Space | Play / pause |
| Home or R | Back to start (while playing: Restart at the loop's first downbeat) |
| L | Loop on/off |
| M | Metronome on/off |
| ← → | Move one grid step |
| ↑ ↓ | Move between strings |
| Enter | Open the fret picker at the cursor |
| [ / ] | Coarser / finer grid value (keeps the style) |
| . | Dotted on/off (armed track) |
| T | Triplet on/off (armed track) |
| Ctrl/⌘+Z | Undo |
| Shift+Ctrl/⌘+Z or Ctrl+Y | Redo |
| Esc | Close the lyrics sheet, the chord library (detail first), the picker or the menu |

With the lyrics sheet open and the text not focused: **Space** play/pause, **R** or **Home** Restart, **L** loop, **M** metronome, **Esc** close. While you type in the text, keys type (Esc still closes).

With the picker open, type a fret number (0–22; for two digits, type them quickly), **x** for muted, or Backspace/Delete to clear. ← → step back and forward, and ↑ ↓ change string, without closing it.

## File format (schemaVersion 5)

Times are in ticks at **480 per quarter note** (PPQ 480), and pitches are MIDI note numbers. That makes the format MIDI-ready. Notes sit at absolute ticks and don't depend on the grid.

```jsonc
{
  "schema": "jlr-guitar-tab",
  "schemaVersion": 5,
  "kind": "project",                 // or "library" for Export all
  "ppq": 480,
  "exportedAt": "2026-10-23T08:00:00.000Z",
  "activeProjectId": "…",
  "projects": [{
    "id": "…", "title": "Night drive riff",
    "bpm": 112,
    "grid": { "value": "eighth" },   // whole | half | quarter | eighth | sixteenth | thirtysecond | sixtyfourth
    "timeSignature": [4, 4],
    "lengthTicks": 3840,              // whole bars
    "loop": { "enabled": true, "startMeasure": 1, "endMeasure": 2 },   // bars from 1, end included
    "metronome": false,               // v8.2: click on/off (optional; missing = off; not in MIDI)
    "idea": "Verse riff",
    "createdAt": "…", "updatedAt": "…", "activeTrackId": "…",
    "tracks": [{                      // 1 to 3 tracks
      "id": "…", "name": "Rhythm",
      "tuning": { "id": "drop-d", "name": "Drop D (D A D G B E)", "midi": [64, 59, 55, 50, 45, 38] },
      "style": "plain",               // plain | dotted | triplet (this track's note style)
      "tone": "nylon",                // v9: nylon | spanish | clean | upright | ebass (optional; missing = nylon)
      "volume": 80, "mute": false, "solo": false,
      "notes": [
        { "string": 6, "fret": 0,    "startTick": 0,    "durationTicks": 240, "techniques": [] },
        { "string": 4, "fret": null, "startTick": 1440, "durationTicks": 240, "techniques": ["muted"] }
      ]
    }]
  }]
}
```

- **Grid and style:** the project's `grid` is just `{ "value" }`. Each track's `style` is `plain`, `dotted` (1.5 × the value) or `triplet` (3 in the time of 2), so a track's step is the project value with its own style. This is why the schemaVersion went from 4 to 5 in v8. In schemaVersion 4 files (v7) the style was on the project grid instead (`"dotted": true` or `"tuplet": { "actual": 3, "normal": 2 }`); importing one gives that style to every track. v7 and older refuse a schemaVersion 5 file ("made by a newer version").
- **Strings:** `string` runs from 1 (high) to 6 (low). `tuning.midi` lists the open strings in that order. Each is a MIDI note from 0 to 105, so even fret 22 stays inside MIDI's 0–127 range. **Pitch = `tuning.midi[string − 1] + fret`.**
- **Notes:** `fret` is 0–22 (0–16 before v6; older files are a subset, so the schemaVersion stays 4), and `null` means muted, which always carries `"muted"`. `durationTicks` is worked out again on every change, so it doesn't need to be set on import. One note per string per `startTick` per track.
- **Techniques allowed in files:** muted, hammer-on, pull-off, slide, bend, vibrato, palm-mute, harmonic, tap, let-ring. Today the editor creates **muted** only. The others are kept if a file has them, but there are no buttons for them yet.
- **Metronome:** `metronome` (since v8.2) is optional, so the schemaVersion stays 5: older files without it open with the click off, and v8/v8.1 ignore it. The v7 copy kept in the browser leaves it out.
- **Sound:** a track's `tone` (since v9) is optional, so the schemaVersion stays 5: files without it, or with an unknown value, open as Nylon, and v8.x ignores it. The v7 copy kept in the browser leaves it out.
- **Lyrics:** `idea` (since v9.1) holds up to 5000 characters with line breaks; the schemaVersion stays 5. v9 and v7 accept such files but keep only the first 500 characters (see [ROLLBACK](ROLLBACK.md)).
- **Not in files:** the playhead position, which is kept per project in this browser only.
- **Limits:** 3 tracks (larger imports keep the first 3), 999 bars, 20,000 notes per track, a 120-character title, 60-character track names and 5000-character lyrics/notes (`idea`; 500 before v9.1).

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
  - **Program Change** from the track's Sound, as GM program numbers (1-based; the byte in the file is one less): Nylon and Spanish nylon **25** Acoustic Guitar (nylon), Clean electric **28** Electric Guitar (clean), Upright bass **33** Acoustic Bass, Electric bass **34** Electric Bass (finger). (v8.2 and older wrote byte 25, Steel guitar.)
  - **CC7 volume** = round(volume × 127 / 100).
- **Notes:**
  - Pitch = **open-string MIDI note + fret** (E standard: E2=40 A2=45 D3=50 G3=55 B3=59 E4=64). On a bass track it's **12 lower**, as it sounds (open low E = E1 = 28); the `s6f0` text events still give the tab's string and fret.
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
