# Plan

See `docs/spec.md` for the details behind each item.

## Milestone 1: Storage foundation ✅

- [x] Spec & technical design
- [x] Svelte 5 + Vite + TS scaffold
- [x] Data model and deterministic `library.json` format with validation
- [x] IndexedDB store with unsaved-change tracking
- [x] Load `library.json` on startup (seeding, newer-file reload, conflict prompt)
- [x] Save to repo (dev plugin), download and import JSON
- [x] Unit tests (serialization, store)

## Milestone 2: Adding albums ✅

- [x] Parse Spotify album links/URIs (`open.spotify.com/album/…`, `spotify:album:…`, with `?si=` etc.)
- [x] Spotify oEmbed lookup: title + cover (swap to the 640px image URL)
- [x] Add-album form: paste link → prefilled fields → confirm/edit → save
- [x] Manual entry (no Spotify link)
- [x] Genre picker: autocomplete existing genres, or "create genre?" for a new name
- [x] Duplicate warning (same Spotify URI already in the library)

## Milestone 3: iTunes 10 window ✅

Reference: iTunes 10 (2010). See `docs/spec.md` §5.

- [x] Window chrome: top bar with LCD display, view switcher, search field; status bar
- [x] Source list: Music, Recently Added, Playlists (tags)
- [x] Column browser: Genres | Artists | Albums, with "All (N)" rows
- [x] List view: sortable columns (Name, Artist, Year, Genre, Rating, Date Added)
- [x] Album grid view
- [x] Instant search
- [x] Double-click / Enter opens the album in Spotify
- [x] "Add to Library…" opens the add form as a sheet

## Milestone 4: Get Info & editing ✅

- [x] Get Info dialog (⌘I): Info and Artwork tabs, edit all fields, delete
- [x] Multi-selection + Get Info for bulk genre/tags/rating
- [x] Inline star ratings in the list
- [x] Genre management (rename, delete, merge)
- [x] Unsaved-changes reminder polish

## Milestone 5: Spotify playback ✅

Optional sign-in, for playback only (§8). Spotify data is shown live, never saved.

- [x] Sign-in with OAuth PKCE, no backend (`VITE_SPOTIFY_CLIENT_ID`)
- [x] Transport buttons, and the display shows the playing track
- [x] Album tracks view; play an album from a track
- [x] Device menu; commands retried on an idle device
- [x] Debug log in the console (`[Spotify]`)

## Phase 2

- [x] Type-ahead in lists (jumps by the sorted column)
- [x] Several Spotify links at once (Add Several sheet)
- [x] CSV import (e.g. a Last.fm top-albums export), with a play-count filter
- [x] Album List view, Triage source, URL routes (Back/Forward)
- [x] Performance: virtualized lists, 3000 albums under 25 ms
- [x] Color themes (Pink, Silver, Mint Green, Fresh Blue, Lavender)
- [ ] Run your own FliTunes: README guide for forks, `LIBRARY_URL` (branch `run-your-own`)
- [ ] Strict validation when loading `library.json` (`spotify` URIs, `https:` covers)
- [ ] Smart playlists (rule editor)
- [ ] "Refresh cover" for dead cover URLs
- [ ] Cover Flow

## Long term: owning the music

Move the library off Spotify: DRM-free purchases served from my own music
server, FliTunes as the front end. See `docs/spec.md` §11.

- [ ] Ownership: an owned field and a store link (e.g. Bandcamp), with a "not owned yet" view
- [ ] Covers kept: copy covers out of Spotify's CDN to storage I control
- [ ] Own playback: a Subsonic client (e.g. Navidrome), Spotify as the fallback
- [ ] Spotify optional

## Small open threads

- [ ] Spotify: first command after idle sometimes does nothing (waiting for a `[Spotify]` log)
- [ ] Track lists for playlist links (albums only for now)
- [ ] Theme picker in narrow windows (the sidebar is hidden)
- [ ] A dark theme (needs its own palette, not only a tint)

## Done another way

- One-off import from Last.fm: through the CSV import.
- Spotify login for a bulk import: replaced by `scripts/spotify-history/` on the listening-history export.
