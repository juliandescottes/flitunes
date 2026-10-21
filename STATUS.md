# Status

_Last updated: 2026-10-21_

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
- Since then (PRs #3–#11): the column browser is resizable; playlist links
  are accepted; a toolbar toggle hides albums without a Spotify link; "+ Add to
  Library" sits at the bottom of the sidebar; double-click or Enter in the
  Albums column opens the album; the app is called **FliTunes**, tinted pink,
  with a pink note favicon.
- Performance (PR #11): lists, grid and column browser only render the rows in
  view (`src/lib/virtual.ts`), and `browse()` sorts the library once and
  filters afterwards. With 3000 albums every interaction takes under 25 ms.
  `src/lib/mock.ts` / `scripts/mock-library.ts` make mock libraries;
  `browse.perf.test.ts` keeps budgets.
- Optional Spotify sign-in (branch `spotify-login`): "Connect Spotify" in the
  toolbar when a client ID is configured; OAuth PKCE in `src/lib/spotify-auth.ts`,
  reactive state and Web API calls in `src/lib/spotify-session.svelte.ts`.
- Playback (branch `spotify-playback`, on top of `spotify-login`): signed in,
  double-click plays the album on the active device; previous/play-pause/next
  in the toolbar; the display shows the playing track and its progress
  (`src/lib/spotify-player.svelte.ts`).
- Album details (branch `spotify-tracks`, on top of `spotify-playback`):
  "Show Tracks" in the context menu shows the album's tracks
  (`AlbumTracks.svelte`, `src/lib/spotify-tracks.ts`); double-click a track to
  play the album from there.
- Sign-in and playback confirmed with a real Spotify app on 2026-10-21
  (dev, `http://127.0.0.1:5173/`).
- 84 unit tests pass, `svelte-check` is clean.
- GitHub Pages: `.github/workflows/pages.yml` tests, builds and deploys on
  every push to `main` (needs Settings → Pages → Source: GitHub Actions).
  Pages is the everywhere-viewer; curation happens locally, then push.

## Next step

Open question: which gesture opens an album's tracks (now only the context
menu; double-click plays). Set the `SPOTIFY_CLIENT_ID` repository variable
for the Pages build.

To try the sign-in for real: create (or reuse) an app in the Spotify developer
dashboard, add `http://127.0.0.1:5173/` and the Pages URL as redirect URIs,
put its client ID in `.env.local` and in the repository variable
`SPOTIFY_CLIENT_ID`.

The library import (Last.fm, Spotify links, early years by artist) is notes
and scripts in the git-ignored `import/` folder: see `import/README.md`.

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
| 2026-10-18 | Code changes go through PRs; the user pushes, opens PRs and files issues. |
| 2026-10-18 | Content apart from code: `library.json` moved to its own repo, `spotify-viewer-album-library` (history kept). The site fetches it from there; dev reads/writes a clone next to the app. |
| 2026-10-21 | Optional Spotify sign-in (OAuth PKCE, no backend) for playback control only. Spotify data shown while signed in is fetched live, never saved; the library stays hand curated. |

## Known issues / notes

- TypeScript pinned to 6.x until `svelte-check` supports 7.
- Multiple artists are entered separated by ";" (names can contain commas).
- Spotify Development Mode (2026): up to 5 allow-listed accounts per app, owner
  needs Premium, and some Web API endpoints were removed. The ones used here
  (`/me`, `/me/player*`, `/albums/{id}/tracks`) aren't in the removed list, but
  check Spotify's changelog if a call starts failing.
- Spotify oEmbed is public but undocumented.
  Always allow manual entry as a fallback.
