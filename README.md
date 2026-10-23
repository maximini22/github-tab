# Guitar Tab

A phone-first guitar tab writer from Jeremy Legal Records. It's one static page with no build step, no backend and no account. It installs as an app (PWA) and works offline.

**Open it:** https://maximini22.github.io/github-tab/

## What it does

- **Projects and tracks.** A library holds many projects. Each project has a title and one or more named tracks, and every track has its own tuning (Standard, Drop D, Drop C, D Standard, Eb, Open G, Open D, DADGAD) and time signature.
- **Player's view.** Strings are always drawn as you see them when playing: high e at the top, low E at the bottom. That applies to the grid rows, the picker's string list, the tuning readout and the copied text tab.
- **Grid / snap.** Like a DAW, each project has one grid resolution: whole, half, quarter, eighth or sixteenth, optionally dotted or triplet. Columns are grid steps, and tapping Next moves one grid step. Changing the grid never moves or deletes notes; it only changes how they are shown. A note that sits between grid lines shows in its cell with a small amber dot, and a cell holding more than one note on a string shows "+n". Insert step and Delete step shift later notes by one grid step.
- **Vertical fret picker.** Tap a string at a step and a neck opens. Frets 0–16 run top to bottom, with inlay dots at 3, 5, 7, 9 and 12, plus Muted (x) and Clear. The current fret is highlighted. Tap it again (open or Muted included) to remove the note, or tap another fret to replace it. Removing a note makes no sound.
- **Ruler and playhead.** A timeline strip above the grid scrolls with it. It shows bar numbers, beat counts (1 & 2 &…) and the loop region. Tap or drag it to move the playhead, a green line drawn through both the ruler and the grid. Tapping it while playing jumps there and playback carries on.
- **Transport (MPC style).** **Play** starts or resumes from the playhead. If the loop is on and the playhead is outside it, Play starts at the loop start. **From start** plays from the loop's first step when the loop is on, or from the top of the track when it is off. **Stop** leaves the playhead where it stopped, and pressing Stop again returns it to the start. When playback reaches the end of the track with the loop off, it stops and the playhead goes back to the start.
- **Edit cursor vs playhead.** The teal box is where you edit, and the green line is where playback starts. While stopped, moving the edit cursor brings the playhead with it, so Play starts where you're working. During playback, editing never moves the playhead. The ruler moves only the playhead. Each track's playhead is remembered in this browser and is not included in exports.
- **Loop.** Mark start and end measures and toggle the loop on or off.
- **Playback.** A plucked-string synth plays each note at its exact tick using the track's tuning plus the fret. Placing a note previews it. Sound unlocks on your first tap.
- **Saving.** Everything saves in this browser automatically. Export one project or the whole library as `.json`. Import can either merge into your library or replace it, and it asks first. Copy the tab as plain text.

## Moving work between phone and computer

Saved work lives in the browser you used, on that device and at this web address. Clearing site data removes it, so **export is your real backup**. On a phone, the export lands in Downloads, and from there you can save it to Drive or email it to yourself. Where the browser supports it, Share sends the file straight to another app. On the other device, use Import and choose Merge.

## File format (schemaVersion 3)

The format is MIDI-ready: times are in ticks at 480 per quarter note (PPQ 480), and pitches are MIDI note numbers. Notes sit at absolute ticks and don't depend on the grid.

```jsonc
{
  "schema": "jlr-guitar-tab",
  "schemaVersion": 3,
  "kind": "project",            // or "library"
  "ppq": 480,
  "exportedAt": "2026-10-23T06:00:00.000Z",
  "activeProjectId": "…",
  "projects": [{
    "id": "…", "title": "Song", "bpm": 90,
    "grid": { "value": "eighth", "dotted": false, "tuplet": null },   // tuplet: { "actual": 3, "normal": 2 } for triplets
    "createdAt": "…", "updatedAt": "…", "activeTrackId": "…",
    "tracks": [{
      "id": "…", "name": "Guitar",
      "tuning": { "id": "drop-d", "name": "Drop D (DADGBE)", "midi": [64, 59, 55, 50, 45, 38] },
      "timeSignature": [4, 4],
      "loop": { "enabled": false, "startMeasure": 1, "endMeasure": 1 },
      "lengthTicks": 3840,
      "notes": [
        { "string": 6, "fret": 0,    "startTick": 0,   "durationTicks": 240, "techniques": [] },
        { "string": 3, "fret": 7,    "startTick": 240, "durationTicks": 480, "techniques": [] },
        { "string": 5, "fret": null, "startTick": 720, "durationTicks": 240, "techniques": ["muted"] }
      ]
    }]
  }]
}
```

- **Tuning:** `tuning.midi` lists strings 1→6, from high e down to low E (standard is 64 59 55 50 45 40). A note's pitch is `midi[string-1] + fret`. Tuning names such as "EADGBE" follow the usual low-to-high spelling.
- **Ticks:** whole 1920, half 960, quarter 480, eighth 240, sixteenth 120. Dotted is ×1.5. A tuplet is ×normal/actual, so a triplet eighth is 160. Grid steps restart at every barline, so a dotted grid that doesn't divide the bar evenly ends the bar with a shorter step.
- **Durations:** `durationTicks` is derived and recalculated on every change. A note lasts until the next note starts on any string, capped at one bar and at the end of the track. `lengthTicks` is always a whole number of bars.
- **Notes:** each note has `string` 1–6 and `fret` 0–16. `fret: null` is a muted note and carries `"muted"` in `techniques`. Allowed techniques are muted, hammer-on, pull-off, slide, bend, vibrato, palm-mute, harmonic, tap and let-ring. A string can't have two notes at the same `startTick`. Notes are sorted by `startTick`, then by string.
- **Loop:** measures are numbered from 1, and `endMeasure` is included.
- **Not in files:** the playhead position is kept per track in this browser only.
- **Import rules:** files are checked before anything changes. Merge keeps everything you have and adds new projects. An identical copy of a project you already have is skipped, and a changed copy is added as "(imported)". Replace swaps the whole library after a second confirm.
- **Older versions:** schemaVersion 2 files (step lists) are converted on import. Each step's events become notes at that step's absolute tick, and the project grid is set to the most common step length. Version 1 single-tab files become quarter-note notes on a quarter grid. A library saved in this browser by an older version is upgraded on load, and the original is kept once under `jlr-guitar-tab:library-v2-backup` (or `-v1-backup`).

## Licence

MIT. See [LICENSE](LICENSE).
