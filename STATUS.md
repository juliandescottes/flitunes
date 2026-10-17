# Status

_Last updated: 2026-10-17_

## Where we are

Milestone 1 (storage foundation) is done and committed. The app runs, but the
UI is a temporary shell (`src/App.svelte`): a plain album list, a minimal
add form (title/artist/year) and the save/download/import buttons. It
exists only to exercise the store.

- 18 unit tests pass, `svelte-check` is clean, and the build works.
- The dev save endpoint was verified manually: it rejects invalid files and
  non-JSON or cross-origin requests, and normalizes valid files.
- **Not yet clicked through in a real browser.**

## Next step

Milestone 2: adding albums from a pasted Spotify link (oEmbed → title + cover,
iTunes → artist/year/genre suggestions). See `PLAN.md`.

## Decisions

| Date | Decision |
|---|---|
| 2026-10-17 | Library curated by hand. Spotify is only a link. No Spotify login in the MVP. |
| 2026-10-17 | IndexedDB working copy + `data/library.json` committed to the repo. |
| 2026-10-17 | UI: Svelte 5 (plain Vite, no SvelteKit). |
| 2026-10-17 | Genres: flat, curated list. |
| 2026-10-17 | One entry per edition. Compilations → artist "Various Artists". |
| 2026-10-17 | Covers: store URLs only. |
| 2026-10-17 | Last.fm import deferred (scraping is blocked; would need an API key). |

## Known issues / notes

- TypeScript pinned to 6.x until `svelte-check` supports 7.
- Spotify oEmbed doesn't return the artist, which is why the iTunes lookup exists.
- The external endpoints (oEmbed, iTunes Search) are public but undocumented.
  Always allow manual entry as a fallback.
