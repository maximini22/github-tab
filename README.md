# Guitar Tab (scaffold)

A small guitar tab editor that runs in your browser, on a phone or a desktop. Part of the Jeremy Legal Records toolkit, styled like the Royalty Dashboard.

- Six strings, with a tuning picker: Standard (EADGBE), Drop D, Drop C, D Standard, Eb / half-step down, Open G, Open D and DADGAD.
- Tap a string at a step and pick a fret from 0 to 16. The picker shows fretboard inlay dots (3, 5, 7, 9, 15, and a double dot at 12) so you can find a fret by its dot or its number. There is also a muted (x) option and a clear.
- Add and remove steps, edit the title, and see the tab as plain text you can copy.
- Saves to this browser as you type and restores when you come back.
- Export downloads the tab as a `.json` file. Import loads one back, after checking it and asking before it replaces the current tab.
- Installs as an app and opens offline after the first visit.

## Saving and moving tabs

Your tab is saved in this browser only. Clearing site data, private windows, or a different browser or device will not see it. Export is the real backup: on a phone the file goes to Downloads, and from there you can save it to Drive or send it by email. Import it on any other device to keep going.

## File format

```json
{
  "schema": "jlr-guitar-tab",
  "version": 1,
  "title": "Riff",
  "tuning": "drop-d",
  "columns": [[null, null, null, 0, 0, 0], [null, null, null, 2, 2, "x"]],
  "createdAt": "2026-10-23T05:50:00.000Z",
  "updatedAt": "2026-10-23T05:55:00.000Z",
  "exportedAt": "2026-10-23T05:56:00.000Z"
}
```

Each column lists strings from string 1 (highest) to string 6 (lowest). A value is a fret number from 0 to 16, `"x"` for muted, or `null` for empty.

## Run it

Static files, no build step. Serve the folder with any static server, for example `python3 -m http.server`, and open it in a browser.

## Licence

MIT. See [LICENSE](LICENSE).
