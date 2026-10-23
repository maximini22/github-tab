# Rollback

## v9.1 → v9

v9.1 (lyrics sheet, section chips, Restart in the scheduler) keeps schemaVersion 5 and adds no new fields: the lyrics are
the existing notes field `idea`, now up to 5000 characters with line breaks (v9 allowed 500). Two annotated tags mark v9:

| Repo | Tag | Commit |
|---|---|---|
| maximini22/github-tab | `v9-stable` | `429abec` |
| maximini22/jeremylegalrecords.com | `guitar-tab-v9-stable` | `870b2d8` |

Roll back with the steps under "Roll back the live JLR copy" and "Roll back the GitHub Pages copy" below, using these
tags (`git rm -r -q guitar-tab && git checkout guitar-tab-v9-stable -- guitar-tab`, and
`git rm -r -q . && git checkout v9-stable -- .`). The v9 service worker (`guitar-tab-v9` / `jlr-guitar-tab-v9`) deletes
the v9.1 shell cache on activate; the Sound cache `gt-tones-v1` is shared and stays.

**What happens to lyrics** (checked by `tests/v91.mjs` against v9 and v7 worktrees):

- v9 and v7 both accept a saved library or file whose notes are up to 5000 characters (their validators already allowed
  5000) and open it; they keep only the **first 500 characters** of each project's notes. In v9 and v7 the notes field
  is one line, so line breaks aren't shown there; they're still in the data unless the notes are edited in that version
  (then the text is saved as one line, as typed).
- v9.1 also keeps a full copy of every project's lyrics longer than 500 characters under a separate browser key
  (`jlr-guitar-tab:lyrics-full`) that v9 and v7 don't touch. On going forward to v9.1 again, a project whose notes came
  back cut to exactly 500 characters, and still match the start of that copy, gets its full lyrics back. Other changes
  made in v9/v7 (BPM, notes on the tab…) are kept. If the notes were edited in the older version, that edit wins and the
  copy is not used.
- A `.json` exported from v9.1 keeps the full lyrics, so Export is still the safe backup before rolling back.
- Rolling back to v7 (below) behaves the same way: v7 opens the library and cuts each project's notes to 500 characters,
  and the backup copy restores them when you come forward to v9.1.

## v9 → v8.2

v9 (sampled Sounds per track) adds one optional per-track field, `tone`, and keeps schemaVersion 5. v8.2 ignores it, so
going back loses only each track's Sound choice (everything plays the v8.2 synth pluck again). Two annotated tags mark
v8.2:

| Repo | Tag | Commit |
|---|---|---|
| maximini22/github-tab | `v8.2-stable` | `3fd67d9` |
| maximini22/jeremylegalrecords.com | `guitar-tab-v8.2-stable` | `fb97602` |

Use the steps under "Roll back the live JLR copy" and "Roll back the GitHub Pages copy" below with these tags in place
of the v7 ones (`git rm -r -q guitar-tab && git checkout guitar-tab-v8.2-stable -- guitar-tab`, and
`git rm -r -q . && git checkout v8.2-stable -- .`). The rolled-back service worker (`guitar-tab-v8-2` /
`jlr-guitar-tab-v8-2`) deletes the v9 shell cache on activate; the Sound cache `gt-tones-v1` is left behind unused
(about 1 MB at most) and can be cleared from the browser's site settings.

## Rollback to v7

v7 is the last release before per-track feel, the chord library and the share fix (v8). Two annotated tags mark it:

| Repo | Tag | Commit |
|---|---|---|
| maximini22/github-tab | `v7-stable` | `a5a19b6` |
| maximini22/jeremylegalrecords.com | `guitar-tab-v7-stable` | `2fdaedf` |

A zip of the built v7 `guitar-tab/` folder (as published on jeremylegalrecords.com) is kept at
`/workspace/github-tab-rollback/guitar-tab-v7.zip`.

## v8.2 → v8.1

v8.2 (chord-detail neck low E on the left, no finger numbers, metronome click) adds one optional project field,
`metronome`, and keeps schemaVersion 5. v8.1 ignores the field, so going back loses only the click setting. The v8.1
release is github-tab `ba16b0a` and site `052da1d` (`git checkout 052da1d -- guitar-tab`).

## v8.1 → v8

