# Status

_Last updated: 2026-10-17 (session 2)_

## Where we are

Milestones 1–3 are done: storage, adding albums, and the iTunes 10 window.

- Window (`src/App.svelte` + `src/components/`): toolbar with Save/Export/Import
  where the playback controls were, the LCD display (selected album, or the
  unsaved-changes count), List/Grid switcher and search; source list (Music,
  Recently Added = last 30 days, Playlists = tags); Genres | Artists | Albums
  column browser; sortable striped list or cover grid; status bar with "+"
  and the album count. Look and colors live in `src/app.css`.
- Keyboard: arrows move the selection (columns, list, grid), Enter opens in
  Spotify, Delete/Backspace removes (with a confirm). Double-click opens too.
- "+" opens the add form as a sheet (`AddAlbum.svelte`); title + cover come
  from a pasted Spotify link (oEmbed), everything else is typed by hand.
- Browse logic (search, columns, sorting) is pure and tested in `src/lib/browse.ts`.
  Sorting ignores a leading "The", like iTunes. Missing values sort last.
- View and sort preferences are kept in localStorage.
- 41 unit tests pass, `svelte-check` is clean. Clicked through in Firefox.

## Next step

Milestone 4: Get Info dialog (⌘I) for editing, multi-selection and bulk
edits, inline star ratings, genre management. See `PLAN.md`. Until then
there's no way to edit an album or set tags (so playlists stay empty).

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
