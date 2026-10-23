# Guitar Tab

Guitar Tab lets you catch a guitar idea as tab on your phone before it's gone. It runs in your browser, with no subscription and no account, and nothing goes online. From Jeremy Legal Records.

**Open it:** https://jeremylegalrecords.com/guitar-tab/app/ · About: https://jeremylegalrecords.com/guitar-tab/

The old address (https://maximini22.github.io/github-tab/) still works. Saved work doesn't carry over between addresses: Export there, Import at the new one.

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

### Publishing to jeremylegalrecords.com/guitar-tab/

This repo is the source. The live copy is the `guitar-tab/` folder of the site repo, maximini22/jeremylegalrecords.com (served by GitHub Pages, the same way as `/royalty-dashboard/`). To publish:

```sh
git clone https://github.com/maximini22/jeremylegalrecords.com ../jlr-site   # once
scripts/publish-to-jlr.sh ../jlr-site
cd ../jlr-site && git status   # review, then commit and push guitar-tab/ only
```

The script replaces `guitar-tab/` in the site repo with `index.html`, `og.png`, `css/`, `assets/`, `icons/`, `app/` and `LICENSE`, then makes the site-only edits:

- removes the "Now at jeremylegalrecords.com" banner
- swaps the app's "Now at" note for an "Export at the old address, Import here" note
- renames the offline cache to `jlr-guitar-tab-*`

It never touches anything outside `guitar-tab/`, and it skips `robots.txt`, the root `sw.js` (which clears old v3 caches on github.io), `docs/` and `tests/`.

## Licence

MIT. See [LICENSE](LICENSE).