v8.1 (movable power and barre chords, chart-order boxes) changes only the chord library and its tests; saved tabs and
files are unchanged (still schemaVersion 5), so going back to v8 loses nothing. The v8 release is github-tab `72c4661`
and site `7649724`: use the steps below with those commits in place of the v7 tags
(`git checkout 7649724 -- guitar-tab`).

## Roll back the live JLR copy (jeremylegalrecords.com/guitar-tab/)

Only `guitar-tab/` changes. Never touch `CNAME` or anything else in the site repo.

```sh
cd jeremylegalrecords.com            # a clone of maximini22/jeremylegalrecords.com
git fetch origin --tags
git checkout main && git pull --ff-only
git rm -r -q guitar-tab                              # drop files v8 added (e.g. guitar-tab/app/chords.json)
git checkout guitar-tab-v7-stable -- guitar-tab      # restore the v7 folder exactly
git status --short                                   # must list guitar-tab/ paths only
git -c user.name=maximini22 -c user.email=maximini22@users.noreply.github.com \
  commit -m "Roll back guitar-tab to v7 (guitar-tab-v7-stable)"
git push origin main
```

Without git history (from the zip):

```sh
cd jeremylegalrecords.com
rm -rf guitar-tab && unzip -q /workspace/github-tab-rollback/guitar-tab-v7.zip   # the zip holds guitar-tab/...
git add -A guitar-tab && git status --short          # guitar-tab/ paths only
git -c user.name=maximini22 -c user.email=maximini22@users.noreply.github.com commit -m "Roll back guitar-tab to v7" && git push origin main
```

## Roll back the GitHub Pages copy (maximini22.github.io/github-tab/)

Restore the v7 tree as a new commit (no force-push, history stays intact):

```sh
cd github-tab
git fetch origin --tags && git checkout main && git pull --ff-only
git rm -r -q . && git checkout v7-stable -- .        # working tree = v7 exactly
git -c user.name=maximini22 -c user.email=maximini22@users.noreply.github.com \
  commit -m "Roll back to v7 (v7-stable)"
git push origin main
```

To re-publish JLR from that state instead of the site-repo route above: `scripts/publish-to-jlr.sh /path/to/jeremylegalrecords.com`, then commit and push `guitar-tab/` in the site repo.

## After a rollback

- Pages takes a minute or two. Check `app/sw.js` on the live URL shows the v7 cache name
  (`guitar-tab-v7` on github.io, `jlr-guitar-tab-v7` on JLR), then reload the app once on the phone
  (the old service worker hands over on the first visit).
- **Saved tabs survive.** v8 keeps its own library under `jlr-guitar-tab:library-v5` and also writes a
  v7-readable copy to the v7 key `jlr-guitar-tab:library` on every save. After a rollback, v7 reads that copy:
  every note, track and setting comes back. The only thing v7 cannot hold is a different note style per
  track; v7 shows the whole project in the armed track's style (notes keep their exact positions).
- Files exported from v8 (schemaVersion 5) are refused by v7 with "Made by a newer version". Export from
  v8 *before* rolling back only if you need per-track styles; otherwise the local copy above is enough.
- Re-running the v7 tests: `git checkout v7-stable && cd tests && npm install && node midi.mjs && node roundtrip.mjs`.

## Performance: v7 baseline and v8

`tests/bench.mjs`, headless Chrome at 390×844, no CPU throttling, two tracks with a note on every beat plus
a chord per bar. render = one full redraw, edit = one note placed in the step editor. Median of 5 in-page
runs, then the median of 3 script runs.

| Case | Cells | v7 render | v7 edit | v8 render | v8 edit |
|---|---:|---:|---:|---:|---:|
| 16 bars, 1/16 | 1,536 | 42 ms | 45 ms | 40 ms | 41 ms |
| 16 bars, 1/64T | 9,216 | 231 ms | 260 ms | 216 ms | 220 ms |
| 64 bars, 1/16 | 6,144 | 157 ms | 164 ms | 151 ms | 153 ms |
| 64 bars, 1/64T | 36,864 | 1,003 ms | 984 ms | 928 ms | 916 ms |

A phone is slower than this desktop-class headless Chrome (expect roughly 3–5×); the table is for
comparing versions, not absolute numbers. v8 is the same or slightly faster in every case (within run-to-run
noise of about ±10%): per-track cells are computed once per render, and the chord library loads only when opened.
