# FliTunes — Spec & Technical Design (draft v2)

Status: draft, 2026-10-17. Personal tool, single user.

## 1. Why

Spotify is built around playlists and tracks. I listen to albums. I want an
old-school iTunes experience (iTunes 10, around 2010, before iCloud and Apple
Music) for my albums: browse by genre, artist and my own playlists, and open
the album in Spotify with a double-click. iTunes is the UI reference only,
never a data source.

## 2. Principles

- **Old-school iTunes, and not much more.** If iTunes 10 didn't do it, we
  probably don't either. The only additions are a few ways to import albums.
- **I curate the library by hand.** Spotify is not the source of truth. Each
  album just *links* to Spotify.
- **Local-first, no backend.** A static web app. The working copy lives in
  IndexedDB, and a JSON snapshot is committed to the repo for durability and history.
- **No Spotify login required to browse.** Browsing, curating and opening
  albums work with public, unauthenticated endpoints. Signing in to Spotify is
  optional and only adds playback control (§8). Spotify data shown while signed
  in (now playing, track lists) is fetched live and never saved to the library.

## 3. Non-goals (for now)

- Importing my Spotify library automatically.
- Track-level curation, multi-user, hosting for others.
- Anything iTunes 10 didn't have: embedded players, recommendations,
  metadata lookups, social features.

## 4. Core concepts

| Concept | Notes |
|---|---|
| **Album** | The core unit: title, artist(s), year, cover, Spotify link, genres, tags, rating, notes. |
| **Edition** | Each edition (original, deluxe, remaster, …) is its own album entry with its own Spotify link. There's no grouping. |
| **Artist** | Plain names on the album, plus an optional sort name ("Beatles, The"). There's no separate artist entity in v1. Compilations use a single artist called **"Various Artists"**, which shows up in the artist column like any other artist. |
| **Genre** | Flat, curated vocabulary that I manage myself, with no hierarchy. One primary genre and optional secondaries. Genres are always picked by hand; typing a new name offers "create genre?". |
| **Tag** | Free-form (`winter`, `vinyl-owned`, `to-listen`, …). Shown as **playlists** in the source list: an album can be in several. |
| **Smart playlist** | A saved filter, like iTunes Smart Playlists, e.g. `genre=Jazz AND year<1970 AND rating>=4`. |

## 5. Features

The target is the iTunes 10 window, with albums instead of songs.

### MVP
1. **Window layout** (iTunes 10)
   - Top bar: the "LCD" display in the center (shows the selected album),
     view switcher (List / Album grid), search field on the right.
   - **Source list** on the left: Library › Music, Recently Added, then
     Playlists (one per tag).
   - **Column browser** above the main view: Genres | Artists | Albums,
     each column with an "All (N)" row at the top.
   - **Main view**: a sortable list (Name, Artist, Year, Genre, Rating,
     Date Added) or a cover grid.
   - Status bar at the bottom: "N albums".
2. **Open in Spotify**: double-click or Enter opens `spotify:album:<id>`, or the album's tracks when signed in to Spotify (§8).
3. **Get Info** (⌘I): the edit dialog, with iTunes-style tabs (Info, Artwork),
   for one album or a multi-selection (bulk genre/tags/rating).
