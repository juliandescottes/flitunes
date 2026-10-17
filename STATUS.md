# Status

_Last updated: 2026-10-17 (session 2)_

## Where we are

Milestones 1 (storage foundation) and 2 (adding albums) are done. The UI is
still a temporary shell (`src/App.svelte`): header with save/download/import,
the add-album form (`src/components/AddAlbum.svelte`) and a plain album list.

- Add album: paste a Spotify link or URI → oEmbed fills title + 640px cover.
  Artist, year and genres are typed by hand. Genre chips (first = primary)
  with autocomplete and "create genre?", "Compilation" button, duplicate
  warning on the same Spotify URI. Works with no link too.
- Lookup code: `src/lib/spotify.ts`, tested in `src/lib/spotify.test.ts`
  with a stubbed `fetch`.
- 34 unit tests pass, `svelte-check` is clean.
- Clicked through in Firefox: paste link → lookup → create genre → add →
  duplicate warning all work, no console errors.

## Next step

Milestone 3: the iTunes 10 window (source list, column browser, list and
grid views, search, double-click to open in Spotify). See `PLAN.md`.

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
