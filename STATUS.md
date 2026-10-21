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
- Triage: albums tagged `triage` (`TRIAGE_TAG`, for bulk imports to review)
  show only in a "Triage" source with a count badge, and are hidden from
  Music, Recently Added, playlists and search. Accept (button, ⌘↩ or the
  context menu) removes the tag; Delete rejects. The source shows while
  albums wait in it.
- Spotify listening history: `scripts/spotify-history/` (TypeScript, see its
  README) counts album listens in an "Extended streaming history" export,
  finds the albums from Spotify's public pages (paced, resumable), and adds
  them tagged `triage`, ordered by plays. Ported from the one-off Python
  scripts used for the 2026-10-21 import (1,951 albums), same output.
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
- Routes: the source, column picks, search and open tracks are in the URL
  hash (`#/playlist/vinyl?genre=jazz&q=blue`, `src/lib/route.ts`), so Back
  and Forward walk through them and a reload keeps the place. A search adds
  one history entry, not one per key.
- Performance (PR #11): lists, grid and column browser only render the rows in
  view (`src/lib/virtual.ts`), and `browse()` sorts the library once and
  filters afterwards. With 3000 albums every interaction takes under 25 ms.
  `src/lib/mock.ts` / `scripts/mock-library.ts` make mock libraries;
  `browse.perf.test.ts` keeps budgets.
- Optional Spotify sign-in: a Spotify toggle next to
  the link filter in the toolbar, when a client ID is configured; OAuth PKCE in `src/lib/spotify-auth.ts`,
  reactive state and Web API calls in `src/lib/spotify-session.svelte.ts`.
- Playback: previous/play-pause/next in the toolbar; the display shows the playing track
  and its progress (`src/lib/spotify-player.svelte.ts`). A disc at the
  display's right edge opens the playing album's tracks (matched by the
  playback context, then the track's album); it stays there during playback
  and is dimmed when the album isn't in the library or is already shown.
- Devices (PR #25): a screen button after the transport buttons lists the
  Spotify devices and moves playback to the one picked. A 404 on a player
  command (idle device) is retried on a device by id, which wakes it up.
- Themes (PR #32): Pink, Silver, Mint Green, Fresh Blue, Lavender, picked
  from a swatch next to Import (`src/lib/themes.ts`). Every tinted CSS color
  is `oklch(L calc(C * var(--tint)) var(--hue))`, so a theme is a hue and a
  chroma scale; semantic colors (errors, warnings) keep their own. The
  favicon follows the theme. Gold (turns brown under white text) and a grey
  "Carbon" (too close to Silver) were tried and dropped.
- Spotify robustness (PR #31 and after): a response body that isn't JSON
  counts as empty (previous/next answer 200 with one), and the console logs
  every Web API call, token refresh, retry and player change as
  `[Spotify]` debug messages, to diagnose the idle-device problem.
- Album details: signed in, double-click or Enter shows the album's tracks
  (`AlbumTracks.svelte`, `src/lib/spotify-tracks.ts`); double-click a track to
  play the album from there. Play is explicit: ▶ on list rows, a translucent
  ▶ over grid covers and over the tracks view's cover on hover, "Play" in the
  context menu. The playing track has a pink speaker left of its number
  (with sound waves while playing). Esc or the browser's Back returns.
  Columns like iTunes 10's song list: # / Name / Time / Artist / Album /
  Genre / Year (not sortable). Album, genre and year come from the curated
  album (Spotify's release year if it has none); the artist is the curated
  one unless Spotify lists others on the track.
- Sign-in and playback confirmed with a real Spotify app on 2026-10-21
  (dev, `http://127.0.0.1:5173/`).
- 130 unit tests pass, `svelte-check` is clean.
- GitHub Pages: `.github/workflows/pages.yml` tests, builds and deploys on
  every push to `main` (needs Settings → Pages → Source: GitHub Actions).
  Pages is the everywhere-viewer; curation happens locally, then push.

## Next step

Friends can run their own copy: `README.md` has the guide for forks, and
the Pages build reads the `LIBRARY_URL` repository variable, else the fork
owner's `flitunes-library`. MIT license. The Pages site has
`SPOTIFY_CLIENT_ID` set (checked 2026-10-21).

Covers are kept with the library (2026-10-21): the 2,494 covers were copied
from Spotify into `flitunes-library/covers/` (`scripts/covers/`, 304 MB), and
`library.json` points at them (`"covers/<album id>.jpg"`). `flitunes-library`
is served by GitHub Pages; the app's `LIBRARY_URL` variable is
`https://juliandescottes.github.io/flitunes-library/library.json`, and
covers resolve next to it. `library.json` is validated strictly, on load and
on edit. In dev, a new album's cover is copied into `covers/` right away
(`POST /__library/covers`); covers added on the site stay URLs until
`scripts/covers/` runs.

Installable as an app: `public/manifest.webmanifest` and icons made from the
favicon. On macOS, with Firefox, it runs as an app through PWAsForFirefox
(own Dock icon, no browser chrome; installed 2026-10-22).

Next, in order (see `PLAN.md`):
1. Ownership, the first step towards owning the music (`docs/spec.md` §11):
   how I own an album and a store link, with a "not owned yet" view.
2. Smart playlists, "Refresh cover" (less urgent now that covers are kept),
   Cover Flow.

Open: the first Spotify command after a while idle sometimes does nothing,
with no error. The `[Spotify]` console log should show whether a request
hangs, the device ignores the command, or the token refresh is slow.

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
| 2026-10-17 | Scope: an old-school iTunes 10 experience, plus a few import paths, and not much more. Tags show as playlists. Embedded player and track lists dropped (track lists came back on 2026-10-21 with the Spotify sign-in). |
| 2026-10-17 | Last.fm import deferred (scraping is blocked; would need an API key). |
| 2026-10-18 | Code changes go through PRs; the user pushes, opens PRs and files issues. |
| 2026-10-18 | Content apart from code: `library.json` moved to its own repo, `spotify-viewer-album-library` (history kept; renamed `flitunes-library` on 2026-10-21). The site fetches it from there; dev reads/writes a clone next to the app. |
| 2026-10-21 | Optional Spotify sign-in (OAuth PKCE, no backend) for playback control only. Spotify data shown while signed in is fetched live, never saved; the library stays hand curated. |
| 2026-10-21 | Themes change the tint only (hue and chroma); no full palettes per theme. |
| 2026-10-21 | Repos renamed: the app is `flitunes`, the library `flitunes-library`. The site moves to `/flitunes/`; IndexedDB and storage keys keep the `album-library` names so local data survives. |
| 2026-10-21 | Covers kept with the library: original 640px files in `flitunes-library/covers/`, referenced by relative path; the library repo is served by GitHub Pages (Cloudflare Pages is the fallback for speed or a custom domain). |
| 2026-10-21 | Friends run their own fork (README guide), not one shared site with `?library=<url>`: each needs their own Spotify app anyway. MIT license. |
| 2026-10-21 | Long-term direction: own the music (DRM-free purchases) and play it from my own Subsonic server (e.g. Navidrome), FliTunes as the front end, Spotify as the fallback (`docs/spec.md` §11). |

## Known issues / notes

- TypeScript pinned to 6.x until `svelte-check` supports 7.
- Multiple artists are entered separated by ";" (names can contain commas).
- Spotify Development Mode (2026): up to 5 allow-listed accounts per app, owner
  needs Premium, and some Web API endpoints were removed. The ones used here
  (`/me`, `/me/player*`, `/albums/{id}/tracks`) aren't in the removed list, but
  check Spotify's changelog if a call starts failing.
- Spotify oEmbed is public but undocumented.
  Always allow manual entry as a fallback.
