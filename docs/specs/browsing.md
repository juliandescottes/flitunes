# Browsing

## Purpose

Find albums in the library the way iTunes 10 did: pick a source, narrow it
with the column browser and the search field, and look at the result as a
list or a grid of covers.

## Behavior

### Sources

- `browsing.music` Music shows every album, except the albums waiting in
  triage.
- `browsing.recently-added` Recently Added shows the albums added in the
  last 30 days.
- `browsing.playlists` Playlists are the playlist tags in use outside
  triage, sorted by name. Selecting one shows the albums tagged with it.
  When no album has a playlist, the section says "Tag albums to make
  playlists."
- `browsing.source-resets-columns` Selecting a source resets the column
  browser to All in every column.

### Column browser

- `browsing.columns` Three columns, Genres, Artists and Albums, list the
  values found in the albums of the source, after the search and the link
  filter. Each column starts with "All", followed by the number of
  entries ("All (3 Artists)", "All (1 Genre)").
- `browsing.column-narrowing` Picking a genre narrows the Artists and
  Albums columns to that genre and resets their picks; picking an artist
  narrows the Albums column and resets its pick. The main view shows the
  albums that match every pick. An album with several genres or artists
  is listed under each of them.
- `browsing.column-order` Genres are sorted by name, artists by their sort
  name (an album's Sort Artist, else the name without a leading "The"),
  album titles by name without a leading "The".
- `browsing.album-editions` Editions sharing a title are one entry in the
  Albums column, and picking it shows all of them.
- `browsing.stale-pick` A pick that is no longer listed, for example after
  a search, counts as All.
- `browsing.column-keyboard` In a focused column, the up and down arrows
  move the pick.
- `browsing.column-open-album` Double-clicking an album title, or `Enter`
  in the Albums column, opens the first shown edition that has a Spotify
  link (see [album opening](#opening-albums)).
- `browsing.column-resize` Dragging the bottom edge of the column browser
  resizes it; with that edge focused, the up and down arrows resize it by
  10 pixels, 50 with `shift`. The album list always keeps 100 pixels.
  The height is remembered in this browser.

### Search and filter

- `browsing.search` Every word typed in the search field must appear in
  the album's title, artists, year, genres or playlists, ignoring case and
  accents.
- `browsing.search-clear` `Escape` in the search field, or its clear
  button, empties it.
- `browsing.search-focus` `⌘F` focuses the search field, its text
  selected, unless a sheet or Get Info is open.
- `browsing.link-filter` The link toggle in the toolbar hides the albums
  without a Spotify link. While it's on, the status bar says "albums
  without a Spotify link hidden". The setting is remembered in this
  browser.

### Main view

- `browsing.views` The main view is a List, an Album List (the list with
  each album's cover) or a Grid of covers with the title and artist. Album
  List is the default; the choice is remembered in this browser.
- `browsing.sort` Clicking a column header of the list sorts by that
  column; clicking it again reverses the order. Rating and Date Added
  start in descending order, the other columns in ascending order. The
  sort is remembered in this browser, and the grid uses it too.
- `browsing.sort-names` Sorting by Artist uses the album's Sort Artist,
  else its first artist without a leading "The". Sorting by Name ignores
  a leading "The".
- `browsing.sort-missing-last` Albums without a value in the sorted column
  (year, genre, rating) come last in both directions.
- `browsing.sort-ties` Albums with the same value are ordered by artist,
  then year, then title.
- `browsing.empty` An empty library says "Your library is empty. Click +
  to add an album." When albums exist but none match, the view says "No
  albums match."
- `browsing.status-count` The status bar shows the number of albums shown,
  and the number selected when more than one is.
- `browsing.display` The display at the top shows the selected album's
  title, artists and year; with several selected, how many; with none,
  "FliTunes" and the number of unsaved changes. While Spotify plays, it
  shows the track instead (see the Spotify spec, not written yet).

### Selection

- `browsing.select-click` Clicking an album selects it alone. `⌘`-click
  adds it to the selection or removes it. `shift`-click selects the range
  from the last album clicked without `shift`.
- `browsing.select-keyboard` In the list, the up and down arrows move the
  selection; in the grid, the left and right arrows move by one album and
  up and down by one row. With `shift`, they extend the selection.
- `browsing.select-all` `⌘A` selects every album shown, while the focus is
  in the main view.
- `browsing.type-ahead` Typing letters in the main view selects the first
  album whose sorted column starts with them, ignoring case and accents.
  Letters typed within a second of each other add up. When sorted by
  Rating or Date Added, the name is matched.

### Opening albums

- `browsing.open` Double-clicking an album, or `Enter` with one album
  selected, opens it: its track list while signed in to Spotify (albums
  only, not playlists), otherwise the Spotify app. An album without a
  Spotify link does nothing.
- `browsing.play-button` Albums with a Spotify link have a play button,
  in the Name column of the list and over the cover in the grid. It plays
  the album while signed in to Spotify, otherwise opens it in the Spotify
  app.

## UI and shortcuts

- Source list on the left (hidden on narrow windows), column browser above
  the main view, search field and view buttons on the right of the
  toolbar, album count in the status bar.
- `⌘F` search, `⌘A` select all, arrows and `shift`+arrows to move or extend
  the selection, `Enter` to open.
