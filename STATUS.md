# Status

_Last updated: 2026-10-17 (session 2)_

## Where we are

The MVP is done (milestones 1–4): storage, adding albums, the iTunes 10
window, and Get Info editing.

- Window (`src/App.svelte` + `src/components/`): toolbar (Save/Export/Import,
  LCD, List/Grid, search), source list (Music, Recently Added = last 30 days,
  Playlists = tags), Genres | Artists | Albums column browser, striped list
  or cover grid, status bar with "+". Look and colors live in `src/app.css`.
- Selection: click, ⌘/Ctrl-click to toggle, Shift-click or Shift-arrows for a
  range, ⌘A selects all. Enter or double-click opens in Spotify, Delete removes.
- Type-ahead: typing letters in the list or grid jumps to the first album whose
  sorted column starts with them (name when sorted by rating or date added).
- Get Info (⌘I or right-click): one album → Info and Artwork tabs with
  Previous / Next (saves and moves on); several → Multiple Item Information,
  where only ticked fields apply and playlists can be added or removed.
- Ratings: click the stars right in the list (click the same star to clear).
- Genres: double-click or right-click a genre in the column browser to rename
  it; renaming to an existing genre's name offers to merge. Delete is in the
  right-click menu. (Unused genres don't show in the column browser.)
- Unsaved changes: Save turns blue, the tab title shows the count, ⌘S saves
  (to the repo in dev, as a download otherwise).
- Add sheet uses the same genre/playlist chips (`ChipInput.svelte`, `fields.ts`).
- Add Several (`AddSeveral.svelte`): paste several Spotify links (or click
  "Add Several…"), look them up 4 at a time, then fill in artists and years
  in a table. Genres and playlists apply to all; links already in the library
  start unticked. Added with `library.addAlbums` (one write, one change).
- Import CSV (`ImportCsv.svelte`, parser in `src/lib/csv.ts`): from the Add
  sheet. Needs album and artist columns (year, plays, spotify optional, found
  by header name). Rows start unticked; a play-count filter and "Tick All
  Shown" narrow long lists. Albums matching one already in the library
  (`albumMatchKey`: artist + title, ignoring case, accents and punctuation)
  are marked and never ticked in bulk.
- Browse logic is pure and tested in `src/lib/browse.ts`; the store gained
  `updateAlbums` (bulk) and `mergeGenre`.
- 52 unit tests pass, `svelte-check` is clean. Clicked through in Firefox
  (except ⌘S, to avoid writing `data/library.json` from a test session).
- GitHub Pages: `.github/workflows/pages.yml` tests, builds and deploys on
  every push to `main` (needs Settings → Pages → Source: GitHub Actions).
  Pages is the everywhere-viewer; curation happens locally, then push.

## Next step

In progress: one-off bulk import of Spotify links for the 666 albums imported
from Last.fm. Notes, scripts and data live in the git-ignored `import/`
folder: start with `import/README.md`.

Then: Phase 2 in `PLAN.md`: smart playlists, Cover Flow. Or start curating the real library and fix what gets in the way.

## Decisions

| Date | Decision |
|---|---|
| 2026-10-17 | Library curated by hand. Spotify is only a link. No Spotify login in the MVP. |
| 2026-10-17 | IndexedDB working copy + `data/library.json` committed to the repo. |
| 2026-10-17 | UI: Svelte 5 (plain Vite, no SvelteKit). |
| 2026-10-17 | Genres: flat, curated list. |
| 2026-10-17 | One entry per edition. Compilations → artist "Various Artists". |
| 2026-10-17 | Covers: store URLs only. |
| 2026-10-17 | Everything hand curated: no metadata lookups (iTunes Search removed). "iTunes-style" = the 2010 iTunes 10 UI only. |
| 2026-10-17 | Scope: an old-school iTunes 10 experience, plus a few import paths, and not much more. Tags show as playlists. Embedded player and track lists dropped. |
| 2026-10-17 | Last.fm import deferred (scraping is blocked; would need an API key). |

## Known issues / notes

- TypeScript pinned to 6.x until `svelte-check` supports 7.
- Multiple artists are entered separated by ";" (names can contain commas).
- Spotify oEmbed is public but undocumented.
  Always allow manual entry as a fallback.
