# Guitar Tab

Guitar Tab lets you catch a guitar idea as tab on your phone before it's gone. It runs in your browser, with no subscription and no account, and nothing goes online. From Jeremy Legal Records.

**Open it:** https://maximini22.github.io/github-tab/app/ · About: https://maximini22.github.io/github-tab/

**User guide:** [docs/USER-GUIDE.md](docs/USER-GUIDE.md), which covers every control, export/import, tunings, the file format and the MIDI export plan.

## What it does

- **Up to 3 tracks on one grid.** The armed track is drawn in full, and the others show faint and colour-coded.
- **Layered playback** of all audible tracks, with per-track **volume, mute and solo**.
- **DAW-style controls:**
  - a transport (Back to start, Play/Pause, Stop, Loop, BPM)
  - a bar|beat ruler with a draggable playhead and loop brace
  - a Grid selector (1/1–1/16)
  - undo/redo
  - Space to play
- **Tap to tab.** Tap a lane for a vertical fretboard, and tap the same fret again to remove the note. Muted notes are supported.
- **Six tunings** per track: C standard, Drop C, D standard, Drop D, E standard and Open G.
- **Fits a phone screen.** Transport, ruler and grid are visible without scrolling, a pinned field holds idea notes, and everything else lives in the menu.
- **Projects saved in this browser**, with **Export project (.json)**, Export all, and Import (merge or replace). Files from earlier versions open fine.

## For developers

The app is static HTML, CSS and JS with no build step. The app itself is in `app/` and the about page is `index.html`. A headless round-trip test is in `tests/` (see the [user guide](docs/USER-GUIDE.md#automated-test)).

## Licence

MIT. See [LICENSE](LICENSE).
