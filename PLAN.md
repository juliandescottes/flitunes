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

## Phase 2

- [ ] Smart playlists (rule editor)
- [x] Type-ahead in lists (jumps by the sorted column)
- [ ] Cover Flow
- [x] Several Spotify links at once (Add Several sheet)
- [x] CSV import (e.g. a Last.fm top-albums export), with a play-count filter
- [ ] "Refresh cover" for dead cover URLs

## Later / maybe

- [ ] One-off import from Last.fm (`user.getTopAlbums`, needs an API key)
- [ ] Optional Spotify login for a one-off bulk import
