# Guitar Tab

A phone-first guitar tab writer from Jeremy Legal Records. It's one static page with no build step, no backend and no account. It installs as an app (PWA) and works offline.

**Open it:** https://maximini22.github.io/github-tab/

## What it does

- **Projects and tracks.** A library holds many projects. Each project has a title and one or more named tracks, and every track has its own tuning (Standard, Drop D, Drop C, D Standard, Eb, Open G, Open D, DADGAD) and time signature.
- **Vertical fret picker.** Tap a string at a step and a neck opens. Frets 0–16 run top to bottom, with single inlay dots at 3, 5, 7 and 9 and a double dot at 12. It also has Muted (x) and Clear, string switching, and a note length.
- **Rhythm.** Each step has a length: whole, half, quarter, eighth or sixteenth, optionally dotted or a triplet. Lengths show under the tab. Beams join eighths and sixteenths within a beat, brackets mark triplets, and barlines fall where the measures do.
- **Loop.** Mark start and end measures and toggle the loop on or off.
- **Playback.** A plucked-string synth plays notes from the track's tuning plus the fret. Tapping a fret previews the note, Play runs the track at your BPM, and with the loop on it repeats the loop region. Sound unlocks on your first tap.
- **Saving.** Everything saves in this browser automatically. Export one project or the whole library as `.json`. Import can either merge into your library or replace it, and it asks first. Copy the tab as plain text.

## Moving work between phone and computer

Saved work lives in the browser you used, on that device and at this web address. Clearing site data removes it, so **export is your real backup**. On a phone, the export lands in Downloads, and from there you can save it to Drive or email it to yourself. Where the browser supports it, Share sends the file straight to another app. On the other device, use Import and choose Merge.

## File format (schemaVersion 2)

The format is MIDI-ready: times are in ticks at 480 per quarter note, and pitches are MIDI note numbers.

```jsonc
{
  "schema": "jlr-guitar-tab",
  "schemaVersion": 2,
  "kind": "project",            // or "library"
  "ppq": 480,
  "exportedAt": "2026-10-23T06:00:00.000Z",
  "activeProjectId": "…",
  "projects": [{
    "id": "…", "title": "Song", "bpm": 90,
    "createdAt": "…", "updatedAt": "…", "activeTrackId": "…",
    "tracks": [{
      "id": "…", "name": "Guitar",
      "tuning": { "id": "drop-d", "name": "Drop D (DADGBE)", "midi": [64, 59, 55, 50, 45, 38] },
      "timeSignature": [4, 4],
      "loop": { "enabled": false, "startMeasure": 1, "endMeasure": 1 },
      "lengthTicks": 1920,
      "steps": [{
        "id": "…",
        "duration": { "value": "eighth", "dotted": false, "tuplet": { "actual": 3, "normal": 2 } },
        "startTick": 0, "durationTicks": 160,
        "events": [
          { "string": 3, "fret": 7, "startTick": 0, "durationTicks": 160, "techniques": [] },
          { "string": 6, "fret": null, "startTick": 0, "durationTicks": 160, "techniques": ["muted"] }
        ]
      }]
    }]
  }]
}
```

- **Tuning:** `tuning.midi` lists strings 1→6, from high e down to low E (standard is 64 59 55 50 45 40). A note's pitch is `midi[string-1] + fret`.
- **Ticks:** whole 1920, half 960, quarter 480, eighth 240, sixteenth 120. Dotted is ×1.5. A tuplet is ×normal/actual, so a triplet eighth is 160. `startTick` is absolute from the start of the track. Steps run back to back, and every event in a step shares its start and length.
- **Events:** `string` is 1–6 and `fret` is 0–16. `fret: null` is a muted note and carries `"muted"` in `techniques`. Allowed techniques are muted, hammer-on, pull-off, slide, bend, vibrato, palm-mute, harmonic, tap and let-ring.
- **Loop:** measures are numbered from 1, and `endMeasure` is included.
- **Import rules:** files are checked before anything changes. Merge keeps everything you have and adds new projects. An identical copy of a project you already have is skipped, and a changed copy is added as "(imported)". Replace swaps the whole library after a second confirm. Older version 1 single-tab files are upgraded on import.

## Licence

MIT. See [LICENSE](LICENSE).
