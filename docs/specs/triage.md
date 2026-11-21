# Triage

## Purpose

Review albums imported in bulk (from a listening history, see
`scripts/spotify-history/`) before they join the library: accept the
ones worth keeping, delete the others.

## Behavior

- `triage.source` Albums with the "triage" playlist tag are waiting for
  review. Triage, in the Library section of the source list, shows them
  with their count. It's listed only while albums are waiting, or while
  it's selected. Waiting albums are left out of Music, Recently Added and
  the playlists, and "triage" isn't listed as a playlist.
- `triage.bar` In Triage, a bar above the column browser says "Imported
  albums waiting for review. Accept keeps them in your library, Delete
  removes them." Its Accept and Delete buttons are disabled until an
  album is selected.
- `triage.accept` Accept, `⌘Enter` in the main view, or Accept into
  Library (Accept N Albums for several) in the album menu removes the
  selected albums from triage, as one unsaved change: they join Music,
  with their other playlists. The album after them is then selected.
- `triage.delete` Delete in the bar asks before removing the selected
  albums from the library, like deleting albums elsewhere.
- `triage.done` Once every album is reviewed, Triage says "Nothing left
  to review." and stays in the source list until another source is
  selected.

## UI and shortcuts

- Triage shows under Music and Recently Added, with the number of albums
  waiting.
- `⌘Enter` accepts the selection, `Delete` / `Backspace` deletes it.
