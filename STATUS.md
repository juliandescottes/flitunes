# Status

_Last updated: 2026-10-21_

## Where we are

The MVP is done (milestones 1–4): storage, adding albums, the iTunes 10
window, and Get Info editing.

- Window (`src/App.svelte` + `src/components/`): toolbar (playback buttons
  when signed in to Spotify, LCD, Spotify and link toggles, List/Grid,
  search), source list (Music, Recently Added = last 30 days, Playlists =
  tags) ending with "+ Add Album(s)" and Save / Export / Import, Genres |
  Artists | Albums column browser, striped list or cover grid, status bar
  with the album count (and the sidebar's buttons on narrow screens). Look
  and colors live in `src/app.css`.
- Selection: click, ⌘/Ctrl-click to toggle, Shift-click or Shift-arrows for a
  range, ⌘A selects all. Enter or double-click opens the album (its tracks
  when signed in to Spotify, else the Spotify app), Delete removes.
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
  are accepted; a toolbar toggle hides albums without a Spotify link; "+ Add Album(s)"
  and Save / Export / Import sit at the bottom of the sidebar; double-click or Enter in the
  Albums column opens the album; the app is called **FliTunes**, tinted pink.
- Since then (PRs #17–#19): the favicon is a white note on a pink tile; the
  column browser and the toolbar display can't be text-selected.
- Album List view (like iTunes 10's): a third button between List and Grid
  shows the list with taller rows and each album's cover on the left
  (`AlbumList.svelte` with `covers`). It is the default view; List stays for
  dense curating.
- Performance (PR #11): lists, grid and column browser only render the rows in
  view (`src/lib/virtual.ts`), and `browse()` sorts the library once and
  filters afterwards. With 3000 albums every interaction takes under 25 ms.
  `src/lib/mock.ts` / `scripts/mock-library.ts` make mock libraries;
  `browse.perf.test.ts` keeps budgets.
- Optional Spotify sign-in: a Spotify toggle next to
  the link filter in the toolbar, when a client ID is configured; OAuth PKCE in `src/lib/spotify-auth.ts`,
  reactive state and Web API calls in `src/lib/spotify-session.svelte.ts`.
- Playback: previous/play-pause/next in the toolbar; the display shows the playing track
  and its progress (`src/lib/spotify-player.svelte.ts`).
- Album details: signed in, double-click or Enter shows the album's tracks
  (`AlbumTracks.svelte`, `src/lib/spotify-tracks.ts`); double-click a track to
  play the album from there. Play is explicit: ▶ on list rows, a translucent
  ▶ over grid covers on hover, "Play" in the context menu.
- Sign-in and playback confirmed with a real Spotify app on 2026-10-21
  (dev, `http://127.0.0.1:5173/`).
- 96 unit tests pass, `svelte-check` is clean.
- GitHub Pages: `.github/workflows/pages.yml` tests, builds and deploys on
  every push to `main` (needs Settings → Pages → Source: GitHub Actions).
  Pages is the everywhere-viewer; curation happens locally, then push.

## Next step

The Spotify work (sign-in, playback, album tracks) is merged. For it to show
on the Pages site, the repository variable `SPOTIFY_CLIENT_ID` must be set and
the Pages URL listed as a redirect URI in the Spotify app.

Next feature: friends' libraries, in three PRs:
1. Strict validation when loading `library.json` (`spotify` must be a
   `spotify:album:` or `spotify:playlist:` URI, `cover` an `https:` URL).
2. `?library=<url>` in the page address, overriding `VITE_LIBRARY_URL`.
3. One IndexedDB working copy per library URL (the default keeps
   `album-library`).

Still open from Phase 2: smart playlists, Cover Flow, "Refresh cover".

The library import (Last.fm, Spotify links, early years by artist) is notes
and scripts in the git-ignored `import/` folder: see `import/README.md`.

## Decisions

| Date | Decision |
|---|---|
| 2026-10-17 | Library curated by hand. Spotify is only a link. No Spotify login in the MVP. |
| 2026-10-17 | IndexedDB working copy + `data/library.json` committed to the repo (moved to its own repo on 2026-10-18). |
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