4. **Ratings**: 1–5 stars, editable inline in the list like iTunes.
5. **Search**: the top-right field filters instantly.
6. **Add / import**
   - "+ Add Album(s)" (bottom of the sidebar): paste a Spotify album link. oEmbed prefills the
     title and cover (§7); artist, year and genres are typed by hand. No
     metadata lookup service. Manual entry with no link works too.
     A playlist link is accepted as a fallback for albums Spotify doesn't
     have as an album (stored as `spotify:playlist:<id>`; oEmbed gives the
     playlist's name and cover).
   - Import / export `library.json` (§6).
7. **Persistence**: IndexedDB working copy plus `library.json` (§6).

### Phase 2
- Smart playlists with a rule editor (iTunes-style "Match all of the following rules"),
  listed in the source list after the playlists.
- Keyboard navigation (arrows, type-ahead, Enter = open in Spotify).
- Cover Flow view.
- More import paths, e.g. pasting several Spotify links at once, or a CSV.
- "Refresh cover" to re-fetch a dead cover URL via oEmbed.

### Later / maybe
- Owning the music and playing it from my own server (§11).
- (Done another way: Last.fm top albums came in through the CSV import, and
  saved Spotify albums through a script on the listening-history export,
  `scripts/spotify-history/`, instead of a Spotify login.)

## 6. Storage & persistence

```
IndexedDB (working copy)  ──export──▶  library.json (in its own data repo)
                          ◀──import──
```

- **IndexedDB** via Dexie. Every edit is saved immediately.
- **`library.json`** is the durable copy, in its own repo
  (`flitunes-library`) so content and code keep separate
  histories. Git gives history and diffs.
- **First run / empty DB**: the app loads `library.json`: from the local clone
  of the data repo in dev, from the data repo's raw URL (`VITE_LIBRARY_URL`)
  on the deployed site. A fresh browser or machine starts with my library.
- **Export options:**
  1. *Download JSON*. Works in every browser; I move the file into the repo myself.
  2. *Save to repo* (dev mode only). A tiny Vite dev-server plugin exposes
     `POST /__library` and writes `library.json` straight into the data repo clone. One click,
     any browser, and nothing exists in production builds. **← recommended**
  3. File System Access API (`showSaveFilePicker`) is Chromium-only. Skip it.
  4. *Commit from the site*. On the deployed site, Save commits `library.json`
     to the data repo through the GitHub REST API, with a fine-grained
     personal access token (that repo only, Contents: read and write) kept in
     the browser. The commit names the blob sha that was read, so a file
     changed elsewhere is never overwritten: it ends in the conflict prompt.
     (Issue #43; a Google Drive copy was set aside, see the PR.)
- **Conflict safety**: the export includes `exportedAt`. On startup, if the
  fetched `library.json` is newer than the last local edit, offer to load it.
  This handles editing on two machines via git pull.
- **Reminder**: show a "N unsaved changes since last export" badge.

### File format (git-diff friendly)

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-10-17T09:00:00Z",
  "genres": [{ "id": "jazz", "name": "Jazz" }],
  "albums": [
    {
      "id": "01JA...",                      // ULID, generated locally
      "title": "Kind of Blue",
      "artists": ["Miles Davis"],
      "artistSort": "Davis, Miles",
      "year": 1959,
      "genres": ["jazz"],                   // first = primary
      "tags": ["modal", "vinyl-owned"],
      "rating": 5,
      "notes": "",
      "spotify": "spotify:album:1weenld61qoidwYuZ1GESA",
      "cover": "https://image-cdn-ak.spotifycdn.com/image/ab67616d0000b273387a29c90de3b2398c29c34f",
      "addedAt": "2026-10-17T09:00:00Z"
    }
  ]
}
```

Albums are sorted by `id`, keys are in a fixed order, and the JSON is pretty-printed,
so adding or editing one album produces a small diff. If one album per line turns out
to diff better, a custom serializer is an easy switch.

## 7. External data sources (no auth, all verified CORS `*`)

| Source | Gives | Use |
|---|---|---|
| **Spotify oEmbed**<br>`https://open.spotify.com/oembed?url=<album url>` | album title, 300px cover URL, embed iframe | Primary for title + cover. |
| **Spotify image CDN** | the same image hash at other sizes: swap the prefix `ab67616d00001e02` (300px) for `ab67616d0000b273` (640px) | Store the 640px URL. |

oEmbed does **not** return the artist. That is fine: the library is hand curated,
so artist, year and genre are always typed in.
oEmbed is an undocumented-ish public endpoint. Treat it as a convenience: the
user can always type or paste values, including a manual cover URL.

## 8. "Play in Spotify"

- **Open in Spotify** links to `spotify:album:<id>`, which opens the desktop
  app on the album page (not playback). A secondary link to
  `https://open.spotify.com/album/<id>` opens the web player.
- **Optional: signing in to Spotify** (OAuth with PKCE, all in the browser, no
  client secret; `src/lib/spotify-auth.ts`) to control playback on the active
  device through the Web API: play an album, pause, skip, see what's playing.
  Needs Spotify Premium, and a Spotify app (developer dashboard) whose client ID
  is set at build time as `VITE_SPOTIFY_CLIENT_ID`; without one the feature is
  hidden. The app must list each address it runs on as a redirect URI
  (`http://127.0.0.1:5173/` in dev, the Pages URL). In Development Mode (2026
  rules), only up to 5 accounts added in the dashboard can sign in, and the
  app's owner needs Premium.
- **Gestures.** Signed out, double-click, Enter and the row/cover buttons open
  the album in the Spotify app. Signed in:
  - double-click or Enter opens the album's tracks (albums; a playlist link plays);
  - **Play** is explicit: the ▶ button on a list row (hover or selection), a
    translucent ▶ over the cover when hovering in the grid, or "Play" in the
    context menu. It plays on the active device, or on the first available one.
  - transport buttons sit left of the toolbar display, which shows the playing
    track like iTunes. The player state is polled every 5 s while the page is
    visible (Spotify doesn't push it).
- **Album details** (signed in): the album's cover, info and track list
  (`GET /albums/{id}/tracks`, cached for the session, never saved).
  Double-click or Enter on a track plays the album from that track; the
  playing track is marked. Esc, Back, a search or another source returns.

## 9. Tech stack

- **Svelte 5 + Vite + TypeScript** (plain Vite app, no SvelteKit). Static build,
  deployable to GitHub Pages if ever wanted.
- **Dexie** for IndexedDB, wrapped in a small store module that exposes Svelte
  runes-based reactive state to the UI.
- No backend. Only the dev-server plugin writes `library.json`.
- Covers: files in the library repo's `covers/` folder (copied once from
  their URLs by `scripts/covers/`), or `https:` URLs for covers not copied
  yet. No image files in the app repo.

## 10. Decisions

The decisions log lives in `STATUS.md`.

## 11. Long-term direction: owning the music

The goal is to move my library off Spotify: buy the albums DRM-free
(Bandcamp and other stores, CDs), serve them myself, and keep FliTunes as the
front end. The hand-curated library is already independent of Spotify, so
this adds a second way to play rather than a rebuild.

### What changes

- **Album links.** Today `spotify` is the only link. An album will carry
  several, each optional: Spotify, a store page (e.g. Bandcamp), and my own
  copy on the music server.
- **Ownership.** Each album records whether and how I own it (Bandcamp, CD,
  files…). "Not owned yet" becomes a view, or a smart playlist: the shopping
  list.
- **Covers.** Covers are Spotify image URLs (`i.scdn.co`) and would break if
  Spotify drops an album. They should come from my own copies or server, never
  as image files in the app repo.
- **Playback.** Owned albums play in the browser from the music server
  (`<audio>`; FLAC plays in current Firefox, Chrome and Safari), with track
  lists from the files' tags. The toolbar, display and track list stay the
  same: a second player provides the same playback state as the Spotify one.
  Spotify remains the fallback for albums I don't own, and becomes optional.

### Serving the music

Use an existing music server rather than writing one:
[Navidrome](https://www.navidrome.org/) (open source, light enough for a NAS
or a small server). It scans the folders, reads tags, serves covers,
transcodes for mobile, and speaks the **Subsonic API**, the shared standard of
many music players. FliTunes becomes one more Subsonic client, and stays a
static app with no backend of its own. `library.json` stays the source of
truth; each album records the matching server album.

Set aside: plain files on a web server with a script that lists the tracks
as JSON. Simpler on paper, but authentication, transcoding and covers would
all be ours to build.

Constraints:
- The site is served over HTTPS, so the music server must be reachable over
  HTTPS and allow the site's origin (CORS). A private network such as
  Tailscale avoids exposing it publicly.
- Purchases stay manual: Bandcamp has no public API for a fan's collection,
  and a hand-curated library fits manual downloads.

### Steps

Each step is useful before the next exists:

1. **Ownership:** an owned field (how I have the album) and a store link,
   editable in Get Info, with a "not owned yet" view.
2. **Covers kept:** a script that copies covers out of Spotify's CDN to
   storage I control, and rewrites the URLs.
3. **Own playback:** sign in to a Subsonic server, match albums, play owned
   albums from it, and fall back to Spotify for the rest.
4. **Spotify optional:** with most albums owned, the Spotify sign-in can stay
   off.
