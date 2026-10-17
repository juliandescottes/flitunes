# Album Library — Spec & Technical Design (draft v2)

Status: draft, 2026-10-17. Personal tool, single user.

## 1. Why

Spotify is built around playlists and tracks. I listen to albums. I want an
iTunes-style library: albums browsed by artist, genre and my own tags, with one
click to open/play the album in Spotify.

## 2. Principles

- **I curate the library by hand.** Spotify is not the source of truth. Each
  album just *links* to Spotify.
- **Local-first, no backend.** A static web app. The working copy lives in
  IndexedDB, and a JSON snapshot is committed to the repo for durability and history.
- **No Spotify login required.** Everything in the MVP works with public,
  unauthenticated endpoints. This avoids the Development Mode / Premium /
  endpoint-churn problems of the Spotify Web API entirely.

## 3. Non-goals (for now)

- Importing my Spotify library automatically.
- Controlling Spotify playback (play/pause/devices).
- Track-level curation, playlists, multi-user, hosting for others.

## 4. Core concepts

| Concept | Notes |
|---|---|
| **Album** | The core unit: title, artist(s), year, cover, Spotify link, genres, tags, rating, notes. |
| **Edition** | Each edition (original, deluxe, remaster, …) is its own album entry with its own Spotify link. There's no grouping. |
| **Artist** | Plain names on the album, plus an optional sort name ("Beatles, The"). There's no separate artist entity in v1. Compilations use a single artist called **"Various Artists"**, which shows up in the artist column like any other artist. |
| **Genre** | Flat, curated vocabulary that I manage myself, with no hierarchy. One primary genre and optional secondaries. iTunes' genre is only a suggestion: it prefills when it matches an existing genre, and otherwise offers "create genre?". |
| **Tag** | Free-form (`winter`, `vinyl-owned`, `to-listen`, …). |
| **Smart collection** | A saved filter (phase 2), e.g. `genre=Jazz AND year<1970 AND rating>=4`. |

## 5. Features

### MVP
1. **Add album**: paste a Spotify album link.
   - Fetch the title and cover via Spotify oEmbed (no auth, see §7).
   - The artist / year / genre fields are prefilled from an iTunes Search lookup
     (no auth). I confirm or edit before saving.
   - Manual entry is always possible, including albums with no Spotify link.
2. **Browse**
   - Cover grid, sortable by artist / title / year / date added.
   - iTunes-style column browser: **Genre → Artist → Album**.
   - Sidebar: All albums, Recently added, Tags.
3. **Album detail**: cover, metadata, tags, rating, notes, **Open in Spotify**.
4. **Edit**: all fields, plus bulk-edit genre/tags on a multi-selection.
5. **Search/filter** over the local library (instant, in-memory).
6. **Persistence**: IndexedDB working copy, plus export/import of JSON (§6).

### Phase 2
- Smart collections with a rule editor.
- Keyboard navigation (arrows, type-ahead, Enter = open in Spotify).
- Optional embedded Spotify player (iframe) in the album detail view.
- "Refresh cover" action to re-fetch a dead cover URL via oEmbed/iTunes.

### Later / maybe
- "Random album" from the current filter.
- Optional Spotify login (PKCE) for one-off bulk import of saved albums and/or
  real playback control (`PUT /me/player/play`, Premium only).
- Track lists.

## 6. Storage & persistence

```
IndexedDB (working copy)  ──export──▶  library.json (committed to repo)
                          ◀──import──
```

- **IndexedDB** via Dexie. Every edit is saved immediately.
- **`library.json`** in the repo is the durable copy. Git gives history and diffs.
- **First run / empty DB**: the app loads the `library.json` bundled with the
  build, so a fresh browser or machine starts with my library.
- **Export options:**
  1. *Download JSON*. Works in every browser; I move the file into the repo myself.
  2. *Save to repo* (dev mode only). A tiny Vite dev-server plugin exposes
     `POST /__library` and writes `library.json` straight into the repo. One click,
     any browser, and nothing exists in production builds. **← recommended**
  3. File System Access API (`showSaveFilePicker`) is Chromium-only. Skip it.
- **Conflict safety**: the export includes `exportedAt`. On startup, if the
  bundled `library.json` is newer than the last local edit, offer to load it.
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
| **iTunes Search API**<br>`https://itunes.apple.com/search?entity=album&term=…` | artist, album, release date, **primary genre**, track count, artwork (resizable to 600×600+ by editing the URL) | Prefill artist/year/genre; fallback cover. |
| **Cover Art Archive** (MusicBrainz) | high-res covers by release MBID | Optional fallback for obscure releases. |

oEmbed does **not** return the artist, which is why the iTunes lookup exists.
These are undocumented-ish public endpoints. Treat them as conveniences: the
user can always type or paste values, including a manual cover URL.

## 8. "Play in Spotify"

- **Open in Spotify** button links to `spotify:album:<id>`, which opens the desktop
  app on the album. A secondary link to `https://open.spotify.com/album/<id>` opens the web player.
- The link opens the album page, not playback. That's acceptable for v1. Real
  "press play" needs the Web API + Premium (see Later).

## 9. Tech stack

- **Svelte 5 + Vite + TypeScript** (plain Vite app, no SvelteKit). Static build,
  deployable to GitHub Pages if ever wanted.
- **Dexie** for IndexedDB, wrapped in a small store module that exposes Svelte
  runes-based reactive state to the UI.
- No backend. Only the dev-server plugin writes `library.json`.
- Covers: stored as URLs only, relying on the browser's HTTP cache. No image files in the repo.

## 10. Decisions

The decisions log lives in `STATUS.md`.
