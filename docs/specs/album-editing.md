# Album editing

## Purpose

Curate albums by hand: fix their details, file them under genres and
playlists, rate them, and remove the ones that don't belong.

## Behavior

### Get Info

- `album-editing.open` `⌘I`, or Get Info in an album's context menu, opens
  Get Info for the selected albums: the album's own window, titled with
  its name, for one album, "Multiple Item Information" for several.
  Right-clicking an album outside the selection selects it first.
- `album-editing.fields` The Info tab has Name, Artist, Sort Artist, Year,
  Genres, Rating, Playlists, Spotify and Comments. Several artists are
  typed in the Artist field separated by ";".
- `album-editing.ok-cancel` Edits are applied with OK, or `Enter` in the
  Name, Artist, Sort Artist, Year or Spotify field. Cancel, the close button and `Escape` close the window and
  discard them.
- `album-editing.required` Name and Artist can't be empty: OK does nothing
  until they are filled.
- `album-editing.year` The year is a whole number, or empty. Anything else
  shows "Year must be a number" and nothing is applied.
- `album-editing.spotify-link` The Spotify field takes an album or playlist
  link, as an `open.spotify.com` address or a `spotify:` URI. Any other
  text shows "The Spotify link is not an album or playlist link." and
  nothing is applied. An empty field removes the link.
- `album-editing.previous-next` Previous and Next apply the edits, then
  show the previous or next album of the main view and select it. They are
  disabled at the start and the end of the view.
- `album-editing.artwork` The Artwork tab shows the cover and its URL,
  which can be edited or removed. Use Spotify Cover fetches the cover of
  the album's Spotify link.

### Genres and playlists

- `album-editing.genre-chips` An album's genres show as chips; the first
  one is the primary genre, highlighted, and the one shown in the Genre
  column. Clicking another genre makes it primary. A chip's × removes it,
  and so does `Backspace` in the empty field after the chips.
- `album-editing.genre-add` Typing a genre name and pressing `Enter` (or
  the button next to the field) adds the existing genre with that name,
  ignoring case and punctuation. An unknown name offers "Create “Name”",
  which creates the genre.
- `album-editing.chip-suggestions` The genre and playlist fields suggest
  the existing names as you type; picking a suggestion adds it right away,
  without `Enter`.
- `album-editing.playlist-chips` Playlists work like genres, without a
  primary one. A name matching an existing playlist, ignoring case, adds
  that playlist; another name offers "New playlist “Name”".

### Several albums

- `album-editing.multi-apply` In Multiple Item Information, each field
  (Artist, Sort Artist, Year, Genres, Rating) has a checkbox, ticked as
  soon as the field is edited, and only ticked fields are applied to every
  album. A field shows the albums' value when they all share it, and
  "Mixed" otherwise.
- `album-editing.multi-playlists` "Add to" adds playlists to every album,
  "Remove from" removes playlists from every album that has them.

### Ratings

- `album-editing.rating` Clicking a star in the list's Rating column rates
  the album from 1 to 5 stars; clicking its current rating clears it.
  Unrated albums show the empty stars while hovered or selected.

### Deleting

- `album-editing.delete` `Delete` or `Backspace` in the main view, Delete
  from Library in the context menu, or Delete in Get Info asks for
  confirmation, then removes the selected albums. The album shown after
  them (else before them) is selected.

## UI and shortcuts

- Get Info is a window over the library, with Info and Artwork tabs and
  Delete, Previous, Next, Cancel and OK buttons.
- `⌘I` Get Info, `Delete` / `Backspace` delete, right-click for the album
  menu.
