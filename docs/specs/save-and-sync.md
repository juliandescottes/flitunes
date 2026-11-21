# Save and sync

## Purpose

Keep the library safe while curating: every edit is kept in the browser
right away, and Save writes `library.json`, the copy that counts, to the
data repository. On the dev server, Save writes the local clone; on the
site, it commits to GitHub.

## Behavior

### Unsaved changes

- `save-and-sync.local-copy` Every change is kept in this browser as soon
  as it's made, and is still there after a reload.
- `save-and-sync.unsaved` Each change counts as unsaved until the library
  is saved or exported. The window title then reads "FliTunes (N
  unsaved)", and the display, with no album selected, says "N unsaved
  changes" ("All changes saved" once there are none).

### Saving

- `save-and-sync.save` Save, at the bottom of the source list, or `⌘S`
  writes `library.json` and resets the unsaved changes. Save is disabled,
  and `⌘S` does nothing, while there are no unsaved changes. Save shows
  only where the library can be written: the dev server, or a site whose
  library is on GitHub.
- `save-and-sync.export` Export downloads the library as
  `library.json`, which counts as saved.
- `save-and-sync.import` Import asks "Replace the whole local library with
  this file?", then replaces the library with the chosen `library.json`.
  A file that isn't a valid library shows why, and changes nothing.
- `save-and-sync.errors` Errors show in a banner under the toolbar, which
  OK dismisses.

### Opening

- `save-and-sync.newer-file` On opening, a `library.json` newer than the
  one the local copy is based on replaces the local copy, when it has no
  unsaved changes.
- `save-and-sync.conflict` When `library.json` is newer and the local copy
  has unsaved changes, a banner says "library.json is newer than your
  local copy, but you have N unsaved changes." Load library.json replaces
  the local copy with it, losing those changes; Keep Local Copy keeps
  them, and the next Save overwrites the file.

### On the site (GitHub)

- `save-and-sync.github-token` The first Save asks for a GitHub token,
  naming the repository it commits to. The token is checked before it's
  kept in this browser: a token GitHub rejects, one without access to the
  repository or one that can't write to it is refused with the reason.
  Once the token is accepted, the save goes on.
- `save-and-sync.github-commit` Save commits `library.json` to the
  repository with the message "Update library (N changes)".
- `save-and-sync.github-token-menu` Right-clicking Save offers Change
  GitHub Token… and Forget GitHub Token (disabled without a token). A
  changed token is checked like the first one, then the save goes on.
  Save is disabled without unsaved changes, so the menu is only there
  while some are waiting. _(to confirm)_
- `save-and-sync.github-rejected` When GitHub no longer accepts the kept
  token, Save asks for a new one: "GitHub rejected the saved token. Paste
  a new one."
- `save-and-sync.github-conflict` When `library.json` changed on GitHub
  since it was read and is newer than the local copy's base, Save shows
  the conflict banner instead of overwriting it.

## UI and shortcuts

- Save, Export, Import and the theme swatch at the bottom of the source
  list; on narrow windows, Save, Export and Import in the status bar.
- `⌘S` saves.
