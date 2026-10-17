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

## Milestone 2: Adding albums

- [ ] Parse Spotify album links/URIs (`open.spotify.com/album/…`, `spotify:album:…`, with `?si=` etc.)
- [ ] Spotify oEmbed lookup: title + cover (swap to the 640px image URL)
- [ ] iTunes Search lookup: suggest artist, year and genre, with a fallback cover
- [ ] Add-album form: paste link → prefilled fields → confirm/edit → save
- [ ] Manual entry (no Spotify link)
- [ ] Genre picker: suggest existing genres, or offer "create genre?" for the iTunes genre
- [ ] Duplicate warning (same Spotify URI already in the library)

## Milestone 3: Browsing

- [ ] App layout: sidebar, column browser, main view
- [ ] Cover grid (virtualized if needed), sortable by artist / title / year / added
- [ ] Column browser: Genre → Artist → Album
- [ ] Sidebar: All albums, Recently added, Tags
- [ ] Instant search/filter over the library
- [ ] "Open in Spotify" (`spotify:` URI) + web player link

## Milestone 4: Editing

- [ ] Album detail view: cover, metadata, tags, rating, notes
- [ ] Edit all fields, delete album
- [ ] Multi-select + bulk edit genre/tags
- [ ] Genre management (rename, delete, merge)
- [ ] Unsaved-changes reminder polish

## Phase 2

- [ ] Smart collections (saved filters + rule editor)
- [ ] Keyboard navigation (arrows, type-ahead, Enter = open in Spotify)
- [ ] Embedded Spotify player (iframe) in album detail
- [ ] "Refresh cover" for dead cover URLs

## Later / maybe

- [ ] Random album from current filter
- [ ] One-off import from Last.fm (`user.getTopAlbums`, needs an API key)
- [ ] Optional Spotify login for bulk import / playback control
- [ ] Track lists
