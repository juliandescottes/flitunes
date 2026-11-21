# Adding albums

## Purpose

Bring albums into the library by hand: one at a time with an optional
Spotify link that fills the title and cover, several at once from a list
of Spotify links, or from a CSV file such as a listening history export.

## Behavior

### Add to Library

- `adding-albums.open` "+ Add Album(s)" at the bottom of the source list
  (the "+" button of the status bar on narrow windows) opens the Add to
  Library sheet. Cancel or `Escape` closes it without adding anything, and
  the sheet starts empty the next time.
- `adding-albums.fields` Title and Artist are required. Several artists
  are typed separated by ";", and Compilation fills in "Various Artists".
  The year is a whole number, or empty: anything else shows "Year must be
  a number" and nothing is added. Genres and Playlists are chips, as in
  Get Info. The Cover URL shows as a preview.
- `adding-albums.spotify-lookup` A Spotify album or playlist link pasted
  in the Spotify link field fills in the title and the cover from Spotify.
  If the lookup fails, the sheet says so and the fields can still be
  filled by hand. Text that isn't an album or playlist link shows "Not a
  Spotify album or playlist link."
- `adding-albums.duplicate` When an album of the library already has
  that link, the sheet names it ("Already in the library: Artist —
  Title") and the Add button becomes Add Anyway.
- `adding-albums.added` Adding closes the sheet and shows the new album
  in Music, with the search and the column picks cleared, the album
  selected. It counts as one unsaved change, and shows in Recently Added.
- `adding-albums.keep-cover` On the dev server, the cover of a new album
  is copied into the library's covers folder, and the album then points
  to that file instead of the address.

### Add Several

- `adding-albums.several-open` Add Several… in the sheet, or pasting more
  than one Spotify link in the Spotify link field, switches to Add Several
  Albums, keeping the links. Add One… goes back.
- `adding-albums.several-links` Links go one per line (spaces or commas
  work too). The sheet counts them, ignoring repeated ones, and lists the
  pieces that aren't album or playlist links as skipped. Look Up is
  disabled until there is a link.
- `adding-albums.several-review` Look Up lists one row per link, with the
  title and cover from Spotify; the artist and year are typed in each row.
  A row whose lookup failed asks to type the name. Links already in the
  library are marked "Already in the library" and start unticked. Only
  ticked rows are added, and their Name and Artist are required. The
  genres and playlists chosen below the rows apply to all of them. Back
  returns to the links.
- `adding-albums.several-added` "Add N Albums" adds the ticked rows as
  one unsaved change, and shows them in Music, all selected.

### Import CSV

- `adding-albums.csv-columns` Import CSV… reads a CSV file whose first
  row names the columns. It needs an album column ("album", "title",
  "name"…) and an artist column ("artist", "album artist"…); year, plays
  and a Spotify link are used when present. Rows without an album or an
  artist are skipped. A file without those columns shows "Expected a
  header row with "album" and "artist" columns".
- `adding-albums.csv-pick` Every row starts unticked. Clicking a row, or
  its checkbox, ticks it. Tick All Shown ticks the rows shown, except
  those already in the library (same first artist and title, ignoring
  case, accents and a leading "The", or the same Spotify link), which are
  marked "Already in the library". Untick All unticks them all.
- `adding-albums.csv-plays` When the file has plays, "Show albums with at
  least N plays" hides the rows with fewer, and the sheet says how many
  rows are shown out of all. Hidden rows aren't added, even when ticked.
- `adding-albums.csv-added` "Add N Albums" adds the ticked rows shown,
  with the genres and playlists chosen below them, as one unsaved change,
  and shows them in Music, all selected. Back returns to choosing a file.

## UI and shortcuts

- "+ Add Album(s)" at the bottom of the source list; on narrow windows,
  "+" in the status bar.
- The sheet slides down from the toolbar. Add Several… and Import CSV…
  are links in its top right corner.
