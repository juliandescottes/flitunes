# Genres

## Purpose

Keep the genre list curated: genres are a flat list shared by every
album, renamed, merged or deleted from the column browser. (Albums are
filed under genres in Get Info and when adding them.)

## Behavior

- `genres.rename` Double-clicking a genre in the Genres column, or Rename
  Genre in its context menu, edits its name in place. `Enter`, or leaving
  the field, renames it; `Escape` cancels. Its albums stay filed under
  it, with the new name. An empty or unchanged name changes nothing.
- `genres.merge` Renaming a genre to the name of another one (ignoring
  case) asks "A genre named “Other” already exists. Merge “Genre” into
  it?". OK files every album of the renamed genre under the other one
  and removes the renamed genre; the Genres column then picks the other
  one. Cancel changes nothing.
- `genres.delete` Delete Genre… in a genre's context menu asks "Delete
  the genre “Genre”? It will be removed from N albums." and then removes
  it from the list and from those albums.
- `genres.menu-picks` Right-clicking a genre picks it in the Genres
  column, then opens its menu.

## UI and shortcuts

- Double-click a genre to rename it; right-click it for Rename Genre and
  Delete Genre….
